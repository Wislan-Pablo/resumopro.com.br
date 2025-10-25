import fitz
import os

def converter_pdf_para_html_simples(caminho_pdf: str, caminho_html_saida: str):
    """
    Converte o PDF para um formato HTML, garantindo que o PyMuPDF gere a saída 
    corretamente, mesmo com versões antigas.
    Retorna uma tupla: (caminho_html_saida, texto_extraido_do_pdf)
    """
    print("--- FASE A: Convertendo PDF para HTML ---")
    
    try:
        doc = fitz.open(caminho_pdf)
        
        # 1. Extrair texto puro do PDF para análise semântica
        texto_pdf_completo = ""
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            texto_pdf_completo += page.get_text() + "\n"
        
        # 2. Obter o conteúdo do documento em formato de texto estruturado (XHTML/HTML)
        # Utilizando o método 'save' com 'output="html"' para compatibilidade
        # doc.save(caminho_html_saida, output="html") # Linha original com erro
        
        # Nova abordagem: Extrair o texto como XHTML e salvar manualmente
        html_content = ""
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            html_content += page.get_text("xhtml")

        # Envolver o conteúdo XHTML com tags HTML e BODY para formar um documento HTML completo
        full_html_document = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PDF Content</title>
</head>
<body>
{html_content}
</body>
</html>
"""

        with open(caminho_html_saida, 'w', encoding='utf-8') as f:
             f.write(full_html_document)

        # html_content = "Conversão para HTML concluída via doc.save()" # Linha original

        # Já foi salvo pelo doc.save()
        # with open(caminho_html_saida, 'w', encoding='utf-8') as f:
        #      f.write(html_content)

        print(f"✅ Conversão concluída. HTML salvo em: {caminho_html_saida}")
        return caminho_html_saida, texto_pdf_completo.strip()
        
    except Exception as e:
        print(f"❌ Erro na conversão para HTML: {e}")
        # Se for um problema de argumento, registra o erro e retorna None
        return None, None