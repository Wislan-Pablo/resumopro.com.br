import os
from PIL import Image # Importação da biblioteca Pillow

# --- FUNÇÃO PRINCIPAL DE UNIFICAÇÃO ---

def unificar_imagens_segmentadas(pasta_prints: str):
    """
    Identifica imagens que pertencem ao mesmo grupo (baseado no prefixo IMAGEM_ID_PAGINA)
    e as une verticalmente em um único arquivo de imagem, deletando os segmentos.
    """
    print("\n--- INICIANDO UNIFICAÇÃO DE IMAGENS SEGMENTADAS ---")
    
    # 1. Agrupar Arquivos por Prefixo (IMAGEM_ID_PAGINA)
    grupos_por_pagina = {}
    arquivos = [f for f in os.listdir(pasta_prints) if f.endswith('.png')]

    for nome_arquivo in arquivos:
        # Usa rsplit('_', 1) para separar o prefixo ('IMAGEM_ID_PAGINA') do índice ('INDEX.png')
        partes = nome_arquivo.rsplit('_', 1) 
        
        if len(partes) == 2:
            prefixo = partes[0] # Ex: 'IMAGEM_ID_1'
            if prefixo not in grupos_por_pagina:
                grupos_por_pagina[prefixo] = []
            
            grupos_por_pagina[prefixo].append(nome_arquivo)
        # Se len(partes) != 2, o arquivo já está no formato unificado (IMAGEM_ID_PAGINA.png)
        # ou é um nome inválido, então ele é ignorado pelo loop de unificação.

    total_grupos_unificados = 0
    total_imagens_removidas = 0

    # 2. Iterar sobre os grupos e unificar
    for prefixo, lista_arquivos in grupos_por_pagina.items():
        
        # Só unifica se houver mais de um segmento
        if len(lista_arquivos) <= 1:
            continue

        total_grupos_unificados += 1
        
        # 2a. Carregar e classificar as imagens (CRUCIAL: Garante a ordem correta 1, 2, 3...)
        try:
             # Classifica pelo índice numérico no final do nome
             lista_arquivos.sort(key=lambda f: int(f.rsplit('_', 1)[1].replace('.png', '')))
        except Exception as e:
             # Caso a conversão para int falhe, usa a ordem alfabética e registra o erro
             print(f"   ⚠️ Aviso: Falha na classificação numérica do grupo {prefixo}: {e}")
             lista_arquivos.sort()
        
        imagens = []
        for nome_arquivo in lista_arquivos:
            caminho_completo = os.path.join(pasta_prints, nome_arquivo)
            try:
                imagens.append(Image.open(caminho_completo))
            except Exception as e:
                print(f"   ⚠️ Não foi possível abrir o arquivo {nome_arquivo}. Será ignorado: {e}")
                continue

        # Se não houver imagens válidas, pule
        if not imagens:
            continue

        # 2b. Calcular o novo tamanho da imagem unificada
        largura_maxima = max(img.width for img in imagens)
        altura_total = sum(img.height for img in imagens)
        
        imagem_unificada = Image.new('RGB', (largura_maxima, altura_total), color='white')

        # 2c. Colar as imagens sequencialmente
        y_offset = 0
        for img in imagens:
            x_centralizado = (largura_maxima - img.width) // 2
            imagem_unificada.paste(img, (x_centralizado, y_offset))
            y_offset += img.height

        # 2d. Salvar o novo arquivo e deletar os segmentos
        # O novo nome é o PREFIXO (IMAGEM_ID_PAGINA) + .png, limpando o índice.
        novo_nome_arquivo = f"{prefixo}.png" 
        caminho_novo = os.path.join(pasta_prints, novo_nome_arquivo)
        imagem_unificada.save(caminho_novo)
        
        print(f"   ✅ UNIFICADO: {len(lista_arquivos)} segmentos -> {novo_nome_arquivo}")

        # 2e. Deletar os arquivos segmentados originais
        for nome_arquivo in lista_arquivos:
            os.remove(os.path.join(pasta_prints, nome_arquivo))
            total_imagens_removidas += 1
            
    print(f"--- Unificação Concluída. {total_grupos_unificados} grupos unificados. {total_imagens_removidas} segmentos deletados. ---")