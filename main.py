import os
import shutil
import re
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Response, Request
from fastapi.responses import HTMLResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from storage import (
    upload_uploadfile,
    upload_local_file,
    list_prefix,
    delete_blob,
    delete_prefix,
    stream_blob,
)
from typing import List, Optional
import time
from fastapi import Body
from main_pipeline import start_full_processing, extrair_titulo_do_resumo, setup_logging
from websocket_manager import ConnectionManager
from sqlalchemy.ext.asyncio import AsyncSession
from db import SessionLocal, init_db, User, RefreshToken
from db_iam import (
    iam_fetch_user_by_email,
    iam_create_user,
    iam_update_last_login,
    iam_insert_refresh_token,
    iam_find_valid_refresh_tokens,
    ensure_schema,
    iam_fetch_user_by_id,
)
from auth import hash_password, verify_password, create_access_token, decode_access_token, generate_refresh_token, verify_refresh_token
from email.utils import parseaddr
import datetime
import secrets
import httpx
import asyncio

# Carregar variáveis do arquivo .env (se existir)
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = FastAPI()

# Configurar logging
setup_logging()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://localhost:8002",
        "http://127.0.0.1:8002",
        "http://resumefull.com.br",
        "https://resumefull.com.br",
        "http://resumefull.com.br:8001",
        "http://resumefull.com.br:8002",
        "http://www.resumefull.com.br",
        "https://www.resumefull.com.br",
        "http://www.resumefull.com.br:8001",
        "http://www.resumefull.com.br:8002",
        # Domínios resumopro (produção)
        "http://resumopro.com.br",
        "https://resumopro.com.br",
        "http://www.resumopro.com.br",
        "https://www.resumopro.com.br"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/static", StaticFiles(directory="static"), name="static")
# app.mount("/temp_uploads", StaticFiles(directory="temp_uploads"), name="temp_uploads")

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

UPLOAD_DIR = "temp_uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

ARQUIVO_PDF_FINAL = "Resumo_Final_Com_Prints.pdf"

# Diretório para estados salvos do editor (projetos)
EDITOR_STATES_DIR = os.path.join(UPLOAD_DIR, "editor_states")
if not os.path.exists(EDITOR_STATES_DIR):
    os.makedirs(EDITOR_STATES_DIR, exist_ok=True)

def _slugify_name(name: str) -> str:
    """Cria um slug seguro para nomes de projeto (apenas letras, números, hífens e underscore)."""
    if not isinstance(name, str):
        name = str(name or "")
    base = name.strip().lower()
    # Substitui espaços e separadores por hífen
    base = re.sub(r"[\s/\\]+", "-", base)
    # Remove caracteres não permitidos
    base = re.sub(r"[^a-z0-9._-]", "", base)
    # Evita vazio
    if not base:
        base = f"projeto-{int(time.time())}"
    # Limita tamanho razoável
    return base[:64]

def normalize_to_markdown(raw_text: str) -> str:
    lines = raw_text.splitlines()
    processed_lines = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Detectar tabelas por tabs
        if '\t' in line:
            # NOVO: Verificar se é uma lista numerada antes de processar como tabela
            if re.match(r'^\s*\d+\.\s*', line.strip()):
                # É uma lista numerada, não processar como tabela
                processed_lines.append(line)
                i += 1
                continue
                
            table_block_lines = []
            while i < len(lines) and '\t' in lines[i]:
                table_block_lines.append(lines[i].strip())
                i += 1

            if table_block_lines:
                # NOVO: Verificar se é uma sequência de listas numeradas
                if _is_numbered_list_sequence(table_block_lines):
                    # Manter como lista numerada, não converter para tabela
                    for list_line in table_block_lines:
                        processed_lines.append(list_line)
                    processed_lines.append("")
                    continue
                
                header_columns = table_block_lines[0].split('\t')
                num_columns = len(header_columns)
                processed_lines.append("| " + " | ".join(header_columns) + " |")
                processed_lines.append("|" + "---|"*num_columns)
                for data_row_text in table_block_lines[1:]:
                    row_columns = data_row_text.split('\t')
                    row_columns = [col.strip() for col in row_columns] + [''] * (num_columns - len(row_columns))
                    processed_lines.append("| " + " | ".join(row_columns) + " |")
                processed_lines.append("")
                continue

        # Detectar tabelas por múltiplos espaços (dados alinhados)
        if _is_tabular_data(line):
            table_block_lines = []
            while i < len(lines) and _is_tabular_data(lines[i].strip()):
                table_block_lines.append(lines[i].strip())
                i += 1

            if table_block_lines and len(table_block_lines) > 1:
                # NOVO: Verificar se é uma sequência de listas numeradas
                if _is_numbered_list_sequence(table_block_lines):
                    # Manter como lista numerada, não converter para tabela
                    for list_line in table_block_lines:
                        processed_lines.append(list_line)
                    processed_lines.append("")
                    continue
                
                # Processar como tabela
                processed_lines.extend(_format_tabular_data_as_table(table_block_lines))
                processed_lines.append("")
                continue

        # Detectar tabelas por padrões de dados estruturados
        if _is_structured_data(line):
            table_block_lines = []
            while i < len(lines) and _is_structured_data(lines[i].strip()):
                table_block_lines.append(lines[i].strip())
                i += 1

            if table_block_lines and len(table_block_lines) > 1:
                # NOVO: Verificar se é uma sequência de listas numeradas
                if _is_numbered_list_sequence(table_block_lines):
                    # Manter como lista numerada, não converter para tabela
                    for list_line in table_block_lines:
                        processed_lines.append(list_line)
                    processed_lines.append("")
                    continue
                
                # Processar como tabela
                processed_lines.extend(_format_structured_data_as_table(table_block_lines))
                processed_lines.append("")
                continue
        
        if line.startswith(('-', '*')):
            processed_lines.append(line)
        elif 5 < len(line) < 70 and line[0].isupper() and (line.endswith(':') or line.endswith('.')):
            if not (i > 0 and lines[i-1].strip().startswith(('-', '*'))):
                processed_lines.append(f"## {line}")
            else:
                processed_lines.append(line)
        else:
            processed_lines.append(line)
        
        i += 1

    final_text = "\n".join([line for line in processed_lines if line is not None])
    return final_text.replace('\n\n\n', '\n\n')

def _is_tabular_data(line: str) -> bool:
    """Detecta se uma linha contém dados tabulares (múltiplos espaços, alinhamento)."""
    if not line or len(line.strip()) < 10:
        return False
    
    # PRIMEIRO: Verificar se já é uma tabela markdown válida
    # Se a linha já tem pipes e está formatada como tabela, não processar
    if '|' in line and line.count('|') >= 2:
        return False
    
    # NOVO: Verificar se é uma lista numerada (padrão: número + ponto + espaço)
    if re.match(r'^\s*\d+\.\s+', line.strip()):
        return False
    
    # NOVO: Verificar se é uma lista com marcadores (-, *, +)
    if re.match(r'^\s*[-*+]\s+', line.strip()):
        return False
    
    # NOVO: Verificar se é uma lista com números entre parênteses
    if re.match(r'^\s*\d+\)\s+', line.strip()):
        return False
    
    # Verificar se tem múltiplos espaços consecutivos (indicativo de alinhamento)
    spaces_count = len([m for m in re.finditer(r'  +', line)])
    if spaces_count >= 2:
        return True
    
    # Verificar padrões de dados numéricos alinhados
    if re.search(r'\d+\s+\d+', line):
        return True
    
    # Verificar se tem pelo menos 3 palavras e não é uma lista
    words = line.split()
    if len(words) >= 3 and not line.strip().startswith(('-', '*', '#')):
        # Verificar se não é um título ou cabeçalho
        if not (line[0].isupper() and line.endswith(':')):
            return True
    
    return False

