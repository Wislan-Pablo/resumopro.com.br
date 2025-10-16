import fitz
import json
import os

def gerar_prints_das_coordenadas(caminho_pdf, caminho_json="mapa_coordenadas.json", pasta_saida="prints_imagens"):
    
    # 1. Carregar o mapa de coordenadas
    with open(caminho_json, "r", encoding="utf-8") as f:
        mapa_coordenadas = json.load(f)
        
    # 2. Abrir o PDF
    doc = fitz.open(caminho_pdf)
    
    # 3. Criar a pasta de saída
    if not os.path.exists(pasta_saida):
        os.makedirs(pasta_saida)

    print(f"Gerando {len(mapa_coordenadas)} prints...")

    for img_id, dados in mapa_coordenadas.items():
        try:
            bbox_list = dados["bbox"]
            num_pagina = dados["pagina"]

            min_x0, min_y0, max_x1, max_y1 = bbox_list[0], bbox_list[1], bbox_list[2], bbox_list[3]

            coordenadas = fitz.Rect(min_x0, min_y0, max_x1, max_y1)

            # Aumenta a área de corte (padding) para pegar um pouco das margens
            margem = 5
            coordenadas.x0 -= margem
            coordenadas.y0 -= margem
            coordenadas.x1 += margem
            coordenadas.y1 += margem

            pagina = doc[num_pagina]
            pix = pagina.get_pixmap(clip=coordenadas, dpi=300)
            nome_arquivo = os.path.join(pasta_saida, f"{img_id}.png")
            pix.save(nome_arquivo)
            print(f"✅ Print salvo: {nome_arquivo}")

        except Exception as e:
            print(f"❌ Erro ao processar {img_id}: {e}")
            
    return True # <--- ISSO É ESSENCIAL PARA O ORQUESTRADOR!
# --- Exemplo de uso da Fase 2 ---
if __name__ == "__main__":
    gerar_prints_das_coordenadas("arquivoteste.pdf")