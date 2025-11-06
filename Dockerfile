FROM python:3.11-slim

# Evita criação de .pyc e garante logs sem buffer
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Dependências de sistema necessárias para WeasyPrint e performance básica
# Cairo/Pango/GDK-PixBuf são obrigatórios para renderização de PDF/HTML
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala dependências Python primeiro para cache eficiente
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do projeto
COPY . .

# Garante diretórios esperados pela aplicação
RUN mkdir -p /app/data /app/temp_uploads

EXPOSE 8001

# Executa com múltiplos workers para produção
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]