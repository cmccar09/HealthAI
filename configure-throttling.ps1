#!/usr/bin/env pwsh
# Configure Throttling for HealthAI AI Processor
# Limits concurrent executions to prevent Bedrock throttling

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 Configuring AI Processor Throttling" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$REGION = "us-east-1"
$FUNCTION_NAME = "HealthAI-AIProcessor"
$QUEUE_NAME = "HealthAI-AI.fifo"

# Step 1: Set Lambda Reserved Concurrency
Write-Host "Step 1: Setting Lambda reserved concurrency..." -ForegroundColor Yellow
Write-Host "  Limiting to 10 concurrent executions (prevents Bedrock throttling)" -ForegroundColor Gray

aws lambda put-function-concurrency `
    --function-name $FUNCTION_NAME `
    --reserved-concurrent-executions 10 `
    --region $REGION | Out-Null

Write-Host "  ✓ Lambda concurrency limited to 10" -ForegroundColor Green

# Step 2: Update SQS Event Source Mapping for batch processing
Write-Host "`nStep 2: Updating SQS event source mapping..." -ForegroundColor Yellow

# Get the event source mapping UUID
$accountId = aws sts get-caller-identity --query Account --output text
$queueArn = "arn:aws:sqs:${REGION}:${accountId}:${QUEUE_NAME}"

$mappingUuid = aws lambda list-event-source-mappings `
    --function-name $FUNCTION_NAME `
    --region $REGION `
    --query "EventSourceMappings[?EventSourceArn=='$queueArn'].UUID" `
    --output text

if ($mappingUuid) {
    Write-Host "  Found event source mapping: $mappingUuid" -ForegroundColor Gray
    Write-Host "  Updating to batch_size=1, max_concurrency=10" -ForegroundColor Gray
    
    aws lambda update-event-source-mapping `
        --uuid $mappingUuid `
        --batch-size 1 `
        --scaling-config MaximumConcurrency=10 `
        --region $REGION | Out-Null
    
    Write-Host "  ✓ Event source mapping updated" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Event source mapping not found" -ForegroundColor Yellow
}

# Step 3: Increase SQS visibility timeout to prevent early retries
Write-Host "`nStep 3: Updating SQS queue attributes..." -ForegroundColor Yellow

$queueUrl = "https://sqs.$REGION.amazonaws.com/$accountId/$QUEUE_NAME"

# Set visibility timeout to 15 minutes (900 seconds) to match Lambda timeout
# This prevents messages from being retried while Lambda is still processing
aws sqs set-queue-attributes `
    --queue-url $queueUrl `
    --attributes VisibilityTimeout=900,ReceiveMessageWaitTimeSeconds=20 `
    --region $REGION

Write-Host "  ✓ Queue visibility timeout set to 900s (15 min)" -ForegroundColor Green
Write-Host "  ✓ Long polling enabled (20s wait time)" -ForegroundColor Green

Write-Host "`n✅ Throttling Configuration Complete!" -ForegroundColor Green
Write-Host "`nConfiguration Summary:" -ForegroundColor Cyan
Write-Host "  • Lambda Concurrency: 10 max concurrent executions" -ForegroundColor White
Write-Host "  • SQS Batch Size: 1 message per invocation" -ForegroundColor White
Write-Host "  • SQS Visibility: 900 seconds (15 minutes)" -ForegroundColor White
Write-Host "  • Long Polling: 20 seconds" -ForegroundColor White
Write-Host "`nThis configuration:" -ForegroundColor Cyan
Write-Host "  ✓ Prevents Bedrock throttling (max 10 parallel AI calls)" -ForegroundColor Green
Write-Host "  ✓ Allows exponential backoff within Lambda" -ForegroundColor Green
Write-Host "  ✓ Prevents duplicate processing during retries" -ForegroundColor Green
Write-Host "  ✓ Reduces SQS polling overhead" -ForegroundColor Green
