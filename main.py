import os
import shutil
import re
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List, Optional

app = FastAPI()

app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/static", StaticFiles(directory="static"), name="static")

UPLOAD_DIR = "temp_uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

ARQUIVO_PDF_FINAL = "Resumo_Final_Com_Prints.pdf"

def normalize_to_markdown(raw_text: str) -> str:
    lines = raw_text.splitlines()
    processed_lines = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if '\t' in line:
            table_block_lines = []
            while i < len(lines) and '\t' in lines[i]:
                table_block_lines.append(lines[i].strip())
                i += 1

            if table_block_lines:
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

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

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
    return FileResponse("static/index.html", media_type="text/html")


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
    from main_pipeline import start_full_processing 
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