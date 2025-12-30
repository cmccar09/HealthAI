#!/usr/bin/env pwsh
# Quick deploy to Innovation account (Dev environment)
# This script initializes the Innovation account with Dev infrastructure

param(
    [string]$Region = "us-east-1",
    [string]$Profile = "innovation"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🏥 HealthAI Innovation Account Setup" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Set AWS profile
$env:AWS_PROFILE = $Profile
Write-Host "Using AWS Profile: $Profile" -ForegroundColor Yellow

# Get Account ID
$AccountId = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to authenticate. Check your AWS credentials." -ForegroundColor Red
    exit 1
}

Write-Host "Account ID: $AccountId" -ForegroundColor Green
Write-Host "Region: $Region`n" -ForegroundColor Green

# Step 1: Package Lambda functions
Write-Host "Step 1: Packaging Lambda functions..." -ForegroundColor Yellow
.\package-lambdas.ps1 -Environment dev -Region $Region -Profile $Profile

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to package Lambda functions" -ForegroundColor Red
    exit 1
}

# Step 2: Deploy infrastructure
Write-Host "`nStep 2: Deploying CloudFormation infrastructure..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file cloudformation/infrastructure.yaml `
    --stack-name HealthAI-dev `
    --parameter-overrides Environment=dev ProjectName=HealthAI `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region `
    --no-fail-on-empty-changeset

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy CloudFormation stack" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Innovation account setup complete!" -ForegroundColor Green

# Display stack outputs
Write-Host "`nStack Outputs:" -ForegroundColor Yellow
aws cloudformation describe-stacks `
    --stack-name HealthAI-dev `
    --region $Region `
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' `
    --output table

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Setup cross-account roles in STG and PRD accounts" -ForegroundColor White
Write-Host "2. Deploy the CI/CD pipeline:" -ForegroundColor White
Write-Host "   .\deploy-pipeline.ps1 -GitHubOwner YOUR_USERNAME -GitHubToken YOUR_TOKEN -STGAccountId XXX -PRDAccountId YYY" -ForegroundColor Gray
Write-Host "3. Push your code to GitHub to trigger the pipeline`n" -ForegroundColor White
