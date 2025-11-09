Param(
  [string]$ProjectId = "affable-grin-477621-f0",
  [string]$Region = "us-central1",
  [string]$ServiceName = "resumopro-service",
  [string]$Repo = "projetollm",
  [string]$ImageTag = "us-central1-docker.pkg.dev/$ProjectId/$Repo/app:latest",
  [string]$ServiceAccount = "resumopro-run-sa",
  [string]$Bucket = "resumopro-storage-bucket",
  [string]$DbUser = "wislanpablo",
  [string]$DbName = "resumopro-db",
  [string]$DbHost = "10.54.192.3",
  [string]$SecretName = "resumopro-db-secret",
  [string]$VpcConnector = "serverless-conn",
  [string]$Egress = "all-traffic"
)

Write-Host "Setting project to $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId | Out-Null

Write-Host "Building and pushing image: $ImageTag" -ForegroundColor Cyan
gcloud builds submit --tag $ImageTag

Write-Host "Deploying Cloud Run service: $ServiceName" -ForegroundColor Cyan
gcloud run deploy $ServiceName `
  --image $ImageTag `
  --region $Region `
  --allow-unauthenticated `
  --service-account $ServiceAccount `
  --set-env-vars "PORT=8080,GCS_BUCKET=$Bucket,UPLOADS_BUCKET=$Bucket,DB_USER=$DbUser,DB_NAME=$DbName,DB_HOST=$DbHost" `
  --update-secrets "DB_PASSWORD=$SecretName:latest" `
  --vpc-connector $VpcConnector `
  --egress-settings $Egress

Write-Host "Service URL:" -ForegroundColor Green
gcloud run services describe $ServiceName --region $Region --format="value(status.url)"