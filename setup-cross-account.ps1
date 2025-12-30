#!/usr/bin/env pwsh
# Setup cross-account roles in STG or PRD accounts
# Run this script in the target account (STG or PRD)

param(
    [Parameter(Mandatory=$true)]
    [string]$InnovationAccountId,
    
    [string]$Region = "us-east-1",
    [string]$Profile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n🏥 HealthAI Cross-Account Role Setup" -ForegroundColor Cyan
Write-Host "=====================================`n" -ForegroundColor Cyan

if ($Profile) {
    $env:AWS_PROFILE = $Profile
    Write-Host "Using AWS Profile: $Profile" -ForegroundColor Yellow
}

# Get current account
$CurrentAccountId = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to authenticate. Check your AWS credentials." -ForegroundColor Red
    exit 1
}

Write-Host "Current Account: $CurrentAccountId" -ForegroundColor Green
Write-Host "Innovation Account: $InnovationAccountId" -ForegroundColor Green
Write-Host "Region: $Region`n" -ForegroundColor Green

# Deploy cross-account roles
Write-Host "Deploying cross-account IAM roles..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file cloudformation/cross-account-roles.yaml `
    --stack-name HealthAI-CrossAccount-Roles `
    --parameter-overrides InnovationAccountId=$InnovationAccountId `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy cross-account roles" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Cross-account roles deployed successfully!" -ForegroundColor Green

# Display role ARNs
Write-Host "`nCreated Roles:" -ForegroundColor Yellow
aws cloudformation describe-stacks `
    --stack-name HealthAI-CrossAccount-Roles `
    --region $Region `
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' `
    --output table

Write-Host "`nThese roles allow the Innovation account ($InnovationAccountId) to deploy to this account.`n" -ForegroundColor Cyan