def _is_structured_data(line: str) -> bool:
    """Detecta se uma linha contém dados estruturados (padrões como 'Campo: Valor')."""
    if not line or len(line.strip()) < 5:
        return False
    
    # PRIMEIRO: Verificar se já é uma tabela markdown válida
    # Se a linha já tem pipes e está formatada como tabela, não processar
    if '|' in line and line.count('|') >= 2:
        return False
    
    # NOVO: Verificar se é uma lista numerada (padrão: número + ponto + espaço)
    if re.match(r'^\s*\d+\.\s+', line.strip()):
        return False
    
    # NOVO: Verificar se é uma lista com marcadores (-, *, +)
    if re.match(r'^\s*[-*+]\s+', line.strip()):
        return False
    
    # NOVO: Verificar se é uma lista com números entre parênteses
    if re.match(r'^\s*\d+\)\s+', line.strip()):
        return False
    
    # Padrões comuns de dados estruturados
    patterns = [
        r'^\s*\w+\s*:\s*.+',  # Campo: Valor
        r'^\s*\w+\s*-\s*.+',  # Campo - Valor
        r'^\s*\w+\s*=\s*.+',  # Campo = Valor
    ]
    
    # Verificar se a linha tem um padrão de chave-valor claro
    for pattern in patterns:
        if re.match(pattern, line):
            # Verificar se não é apenas uma lista ou título
            if not line.strip().startswith(('-', '*', '#')):
                return True
    
    return False

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)

def _is_numbered_list_sequence(lines: list) -> bool:
    """Verifica se as linhas formam uma sequência de lista numerada."""
    if len(lines) < 2:
        return False
    
    # Verificar se pelo menos 70% das linhas são listas numeradas
    numbered_count = 0
    for line in lines:
        if re.match(r'^\s*\d+\.\s+', line.strip()):
            numbered_count += 1
    
    # Se a maioria das linhas são listas numeradas, é uma sequência de lista
    return numbered_count >= len(lines) * 0.7

def _format_tabular_data_as_table(table_lines: list) -> list:
    """Formata dados tabulares como tabela markdown."""
    if not table_lines or len(table_lines) < 2:
        return table_lines  # Não é uma tabela válida
    
    # Primeiro, tentar detectar se é realmente uma tabela
    if not _is_valid_table(table_lines):
        return table_lines
    
    # Tentar diferentes métodos de divisão
    result = _try_format_with_spaces(table_lines)
    if result:
        return result
    
    result = _try_format_with_words(table_lines)
    if result:
        return result
    
    # Se nada funcionou, retornar as linhas originais
    return table_lines

def _is_valid_table(table_lines: list) -> bool:
    """Verifica se as linhas formam uma tabela válida."""
    if len(table_lines) < 2:
        return False
    
    # Verificar se todas as linhas têm um padrão similar
    first_line_words = len(table_lines[0].split())
    for line in table_lines[1:]:
        if len(line.split()) < 2:
            return False
    
    return True

def _try_format_with_spaces(table_lines: list) -> list:
    """Tenta formatar usando espaços múltiplos."""
    # Encontrar posições de espaços múltiplos na primeira linha
    first_line = table_lines[0]
    space_positions = []
    
    for match in re.finditer(r'  +', first_line):
        space_positions.append(match.start())
    
    if len(space_positions) < 1:
        return None
    
    # Tentar dividir todas as linhas usando essas posições
    formatted_lines = []
    for i, line in enumerate(table_lines):
        columns = _split_by_space_positions(line, space_positions)
        if len(columns) >= 2:
            formatted_line = "| " + " | ".join(columns) + " |"
            formatted_lines.append(formatted_line)
            
            if i == 0:
                separator = "|" + "---|" * len(columns)
                formatted_lines.append(separator)
        else:
            return None  # Falhou
    
    return formatted_lines

def _split_by_space_positions(line: str, positions: list) -> list:
    """Divide uma linha usando posições de espaços."""
    columns = []
    last_pos = 0
    
    for pos in positions:
        if pos > last_pos and pos <= len(line):
            cell_content = line[last_pos:pos].strip()
            if cell_content:
                columns.append(cell_content)
            last_pos = pos
    
    # Adicionar o resto da linha
    if last_pos < len(line):
        cell_content = line[last_pos:].strip()
        if cell_content:
            columns.append(cell_content)
    
    return columns

def _try_format_with_words(table_lines: list) -> list:
    """Tenta formatar dividindo por palavras."""
    formatted_lines = []
    
    for i, line in enumerate(table_lines):
        words = line.split()
        if len(words) >= 2:
            formatted_line = "| " + " | ".join(words) + " |"
            formatted_lines.append(formatted_line)
            
            if i == 0:
                separator = "|" + "---|" * len(words)
                formatted_lines.append(separator)
        else:
            return None  # Falhou
    
    return formatted_lines


def _format_structured_data_as_table(table_lines: list) -> list:
    """Formata dados estruturados como tabela markdown."""
    if not table_lines:
        return []
    
    # Tentar extrair pares chave-valor
    key_value_pairs = []
    for line in table_lines:
        # Tentar diferentes padrões de separação
        for separator in [':', '-', '=']:
            if separator in line:
                parts = line.split(separator, 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip()
                    key_value_pairs.append((key, value))
                    break
    
    if len(key_value_pairs) < 2:
        return table_lines  # Não é uma tabela válida
    
    # Formatar como tabela
    formatted_lines = []
    formatted_lines.append("| Campo | Valor |")
    formatted_lines.append("|-------|-------|")
    
    for key, value in key_value_pairs:
        formatted_lines.append(f"| {key} | {value} |")
    
    return formatted_lines



manager = ConnectionManager()

async def cleanup_temp_files(manifest_path: str):
    print(f"[CLEANUP] Iniciando limpeza para manifesto: {manifest_path}")
    if not os.path.exists(manifest_path):
        print(f"[CLEANUP] Manifesto não encontrado: {manifest_path}")
        return

    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            files_to_delete = json.load(f)

        for item_path in files_to_delete:
            full_path = os.path.join(UPLOAD_DIR, item_path)
            if os.path.exists(full_path):
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path)
                    print(f"[CLEANUP] Diretório removido: {full_path}")
                else:
                    os.remove(full_path)
                    print(f"[CLEANUP] Arquivo removido: {full_path}")
            else:
                print(f"[CLEANUP] Arquivo/Diretório não encontrado durante a limpeza (já removido?): {full_path}")
    except Exception as e:
        print(f"[CLEANUP] Erro durante a limpeza do manifesto {manifest_path}: {e}")
    finally:
        if os.path.exists(manifest_path):
            os.remove(manifest_path)
            print(f"[CLEANUP] Manifesto removido: {manifest_path}")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    # Servir diretamente o painel principal
    return FileResponse("static/editor.html", media_type="text/html")

@app.get("/editor", response_class=HTMLResponse)
async def serve_editor():
    # Redirecionar para a raiz, que serve editor.html
    return RedirectResponse(url="/")

@app.get("/index.html", response_class=HTMLResponse)
async def redirect_legacy_index():
    # Redirecionar qualquer acesso antigo para a homepage
    return RedirectResponse(url="/")

@app.get("/favicon.ico")
async def favicon():
    # Servir favicon para evitar 404 no console
    try:
        return FileResponse("images/Logo_Favicon_ResumoFull.svg", media_type="image/svg+xml")
    except Exception:
        raise HTTPException(status_code=404, detail="Favicon não encontrado")

@app.get("/browse/uploads", response_class=HTMLResponse)
async def browse_uploads():
    """Retorna uma listagem HTML simples dos arquivos em Imagens_de_Uploads."""
    try:
        dest_dir = os.path.join(UPLOAD_DIR, "Imagens_de_Uploads")
        os.makedirs(dest_dir, exist_ok=True)
        items = []
        if os.path.isdir(dest_dir):
            for filename in sorted(os.listdir(dest_dir)):
                file_path = os.path.join(dest_dir, filename)
                if os.path.isfile(file_path):
                    items.append(filename)
        html_items = "\n".join(
            f'<li><a href="/temp_uploads/Imagens_de_Uploads/{fn}" target="_blank">{fn}</a></li>' for fn in items
        ) or '<li>Nenhum arquivo encontrado.</li>'
        html = f"""
        <!DOCTYPE html>
        <html lang=\"pt-BR\">
          <head>
            <meta charset=\"utf-8\" />
            <title>Uploads</title>
            <style>
              body {{ font-family: Arial, sans-serif; padding: 16px; }}
              ul {{ list-style: none; padding: 0; }}
              li {{ margin: 6px 0; }}
              a {{ color: #1a73e8; text-decoration: none; }}
              a:hover {{ text-decoration: underline; }}
            </style>
          </head>
          <body>
            <h2>Imagens de Uploads</h2>
            <ul>
              {html_items}
            </ul>
          </body>
        </html>
        """
        return HTMLResponse(content=html, status_code=200)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao listar uploads: {e}")


