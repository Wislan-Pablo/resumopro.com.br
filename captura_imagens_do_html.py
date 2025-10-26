from bs4 import BeautifulSoup
import os
import requests
import re
import base64
import hashlib # Necessário para gerar hashes das imagens

# O diretório onde as imagens serão salvas
OUTPUT_IMAGES_DIR = "imagens_extraidas"


def capturar_imagens_do_corpo_html(caminho_html: str, caminho_imagens_destino: str):
    """
    Filtra o corpo da página HTML e captura todas as imagens, 
    ignorando duplicatas baseadas no conteúdo (hash binário).
    Retorna um dicionário com informações das imagens incluindo página de origem.
    """
    print("\n--- FASE B & C: Filtragem do Corpo e Captura de Imagens ---")
    
    if not os.path.exists(caminho_imagens_destino):
        os.makedirs(caminho_imagens_destino)
        
    try:
        with open(caminho_html, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"❌ Erro: Arquivo HTML não encontrado em {caminho_html}")
        return False

    soup = BeautifulSoup(html_content, 'html.parser')
    imagens_salvas = []
    imagens_info = {}  # Dicionário para armazenar informações das imagens
    
    # --- NOVO: CONJUNTO PARA ARMAZENAR HASHES DE IMAGENS JÁ VISTAS ---
    hashes_salvos = set()
    contador_imagens_unicas = 0 # Usado para nomear as imagens sequencialmente
    
    body = soup.find('body')
    if not body:
        print("❌ Não foi possível encontrar a tag <body> no HTML.")
        return False

    # Variável para rastrear o total de imagens encontradas (para a mensagem final)
    total_imagens_encontradas = 0

    # 1. Iterar sobre todas as tags de imagem
    for i, img in enumerate(body.find_all('img')):
        src = img.get('src')
        page_number = img.get('data-page-number', 'Desconhecida')  # Extrair número da página
        if not src:
            continue
        
        total_imagens_encontradas += 1
        img_data = None 

        # 2. Lógica de Captura (Obtém os dados binários)
        if src.startswith('data:image'):
            # A. Imagem embutida em Base64
            try:
                header, encoded = src.split(',', 1)
                img_data = base64.b64decode(encoded)
            except Exception:
                continue
            
        elif src.startswith(('http', 'https')):
            # B. Imagem externa (apenas para completude)
            try:
                img_data = requests.get(src).content
            except Exception:
                continue

        # --- FILTRO DE DUPLICATAS POR HASH ---
        if img_data:
            # 3. Gerar o Hash do Conteúdo Binário
            img_hash = hashlib.sha256(img_data).hexdigest()
            
            if img_hash in hashes_salvos:
                # SE O HASH EXISTE, ESTA IMAGEM É UMA DUPLICATA E É IGNORADA.
                print(f"   ℹ️ Imagem {i+1} ignorada: Duplicata (Hash: {img_hash[:6]}).")
                continue
            
            # --- NOVO FILTRO DE TAMANHO MÍNIMO (RELEVÂNCIA) ---
            # Define o limite mínimo (ex: 5 KB). Imagens pequenas (logotipos, linhas) serão descartadas.
            MIN_SIZE_BYTES = 7500 
            
            if len(img_data) < MIN_SIZE_BYTES:
                 print(f"   ℹ️ Imagem {i+1} ignorada: Tamanho {len(img_data)}B é muito pequeno para ser um diagrama (min: 7.500 bytes).")
                 # O HASH não é adicionado, permitindo que a próxima ocorrência (se for maior) seja verificada.
                 continue
            
            # --- SE CHEGOU AQUI, A IMAGEM É ÚNICA ---
            
            # 4. Adiciona o hash ao conjunto (garantindo que futuras cópias sejam ignoradas)
            hashes_salvos.add(img_hash)
            
            # 5. Incrementa o contador de imagens ÚNICAS
            contador_imagens_unicas += 1

            # 6. Salvar o arquivo com um nome sequencial baseado apenas nas imagens ÚNICAS
            nome_arquivo = f"img_{contador_imagens_unicas}.png"
            caminho_saida = os.path.join(caminho_imagens_destino, nome_arquivo)

            with open(caminho_saida, 'wb') as f:
                f.write(img_data)
            
            # 7. Armazenar informações da imagem incluindo página
            imagens_info[nome_arquivo] = {
                'caminho': caminho_saida,
                'pagina': page_number,
                'hash': img_hash
            }
            
            imagens_salvas.append(caminho_saida)
            print(f"   ✅ Imagem única salva como: {nome_arquivo} (Página {page_number})")

    print(f"✅ Captura concluída. {len(imagens_salvas)} imagens únicas salvas em {caminho_imagens_destino}")
    print(f"   Foram encontradas e descartadas {total_imagens_encontradas - len(imagens_salvas)} imagens repetidas (incluindo a primeira cópia).")
    
    # Salvar informações das imagens em um arquivo JSON
    import json
    info_file_path = os.path.join(caminho_imagens_destino, 'imagens_info.json')
    with open(info_file_path, 'w', encoding='utf-8') as f:
        json.dump(imagens_info, f, ensure_ascii=False, indent=2)
    
    print(f"   📄 Informações das imagens salvas em: {info_file_path}")
    
    return True