import os
import fitz
import json
from dotenv import load_dotenv
from fastapi import WebSocket
import logging

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(levelname)s] %(message)s",
        handlers=[
            logging.StreamHandler()
        ]
    )

from websocket_manager import ConnectionManager # Importar ConnectionManager


# --- ETAPA DE CARREGAMENTO DE AMBIENTE E API ---
# Esta lógica deve ser concisa e no topo para carregar a chave de API
BASEDIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASEDIR, '.env'))
API_KEY = os.environ.get("GEMINI_API_KEY") 


# --- IMPORTS FUNCIONAIS (MÓDULOS DE FASE) ---
from pdf_for_html import converter_pdf_para_html_simples 
from captura_imagens_do_html import capturar_imagens_do_corpo_html
from gerador_pdf_final import executar_fase_final 


# --- CONFIGURAÇÕES GLOBAIS DE NOMES DE ARQUIVO INTERNOS ---
ARQUIVO_MAPA_COORDENADAS = "mapa_coordenadas.json" # Mantido por convenção
ARQUIVO_MAPA_DESCRICOES = "mapa_descricoes.json"
ARQUIVO_RESUMO_FINAL_TAGGED = "resumo_com_tags_final.txt"
ARQUIVO_PDF_FINAL_NAME = "Resumo_Final_Com_Prints.pdf"
PASTA_IMAGENS_NOME = "imagens_extraidas" # Nome da subpasta de saída de imagens


# --- FUNÇÃO AUXILIAR: EXTRAÇÃO DE TÍTULO ---
def extrair_titulo_do_resumo(caminho_resumo: str) -> str:
    """Extrai a primeira linha do resumo (que deve ser o título) e limpa a sintaxe Markdown."""
    try:
        with open(caminho_resumo, 'r', encoding='utf-8') as f:
            primeira_linha = f.readline().strip()
            # Limpa marcadores Markdown (#, ##, ***, etc.) e retorna um contexto útil
            titulo = primeira_linha.lstrip('#* ').strip() 
            if titulo:
                return titulo
            
    except Exception:
        pass # Ignora erros de leitura
        
    return "documento técnico de engenharia de software" # Retorno seguro

# --- FUNÇÃO DE ORQUESTRAÇÃO PRINCIPAL (Para o FastAPI) ---

