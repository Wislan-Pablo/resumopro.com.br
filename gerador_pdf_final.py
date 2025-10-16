import os
import re # Necessário para expressões regulares
from weasyprint import HTML
from markdown_it import MarkdownIt

# --- FUNÇÃO AUXILIAR PARA RECONSTRUIR TABELAS ---

def limpar_e_reconstruir_tabelas(texto):
    """
    Tenta identificar e separar linhas de tabela grudadas (que não têm \n entre as colunas).
    Isso é necessário porque a cópia/colagem de rich text destrói as quebras de linha essenciais.
    """
    
    linhas = []
    em_tabela = False
    
    # Divide o texto em linhas e tenta identificar se estamos dentro de um bloco de tabela
    for linha in texto.splitlines():
        linha_strip = linha.strip()

        # Verifica se a linha atual inicia uma tabela
        if linha_strip.startswith('|'):
            # Se já estávamos processando uma tabela, esta linha é uma continuação que precisa de uma quebra de linha antes
            if em_tabela:
                # Procura por um padrão de continuação grudada e tenta separá-la
                if linha_strip.count('|') > 2:
                    # Encontra o primeiro pipe e insere uma quebra de linha antes
                    partes = linha_strip.split('|')
                    if len(partes) > 2:
                         # Junta as partes com quebras de linha para reconstruir as linhas da tabela
                         # Isso é uma heurística: assume que o pipe inicial foi perdido na junção.
                         linha_reconstruida = '|' + '|\n|'.join(partes[1:])
                         linhas.append(linha_reconstruida)
                         continue

            # Se a linha começa com o separador (| --- |) ou é uma linha de dados
            if linha_strip.count('|') >= 2:
                # Usamos o marcador de linha para ajudar o parser
                # Garantimos que a linha de separação (| --- |) tenha quebra de linha clara
                if linha_strip.startswith('|'):
                    linhas.append(linha_strip)
                    em_tabela = True
                    continue
            
        # Se a linha não começar com '|' ou não for uma tabela, ou se a tabela terminou, adicionamos normalmente
        if em_tabela and not linha_strip.startswith('|') and linha_strip:
             # Sai do modo tabela se houver texto quebrado sem o pipe inicial
             em_tabela = False

        if not em_tabela:
             # Se não for tabela, apenas adiciona a linha original
             linhas.append(linha)

    # Retorna o texto reconstruído
    return '\n'.join(linhas)

# --- FUNÇÕES DE MONTAGEM E CONVERSÃO ---

