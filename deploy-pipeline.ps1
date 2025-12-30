#!/usr/bin/env pwsh
# Deploy CodePipeline for multi-account deployments
# Run this AFTER setting up cross-account roles in STG and PRD

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubOwner,
    
    [Parameter(Mandatory=$true)]
    [string]$GitHubToken,
    
    [Parameter(Mandatory=$true)]
    [string]$STGAccountId,
    
    [Parameter(Mandatory=$true)]
    [string]$PRDAccountId,
    
    [string]$GitHubRepo = "HealthAI",
    [string]$GitHubBranch = "main",
    [string]$Region = "us-east-1",
    [string]$Profile = "innovation"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🏥 HealthAI Pipeline Deployment" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Set AWS profile
$env:AWS_PROFILE = $Profile

# Validate accounts
Write-Host "Validating AWS accounts..." -ForegroundColor Yellow
$CurrentAccountId = (aws sts get-caller-identity --query Account --output text)
Write-Host "  Innovation Account: $CurrentAccountId" -ForegroundColor Green
Write-Host "  STG Account: $STGAccountId" -ForegroundColor Green
Write-Host "  PRD Account: $PRDAccountId`n" -ForegroundColor Green

# Deploy pipeline
Write-Host "Deploying CodePipeline stack..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file cloudformation/pipeline.yaml `
    --stack-name HealthAI-Pipeline `
    --parameter-overrides `
        GitHubOwner=$GitHubOwner `
        GitHubToken=$GitHubToken `
        GitHubRepo=$GitHubRepo `
        GitHubBranch=$GitHubBranch `
        STGAccountId=$STGAccountId `
        PRDAccountId=$PRDAccountId `
        ProjectName=HealthAI `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy pipeline" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Pipeline deployed successfully!" -ForegroundColor Green

# Get pipeline URL
$PipelineUrl = (aws cloudformation describe-stacks `
    --stack-name HealthAI-Pipeline `
    --region $Region `
    --query 'Stacks[0].Outputs[?OutputKey==`PipelineUrl`].OutputValue' `
    --output text)

Write-Host "`nPipeline URL:" -ForegroundColor Yellow
Write-Host $PipelineUrl -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Push code to GitHub to trigger the pipeline" -ForegroundColor White
Write-Host "   git push origin main" -ForegroundColor Gray
Write-Host "2. Monitor pipeline execution:" -ForegroundColor White
Write-Host "   $PipelineUrl" -ForegroundColor Gray
Write-Host "3. Approve manual approvals for STG and PRD deployments`n" -ForegroundColor White

# Open pipeline in browser
$openBrowser = Read-Host "Open pipeline in browser? (y/n)"
if ($openBrowser -eq 'y') {
    Start-Process $PipelineUrl
}
