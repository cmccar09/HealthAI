#!/usr/bin/env pwsh
# Quick redeploy of AI Processor Lambda with throttling improvements

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 Redeploying AI Processor with Throttling Improvements" -ForegroundColor Cyan
Write-Host "=========================================================`n" -ForegroundColor Cyan

$REGION = "us-east-1"
$FUNCTION_NAME = "HealthAI-AIProcessor"
$LAMBDA_PATH = "lambdas\ai-processor"

# Step 1: Package Lambda
Write-Host "Step 1: Creating deployment package..." -ForegroundColor Yellow
Push-Location $LAMBDA_PATH

# Create zip file
$zipFile = "..\..\deployment-$FUNCTION_NAME.zip"
Remove-Item $zipFile -ErrorAction SilentlyContinue

Write-Host "  Compressing Lambda code and dependencies..." -ForegroundColor Gray
Compress-Archive -Path * -DestinationPath $zipFile -Force

Pop-Location
Write-Host "  ✓ Package created" -ForegroundColor Green

# Step 2: Update Lambda code
Write-Host "`nStep 2: Updating Lambda function code..." -ForegroundColor Yellow

aws lambda update-function-code `
    --function-name $FUNCTION_NAME `
    --zip-file "fileb://deployment-$FUNCTION_NAME.zip" `
    --region $REGION | Out-Null

Write-Host "  ✓ Lambda code updated" -ForegroundColor Green

# Step 3: Wait for update to complete
Write-Host "`nStep 3: Waiting for Lambda update to complete..." -ForegroundColor Yellow
aws lambda wait function-updated --function-name $FUNCTION_NAME --region $REGION
Write-Host "  ✓ Update completed" -ForegroundColor Green

# Clean up
Remove-Item "deployment-$FUNCTION_NAME.zip" -ErrorAction SilentlyContinue

Write-Host "`n✅ AI Processor Redeployed Successfully!" -ForegroundColor Green
Write-Host "`nUpdates Applied:" -ForegroundColor Cyan
Write-Host "  ✓ Exponential backoff with jitter for throttling" -ForegroundColor Green
Write-Host "  ✓ Image compression for >5MB images" -ForegroundColor Green
Write-Host "  ✓ Better error handling (throttling vs validation)" -ForegroundColor Green
Write-Host "  ✓ Max 5 retries with increasing delays" -ForegroundColor Green
Write-Host "`nNext: Run .\configure-throttling.ps1 to set concurrency limits" -ForegroundColor Yellow
