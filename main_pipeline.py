import os
import fitz
import json
from dotenv import load_dotenv
from fastapi import WebSocket
from main import ConnectionManager # Importar ConnectionManager


# --- ETAPA DE CARREGAMENTO DE AMBIENTE E API ---
# Esta lógica deve ser concisa e no topo para carregar a chave de API
BASEDIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASEDIR, '.env'))
API_KEY = os.environ.get("GEMINI_API_KEY") 


# --- IMPORTS FUNCIONAIS (MÓDULOS DE FASE) ---
from pdf_for_html import converter_pdf_para_html_simples 
from captura_imagens_do_html import capturar_imagens_do_corpo_html
from analise_vision import fase_4_analise_vision 
from posicionamento_contextual import fase_5_posicionamento_contextual 
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
    
    # 1. VERIFICAÇÃO CRÍTICA DA CHAVE
    if not API_KEY:
        print("❌ ERRO CRÍTICO: CHAVE DE API AUSENTE.")
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro Crítico: Chave de API ausente.\"}")
        return False
        
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
    print("| INICIANDO ORQUESTRAÇÃO DO PIPELINE DE 5 FASES (WEB) |")
    print("=" * 60)
    await manager.send_message("{\"progress\": 0, \"status\": \"Iniciando processamento...\"}") # Início


    # --- FASE 1: CONVERTER PDF -> HTML ---
    print("\n[FASE 1/5] Convertendo PDF para HTML simples...")
    await manager.send_message("{\"progress\": 5, \"status\": \"Fase 1/5: Convertendo PDF para HTML...\"}")
    if not converter_pdf_para_html_simples(caminho_pdf_input, CAMINHO_HTML_TEMP):
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 1: Falha na conversão para HTML.\"}")
        return False
    await manager.send_message("{\"progress\": 10, \"status\": \"Fase 1/5 Concluída.\"}")
    
    
    # --- FASE 2: FILTRAR E CAPTURAR IMAGENS ---
    print("\n[FASE 2/5] Capturando imagens do corpo HTML...")
    await manager.send_message("{\"progress\": 10, \"status\": \"Fase 2/5: Capturando imagens do HTML...\"}")
    if not capturar_imagens_do_corpo_html(CAMINHO_HTML_TEMP, caminho_pasta_imagens):
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 2: Falha na captura de imagens do HTML.\"}")
        return False
    await manager.send_message("{\"progress\": 20, \"status\": \"Fase 2/5 Concluída.\"}")


    # --- FASE 3: ANÁLISE DE VISÃO (Gemini Vision) ---
    print("\n[FASE 3/5] Análise de Visão e Geração de Descrições (Gemini Vision)...")
    await manager.send_message("{\"progress\": 40, \"status\": \"Fase 3/5: Análise de Visão e Geração de Descrições...\"}")
    caminho_descricoes = fase_4_analise_vision(
        caminho_pasta_imagens, 
        caminho_mapa_desc,
        contexto_titulo, # <--- NOVO ARGUMENTO PASSADO: CONTEXTO!
        API_KEY=API_KEY
    )
    if not caminho_descricoes:
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 3: Não foi possível gerar as descrições de imagem.\"}")
        return False
    await manager.send_message("{\"progress\": 60, \"status\": \"Fase 3/5 Concluída.\"}")


    # --- FASE 4: POSICIONAMENTO CONTEXTUAL (Gemini Pro) ---
    print("\n[FASE 4/5] Posicionamento Contextual das Tags no Resumo (Gemini Pro)...")
    await manager.send_message("{\"progress\": 60, \"status\": \"Fase 4/5: Posicionamento Contextual das Tags...\"}")
    caminho_resumo_final_tagged = fase_5_posicionamento_contextual(
        caminho_resumo_input,
        caminho_mapa_desc,
        caminho_resumo_tagged,
        API_KEY=API_KEY
    )
    if not caminho_resumo_final_tagged:
        await manager.send_message("{\"progress\": -1, \"status\": \"Erro na Fase 4: Posicionamento das tags falhou.\"}")
        return False
    await manager.send_message("{\"progress\": 80, \"status\": \"Fase 4/5 Concluída.\"}")


    # --- FASE 5: MONTAGEM E PDF (Geração Final) ---
    print("\n[FASE 5/5] Montagem HTML e Conversão para PDF...")
    await manager.send_message("{\"progress\": 80, \"status\": \"Fase 5/5: Montagem HTML e Conversão para PDF...\"}")
    try:
        executar_fase_final(
            caminho_resumo_final_tagged,
            caminho_pdf_final,
            PASTA_IMAGENS_NOME
        )
    except Exception as e:
        print(f"❌ ERRO GRAVE NA FASE 5 (WeasyPrint/HTML): {e}")
        await manager.send_message(f"{{\"progress\": -1, \"status\": \"Erro na Fase 5: {e}\"}}") 
        return False
    await manager.send_message("{\"progress\": 100, \"status\": \"Pipeline Concluído com Sucesso!\"}")

    print("=" * 60)
    print(f"| SUCESSO! PIPELINE CONCLUÍDO. ARQUIVO FINAL: {arquivo_pdf_output_name} |")
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