import fitz # PyMuPDF
import json

def analisar_layout_e_mapear_imagens(caminho_pdf, caminho_json="mapa_coordenadas.json"):
    """
    Analisa o PDF para encontrar coordenadas de imagem, aplicando um filtro
    de cabeçalho/rodapé, e gera IDs de imagem logicamente corretos.
    """
    # map_imagens agora é a variável local do mapa
    map_imagens = {}
    conteudo_para_llm = []

    doc = fitz.open(caminho_pdf)
    
    # Dicionário para rastrear o índice de imagens válidas por número de página
    contadores_por_pagina = {} 

    for num_pagina, pagina in enumerate(doc):
        layout = pagina.get_text("dict")

        # Define as margens superior e inferior para o filtro de cabeçalho e rodapé
        largura_pagina = pagina.rect.width
        altura_pagina = pagina.rect.height
        
        # Ajuste estas margens conforme a necessidade do seu PDF (50 pontos é um bom padrão)
        margem_cabecalho = 50 
        margem_rodape = 50 
        
        # Área do corpo do documento (coordenadas Y)
        corpo_doc_y0 = margem_cabecalho
        corpo_doc_y1 = altura_pagina - margem_rodape

        blocos_texto = []
        imagens_encontradas = []

        for bloco in layout["blocks"]:
            if bloco["type"] == 0: # Texto
                texto_completo = ""
                for linha in bloco["lines"]:
                    for span in linha["spans"]:
                        texto_completo += span["text"]
                    texto_completo += "\n"
                
                # Armazena o bloco de texto completo
                blocos_texto.append((
                    bloco["bbox"][0], bloco["bbox"][1], bloco["bbox"][2], bloco["bbox"][3],
                    texto_completo.strip() 
                ))
            elif bloco["type"] == 1: # Imagem
                imagens_encontradas.append(bloco["bbox"])

        # Lógica de Associação e Injeção de Marcadores
        for i, bbox in enumerate(imagens_encontradas):
            
            # --- FILTRO DE VALIDADE (CRUCIAL PARA A CORREÇÃO DINÂMICA) ---
            y0_imagem = bbox[1]
            y1_imagem = bbox[3]
            
            # Verifica se a imagem está dentro do corpo do documento (IGNORANDO C/R)
            if y0_imagem >= corpo_doc_y0 and y1_imagem <= corpo_doc_y1:
                
                # 1. Incrementa o contador da página (SÓ PARA IMAGENS VÁLIDAS)
                if num_pagina not in contadores_por_pagina:
                     contadores_por_pagina[num_pagina] = 0
                
                contadores_por_pagina[num_pagina] += 1
                indice_corrigido = contadores_por_pagina[num_pagina]

                # --- CRIAÇÃO DINÂMICA DO ID CORRETO ---
                # O ID é baseado na contagem real de imagens válidas por página
                img_id = f"IMAGEM_ID_{num_pagina}_{indice_corrigido}"
                tag_marcador = f"[{img_id}]"

                # 2. Salva as coordenadas no mapa
                map_imagens[img_id] = {
                    "pagina": num_pagina,
                    "bbox": list(bbox)
                }

                # 3. Encontra o Bloco de Texto mais próximo abaixo da imagem
                bloco_proximo = None
                distancia_minima = float('inf')

                for bloco in blocos_texto:
                    y_inicio_bloco = bloco[1] 
                    y_final_imagem = bbox[3]
                    distancia = y_inicio_bloco - y_final_imagem

                    # Busca o bloco que começa logo abaixo da imagem
                    if 0 <= distancia < 100 and distancia < distancia_minima:
                        distancia_minima = distancia
                        bloco_proximo = bloco

                # 4. Injeta a Tag no Conteúdo (para análise futura pelo Gemini)
                if bloco_proximo:
                    conteudo_para_llm.append(f"{tag_marcador}\n{bloco_proximo[4]}")
                else:
                    conteudo_para_llm.append(f"{tag_marcador}\n")
            
            # NOTA: Imagens fora do corpo do documento (C/R) são simplesmente ignoradas.

    # Salva o mapa de coordenadas
    with open(caminho_json, "w", encoding="utf-8") as f:
        json.dump(map_imagens, f, ensure_ascii=False, indent=2)

    return "\n\n".join(conteudo_para_llm)


# --- Bloco de execução (Para testes locais) ---
if __name__ == "__main__":
    CAMINHO_PDF = "arquivoteste.pdf" 
    
    print("--- Rodando Pré-Processamento ---")
    # A função é chamada com o nome do arquivo JSON padrão
    conteudo = analisar_layout_e_mapear_imagens(CAMINHO_PDF) 
    
    print("\n--- Conteúdo Injetado (Para o LLM) ---\n")
    # print(conteudo) # Comentado para evitar poluir o console
    print("\n----------------------------------------\n")
    print("✅ Arquivo 'mapa_coordenadas.json' gerado com sucesso.")