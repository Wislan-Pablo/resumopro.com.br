import os
import json
from google import genai
from google.genai.errors import APIError
from dotenv import load_dotenv

# --- NADA DEVE SER EXECUTADO AQUI FORA DAS FUNÇÕES ---

def fase_4_analise_vision(pasta_prints: str, caminho_saida: str, contexto_titulo: str, API_KEY: str):
    """
    Analisa cada imagem na pasta de prints usando a API Gemini Vision, 
    utilizando o título do documento como contexto.
    """
    
    # 1. VERIFICAÇÃO DE CHAVE E INICIALIZAÇÃO DO CLIENTE
    if not API_KEY:
        raise ValueError("ERRO INTERNO: API_KEY não foi fornecida pelo Orquestrador.")
        
    try:
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"❌ ERRO CRÍTICO na inicialização do Cliente Gemini: {e}")
        return False
    
    
    print("\n[FASE 3/5] Iniciando Análise de Visão e Geração de Descrições (Gemini Vision)...")
    
    mapa_descricoes = {}
    arquivos_imagens = [f for f in os.listdir(pasta_prints) if f.endswith('.png')]

    if not arquivos_imagens:
        print("❌ ERRO: Nenhuma imagem PNG encontrada na pasta prints_imagens.")
        return False

    # 2. CONSTRUÇÃO DO PROMPT COM CONTEXTO
    prompt_vision = f"""
    Você é um analista sênior especializado em interpretar imagens de Fundamentos e Processos da Engenharia de Software.
    
    Diga apenas do que se trata esta imagem no contexto de Fundamentos e Processos da Engenharia de Software. Sua resposta deve ser direta e retornar apenas a efetiva descrição da imagem (ex: "Modelo cascata de desenvolvimento de software."). 
    
    REGRAS RÍGIDAS: 
    1. Sua resposta DEVE ter NO MÁXIMO 10 palavras.
    2. NÃO INCLUA as palavras 'esta ilustração é...", "esta representa...", 'imagem', 'diagrama', 'figura', 'gráfico' ou 'fluxograma' na resposta.
    """
    
    for nome_arquivo in arquivos_imagens:
        caminho_completo = os.path.join(pasta_prints, nome_arquivo)
        img_id = nome_arquivo.replace('.png', '') 
        
        uploaded_file = None
        
        try:
            # UPLOAD DO ARQUIVO
            print(f" [Uploading file for vision analysis: {nome_arquivo}]")
            uploaded_file = client.files.upload(file=caminho_completo)
            
            # CHAMADA DA API MULTIMODAL
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt_vision, uploaded_file]
            )
            
            descricao = response.text.strip().replace('\n', ' ')
            
            mapa_descricoes[img_id] = descricao
            print(f" ✅ Descrição gerada para {img_id}: {descricao}")
            
        except APIError as e:
            print(f"❌ ERRO API Gemini ao processar {img_id}: {e}")
            mapa_descricoes[img_id] = "ERRO_DESCRICAO"
        except Exception as e:
            print(f"❌ ERRO inesperado ao carregar arquivo {img_id}: {e}")
            mapa_descricoes[img_id] = "ERRO_DESCRICAO"
            
        finally:
            # Deletar o arquivo do serviço Gemini após o uso
            if uploaded_file:
                client.files.delete(name=uploaded_file.name) 
                
    # Salva o mapa de descrições
    with open(caminho_saida, "w", encoding="utf-8") as f:
        json.dump(mapa_descricoes, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Análise de Visão concluída. Descrições salvas em: {caminho_saida}")
    return caminho_saida