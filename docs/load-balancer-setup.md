# Guia de Configuração: Global Load Balancer (HTTP(S)) para Cloud Run

Este guia descreve como expor o Cloud Assist (serviço Cloud Run) via Global HTTP(S) Load Balancer com domínio opcional e certificados gerenciados.

## Pré-requisitos
- Projeto GCP com faturamento ativo.
- Serviço Cloud Run implantado (ex.: `resumopro-service`).
- `gcloud` instalado e autenticado.
- Permissões: Compute Admin, Cloud Run Admin, Storage Admin, e DNS Admin (se usar domínio).

## Passo a passo
1. Backend service (serverless NEG)
   - Crie um NEG serverless apontando para o serviço Cloud Run:
     ```sh
     gcloud compute network-endpoint-groups create resumopro-neg \
       --region=us-central1 \
       --network-endpoint-type=serverless \
       --cloud-run-service=resumopro-service
     ```

2. Health check e backend
   - O Global LB para HTTP(S) não exige health check separado para serverless; ele usa capacidade do Cloud Run.
   - Crie um backend service e associe o NEG:
     ```sh
     gcloud compute backend-services create resumopro-backend --global --protocol=HTTP
     gcloud compute backend-services add-backend resumopro-backend --global \
       --network-endpoint-group=resumopro-neg --network-endpoint-group-region=us-central1
     ```

3. Host e certificado (opcional)
   - Para `resumopro.com.br` e `www.resumopro.com.br`, crie um certificado gerenciado:
     ```sh
     gcloud compute ssl-certificates create resumopro-managed-cert \
       --domains=resumopro.com.br,www.resumopro.com.br
     ```
   - Garanta que o DNS do domínio aponte para o IP global (ver próximo passo). O certificado só ficará ativo após a validação DNS.

4. Regras e IP
   - Reserve um IP global:
     ```sh
     gcloud compute addresses create resumopro-ip --global
     gcloud compute addresses describe resumopro-ip --global --format="value(address)"
     ```
   - Crie mapa de URL e proxy:
     ```sh
     gcloud compute url-maps create resumopro-url-map --default-service=resumopro-backend
     gcloud compute target-http-proxies create resumopro-http-proxy --url-map=resumopro-url-map
     gcloud compute target-https-proxies create resumopro-https-proxy \
       --url-map=resumopro-url-map --ssl-certificates=resumopro-managed-cert
     ```
   - Crie regras de encaminhamento (porta 80 e 443):
     ```sh
     gcloud compute forwarding-rules create resumopro-http-rule --global \
       --target-http-proxy=resumopro-http-proxy --ports=80 --address=resumopro-ip
     gcloud compute forwarding-rules create resumopro-https-rule --global \
       --target-https-proxy=resumopro-https-proxy --ports=443 --address=resumopro-ip
     ```

5. DNS
   - No provedor de DNS, crie um registro `A` apontando `resumopro.com.br` e `www.resumopro.com.br` para o IP global obtido.
   - Aguarde a propagação do DNS e a emissão do certificado.

## Testes
- Acesse `https://resumopro.com.br/healthz` para verificar saúde.
- Verifique CORS com o frontend chamando `https://resumopro.com.br/api/uploads/list`.
- Teste uploads e streaming com GCS ativo.

## Observações
- Cloud Run escala automaticamente; o LB distribui tráfego globalmente.
- Para regras por caminho/host, edite o `url-map` para rotas específicas.
- Se usar autenticação do Cloud Run, remova `--allow-unauthenticated` e configure `IAP` ou cabeçalhos assinados.