def montar_resumo_com_imagens(caminho_resumo_tags, caminho_html_saida, nome_subpasta_imagens_html):
    """
    Carrega o resumo (Markdown), converte para HTML, substitui as tags de imagem
    e garante que o caminho de SRC do HTML seja relativo (ex: prints_imagens/img.png).
    """
    print("--- 1. Montagem: Gerando HTML ---")

    try:
        # 1. Carregar como TEXTO (esperando Markdown)
        with open(caminho_resumo_tags, "r", encoding="utf-8") as f:
            resumo_texto = f.read()
    except FileNotFoundError:
        print(f"❌ ERRO: Arquivo de resumo com tags não encontrado em '{caminho_resumo_tags}'")
        return None

    # 2. CONVERTER MARKDOWN PARA HTML (ignora a pré-limpeza, que é falha)
    md = MarkdownIt()
    resumo_html_base = md.render(resumo_texto)
    resumo_montado_html = resumo_html_base
    
    # Define a estrutura HTML básica e estilos (com CSS de tabela)
    html_header = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Resumo Final com Imagens IA</title>
    <style>
        body { text-align: justify; font-family: Arial, sans-serif; margin: 50px; line-height: 1.6; }
        h1, h2, h3 { 
            border-bottom: 1px solid #ddd; 
            padding-bottom: 5px; 
            margin-top: 30px; 
        }
        ul { margin-bottom: 20px; }
        
        /* ESTILOS DE TABELA OTIMIZADOS PARA WEASYPRINT */
        table {
            border-collapse: collapse; /* Une as bordas */
            width: 100%; 
            margin: 20px 0; 
            font-size: 0.9em;
            page-break-inside: auto; 
        }
        th, td {
            border: 1px solid #ccc;
            padding: 10px;
            text-align: left;
            page-break-inside: avoid; 
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        
        /* Estilos para Imagem */
        .image-container { text-align: center; margin: 20px auto; page-break-inside: avoid; }
        .image-container img { max-width: 70%; width: 100%; height: auto; }
    </style>
</head>
<body>
"""
    html_footer = "</body></html>"
    
    # 3. Substituir TAGs ([IMAGEM_ID_X_Y]) no HTML
    
    # O caminho COMPLETO não é usado aqui, apenas o nome relativo para o HTML
    pasta_imagens_caminho_html = os.path.join("temp_uploads", nome_subpasta_imagens_html)
    
    # Nota: Precisamos dos arquivos PNG para saber quais tags substituir.
    # O loop abaixo usa a pasta temporária para listar os nomes de arquivo
    # mas o HTML usará o caminho relativo para o servidor.

    # Lista arquivos para substituição (assumindo que a pasta prints_imagens existe dentro de temp_uploads)
    pasta_prints_completa = os.path.join(os.path.dirname(caminho_html_saida), nome_subpasta_imagens_html)
    
    if not os.path.exists(pasta_prints_completa):
        print(f"❌ ERRO: Pasta de imagens '{pasta_prints_completa}' não encontrada. Abortando montagem.")
        return None

    for nome_arquivo in os.listdir(pasta_prints_completa):
        if nome_arquivo.endswith(".png"):
            img_id = nome_arquivo.replace(".png", "")
            tag_marcador = f"[{img_id}]"
            
            # CRÍTICO: O caminho SRC precisa ser relativo ao diretório raiz do servidor (temp_uploads/)
            html_imagem = f'<div class="image-container"><img src="{nome_subpasta_imagens_html}/{nome_arquivo}" alt="Diagrama {img_id}"></div>'
            
            resumo_montado_html = resumo_montado_html.replace(tag_marcador, html_imagem)

    # 4. Finalizar o arquivo HTML
    conteudo_final_html = html_header + resumo_montado_html + html_footer

    # Salva a saída como arquivo HTML
    with open(caminho_html_saida, "w", encoding="utf-8") as f:
        f.write(conteudo_final_html)
        
    print(f"✅ Arquivo HTML de montagem salvo em: '{caminho_html_saida}'")
    return caminho_html_saida

def converter_html_para_pdf(caminho_html, caminho_pdf_saida):
    """Converte um arquivo HTML para um arquivo PDF usando WeasyPrint."""
    print("--- 2. Conversão: Gerando PDF ---")
    try:
        # WeasyPrint resolve os caminhos relativos (src="prints_imagens/...") a partir do diretório onde o HTML está.
        HTML(caminho_html).write_pdf(caminho_pdf_saida)
        print(f"\n🎉 Conversão para PDF concluída com sucesso!")
        print(f"   Arquivo PDF final: '{caminho_pdf_saida}'")
        return True
    except Exception as e:
        print(f"\n❌ ERRO durante a conversão para PDF: {e}")
        return False

# --- FUNÇÃO PRINCIPAL DE EXECUÇÃO (DO PIPELINE) ---

def executar_fase_final(caminho_resumo_tags, caminho_pdf_final_output, nome_subpasta_imagens_input):
    
    ARQUIVO_HTML_SAIDA = os.path.join(os.path.dirname(caminho_pdf_final_output), "relatorio_final.html")
    
    print("\n-------------------------------------------------")
    print("INICIANDO FASE FINAL: MONTAGEM E CONVERSÃO PDF")
    print("-------------------------------------------------")
    
    # 1. Montagem HTML
    caminho_html_gerado = montar_resumo_com_imagens(
        caminho_resumo_tags, 
        ARQUIVO_HTML_SAIDA,
        nome_subpasta_imagens_input # Passa o nome da subpasta
    )
    
    if caminho_html_gerado:
        # 2. Conversão para PDF
        converter_html_para_pdf(caminho_html_gerado, caminho_pdf_final_output)
    
    print("\n--- FIM DO PROCESSO DE GERAÇÃO ---")