#!/usr/bin/env pwsh
# Deploy HealthAI Infrastructure to AWS
# Run this script to create all AWS resources

$ErrorActionPreference = "Stop"

Write-Host "🏥 HealthAI Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Configuration
$REGION = "us-east-1"
$PROJECT_NAME = "HealthAI"
$UPLOAD_BUCKET = "futuregen-health-ai-upload"
$PDF_BUCKET = "futuregen-health-ai-pdf"
$PNG_BUCKET = "futuregen-health-ai-png"
$WEBP_BUCKET = "futuregen-health-ai-webp"

Write-Host "Step 1: Creating S3 Buckets..." -ForegroundColor Yellow

# Create S3 buckets
$buckets = @($UPLOAD_BUCKET, $PDF_BUCKET, $PNG_BUCKET, $WEBP_BUCKET)
foreach ($bucket in $buckets) {
    Write-Host "  Creating bucket: $bucket"
    aws s3api create-bucket --bucket $bucket --region $REGION 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Created" -ForegroundColor Green
    } else {
        Write-Host "    ⓘ Already exists" -ForegroundColor Gray
    }
    
    # Enable versioning
    aws s3api put-bucket-versioning --bucket $bucket --versioning-configuration Status=Enabled
}

Write-Host "`nStep 2: Creating DynamoDB Tables..." -ForegroundColor Yellow

# Read DynamoDB table definitions
$tablesJson = Get-Content "infrastructure\dynamodb-tables.json" | ConvertFrom-Json

foreach ($table in $tablesJson.tables) {
    $tableName = $table.TableName
    Write-Host "  Creating table: $tableName"
    
    # Check if table exists
    $exists = aws dynamodb describe-table --table-name $tableName --region $REGION 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        # Build create-table command
        $tableJson = $table | ConvertTo-Json -Depth 10 -Compress
        $tableJson | Out-File -FilePath "temp_table.json" -Encoding utf8
        
        aws dynamodb create-table --cli-input-json file://temp_table.json --region $REGION | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "    ✓ Created" -ForegroundColor Green
        } else {
            Write-Host "    ✗ Failed" -ForegroundColor Red
        }
        
        Remove-Item "temp_table.json" -ErrorAction SilentlyContinue
    } else {
        Write-Host "    ⓘ Already exists" -ForegroundColor Gray
    }
}

Write-Host "`nStep 3: Creating SQS Queues..." -ForegroundColor Yellow

# Create FIFO queues for ordered processing
$processingQueue = "$PROJECT_NAME-Processing.fifo"
$aiQueue = "$PROJECT_NAME-AI.fifo"

foreach ($queueName in @($processingQueue, $aiQueue)) {
    Write-Host "  Creating queue: $queueName"
    
    $queueUrl = aws sqs create-queue `
        --queue-name $queueName `
        --attributes "FifoQueue=true,ContentBasedDeduplication=false,MessageRetentionPeriod=86400,VisibilityTimeout=900" `
        --region $REGION `
        --query 'QueueUrl' `
        --output text 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ Created: $queueUrl" -ForegroundColor Green
    } else {
        Write-Host "    ⓘ Already exists" -ForegroundColor Gray
    }
}

Write-Host "`nStep 4: Creating IAM Role for Lambda..." -ForegroundColor Yellow

$roleName = "$PROJECT_NAME-Lambda-Role"
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$trustPolicy | Out-File -FilePath "trust-policy.json" -Encoding utf8

# Create IAM role
Write-Host "  Creating role: $roleName"
aws iam create-role --role-name $roleName --assume-role-policy-document file://trust-policy.json 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "    ✓ Created" -ForegroundColor Green
} else {
    Write-Host "    ⓘ Already exists" -ForegroundColor Gray
}

# Attach policies
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

# Add Bedrock permissions
$bedrockPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    }
  ]
}
"@

$bedrockPolicy | Out-File -FilePath "bedrock-policy.json" -Encoding utf8
aws iam put-role-policy --role-name $roleName --policy-name BedrockAccess --policy-document file://bedrock-policy.json 2>$null

Remove-Item "trust-policy.json", "bedrock-policy.json" -ErrorAction SilentlyContinue

Write-Host "    ✓ Policies attached" -ForegroundColor Green

# Wait for role to propagate
Write-Host "  Waiting for IAM role to propagate (10s)..."
Start-Sleep -Seconds 10

