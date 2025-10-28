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

def detectar_e_corrigir_tabelas_malformadas(texto):
    """
    Detecta e corrige tabelas que podem ter sido malformadas durante o processamento.
    """
    linhas = texto.splitlines()
    linhas_corrigidas = []
    i = 0
    
    while i < len(linhas):
        linha = linhas[i].strip()
        
        # Detectar possíveis tabelas por padrões comuns
        if _eh_possivel_tabela(linha):
            # Coletar linhas consecutivas que parecem ser parte de uma tabela
            linhas_tabela = []
            j = i
            while j < len(linhas) and _eh_possivel_tabela(linhas[j].strip()):
                linhas_tabela.append(linhas[j].strip())
                j += 1
            
            if len(linhas_tabela) >= 2:
                # Tentar reconstruir como tabela markdown
                tabela_reconstruida = _reconstruir_tabela_markdown(linhas_tabela)
                if tabela_reconstruida:
                    linhas_corrigidas.extend(tabela_reconstruida)
                    i = j
                    continue
        
        linhas_corrigidas.append(linhas[i])
        i += 1
    
    return '\n'.join(linhas_corrigidas)

def _eh_possivel_tabela(linha):
    """Verifica se uma linha pode ser parte de uma tabela."""
    if not linha or len(linha.strip()) < 5:
        return False
    
    # Padrões que indicam possíveis tabelas
    padroes_tabela = [
        r'\|\s*.*\s*\|',  # Já tem pipes
        r'\s+\w+\s+\w+',  # Múltiplas palavras com espaços
        r'\w+\s*:\s*\w+',  # Padrão chave:valor
        r'\w+\s*-\s*\w+',  # Padrão chave-valor
    ]
    
    return any(re.search(padrao, linha) for padrao in padroes_tabela)

def _reconstruir_tabela_markdown(linhas_tabela):
    """Tenta reconstruir uma tabela markdown a partir de linhas malformadas."""
    if len(linhas_tabela) < 2:
        return None
    
    # Se já tem pipes, apenas limpar
    if all('|' in linha for linha in linhas_tabela):
        return linhas_tabela
    
    # Tentar detectar colunas por espaços
    primeira_linha = linhas_tabela[0]
    posicoes_colunas = []
    
    # Encontrar posições de múltiplos espaços
    for match in re.finditer(r'  +', primeira_linha):
        posicoes_colunas.append(match.start())
    
    if len(posicoes_colunas) < 1:
        # Tentar por padrão chave:valor
        if ':' in primeira_linha or '-' in primeira_linha:
            return _formatar_como_tabela_chave_valor(linhas_tabela)
        return None
    
    # Adicionar posição final
    posicoes_colunas.append(len(primeira_linha))
    
    # Reconstruir cada linha
    linhas_formatadas = []
    for i, linha in enumerate(linhas_tabela):
        colunas = []
        for j in range(len(posicoes_colunas) - 1):
            inicio = posicoes_colunas[j]
            fim = posicoes_colunas[j + 1] if j + 1 < len(posicoes_colunas) else len(linha)
            conteudo_celula = linha[inicio:fim].strip()
            colunas.append(conteudo_celula)
        
        if colunas:
            linha_formatada = "| " + " | ".join(colunas) + " |"
            linhas_formatadas.append(linha_formatada)
            
            # Adicionar separador após cabeçalho
            if i == 0:
                separador = "|" + "---|" * len(colunas)
                linhas_formatadas.append(separador)
    
    return linhas_formatadas

def _formatar_como_tabela_chave_valor(linhas_tabela):
    """Formata linhas como tabela chave-valor."""
    linhas_formatadas = []
    linhas_formatadas.append("| Campo | Valor |")
    linhas_formatadas.append("|-------|-------|")
    
    for linha in linhas_tabela:
        # Tentar diferentes separadores
        for separador in [':', '-', '=']:
            if separador in linha:
                partes = linha.split(separador, 1)
                if len(partes) == 2:
                    chave = partes[0].strip()
                    valor = partes[1].strip()
                    linhas_formatadas.append(f"| {chave} | {valor} |")
                    break
    
    return linhas_formatadas

# --- FUNÇÕES DE MONTAGEM E CONVERSÃO ---

def montar_resumo_com_imagens(caminho_resumo_tags, caminho_html_saida, nome_subpasta_imagens_html):
    """
    Carrega o resumo (HTML editado pelo usuário) e processa as imagens posicionadas.
    """
    print("--- 1. Montagem: Gerando HTML ---")

    try:
        # 1. Carregar como HTML (já editado pelo usuário)
        with open(caminho_resumo_tags, "r", encoding="utf-8") as f:
            resumo_html = f.read()
    except FileNotFoundError:
        print(f"❌ ERRO: Arquivo de resumo editado não encontrado em '{caminho_resumo_tags}'")
        return None

    # 2. Processar conteúdo: se vier como HTML do editor, não aplicar heurísticas de Markdown
    # Isso evita corromper negritos (<strong>/<b>) e inserir linhas de tabela "| Campo | Valor |" indevidas.
    try:
        contem_tags_html = bool(re.search(r"<[^>]+>", resumo_html))
    except Exception:
        contem_tags_html = True  # por segurança, assume HTML

    if contem_tags_html:
        # Já é HTML do Summernote/Editor: preservar exatamente como está
        resumo_montado_html = resumo_html
    else:
        # Conteúdo puro (ex.: Markdown): aplicar correções de tabela e converter para HTML
        texto_md_corrigido = limpar_e_reconstruir_tabelas(resumo_html)
        texto_md_corrigido = detectar_e_corrigir_tabelas_malformadas(texto_md_corrigido)
        md = MarkdownIt()
        resumo_montado_html = md.render(texto_md_corrigido)
    
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
    
    # 3. Processar imagens já posicionadas no HTML
    # Ajustar os caminhos de imagens para formato relativo e remover querystrings (ex.: ?v=123)
    pasta_prints_completa = os.path.join(os.path.dirname(caminho_html_saida), nome_subpasta_imagens_html)
    if not os.path.exists(pasta_prints_completa):
        print(f"❌ ERRO: Pasta de imagens '{pasta_prints_completa}' não encontrada. Abortando montagem.")
        return None

    # Normalizar todos os src que apontam para /temp_uploads/imagens_extraidas/<arquivo>[?...] -> imagens_extraidas/<arquivo>
    try:
        padrao_src = re.compile(
            rf'(src\s*=\s*["\"])\/temp_uploads\/{re.escape(nome_subpasta_imagens_html)}\/([^"\']+?)(?:\?[^"\']*)?(["\"])'
        )
        resumo_montado_html = padrao_src.sub(r'\1' + nome_subpasta_imagens_html + r'/\2\3', resumo_montado_html)
    except Exception as e:
        print(f"Aviso: falha ao normalizar caminhos de imagens no HTML: {e}")

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