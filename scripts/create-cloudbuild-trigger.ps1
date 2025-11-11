Param(
  [string]$ProjectId,
  [string]$TriggerName = "resumopro-main-trigger",
  [string]$RepoOwner = "Wislan-Pablo",
  [string]$RepoName = "resumopro.com.br",
  [string]$Branch = "main"
)

if (-not $ProjectId) {
  Write-Error "ProjectId é obrigatório. Use -ProjectId <ID do projeto>."
  exit 1
}

Write-Host "Definindo projeto: $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId | Out-Null

Write-Host "Criando trigger do Cloud Build para GitHub (branch: $Branch)" -ForegroundColor Cyan
Write-Host "Se ainda não conectou o repositório GitHub ao Cloud Build, faça isso no console (Cloud Build > Triggers > Connect repository)." -ForegroundColor Yellow

# Cria trigger que dispara em push para a branch main usando cloudbuild.yaml
gcloud beta builds triggers create github `
  --name=$TriggerName `
  --repo-owner=$RepoOwner `
  --repo-name=$RepoName `
  --branch-pattern="^$Branch$" `
  --build-config="cloudbuild.yaml"

Write-Host "Trigger criado (se conexão com GitHub já existente)." -ForegroundColor Green