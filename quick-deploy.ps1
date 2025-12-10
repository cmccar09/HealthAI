#!/usr/bin/env pwsh
# Quick Deploy - Setup Lambda functions and triggers for existing S3 buckets
$ErrorActionPreference = "Stop"

Write-Host "🏥 HealthAI Quick Deploy" -ForegroundColor Cyan
Write-Host "Start Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n" -ForegroundColor Yellow

$REGION = "us-east-1"
$PROJECT_NAME = "HealthAI"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)

# Your existing bucket
$UPLOAD_BUCKET = "futuregen-health-ai"
$UPLOAD_PREFIX = "health-ai-upload/"
$PDF_PREFIX = "health-ai-pdf/"
$PNG_PREFIX = "health-ai-png/"
$WEBP_PREFIX = "health-ai-webp/"

Write-Host "Creating DynamoDB Tables..." -ForegroundColor Yellow
$tables = @("Documents", "Pages", "Patients", "Medications", "Diagnoses", "TestResults", "Categories")
foreach ($table in $tables) {
    $tableName = "$PROJECT_NAME-$table"
    $exists = aws dynamodb describe-table --table-name $tableName --region $REGION 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Creating: $tableName"
        # Simplified table creation - single key only
        aws dynamodb create-table `
            --table-name $tableName `
            --attribute-definitions AttributeName=id,AttributeType=S `
            --key-schema AttributeName=id,KeyType=HASH `
            --billing-mode PAY_PER_REQUEST `
            --region $REGION | Out-Null
        Write-Host "    ✓" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Exists: $tableName" -ForegroundColor Gray
    }
}

Write-Host "`nCreating SQS Queues..." -ForegroundColor Yellow
$queues = @("Processing.fifo", "AI.fifo")
foreach ($q in $queues) {
    $queueName = "$PROJECT_NAME-$q"
    aws sqs create-queue `
        --queue-name $queueName `
        --attributes '{\"FifoQueue\":\"true\",\"ContentBasedDeduplication\":\"false\",\"VisibilityTimeout\":\"900\"}' `
        --region $REGION 2>$null | Out-Null
    Write-Host "  ✓ $queueName" -ForegroundColor Green
}

Write-Host "`nCreating IAM Role..." -ForegroundColor Yellow
$roleName = "$PROJECT_NAME-Lambda-Role"

$trustPolicy = @'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
'@

$trustPolicy | Out-File "trust-policy.json" -Encoding utf8
aws iam create-role --role-name $roleName --assume-role-policy-document file://trust-policy.json 2>$null

$policies = @(
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    "arn:aws:iam::aws:policy/AmazonS3FullAccess",
    "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess",
    "arn:aws:iam::aws:policy/AmazonSQSFullAccess",
    "arn:aws:iam::aws:policy/AWSLambda_FullAccess"
)

foreach ($policy in $policies) {
    aws iam attach-role-policy --role-name $roleName --policy-arn $policy 2>$null
}

$bedrockPolicy = @'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
    "Resource": "*"
  }]
}
'@

$bedrockPolicy | Out-File "bedrock-policy.json" -Encoding utf8
aws iam put-role-policy --role-name $roleName --policy-name BedrockAccess --policy-document file://bedrock-policy.json 2>$null
Remove-Item "trust-policy.json", "bedrock-policy.json" -ErrorAction SilentlyContinue

Write-Host "  ✓ Role created, waiting 10s for propagation..." -ForegroundColor Green
Start-Sleep -Seconds 10

$roleArn = "arn:aws:iam::${ACCOUNT_ID}:role/$roleName"
$processingQueueUrl = "https://sqs.$REGION.amazonaws.com/$ACCOUNT_ID/$PROJECT_NAME-Processing.fifo"
$aiQueueUrl = "https://sqs.$REGION.amazonaws.com/$ACCOUNT_ID/$PROJECT_NAME-AI.fifo"

Write-Host "`nDeploying Lambda: upload-handler..." -ForegroundColor Yellow
Push-Location "lambdas\upload-handler"
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt -t . -q 2>$null
}
Compress-Archive -Path * -DestinationPath "..\..\upload-handler.zip" -Force
Pop-Location

aws lambda create-function `
    --function-name "$PROJECT_NAME-UploadHandler" `
    --runtime python3.11 `
    --role $roleArn `
    --handler lambda_function.lambda_handler `
    --timeout 60 `
    --memory-size 256 `
    --environment "Variables={UPLOAD_BUCKET=$UPLOAD_BUCKET,PDF_BUCKET=$UPLOAD_BUCKET,PROCESSING_QUEUE_URL=$processingQueueUrl,DOCUMENTS_TABLE=$PROJECT_NAME-Documents}" `
    --zip-file fileb://upload-handler.zip `
    --region $REGION 2>$null | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Created" -ForegroundColor Green
} else {
    Write-Host "  Updating..." -ForegroundColor Yellow
    aws lambda update-function-code --function-name "$PROJECT_NAME-UploadHandler" --zip-file fileb://upload-handler.zip --region $REGION | Out-Null
    Write-Host "  ✓ Updated" -ForegroundColor Green
}

Write-Host "`nConfiguring S3 Trigger..." -ForegroundColor Yellow

# Add Lambda permission
aws lambda add-permission `
    --function-name "$PROJECT_NAME-UploadHandler" `
    --statement-id s3-trigger `
    --action lambda:InvokeFunction `
    --principal s3.amazonaws.com `
    --source-arn "arn:aws:s3:::$UPLOAD_BUCKET" `
    --region $REGION 2>$null

# Create S3 notification configuration
$lambdaArn = "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:$PROJECT_NAME-UploadHandler"

$notificationConfig = @"
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "$lambdaArn",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "prefix", "Value": "$UPLOAD_PREFIX"},
            {"Name": "suffix", "Value": ".pdf"}
          ]
        }
      }
    }
  ]
}
"@

$notificationConfig | Out-File "s3-notification.json" -Encoding utf8
aws s3api put-bucket-notification-configuration --bucket $UPLOAD_BUCKET --notification-configuration file://s3-notification.json
Remove-Item "s3-notification.json" -ErrorAction SilentlyContinue

Write-Host "  ✓ S3 trigger configured for $UPLOAD_PREFIX*.pdf" -ForegroundColor Green

Write-Host "`n✅ Quick Deploy Complete!" -ForegroundColor Green
Write-Host "End Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow

Write-Host "`n📋 Processing Status:" -ForegroundColor Cyan
Write-Host "Your PDF was uploaded at 17:00:53"
Write-Host "S3 trigger is now active - it will process NEW uploads only"
Write-Host "`nTo process the existing PDF, re-upload it or run:"
Write-Host "aws lambda invoke --function-name $PROJECT_NAME-UploadHandler --payload '{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"$UPLOAD_BUCKET\"},\"object\":{\"key\":\"${UPLOAD_PREFIX}AlexDoe_MedicalRecords(fake).pdf\"}}}]}' response.json" -ForegroundColor Yellow

# Cleanup
Remove-Item "upload-handler.zip" -ErrorAction SilentlyContinue