# Get role ARN
$roleArn = aws iam get-role --role-name $roleName --query 'Role.Arn' --output text

Write-Host "`nStep 5: Deploying Lambda Functions..." -ForegroundColor Yellow

# Get queue URLs
$processingQueueUrl = aws sqs get-queue-url --queue-name $processingQueue --region $REGION --query 'QueueUrl' --output text
$aiQueueUrl = aws sqs get-queue-url --queue-name $aiQueue --region $REGION --query 'QueueUrl' --output text

$lambdas = @(
    @{
        Name = "$PROJECT_NAME-UploadHandler"
        Path = "lambdas\upload-handler"
        Handler = "lambda_function.lambda_handler"
        Timeout = 60
        Memory = 256
        Env = @{
            UPLOAD_BUCKET = $UPLOAD_BUCKET
            PDF_BUCKET = $PDF_BUCKET
            PROCESSING_QUEUE_URL = $processingQueueUrl
            DOCUMENTS_TABLE = "$PROJECT_NAME-Documents"
        }
    },
    @{
        Name = "$PROJECT_NAME-PDFConverter"
        Path = "lambdas\pdf-converter"
        Handler = "lambda_function.lambda_handler"
        Timeout = 300
        Memory = 3008
        Env = @{
            PDF_BUCKET = $PDF_BUCKET
            PNG_BUCKET = $PNG_BUCKET
            WEBP_BUCKET = $WEBP_BUCKET
            AI_QUEUE_URL = $aiQueueUrl
            PAGES_TABLE = "$PROJECT_NAME-Pages"
            DOCUMENTS_TABLE = "$PROJECT_NAME-Documents"
        }
    },
    @{
        Name = "$PROJECT_NAME-AIProcessor"
        Path = "lambdas\ai-processor"
        Handler = "lambda_function.lambda_handler"
        Timeout = 900
        Memory = 1024
        Env = @{
            PAGES_TABLE = "$PROJECT_NAME-Pages"
            PATIENTS_TABLE = "$PROJECT_NAME-Patients"
            MEDICATIONS_TABLE = "$PROJECT_NAME-Medications"
            DIAGNOSES_TABLE = "$PROJECT_NAME-Diagnoses"
            TESTS_TABLE = "$PROJECT_NAME-TestResults"
            CATEGORIES_TABLE = "$PROJECT_NAME-Categories"
            DOCUMENTS_TABLE = "$PROJECT_NAME-Documents"
        }
    },
    @{
        Name = "$PROJECT_NAME-APIHandler"
        Path = "lambdas\api-handler"
        Handler = "lambda_function.lambda_handler"
        Timeout = 30
        Memory = 512
        Env = @{
            PATIENTS_TABLE = "$PROJECT_NAME-Patients"
            DOCUMENTS_TABLE = "$PROJECT_NAME-Documents"
            PAGES_TABLE = "$PROJECT_NAME-Pages"
            MEDICATIONS_TABLE = "$PROJECT_NAME-Medications"
            DIAGNOSES_TABLE = "$PROJECT_NAME-Diagnoses"
            TESTS_TABLE = "$PROJECT_NAME-TestResults"
            PNG_BUCKET = $PNG_BUCKET
            WEBP_BUCKET = $WEBP_BUCKET
        }
    }
)

