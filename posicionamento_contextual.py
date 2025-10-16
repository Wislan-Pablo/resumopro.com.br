import os
import json
from google import genai
from google.genai.errors import APIError
from dotenv import load_dotenv

# --- NADA DEVE SER EXECUTADO AQUI FORA DAS FUNÇÕES ---
# A inicialização do cliente e o carregamento da API dependem do argumento passado.


# AQUI ESTÁ A CORREÇÃO: ADICIONAMOS API_KEY=None à definição da função
def fase_5_posicionamento_contextual(caminho_resumo, caminho_descricoes, caminho_saida="resumo_com_tags_final.txt", API_KEY=None):
    """
    Usa o Gemini Pro para correlacionar a descrição da imagem (visão) com o texto do resumo
    e insere as tags de imagem nos locais contextuais ideais.
    """
    print("\n[FASE 4/5] Posicionamento Contextual das Tags no Resumo (Gemini Pro)...")

    # 1. VERIFICAÇÃO DE CHAVE E INICIALIZAÇÃO DO CLIENTE
    
    if not API_KEY:
        print("❌ ERRO: Chave GEMINI_API_KEY não configurada. Abortando Fase 4.")
        return None

    # 2. Carregar Insumos
    try:
        with open(caminho_descricoes, "r", encoding="utf-8") as f:
            mapa_descricoes = json.load(f)
        with open(caminho_resumo, "r", encoding="utf-8") as f:
            resumo_notebooklm = f.read().strip()
    except FileNotFoundError as e:
        print(f"❌ ERRO: Arquivo de insumo não encontrado: {e}")
        return None

    # Inicialização do Cliente
    try:
        # Usa a chave API_KEY que foi passada como argumento
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        print(f"❌ ERRO CRÍTICO na inicialização do Cliente Gemini: {e}")
        return None

    resumo_atual = resumo_notebooklm
    
    # 3. Iterar e Posicionar Cada Tag
    for img_id, descricao in mapa_descricoes.items():
        tag_marcador = f"[{img_id}]"
        
        # Ignora imagens que falharam na Fase 3
        if descricao == "ERRO_DESCRICAO":
            print(f"⚠️ Ignorando {img_id}: Falha na descrição da imagem.")
            continue
            
        print(f" [Processando Tag: {img_id}] - Descrição: {descricao[:50]}...")
        
        # O PROMPT DE POSICIONAMENTO: Instrução para inserção baseada na descrição visual
        prompt_posicionamento = f"""
        Você é um editor de relatórios sênior. Sua única tarefa é inserir a TAG de imagem: '{tag_marcador}' no local mais preciso do RESUMO fornecido.

        Use a DESCRIÇÃO DA IMAGEM para compará-la com o texto da página que contém a coordenada da tag, a fim de identificar o tópico exato (ex: 1. "Título do tópico", ou 1.1. "Título do sub tópico") que possua maior correlação de contexto e significado com a DESCRIÇÃO DA IMAGEM, e então insira a tag na linha subsequente após o primeiro parágrafo desse tópico definido.

        REGRAS RÍGIDAS:
        1. Retorne APENAS o RESUMO COMPLETO MODIFICADO.
        2. Se não houver correlação CLARA de contexto e significado entre a DESCRIÇÃO DA IMAGEM com o texto do corpo das páginas, então NÃO insira a tag.
        ---
        DESCRIÇÃO DA IMAGEM: {descricao}
        ---
        RESUMO ATUAL:
        {resumo_atual}
        """
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash', 
                contents=prompt_posicionamento,
                config={"temperature": 0.1}
            )
            
            # 3. Atualizar o Resumo
            resumo_atual = response.text.strip()
            print(f" ✅ Tag inserida com sucesso.")
            
        except APIError as e:
            print(f"❌ ERRO API Gemini ao posicionar {img_id}: {e}. Inserindo tag no final.")
            resumo_atual += f"\n\n[ERRO POSICIONAMENTO: {tag_marcador}]" 

    # 4. Salvar o Resultado Final
    with open(caminho_saida, "w", encoding="utf-8") as f:
        f.write(resumo_atual)
        
    print(f"\n--- FASE 4 CONCLUÍDA ---")
    print(f"✅ Resumo com tags final salvo em: '{caminho_saida}'")
    return caminho_saida

# --- BLOCO DE EXECUÇÃO (Para testes autônomos) ---
if __name__ == "__main__":
    # Note: Este bloco falhará sem os arquivos de entrada (resumo_notebookLM.md e mapa_descricoes.json)
    print("Execução autônoma do posicionador. Certifique-se de que os arquivos de entrada existam.")
    
    # Simulação de carga da chave:
    API_TEST = os.environ.get("GEMINI_API_KEY") 
    
    fase_5_posicionamento_contextual(
        "resumo_notebookLM.md", 
        "mapa_descricoes.json",
        API_KEY=API_TEST
    )