async def start_full_processing(caminho_pdf_input: str, caminho_resumo_input: str, upload_dir: str, arquivo_pdf_output_name: str, manager: ConnectionManager):
        
    # Lista para armazenar caminhos de arquivos/diretórios temporários para limpeza
    temp_files_to_clean = []
    
    # --- DEFINIÇÃO DOS CAMINHOS TEMPORÁRIOS COMPLETOS ---
    temp_files_to_clean.append(os.path.relpath(caminho_pdf_input, upload_dir))
    temp_files_to_clean.append(os.path.relpath(caminho_resumo_input, upload_dir))

    caminho_mapa_desc = os.path.join(upload_dir, ARQUIVO_MAPA_DESCRICOES)
    temp_files_to_clean.append(os.path.relpath(caminho_mapa_desc, upload_dir))

    caminho_resumo_tagged = os.path.join(upload_dir, ARQUIVO_RESUMO_FINAL_TAGGED)
    temp_files_to_clean.append(os.path.relpath(caminho_resumo_tagged, upload_dir))

    caminho_pasta_imagens = os.path.join(upload_dir, PASTA_IMAGENS_NOME)
    temp_files_to_clean.append(os.path.relpath(caminho_pasta_imagens, upload_dir))

    caminho_pdf_final = os.path.join(upload_dir, arquivo_pdf_output_name)
    
    # ------------------------------------------------------------------------
    # DEFINIÇÕES INTERNAS DO PIPELINE
    # ------------------------------------------------------------------------
    CAMINHO_HTML_TEMP = os.path.join(upload_dir, "temp_doc.html")
    temp_files_to_clean.append(os.path.relpath(CAMINHO_HTML_TEMP, upload_dir))

    # Obter o contexto do título
    contexto_titulo = extrair_titulo_do_resumo(caminho_resumo_input)


    print("=" * 60)
    print("| INICIANDO ORQUESTRAÇÃO DO PIPELINE DE 4 FASES (EDITOR SEMÂNTICO) |")
    print("=" * 60)
    await manager.send_message("{\"progress\": 0, \"status\": \"Iniciando processamento...\"}") # Início


    # --- FASE 1: CONVERTER PDF -> HTML ---
    print("\n[FASE 1/4] Convertendo PDF para HTML simples...")
    await manager.send_message("{\"progress\": 5, \"status\": \"Fase 1/4: Convertendo PDF para HTML...\"}")
    resultado_conversao = converter_pdf_para_html_simples(caminho_pdf_input, CAMINHO_HTML_TEMP)
    if not resultado_conversao or not resultado_conversao[0]:
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 1: Falha na conversão para HTML.\"}")
        return False
    
    await manager.send_message("{\"progress\": 25, \"status\": \"Fase 1/4 Concluída.\"}")
    
    
    # --- FASE 2: FILTRAR E CAPTURAR IMAGENS ---
    print("\n[FASE 2/4] Capturando imagens do corpo HTML...")
    await manager.send_message("{\"progress\": 25, \"status\": \"Fase 2/4: Capturando imagens do HTML...\"}")
    if not capturar_imagens_do_corpo_html(CAMINHO_HTML_TEMP, caminho_pasta_imagens):
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 2: Falha na captura de imagens do HTML.\"}")
        return False
    await manager.send_message("{\"progress\": 50, \"status\": \"Fase 2/4 Concluída.\"}")


    # --- FASE 3: INTERFACE DE EDIÇÃO SEMÂNTICA ---
    print("\n[FASE 3/4] Preparando Interface de Edição Semântica...")
    await manager.send_message("{\"progress\": 50, \"status\": \"Fase 3/4: Preparando Interface de Edição...\"}")
    
    # Criar estrutura JSON para a interface de edição
    estrutura_edicao = {
        "html_content": "",
        "images": [],
        "resumo_text": "",
        "upload_dir": upload_dir
    }
    
    # Carregar conteúdo HTML
    try:
        with open(CAMINHO_HTML_TEMP, 'r', encoding='utf-8') as f:
            estrutura_edicao["html_content"] = f.read()
    except Exception as e:
        print(f"❌ Erro ao carregar HTML: {e}")
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro ao carregar conteúdo HTML.\"}")
        return False
    
    # Carregar lista de imagens
    try:
        imagens = [f for f in os.listdir(caminho_pasta_imagens) if f.endswith('.png')]
        estrutura_edicao["images"] = imagens
    except Exception as e:
        print(f"❌ Erro ao listar imagens: {e}")
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro ao carregar imagens.\"}")
        return False
    
    # Carregar resumo
    try:
        with open(caminho_resumo_input, 'r', encoding='utf-8') as f:
            estrutura_edicao["resumo_text"] = f.read()
    except Exception as e:
        print(f"❌ Erro ao carregar resumo: {e}")
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro ao carregar resumo.\"}")
        return False
    
    # Salvar estrutura para a interface
    caminho_estrutura = os.path.join(upload_dir, "estrutura_edicao.json")
    with open(caminho_estrutura, 'w', encoding='utf-8') as f:
        json.dump(estrutura_edicao, f, ensure_ascii=False, indent=2)
    
    await manager.send_message("{\"progress\": 75, \"status\": \"Fase 3/4 Concluída. Interface pronta para edição.\"}")


    # --- FASE 4: AGUARDAR EDIÇÃO DO USUÁRIO ---
    print("\n[FASE 4/4] Aguardando edição do usuário...")
    await manager.send_message("{\"progress\": 75, \"status\": \"Fase 4/4: Aguardando posicionamento das imagens pelo usuário...\"}")
    
    # Aqui o sistema aguarda o usuário posicionar as imagens via interface
    # O usuário interage com a interface e retorna a estrutura finalizada
    await manager.send_message("{\"progress\": 100, \"status\": \"Editor Semântico pronto! Use a interface para posicionar as imagens.\"}")

    print("=" * 60)
    print("| EDITOR SEMÂNTICO PRONTO! INTERFACE DE EDIÇÃO DISPONÍVEL |")
    print("=" * 60)

    # --- Geração do Manifesto de Limpeza ---
    try:
        pdf_final_base_name = os.path.splitext(arquivo_pdf_output_name)[0]
        manifest_name = f"cleanup_manifest_{pdf_final_base_name}.json"
        manifest_path = os.path.join(upload_dir, manifest_name)
        
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(temp_files_to_clean, f, indent=4)
        print(f"[CLEANUP_MANIFEST] Manifesto de limpeza criado em: {manifest_path}")
    except Exception as e:
        print(f"[ERRO] Não foi possível criar o manifesto de limpeza: {e}")
        # Não impede o retorno de sucesso, mas registra o erro

    return True


# --- BLOCO PRINCIPAL DE EXECUÇÃO (Para testes locais) ---
if __name__ == "__main__":
    print("Este módulo foi projetado para ser importado pelo main.py.")