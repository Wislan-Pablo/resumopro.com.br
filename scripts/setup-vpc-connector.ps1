Param(
  [string]$ProjectId = "affable-grin-477621-f0",
  [string]$Region = "southamerica-east1",
  [string]$Network = "default",
  [string]$Subnet = "serverless-subnet",
  [string]$VpcConnector = "serverless-conn",
  [string]$IpCidrRange = "10.8.0.0/28"
)

Write-Host "Setting project to $ProjectId" -ForegroundColor Cyan
gcloud config set project $ProjectId | Out-Null

Write-Host "Creating subnet $Subnet in $Region with range $IpCidrRange" -ForegroundColor Cyan
gcloud compute networks subnets create $Subnet `
  --network $Network `
  --region $Region `
  --range $IpCidrRange

Write-Host "Creating VPC Connector $VpcConnector" -ForegroundColor Cyan
gcloud compute networks vpc-access connectors create $VpcConnector `
  --region $Region `
  --subnet $Subnet

Write-Host "Checking VPC Connector state" -ForegroundColor Green
gcloud compute networks vpc-access connectors describe $VpcConnector --region $Region --format="value(state)"