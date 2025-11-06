# Deploy em Produção

Este guia explica como colocar a aplicação FastAPI/SQLModel em produção usando Docker Compose e Nginx como proxy reverso.

## Pré-requisitos
- Docker Desktop instalado (Windows/macOS) ou Docker Engine (Linux).
- Um domínio apontando para o servidor (opcional, recomendado para HTTPS).
- Variáveis de ambiente necessárias:
  - `GEMINI_API_KEY` – chave para o serviço Gemini.
  - `DATABASE_URL` (opcional) – por padrão usa `sqlite:///data/app.db`.

## Estrutura de Deploy
- `Dockerfile` – imagem de produção com libs do WeasyPrint.
- `compose.yaml` – orquestra `app` (FastAPI) e `nginx` (proxy).
- `deploy/nginx.conf` – configuração de proxy reverso e estáticos.
- Volumes persistentes:
  - `./data` mapeado em `/app/data` (SQLite).
  - `./temp_uploads` mapeado em `/app/temp_uploads`.

## Passo a passo
1. Crie o arquivo `.env` na raiz do projeto:
   ```env
   GEMINI_API_KEY=SEU_TOKEN_AQUI
   # opcional: sobrescrever URL do banco
   # DATABASE_URL=sqlite:///data/app.db
   ```

2. Crie diretórios para volumes (se não existirem):
   ```bash
   mkdir -p data temp_uploads
   ```

3. Suba a stack em modo detached:
   ```bash
   docker compose up -d --build
   ```

4. Acesse a aplicação:
   - Backend direto: `http://localhost:8001/`
   - Via Nginx: `http://localhost/`
   - Editor estático: `http://localhost/static/editor.html`

## HTTPS (opcional, recomendado)
Para TLS, você pode:
- Usar um proxy gerenciado (Cloudflare) com modo Full/Strict apontando para o Nginx.
- Integrar Certbot no Nginx (necessário abrir portas 80/443 e montar certificados):
  - Atualize `deploy/nginx.conf` com bloco `server` para `listen 443 ssl` e caminhos dos certificados.
  - Monte `./certs` em `/etc/nginx/certs` no `compose.yaml`.

## Banco de dados
- Por padrão, a aplicação cria o schema na inicialização (`create_db_and_tables`).
- Alembic está configurado; se optar por migrações:
  ```bash
  docker compose exec app alembic upgrade head
  ```

## Operações comuns
- Logs do backend:
  ```bash
  docker compose logs -f app
  ```
- Reiniciar serviços:
  ```bash
  docker compose restart
  ```
- Atualizar imagem e reimplantar:
  ```bash
  docker compose pull && docker compose up -d --build
  ```

## Notas
- O Nginx serve ` /static/ ` diretamente para melhor performance; o restante trafega para o backend.
- Ajuste `server_name` em `deploy/nginx.conf` quando tiver o domínio definido.
- Em produção, mantenha `restart: unless-stopped` para resiliência.