# Streaming dinâmico de arquivos de temp_uploads via Cloud Storage, com fallback local
@app.get("/temp_uploads/{path:path}")
async def stream_temp_uploads(path: str):
    # Priorizar arquivo local para reduzir latência e evitar timeouts
    local_path = os.path.join(UPLOAD_DIR, path)
    if os.path.isfile(local_path):
        return FileResponse(local_path)

    # Complementar com GCS quando não há arquivo local
    gcs_path = f"temp_uploads/{path}"
    try:
        return stream_blob(gcs_path)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

@app.get("/gcs/{path:path}")
async def stream_gcs(path: str):
    try:
        return stream_blob(path)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no GCS.")

@app.head("/temp_uploads/{path:path}")
async def head_temp_uploads(path: str):
    """Responder rapidamente a verificações de HEAD para PDFs e outros arquivos."""
    local_path = os.path.join(UPLOAD_DIR, path)
    if os.path.isfile(local_path):
        return Response(status_code=200)
    # Tentar verificar existência no GCS
    try:
        # Se stream_blob não lançar 404, considerar existente
        stream_blob(f"temp_uploads/{path}")
        return Response(status_code=200)
    except HTTPException:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")


@app.websocket("/ws/progress")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Cliente desconectado do WebSocket de progresso.")
    except Exception as e:
        print(f"Erro no WebSocket: {e}")


@app.post("/api/normalize-text")
async def normalize_text(request_data: dict):
    """
    Normaliza texto usando a função de normalização.
    """
    try:
        text = request_data.get('text', '')
        if not text:
            raise HTTPException(status_code=400, detail="Texto não fornecido")
        
        normalized_text = normalize_to_markdown(text)
        
        return {
            "normalized_text": normalized_text,
            "status": "success"
        }
    except Exception as e:
        print(f"Erro na normalização: {e}")
        raise HTTPException(status_code=500, detail="Erro interno na normalização do texto")