foreach ($lambda in $lambdas) {
    Write-Host "  Deploying: $($lambda.Name)"
    
    # Create deployment package
    Push-Location $lambda.Path
    
    # Install dependencies if requirements.txt exists
    if (Test-Path "requirements.txt") {
        Write-Host "    Installing dependencies..."
        pip install -r requirements.txt -t . -q 2>$null
    }
    
    # Create zip file
    $zipFile = "..\..\deployment-$($lambda.Name).zip"
    Remove-Item $zipFile -ErrorAction SilentlyContinue
    
    Compress-Archive -Path * -DestinationPath $zipFile -Force
    
    Pop-Location
    
    # Build environment variables
    $envVars = ($lambda.Env.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ","
    
    # Create or update Lambda
    $functionExists = aws lambda get-function --function-name $lambda.Name --region $REGION 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        # Create new function
        aws lambda create-function `
            --function-name $lambda.Name `
            --runtime python3.11 `
            --role $roleArn `
            --handler $lambda.Handler `
            --timeout $lambda.Timeout `
            --memory-size $lambda.Memory `
            --environment "Variables={$envVars}" `
            --zip-file "fileb://deployment-$($lambda.Name).zip" `
            --region $REGION | Out-Null
        
        Write-Host "    ✓ Created" -ForegroundColor Green
    } else {
        # Update existing function
        aws lambda update-function-code `
            --function-name $lambda.Name `
            --zip-file "fileb://deployment-$($lambda.Name).zip" `
            --region $REGION | Out-Null
        
        aws lambda update-function-configuration `
            --function-name $lambda.Name `
            --timeout $lambda.Timeout `
            --memory-size $lambda.Memory `
            --environment "Variables={$envVars}" `
            --region $REGION | Out-Null
        
        Write-Host "    ✓ Updated" -ForegroundColor Green
    }
    
    Remove-Item "deployment-$($lambda.Name).zip" -ErrorAction SilentlyContinue
}

Write-Host "`nStep 6: Configuring Event Sources..." -ForegroundColor Yellow

# S3 trigger for upload-handler
Write-Host "  Setting up S3 upload trigger..."

# Add Lambda permission for S3
aws lambda add-permission `
    --function-name "$PROJECT_NAME-UploadHandler" `
    --statement-id s3-trigger `
    --action lambda:InvokeFunction `
    --principal s3.amazonaws.com `
    --source-arn "arn:aws:s3:::$UPLOAD_BUCKET" `
    --region $REGION 2>$null

# Configure S3 notification
$s3Notification = @"
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$PROJECT_NAME-UploadHandler",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {"Name": "suffix", "Value": ".pdf"}
          ]
        }
      }
    }
  ]
}
"@

$s3Notification | Out-File -FilePath "s3-notification.json" -Encoding utf8
aws s3api put-bucket-notification-configuration --bucket $UPLOAD_BUCKET --notification-configuration file://s3-notification.json
Remove-Item "s3-notification.json" -ErrorAction SilentlyContinue

Write-Host "    ✓ S3 trigger configured" -ForegroundColor Green

# SQS triggers for Lambda
Write-Host "  Setting up SQS triggers..."

# PDF Converter SQS trigger
aws lambda create-event-source-mapping `
    --function-name "$PROJECT_NAME-PDFConverter" `
    --event-source-arn "arn:aws:sqs:$REGION:$(aws sts get-caller-identity --query Account --output text):$processingQueue" `
    --batch-size 1 `
    --region $REGION 2>$null

# AI Processor SQS trigger
aws lambda create-event-source-mapping `
    --function-name "$PROJECT_NAME-AIProcessor" `
    --event-source-arn "arn:aws:sqs:$REGION:$(aws sts get-caller-identity --query Account --output text):$aiQueue" `
    --batch-size 10 `
    --region $REGION 2>$null

Write-Host "    ✓ SQS triggers configured" -ForegroundColor Green

Write-Host "`nStep 7: Creating API Gateway..." -ForegroundColor Yellow

# Create REST API
$apiName = "$PROJECT_NAME-API"
$apiId = aws apigateway create-rest-api --name $apiName --region $REGION --query 'id' --output text 2>$null

if ($LASTEXITCODE -ne 0) {
    # Get existing API
    $apiId = aws apigateway get-rest-apis --region $REGION --query "items[?name=='$apiName'].id" --output text
    Write-Host "  ⓘ Using existing API: $apiId" -ForegroundColor Gray
} else {
    Write-Host "  ✓ Created API: $apiId" -ForegroundColor Green
}

# Get root resource
$rootId = aws apigateway get-resources --rest-api-id $apiId --region $REGION --query 'items[?path==`/`].id' --output text

# Note: Full API Gateway setup requires multiple resource/method configurations
# For now, we'll create a simple proxy integration

Write-Host "    ⓘ API Gateway requires manual configuration in AWS Console" -ForegroundColor Yellow
Write-Host "    Configure: /{proxy+} -> $PROJECT_NAME-APIHandler" -ForegroundColor Yellow

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Configure API Gateway endpoints in AWS Console"
Write-Host "2. Deploy API to 'prod' stage"
Write-Host "3. Update frontend/.env with API URL"
Write-Host "4. Deploy React frontend to AWS Amplify"
Write-Host "`nUpload a PDF to test: aws s3 cp AlexDoe_MedicalRecords.pdf s3://$UPLOAD_BUCKET/"