@app.post("/api/save-structured-summary")
async def save_structured_summary(request_data: dict):
    """Salva o resumo estruturado com formatação HTML completa."""
    try:
        markdown_content = request_data.get('markdown', '')
        # html_content é ignorado definitivamente — não geramos mais o arquivo HTML
        
        # Salvar apenas o Markdown quando houver conteúdo
        if markdown_content and markdown_content.strip():
            markdown_path = os.path.join(UPLOAD_DIR, "resumo_notebooklm_normalized.md")
            with open(markdown_path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            print(f"[TRACE] Resumo estruturado salvo (Markdown): {markdown_path}")
        else:
            print("[TRACE] Ignorado salvamento de Markdown vazio em /api/save-structured-summary")
        
        # Não gerar mais 'resumo_estruturado_formatado.html'
        return {"status": "success", "message": "Resumo estruturado salvo (HTML descontinuado)"}
    
    except Exception as e:
        print(f"Erro ao salvar resumo estruturado: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar resumo estruturado")

# --- ENDPOINTS: Estados do Editor (Projetos) ---

@app.post("/api/editor-state/save-image")
async def editor_state_save_image(file: UploadFile = File(...), project: str = Form(...), filename: Optional[str] = Form(None)):
    """Salva uma imagem (blob/data) dentro da pasta do projeto (captures/)."""
    try:
        slug = _slugify_name(project)
        project_dir = os.path.join(EDITOR_STATES_DIR, slug)
        captures_dir = os.path.join(project_dir, "captures")
        os.makedirs(captures_dir, exist_ok=True)

        base_name = filename or f"capture_{int(time.time()*1000)}.png"
        if not base_name.lower().endswith(".png") and not base_name.lower().endswith(".jpg") and not base_name.lower().endswith(".jpeg"):
            base_name = base_name + ".png"
        save_path = os.path.join(captures_dir, base_name)

        data = await file.read()
        with open(save_path, 'wb') as f:
            f.write(data)

        rel_path = f"/{UPLOAD_DIR}/editor_states/{slug}/captures/{base_name}"
        return {"status": "ok", "filename": base_name, "path": rel_path}
    except Exception as e:
        print(f"Erro ao salvar imagem do estado do editor: {e}")
        raise HTTPException(status_code=500, detail="Falha ao salvar imagem do projeto")

@app.post("/api/editor-state/save")
async def editor_state_save(request_data: dict = Body(...)):
    """Salva o estado do editor (HTML) associado a um nome de projeto."""
    try:
        name = request_data.get('name') or ''
        html = request_data.get('html') or ''
        pdf_name = request_data.get('pdf_name') or None
        gallery_images = request_data.get('gallery_images') or []  # nomes base em imagens_extraidas

        if not isinstance(name, str) or not name.strip():
            raise HTTPException(status_code=400, detail="Nome do projeto não fornecido")
        if not isinstance(html, str) or not html.strip():
            raise HTTPException(status_code=400, detail="Conteúdo HTML do editor vazio")

        slug = _slugify_name(name)
        project_dir = os.path.join(EDITOR_STATES_DIR, slug)
        images_dir = os.path.join(project_dir, "images")
        captures_dir = os.path.join(project_dir, "captures")
        os.makedirs(project_dir, exist_ok=True)
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(captures_dir, exist_ok=True)

        # Copiar imagens da galeria referenciadas para a pasta do projeto (images/)
        copied = []
        for base_name in gallery_images:
            try:
                base = str(base_name).split('/')[-1]
                src_path = os.path.join(UPLOAD_DIR, "imagens_extraidas", base)
                dst_path = os.path.join(images_dir, base)
                if os.path.exists(src_path):
                    shutil.copy2(src_path, dst_path)
                    copied.append(base)
            except Exception as ce:
                print(f"Aviso: falha ao copiar imagem de galeria '{base_name}' para projeto '{slug}': {ce}")

        # Salvar HTML
        html_path = os.path.join(project_dir, "resumo.html")
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)

        # Salvar metadados
        state = {
            "name": name,
            "slug": slug,
            "saved_at": int(time.time()*1000),
            "pdf_name": pdf_name,
            "images_copied": copied,
        }
        state_path = os.path.join(project_dir, "state.json")
        with open(state_path, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

        return {"status": "ok", "slug": slug, "project_path": f"/{UPLOAD_DIR}/editor_states/{slug}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao salvar estado do editor: {e}")
        raise HTTPException(status_code=500, detail="Falha ao salvar estado do editor")

@app.get("/api/editor-state/list")
async def editor_state_list():
    """Lista os projetos salvos com metadados básicos."""
    try:
        items = []
        if os.path.isdir(EDITOR_STATES_DIR):
            for entry in os.listdir(EDITOR_STATES_DIR):
                proj_dir = os.path.join(EDITOR_STATES_DIR, entry)
                if not os.path.isdir(proj_dir):
                    continue
                state_path = os.path.join(proj_dir, 'state.json')
                html_path = os.path.join(proj_dir, 'resumo.html')
                meta = {
                    "slug": entry,
                    "name": entry,
                    "saved_at": None,
                    "pdf_name": None,
                    "has_html": os.path.exists(html_path),
                }
                try:
                    if os.path.exists(state_path):
                        with open(state_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        meta.update({
                            "name": data.get('name') or entry,
                            "saved_at": data.get('saved_at'),
                            "pdf_name": data.get('pdf_name'),
                        })
                except Exception:
                    pass
                items.append(meta)
        return {"items": items, "count": len(items)}
    except Exception as e:
        print(f"Erro ao listar estados do editor: {e}")
        raise HTTPException(status_code=500, detail="Erro ao listar projetos salvos")

@app.get("/api/editor-state/{slug}")
async def editor_state_get(slug: str):
    """Carrega o estado do editor por slug."""
    try:
        s = _slugify_name(slug)
        proj_dir = os.path.join(EDITOR_STATES_DIR, s)
        if not os.path.isdir(proj_dir):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        state_path = os.path.join(proj_dir, 'state.json')
        html_path = os.path.join(proj_dir, 'resumo.html')
        meta = {}
        if os.path.exists(state_path):
            with open(state_path, 'r', encoding='utf-8') as f:
                meta = json.load(f)
        html_text = ""
        if os.path.exists(html_path):
            with open(html_path, 'r', encoding='utf-8') as f:
                html_text = f.read()
        return {"meta": meta, "html": html_text}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao carregar estado do editor: {e}")
        raise HTTPException(status_code=500, detail="Erro ao carregar projeto salvo")

@app.delete("/api/editor-state/{slug}")
async def editor_state_delete(slug: str):
    """Remove o projeto e seus arquivos."""
    try:
        s = _slugify_name(slug)
        proj_dir = os.path.join(EDITOR_STATES_DIR, s)
        if not os.path.isdir(proj_dir):
            raise HTTPException(status_code=404, detail="Projeto não encontrado")
        shutil.rmtree(proj_dir, ignore_errors=False)
        return {"status": "ok", "deleted": s}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao deletar estado do editor: {e}")
        raise HTTPException(status_code=500, detail="Erro ao remover projeto salvo")

@app.post("/api/processamento-full")
async def receive_files_and_text(
    background_tasks: BackgroundTasks,
    originalPdf: UploadFile = File(...),
    iaSummaryText: str = Form(...)
):
    """
    Recebe os arquivos, normaliza o resumo e inicia o pipeline em segundo plano.
    """
    
    # 1. NORMALIZAÇÃO E ARMAZENAMENTO DO RESUMO (ETAPA 2)
    try:
        normalized_summary_md = normalize_to_markdown(iaSummaryText)
        summary_filename = os.path.join(UPLOAD_DIR, "resumo_notebooklm_normalized.md")
        
        # Salvamento do Resumo
        with open(summary_filename, "w", encoding="utf-8") as f:
            f.write(normalized_summary_md)
        print(f"[TRACE] Resumo normalizado salvo em: {summary_filename}")
    except Exception as e:
        print(f"[ERRO FATAL] Normalização/Salvamento do Resumo: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar texto do resumo normalizado.")

    
    # 2. ARMAZENAMENTO DO ARQUIVO PDF (ETAPA 1)
    
    # --- CORREÇÃO DE SEGURANÇA NO NOME DO ARQUIVO PDF ---
    safe_pdf_filename = originalPdf.filename.replace('\\', '_').replace('/', '_')
    pdf_filename = os.path.join(UPLOAD_DIR, safe_pdf_filename)
    
    try:
        with open(pdf_filename, "wb") as buffer:
            shutil.copyfileobj(originalPdf.file, buffer)
        print(f"[TRACE] PDF original salvo em: {pdf_filename}")
    except Exception as e:
        print(f"[ERRO FATAL] Salvamento do PDF: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar o arquivo PDF.")
    
    # --- NOVO BLOCO DE IMPORTAÇÃO LOCAL ---
    # Importa a função APENAS quando é necessário executá-la
    from main_pipeline import start_full_processing, extrair_titulo_do_resumo 
    # --------------------------------------

    # --- 3. INJEÇÃO DA TAREFA NO BACKGROUND (INÍCIO DO PIPELINE) ---
    
    background_tasks.add_task(
        start_full_processing, 
        pdf_filename,            # caminho_pdf_input
        summary_filename,        # caminho_resumo_input
        UPLOAD_DIR,              # upload_dir
        ARQUIVO_PDF_FINAL,       # arquivo_pdf_output_name
        manager                  # Adicionar o manager aqui para comunicação WebSocket
    )
    
    # 4. RETORNO IMEDIATO
    return {"status": "processing", 
            "message": "Processamento iniciado em segundo plano."}


# --- ROTA PARA DOWNLOAD DO ARQUIVO FINAL ---
@app.get("/download-final-pdf/{filename}") # Rota dinâmica para o nome do arquivo
async def download_final_pdf(filename: str, background_tasks: BackgroundTasks):
    """Permite ao usuário baixar o PDF final e agenda a limpeza dos arquivos temporários."""
    file_path = os.path.join(UPLOAD_DIR, filename) # Usar o nome do arquivo dinâmico
    manifest_name = f"cleanup_manifest_{os.path.splitext(filename)[0]}.json" # Nome do manifesto baseado no PDF
    manifest_path = os.path.join(UPLOAD_DIR, manifest_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="O arquivo final ainda não está pronto ou não existe.")
    
    response = FileResponse(path=file_path, filename=filename, media_type='application/pdf')
    
    # Agendar a limpeza após o download
    background_tasks.add_task(cleanup_temp_files, manifest_path)
    print(f"[DOWNLOAD] Download de {filename} iniciado. Limpeza de arquivos temporários agendada.")
    
    return response

# --- NOVAS ROTAS PARA O EDITOR SEMÂNTICO ---

@app.get("/api/get-preview-data")
async def get_preview_data():
    """Retorna os dados necessários para a interface de preview."""
    try:
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        if os.path.exists(estrutura_path):
            with open(estrutura_path, 'r', encoding='utf-8') as f:
                estrutura = json.load(f)
            
            # Carregar informações das imagens se disponível
            imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
            info_file_path = os.path.join(imagens_dir, 'imagens_info.json')
            if os.path.exists(info_file_path):
                with open(info_file_path, 'r', encoding='utf-8') as f:
                    estrutura["imagens_info"] = json.load(f)
            else:
                estrutura["imagens_info"] = {}
            return {
                "images": estrutura.get("images", []),
                "resumo_text": estrutura.get("resumo_text", ""),
                "imagens_info": estrutura.get("imagens_info", {})
            }
        # Fallback quando estrutura_edicao.json não existe
        imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
        imagens = []
        if os.path.isdir(imagens_dir):
            try:
                imagens = [f for f in os.listdir(imagens_dir) if f.lower().endswith('.png')]
            except Exception as e:
                print(f"Erro ao listar imagens no fallback: {e}")
                imagens = []
        resumo_text = ""
        resumo_md_path = os.path.join(UPLOAD_DIR, "resumo_notebooklm_normalized.md")
        if os.path.exists(resumo_md_path):
            with open(resumo_md_path, 'r', encoding='utf-8') as f:
                resumo_text = f.read()
        return {
            "images": imagens,
            "resumo_text": resumo_text
        }
    except Exception as e:
        print(f"Erro ao carregar dados de preview: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

@app.get("/api/get-editor-data")
async def get_editor_data():
    """Retorna os dados necessários para a interface de edição."""
    try:
        # Tentar identificar usuário autenticado
        # Nota: sem restrições por plano ainda
        user_id = None
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        estrutura = None
        if os.path.exists(estrutura_path):
            with open(estrutura_path, 'r', encoding='utf-8') as f:
                estrutura = json.load(f)
            # Remover texto placeholder do resumo, caso exista
            try:
                if isinstance(estrutura.get('resumo_text'), str) and estrutura['resumo_text'].strip() == 'Resumo temporário para extração de imagens.':
                    estrutura['resumo_text'] = ''
            except Exception:
                pass
            # Garantir que imagens_info seja incluído mesmo quando estrutura_edicao.json existe
            imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
            info_file_path = os.path.join(imagens_dir, 'imagens_info.json')
            try:
                if "imagens_info" not in estrutura or not isinstance(estrutura.get("imagens_info"), dict):
                    if os.path.exists(info_file_path):
                        with open(info_file_path, 'r', encoding='utf-8') as f:
                            estrutura["imagens_info"] = json.load(f)
                    else:
                        estrutura["imagens_info"] = {}
            except Exception as e:
                print(f"Erro ao carregar imagens_info quando estrutura_edicao.json existe: {e}")
                estrutura["imagens_info"] = estrutura.get("imagens_info", {})

            # Incluir lista de capturas de tela do diretório caso não esteja presente
            try:
                cap_dir = os.path.join(UPLOAD_DIR, "capturas_de_tela")
                if "captured_images" not in estrutura or not isinstance(estrutura.get("captured_images"), list):
                    if os.path.isdir(cap_dir):
                        estrutura["captured_images"] = [f for f in os.listdir(cap_dir) if f.lower().endswith('.png')]
                    else:
                        estrutura["captured_images"] = []
            except Exception as e:
                print(f"Erro ao listar capturas no get_editor_data: {e}")
        else:
            # Fallback quando estrutura_edicao.json não existe
            estrutura = {
                "images": [],
                "resumo_text": "",
                "upload_dir": UPLOAD_DIR,
                "captured_images": []
            }
            imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
            if os.path.isdir(imagens_dir):
                try:
                    estrutura["images"] = [f for f in os.listdir(imagens_dir) if f.lower().endswith('.png')]
                    
                    # Carregar informações das imagens se disponível
                    info_file_path = os.path.join(imagens_dir, 'imagens_info.json')
                    print(f"Debug: Verificando arquivo de informações das imagens: {info_file_path}")
                    print(f"Debug: Arquivo existe? {os.path.exists(info_file_path)}")
                    if os.path.exists(info_file_path):
                        with open(info_file_path, 'r', encoding='utf-8') as f:
                            estrutura["imagens_info"] = json.load(f)
                        print(f"Debug: Informações das imagens carregadas: {len(estrutura['imagens_info'])} imagens")
                        print(f"Debug: Primeiras 3 chaves: {list(estrutura['imagens_info'].keys())[:3]}")
                    else:
                        estrutura["imagens_info"] = {}
                        print("Debug: Arquivo imagens_info.json não encontrado, usando dicionário vazio")
                        
                except Exception as e:
                    print(f"Erro ao listar imagens no fallback: {e}")
            # Incluir capturas no fallback
            try:
                cap_dir = os.path.join(UPLOAD_DIR, "capturas_de_tela")
                if os.path.isdir(cap_dir):
                    estrutura["captured_images"] = [f for f in os.listdir(cap_dir) if f.lower().endswith('.png')]
            except Exception:
                pass
            # Preferir PDFs e imagens do GCS para persistência
            try:
                from storage import list_prefix
                if user_id:
                    pdfs_gcs = [os.path.basename(n) for n, _ in list_prefix(f"uploads/{user_id}/pdfs") if n.lower().endswith('.pdf')]
                else:
                    pdfs_gcs = [os.path.basename(n) for n, _ in list_prefix("uploads/anonymous/pdfs") if n.lower().endswith('.pdf')]
            except Exception:
                pdfs_gcs = []
            base_name = None
            if pdfs_gcs:
                estrutura["pdf_name"] = pdfs_gcs[0]
                base_name = os.path.splitext(estrutura["pdf_name"])[0]
                base_prefix = f"uploads/{user_id or 'anonymous'}/imagens_extraidas/{base_name}"
                try:
                    imgs_gcs = [os.path.basename(n) for n, _ in list_prefix(base_prefix) if n.lower().endswith('.png')]
                except Exception:
                    imgs_gcs = []
                if imgs_gcs:
                    estrutura["images"] = imgs_gcs
                    estrutura["base_images_url"] = f"/gcs/{base_prefix}/"
            # tentar descobrir um PDF no diretório local para ajudar a UI
            try:
                pdfs = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
                if pdfs:
                    estrutura["pdf_path"] = f"/{UPLOAD_DIR}/{pdfs[0]}"
                    estrutura["pdf_name"] = pdfs[0]
            except Exception:
                pass

        # Carregar apenas o resumo em Markdown
        resumo_estruturado_path = os.path.join(UPLOAD_DIR, "resumo_notebooklm_normalized.md")
        if os.path.exists(resumo_estruturado_path):
            with open(resumo_estruturado_path, 'r', encoding='utf-8') as f:
                resumo_estruturado = f.read()
            estrutura['resumo_text'] = resumo_estruturado
            estrutura['resumo_formatado'] = False  # Sempre Markdown; conversão para HTML no frontend

        return estrutura
    except Exception as e:
        print(f"Erro ao carregar dados de edição: {e}")
        raise HTTPException(status_code=500, detail="Erro interno do servidor")

# --- ROTAS: Exclusão de capturas ---
@app.post("/api/captures/delete")
async def delete_capture(request_data: dict = Body(default={})):  # { filename: str }
    try:
        filename = (request_data or {}).get("filename")
        if not filename or not isinstance(filename, str):
            raise HTTPException(status_code=400, detail="filename inválido")
        # Garantir que é um nome simples, sem path traversal
        safe = os.path.basename(filename)
        # Excluir no GCS
        try:
            delete_blob(f"temp_uploads/capturas_de_tela/{safe}")
        except HTTPException as e:
            print(f"[WARN] Falha ao excluir captura no GCS: {e}")
        # Fallback local
        cap_dir = os.path.join(UPLOAD_DIR, "capturas_de_tela")
        target = os.path.join(cap_dir, safe)
        if os.path.exists(target):
            try:
                os.remove(target)
            except Exception:
                pass
        # Atualizar estrutura_edicao.json
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        try:
            if os.path.exists(estrutura_path):
                with open(estrutura_path, 'r', encoding='utf-8') as f:
                    estrutura = json.load(f)
                captured_images = estrutura.get("captured_images", [])
                estrutura["captured_images"] = [f for f in captured_images if f != safe]
                with open(estrutura_path, 'w', encoding='utf-8') as f:
                    json.dump(estrutura, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erro ao atualizar estrutura_edicao.json na exclusão: {e}")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao excluir captura: {e}")
        raise HTTPException(status_code=500, detail="Falha ao excluir captura")

@app.post("/api/captures/delete-all")
async def delete_all_captures():
    try:
        # Excluir no GCS
        try:
            delete_prefix("temp_uploads/capturas_de_tela")
        except HTTPException as e:
            print(f"[WARN] Falha ao excluir capturas no GCS: {e}")
        # Fallback local
        cap_dir = os.path.join(UPLOAD_DIR, "capturas_de_tela")
        if os.path.isdir(cap_dir):
            for f in os.listdir(cap_dir):
                if f.lower().endswith('.png'):
                    try:
                        os.remove(os.path.join(cap_dir, f))
                    except Exception:
                        pass
        # Atualizar estrutura_edicao.json
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        try:
            if os.path.exists(estrutura_path):
                with open(estrutura_path, 'r', encoding='utf-8') as f:
                    estrutura = json.load(f)
                estrutura["captured_images"] = []
                with open(estrutura_path, 'w', encoding='utf-8') as f:
                    json.dump(estrutura, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erro ao atualizar estrutura_edicao.json na exclusão de todas: {e}")
        return {"status": "ok"}
    except Exception as e:
        print(f"Erro ao excluir todas as capturas: {e}")
        raise HTTPException(status_code=500, detail="Falha ao excluir capturas")

@app.get("/api/config-viewer")
async def config_viewer():
    """Retorna configurações do visualizador (Adobe Client ID)."""
    client_id = os.getenv("ADOBE_CLIENT_ID", "b06000c70bd143a0adc54a2f6d394b2a")
    return {"adobe_client_id": client_id}

@app.post("/api/generate-final-pdf")
async def generate_final_pdf(request_data: dict):
    """Gera o PDF final com base na estrutura editada pelo usuário."""
    try:
        from gerador_pdf_final import executar_fase_final
        
        # Extrair dados da requisição
        resumo_html = request_data.get('resumo_text', '')
        imagens_posicionadas = request_data.get('imagens_posicionadas', [])
        upload_dir = request_data.get('upload_dir', UPLOAD_DIR)
        
        # Criar arquivo temporário com o resumo editado
        resumo_editado_path = os.path.join(upload_dir, "resumo_editado_final.txt")
        with open(resumo_editado_path, 'w', encoding='utf-8') as f:
            f.write(resumo_html)
        
        # Caminho do PDF final
        pdf_final_path = os.path.join(upload_dir, "Resumo_Final_Com_Prints.pdf")
        
        # Executar geração do PDF
        executar_fase_final(
            resumo_editado_path,
            pdf_final_path,
            "imagens_extraidas"
        )
        
        # Retornar o PDF como resposta
        if os.path.exists(pdf_final_path):
            # Preferir Content-Disposition inline para exibição no navegador
            return FileResponse(
                path=pdf_final_path,
                media_type='application/pdf',
                headers={
                    'Content-Disposition': 'inline; filename="Resumo_Final_Com_Prints.pdf"',
                    'Cache-Control': 'no-store'
                }
            )
        else:
            raise HTTPException(status_code=500, detail="Erro ao gerar PDF final")
            
    except Exception as e:
        print(f"Erro ao gerar PDF final: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.post("/api/upload-pdf")
async def upload_pdf(originalPdf: UploadFile = File(...)):
    # Limpar o diretório de imagens extraídas para garantir que não haja imagens antigas.
    imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
    if os.path.exists(imagens_dir):
        for f in os.listdir(imagens_dir):
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')) or f == 'imagens_info.json':
                try:
                    os.remove(os.path.join(imagens_dir, f))
                except Exception as e:
                    print(f"Aviso: Falha ao remover arquivo de imagem antigo '{f}': {e}")
    else:
        os.makedirs(imagens_dir)

    safe_pdf_filename = originalPdf.filename.replace('\\', '_').replace('/', '_')
    base_name, ext = os.path.splitext(safe_pdf_filename)
    candidate_name = safe_pdf_filename
    pdf_path = os.path.join(UPLOAD_DIR, candidate_name)

    if os.path.exists(pdf_path):
        idx = 1
        while True:
            candidate_name = f"{base_name} ({idx}){ext}"
            pdf_path = os.path.join(UPLOAD_DIR, candidate_name)
            if not os.path.exists(pdf_path):
                break
            idx += 1

    try:
        try:
            originalPdf.file.seek(0)
        except Exception:
            pass

        with open(pdf_path, "wb") as buffer:
            shutil.copyfileobj(originalPdf.file, buffer)
        print(f"[TRACE] PDF recebido e salvo em: {pdf_path}")

        # Criar um arquivo de resumo temporário vazio (sem texto inicial)
        resumo_temp_path = os.path.join(UPLOAD_DIR, f"temp_resumo_{base_name}.txt")
        with open(resumo_temp_path, "w", encoding="utf-8") as f:
            f.write("")

        # Acionar a extração de imagens
        await start_full_processing(
            caminho_pdf_input=pdf_path,
            caminho_resumo_input=resumo_temp_path,
            upload_dir=UPLOAD_DIR,
            arquivo_pdf_output_name=f"output_{base_name}.pdf",
            manager=manager
        )
        # Persistir no GCS por usuário (ou 'anonymous' se não autenticado)
        # Obter user_id do access_token se disponível
        try:
            # Nota: em upload via fetch, o cookie HttpOnly existe; aqui mantemos 'anonymous' se falhar
            user_id = None
        except Exception:
            user_id = None
        user_prefix = f"uploads/{user_id or 'anonymous'}"
        # Enviar PDF
        try:
            upload_local_file(f"{user_prefix}/pdfs", pdf_path, dest_name=candidate_name)
        except Exception as e:
            print(f"[WARN] Falha ao enviar PDF para GCS: {e}")
        # Enviar imagens extraídas e info, se existirem
        try:
            images_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
            if os.path.isdir(images_dir):
                for fn in os.listdir(images_dir):
                    if fn.lower().endswith('.png'):
                        local_img = os.path.join(images_dir, fn)
                        try:
                            upload_local_file(f"{user_prefix}/imagens_extraidas/{base_name}", local_img, dest_name=fn)
                        except Exception as ie:
                            print(f"[WARN] Falha ao enviar imagem {fn} para GCS: {ie}")
                info_path = os.path.join(images_dir, 'imagens_info.json')
                if os.path.isfile(info_path):
                    try:
                        upload_local_file(f"{user_prefix}/imagens_extraidas/{base_name}", info_path, dest_name='imagens_info.json')
                    except Exception as je:
                        print(f"[WARN] Falha ao enviar imagens_info.json para GCS: {je}")
        except Exception as e:
            print(f"[WARN] Upload de imagens para GCS falhou: {e}")

        return {"status": "success", "filename": candidate_name,
                "path": f"/temp_uploads/{candidate_name}",
                "gcs_pdf": f"/gcs/{user_prefix}/pdfs/{candidate_name}",
                "gcs_images_base": f"/gcs/{user_prefix}/imagens_extraidas/{base_name}/"}
    except Exception as e:
        print(f"[ERRO] upload-pdf: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar o arquivo PDF.")

# --- ROTA: Upload de imagem capturada (capturas de tela) ---
@app.post("/api/upload-captured-image")
async def upload_captured_image(file: UploadFile = File(...), filename: Optional[str] = Form(None)):
    try:
        base_name = filename or f"img_capture_{int(time.time()*1000)}.png"
        if not base_name.lower().endswith('.png'):
            base_name = base_name + ".png"
        # Primeiro tenta enviar para Cloud Storage
        try:
            await upload_uploadfile("temp_uploads/capturas_de_tela", file, dest_name=base_name)
        except HTTPException as e:
            # Fallback: salvar em disco local
            print(f"[WARN] Cloud Storage indisponível; usando disco local: {e}")
            dest_dir = os.path.join(UPLOAD_DIR, "capturas_de_tela")
            os.makedirs(dest_dir, exist_ok=True)
            save_path = os.path.join(dest_dir, base_name)
            try:
                file.file.seek(0)
            except Exception:
                pass
            with open(save_path, 'wb') as f:
                shutil.copyfileobj(file.file, f)

        # Atualizar estrutura_edicao.json (compatibilidade até migrar para SQL)
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        estrutura = {}
        if os.path.exists(estrutura_path):
            try:
                with open(estrutura_path, 'r', encoding='utf-8') as f:
                    estrutura = json.load(f)
            except Exception:
                estrutura = {}
        captured_images = estrutura.get("captured_images", [])
        if base_name not in captured_images:
            captured_images.append(base_name)
            estrutura["captured_images"] = captured_images
        if "upload_dir" not in estrutura:
            estrutura["upload_dir"] = UPLOAD_DIR
        try:
            with open(estrutura_path, 'w', encoding='utf-8') as f:
                json.dump(estrutura, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Erro ao salvar estrutura_edicao.json: {e}")
        return {"filename": base_name, "url": f"/temp_uploads/capturas_de_tela/{base_name}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro no upload de captura: {e}")
        raise HTTPException(status_code=500, detail="Falha ao salvar imagem capturada")

# --- ROTAS: Uploads de imagens enviadas pelo usuário ---
@app.post("/api/uploads/upload")
async def uploads_upload(file: UploadFile = File(...)):
    try:
        # Normalizar nome e aplicar duplicação por conflito
        safe_name = (file.filename or f"upload_{int(time.time()*1000)}").replace('\\', '_').replace('/', '_')
        base, ext = os.path.splitext(safe_name)
        if not ext:
            ext = ".png"
        candidate = f"{base}{ext}"
        # Verificar conflitos no GCS
        try:
            existing = {os.path.basename(n) for (n, _) in list_prefix("temp_uploads/Imagens_de_Uploads")}
            if candidate in existing:
                idx = 1
                while True:
                    cand2 = f"{base} ({idx}){ext}"
                    if cand2 not in existing:
                        candidate = cand2
                        break
                    idx += 1
        except HTTPException as e:
            # Se GCS indisponível, apenas segue e tenta fallback/local
            print(f"[WARN] Falha ao listar GCS para evitar conflito: {e}")

        # Tenta enviar para GCS
        try:
            await upload_uploadfile("temp_uploads/Imagens_de_Uploads", file, dest_name=candidate)
        except HTTPException as e:
            print(f"[WARN] Cloud Storage indisponível; salvando localmente: {e}")
            dest_dir = os.path.join(UPLOAD_DIR, "Imagens_de_Uploads")
            os.makedirs(dest_dir, exist_ok=True)
            save_path = os.path.join(dest_dir, candidate)
            try:
                file.file.seek(0)
            except Exception:
                pass
            with open(save_path, 'wb') as f:
                shutil.copyfileobj(file.file, f)

        return {"filename": candidate, "url": f"/temp_uploads/Imagens_de_Uploads/{candidate}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro no upload de imagem enviada: {e}")
        raise HTTPException(status_code=500, detail="Falha ao salvar imagem enviada")

@app.post("/api/uploads/delete")
async def uploads_delete(request_data: dict = Body(default={})):  # { filename: str }
    try:
        filename = (request_data or {}).get("filename")
        if not filename or not isinstance(filename, str):
            raise HTTPException(status_code=400, detail="filename inválido")
        safe = os.path.basename(filename)
        # Excluir no GCS
        try:
            delete_blob(f"temp_uploads/Imagens_de_Uploads/{safe}")
        except HTTPException as e:
            print(f"[WARN] Falha ao excluir no GCS: {e}")
        # Fallback local
        dest_dir = os.path.join(UPLOAD_DIR, "Imagens_de_Uploads")
        target = os.path.join(dest_dir, safe)
        if os.path.exists(target):
            try:
                os.remove(target)
            except Exception:
                pass
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro ao excluir upload: {e}")
        raise HTTPException(status_code=500, detail="Falha ao excluir upload")

@app.post("/api/uploads/delete-all")
async def uploads_delete_all():
    try:
        # Excluir no GCS
        try:
            delete_prefix("temp_uploads/Imagens_de_Uploads")
        except HTTPException as e:
            print(f"[WARN] Falha ao excluir prefixo no GCS: {e}")
        # Fallback local
        dest_dir = os.path.join(UPLOAD_DIR, "Imagens_de_Uploads")
        if os.path.isdir(dest_dir):
            # Alinhar os tipos de arquivo com a listagem de uploads
            allowed_exts = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg")
            for f in os.listdir(dest_dir):
                if f.lower().endswith(allowed_exts):
                    try:
                        os.remove(os.path.join(dest_dir, f))
                    except Exception:
                        pass
        return {"status": "ok"}
    except Exception as e:
        print(f"Erro ao excluir todos os uploads: {e}")
        raise HTTPException(status_code=500, detail="Falha ao excluir uploads")

# --- ROTA: Reprocessar imagens iniciais do PDF (Somente Fase de Captura) ---
@app.post("/api/recover-initial-images")
async def recover_initial_images(request_data: dict = Body(default={})):  # aceita JSON com { pdf_name?: str, force?: bool }
    try:
        # Determinar PDF de origem
        pdf_name = (request_data or {}).get("pdf_name")
        pdf_path = None
        if pdf_name:
            cand = os.path.join(UPLOAD_DIR, pdf_name)
            if os.path.exists(cand):
                pdf_path = cand
        if not pdf_path:
            # fallback: primeiro PDF encontrado na pasta de uploads
            pdfs = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
            if pdfs:
                pdf_path = os.path.join(UPLOAD_DIR, pdfs[0])
        if not pdf_path:
            raise HTTPException(status_code=400, detail="Nenhum PDF disponível em temp_uploads para recuperar imagens")

        # Preparar diretórios/arquivos
        imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
        os.makedirs(imagens_dir, exist_ok=True)
        
        # Limpeza condicional: só limpar quando forçarmos ou ao mudar de PDF
        force = bool((request_data or {}).get("force"))
        try:
            # Determinar PDF anterior salvo (se houver) para evitar limpeza desnecessária
            last_pdf = None
            estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
            try:
                if os.path.exists(estrutura_path):
                    with open(estrutura_path, 'r', encoding='utf-8') as f:
                        prev = json.load(f)
                        last_pdf = (prev.get('pdf_name') or prev.get('pdf_path'))
                        if isinstance(last_pdf, str):
                            last_pdf = os.path.basename(last_pdf)
            except Exception:
                last_pdf = None

            current_pdf_base = os.path.basename(pdf_path)
            pdf_changed = (last_pdf and last_pdf != current_pdf_base)

            if force or pdf_changed:
                for f in os.listdir(imagens_dir):
                    if f.lower().endswith('.png') or f == 'imagens_info.json':
                        try:
                            os.remove(os.path.join(imagens_dir, f))
                        except Exception:
                            pass
        except Exception as e:
            print(f"Falha ao avaliar/limpar imagens anteriores: {e}")

        # Converter PDF -> HTML temporário
        from pdf_for_html import converter_pdf_para_html_simples
        temp_html_path = os.path.join(UPLOAD_DIR, "temp_doc.html")
        resultado = converter_pdf_para_html_simples(pdf_path, temp_html_path)
        if not resultado or not resultado[0]:
            raise HTTPException(status_code=500, detail="Falha na conversão do PDF para HTML")

        # Capturar imagens do HTML
        from captura_imagens_do_html import capturar_imagens_do_corpo_html
        ok = capturar_imagens_do_corpo_html(temp_html_path, imagens_dir)
        if not ok:
            raise HTTPException(status_code=500, detail="Falha na captura das imagens do HTML")

        # Atualizar estrutura_edicao.json (opcional, para consistência)
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        estrutura = {}
        try:
            if os.path.exists(estrutura_path):
                with open(estrutura_path, 'r', encoding='utf-8') as f:
                    estrutura = json.load(f)
        except Exception:
            estrutura = {}
        try:
            imagens = [f for f in os.listdir(imagens_dir) if f.lower().endswith('.png')]
            estrutura["images"] = imagens
            estrutura["upload_dir"] = UPLOAD_DIR
            estrutura["pdf_name"] = os.path.basename(pdf_path)
            estrutura["pdf_path"] = pdf_path
            info_file_path = os.path.join(imagens_dir, 'imagens_info.json')
            if os.path.exists(info_file_path):
                with open(info_file_path, 'r', encoding='utf-8') as f:
                    estrutura["imagens_info"] = json.load(f)
            with open(estrutura_path, 'w', encoding='utf-8') as f:
                json.dump(estrutura, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Aviso: não foi possível atualizar estrutura_edicao.json: {e}")

        # Responder com resumo
        return {
            "status": "ok",
            "pdf_name": os.path.basename(pdf_path),
            "images_count": len([f for f in os.listdir(imagens_dir) if f.lower().endswith('.png')])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Erro em recover-initial-images: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao recuperar imagens iniciais")

# --- ROTA: Deletar TODAS as imagens físicas da pasta imagens_extraidas ---
@app.post("/api/delete-all-images")
async def api_delete_all_images():
    try:
        imagens_dir = os.path.join(UPLOAD_DIR, "imagens_extraidas")
        if os.path.isdir(imagens_dir):
            for f in os.listdir(imagens_dir):
                try:
                    os.remove(os.path.join(imagens_dir, f))
                except Exception:
                    pass
        else:
            os.makedirs(imagens_dir, exist_ok=True)

        # Atualizar estrutura_edicao.json
        estrutura_path = os.path.join(UPLOAD_DIR, "estrutura_edicao.json")
        try:
            estrutura = {}
            if os.path.exists(estrutura_path):
                with open(estrutura_path, 'r', encoding='utf-8') as f:
                    estrutura = json.load(f)
            estrutura["images"] = []
            estrutura["imagens_info"] = {}
            with open(estrutura_path, 'w', encoding='utf-8') as f:
                json.dump(estrutura, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Aviso: falha ao atualizar estrutura_edicao.json na deleção: {e}")

        return {"status": "ok", "deleted_all": True}
    except Exception as e:
        print(f"Erro ao deletar todas as imagens: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao deletar imagens")
# --- ROTA: Listar imagens enviadas (uploads) ---
@app.get("/api/uploads/list")
async def uploads_list():
    try:
        images = []
        # Primeiro listar localmente para evitar timeouts
        try:
            dest_dir = os.path.join(UPLOAD_DIR, "Imagens_de_Uploads")
            os.makedirs(dest_dir, exist_ok=True)
            if os.path.exists(dest_dir):
                for filename in os.listdir(dest_dir):
                    file_path = os.path.join(dest_dir, filename)
                    if os.path.isfile(file_path) and any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']):
                        images.append({
                            "filename": filename,
                            "url": f"/temp_uploads/Imagens_de_Uploads/{filename}"
                        })
        except Exception as e:
            print(f"[WARN] Falha ao listar uploads localmente: {e}")

        # Complementar com GCS quando disponível
        try:
            for name, _ in list_prefix("temp_uploads/Imagens_de_Uploads"):
                base = os.path.basename(name)
                if any(base.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']):
                    if not any(img.get("filename") == base for img in images):
                        images.append({
                            "filename": base,
                            "url": f"/temp_uploads/Imagens_de_Uploads/{base}"
                        })
        except HTTPException as e:
            print(f"[WARN] Falha ao listar uploads no GCS: {e}")
        
        return {"images": images, "count": len(images)}
    except Exception as e:
        print(f"Erro ao listar imagens enviadas: {e}")
        raise HTTPException(status_code=500, detail="Falha ao listar imagens enviadas")

# --- ROTA: Listar PDFs disponíveis em temp_uploads ---
@app.get("/api/list-pdfs")
async def list_pdfs():
    try:
        # Priorizar listagem local para evitar timeouts quando egress estiver restrito
        try:
            local_pdfs = [f for f in os.listdir(UPLOAD_DIR) if f.lower().endswith('.pdf')]
        except Exception:
            local_pdfs = []

        pdfs: List[str] = list(local_pdfs)
        # Tentar complementar com GCS apenas se necessário
        try:
            for name, _ in list_prefix("temp_uploads"):
                base = os.path.basename(name)
                if base.lower().endswith('.pdf') and base not in pdfs:
                    pdfs.append(base)
        except HTTPException as e:
            print(f"[WARN] Falha ao listar PDFs no GCS: {e}")
        return {"pdfs": pdfs, "count": len(pdfs)}
    except Exception as e:
        print(f"Erro ao listar PDFs: {e}")
        raise HTTPException(status_code=500, detail="Erro ao listar PDFs")
# --- Auth dependencies and helpers ---
async def get_db_session() -> AsyncSession:
    return SessionLocal()


def _is_valid_email(email: str) -> bool:
    name, addr = parseaddr(email or "")
    return "@" in addr and "." in addr


def _cookie_settings():
    return {
        "secure": True,
        "httponly": True,
        "samesite": "lax"
    }


@app.on_event("startup")
async def on_startup():
    try:
        await init_db()
    except Exception as e:
        print(f"DB init failed: {e}")
    # Garantir schema mínimo via conector (sem depender de VPC/IP)
    try:
        await ensure_schema()
        print("Schema ensured via Cloud SQL Connector")
    except Exception as e:
        print(f"ensure_schema failed: {e}")


@app.get("/health/db")
async def health_db():
    """Ping rápido ao banco para diagnosticar conectividade."""
    try:
        # Usar Cloud SQL Connector (asyncpg) para validar conexão sem depender de VPC/IP
        from db_iam import connect_asyncpg
        conn = await connect_asyncpg()
        try:
            row = await conn.fetchrow("SELECT 1 AS ok")
            if row and row.get("ok") == 1:
                return {"status": "ok"}
            return {"status": "error", "detail": "Query retornou resultado inesperado"}
        finally:
            await conn.close()
    except Exception as e:
        # Expor causa raiz para rápido diagnóstico
        return {"status": "error", "detail": str(e)}


@app.post("/auth/signup")
async def auth_signup(email: str = Form(...), password: str = Form(...), name: str = Form(None)):
    if not _is_valid_email(email):
        raise HTTPException(status_code=400, detail="Email inválido")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Senha muito curta")
    # Usar Cloud SQL Connector (IAM) para evitar dependência de VPC/IP
    existing = await iam_fetch_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Email já cadastrado")
    created = await iam_create_user(email=email, name=(name or email.split('@')[0]), password_hash=hash_password(password))
    return {"status": "ok", "user_id": created.get("id")}


@app.post("/auth/login")
async def auth_login(response: Response, email: str = Form(...), password: str = Form(...)):
    user = await iam_fetch_user_by_email(email)
    if not user or not user.get("password_hash") or not verify_password(password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    await iam_update_last_login(user_id=int(user["id"]))
    access = create_access_token(user_id=int(user["id"]), email=user["email"])
    raw_refresh, hashed_refresh = generate_refresh_token()
    expires_at = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat()
    await iam_insert_refresh_token(user_id=int(user["id"]), token_hash=hashed_refresh, expires_at_iso=expires_at)
    # Cookies
    cs = _cookie_settings()
    response.set_cookie("access_token", access, **cs)
    response.set_cookie("refresh_token", raw_refresh, **cs)
    return {"status": "ok"}


@app.post("/auth/refresh")
async def auth_refresh(response: Response, refresh_token: str = Form(...)):
    tokens = await iam_find_valid_refresh_tokens()
    matched = None
    for t in tokens:
        # expires_at vem como string em ISO; validar
        try:
            if t.get("expires_at") and datetime.datetime.fromisoformat(str(t["expires_at"]).replace("Z","")) < datetime.datetime.utcnow():
                continue
        except Exception:
            pass
        if verify_refresh_token(refresh_token, t.get("token_hash", "")):
            matched = t
            break
    if not matched:
        raise HTTPException(status_code=401, detail="Refresh inválido")
    u = await iam_fetch_user_by_id(int(matched["user_id"]))
    if not u:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    access = create_access_token(user_id=int(u["id"]), email=u["email"]) 
    cs = _cookie_settings()
    response.set_cookie("access_token", access, **cs)
    return {"status": "ok"}


@app.post("/auth/logout")
async def auth_logout(response: Response):
    # Soft logout: apenas limpar cookies. Revogação completa será adicionada em fase posterior.
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"status": "ok"}


def _get_current_user_from_cookie(access_token: Optional[str]) -> Optional[dict]:
    if not access_token:
        return None
    payload = decode_access_token(access_token)
    return payload


@app.get("/me")
async def me(request: Request):
    # Ler access_token do cookie HttpOnly
    access_token = request.cookies.get("access_token")
    payload = _get_current_user_from_cookie(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return {"user_id": payload.get("sub"), "email": payload.get("email")}
def _get_oauth_client():
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth não configurado")
    return client_id, client_secret

def _get_redirect_uri(request: Request) -> str:
    base = (os.getenv("OAUTH_REDIRECT_BASE") or "").strip()
    if base:
        # Permite forçar o domínio público (ex.: https://resumopro.com.br)
        return f"{base.rstrip('/')}/oauth/google/callback"
    # Padrão: usar a URL da própria revisão do Cloud Run
    return str(request.url_for("oauth_google_callback"))


@app.get("/oauth/google/start")
async def oauth_google_start(request: Request):
    client_id, _ = _get_oauth_client()
    redirect_uri = _get_redirect_uri(request)
    state = secrets.token_urlsafe(24)
    # Salvar state em cookie
    cs = _cookie_settings()
    response = RedirectResponse(url=(
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
        f"&state={state}"
    ))
    response.set_cookie("oauth_state", state, **cs)
    return response


@app.get("/oauth/google/callback")
async def oauth_google_callback(request: Request, code: str, state: str):
    # Validar state
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        raise HTTPException(status_code=400, detail="State inválido")
    client_id, client_secret = _get_oauth_client()
    redirect_uri = _get_redirect_uri(request)
    # Trocar code por tokens
    async with httpx.AsyncClient(timeout=15.0) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Falha ao obter tokens do Google")
        tokens = token_res.json()
    id_token = tokens.get("id_token")
    payload = decode_access_token(id_token) if id_token else None
    # Nota: idealmente, validar o id_token com chave pública do Google; aqui mantemos simplicidade inicial.
    # Se não conseguirmos decodificar, tentar obter profile via userinfo
    email = None
    sub = None
    name = None
    if payload:
        email = payload.get("email")
        sub = payload.get("sub")
        name = payload.get("name")
    if not email:
        # userinfo endpoint
        async with httpx.AsyncClient(timeout=15.0) as client:
            ui_res = await client.get("https://openidconnect.googleapis.com/v1/userinfo",
                                      headers={"Authorization": f"Bearer {tokens.get('access_token')}"})
            if ui_res.status_code == 200:
                ui = ui_res.json()
                email = ui.get("email")
                sub = ui.get("sub")
                name = ui.get("name")
    if not email or not sub:
        raise HTTPException(status_code=401, detail="Perfil do Google inválido")
    # Criar/associar usuário
    async with SessionLocal() as session:
        from sqlalchemy import select
        # Procurar conta OAuth
        oa_res = await session.execute(select(User).join(User.oauth_accounts).where(User.email == email))
        user = oa_res.scalar_one_or_none()
        if not user:
            # Procurar por email
            ures = await session.execute(select(User).where(User.email == email))
            user = ures.scalar_one_or_none()
            if not user:
                user = User(email=email, name=name or email.split('@')[0], password_hash=None)
                session.add(user)
                await session.commit()
                await session.refresh(user)
            # Criar vínculo OAuth
            from db import OAuthAccount
            oauth = OAuthAccount(provider="google", subject=sub, user_id=user.id)
            session.add(oauth)
            await session.commit()
        user.last_login = datetime.datetime.utcnow()
        await session.commit()
    # Emitir cookies de sessão
    access = create_access_token(user_id=user.id, email=user.email)
    raw_refresh, hashed_refresh = generate_refresh_token()
    async with SessionLocal() as session:
        rt = RefreshToken(user_id=user.id, token_hash=hashed_refresh,
                          expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30))
        session.add(rt)
        await session.commit()
    cs = _cookie_settings()
    resp = RedirectResponse(url="/")
    resp.set_cookie("access_token", access, **cs)
    resp.set_cookie("refresh_token", raw_refresh, **cs)
    # limpar state
    resp.delete_cookie("oauth_state")
    return resp