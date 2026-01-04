#!/usr/bin/env pwsh
# Package Lambda Functions for CloudFormation Deployment
# Usage: .\package-lambdas.ps1 -Environment dev -Region us-east-1

param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1",
    [string]$Profile = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n🏥 HealthAI Lambda Packaging Script" -ForegroundColor Cyan
Write-Host "===================================`n" -ForegroundColor Cyan

$ProjectName = "HealthAI"

# Set AWS profile if specified
if ($Profile) {
    $env:AWS_PROFILE = $Profile
    Write-Host "Using AWS Profile: $Profile`n" -ForegroundColor Yellow
}

# Get Account ID
Write-Host "Getting AWS Account ID..." -ForegroundColor Yellow
$AccountId = (aws sts get-caller-identity --query Account --output text)
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get AWS Account ID. Check your AWS credentials." -ForegroundColor Red
    exit 1
}
Write-Host "  Account ID: $AccountId" -ForegroundColor Green

$BucketName = "$ProjectName-$Environment-lambda-code-$AccountId".ToLower()

# Create Lambda code bucket if it doesn't exist
Write-Host "`nCreating Lambda code bucket: $BucketName" -ForegroundColor Yellow
aws s3 mb "s3://$BucketName" --region $Region 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Bucket created" -ForegroundColor Green
} else {
    Write-Host "  ℹ Bucket already exists" -ForegroundColor Gray
}

# Enable encryption
aws s3api put-bucket-encryption `
    --bucket $BucketName `
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }]
    }' `
    --region $Region 2>$null

Write-Host "`nPackaging Lambda functions..." -ForegroundColor Yellow

$lambdas = @(
    @{Name="upload-handler"; NeedsDeps=$false},
    @{Name="pdf-converter"; NeedsDeps=$true},
    @{Name="ai-processor"; NeedsDeps=$true},
    @{Name="api-handler"; NeedsDeps=$true}
)

foreach ($lambda in $lambdas) {
    $lambdaName = $lambda.Name
    Write-Host "`n  📦 Packaging $lambdaName..." -ForegroundColor Cyan
    
    $lambdaDir = "lambdas\$lambdaName"
    if (-not (Test-Path $lambdaDir)) {
        Write-Host "    ⚠ Directory not found: $lambdaDir" -ForegroundColor Yellow
        continue
    }
    
    Push-Location $lambdaDir
    
    try {
        # Clean up old packages
        if (Test-Path "$lambdaName.zip") {
            Remove-Item "$lambdaName.zip" -Force
        }
        
        # Install dependencies if needed
        if ($lambda.NeedsDeps -and (Test-Path "requirements.txt")) {
            Write-Host "    Installing dependencies..." -ForegroundColor Gray
            
            # Create temp package directory
            $tempDir = "package_temp"
            if (Test-Path $tempDir) {
                Remove-Item $tempDir -Recurse -Force
            }
            New-Item -ItemType Directory -Path $tempDir | Out-Null
            
            # Install dependencies to temp directory
            pip install -r requirements.txt -t $tempDir --quiet --upgrade 2>$null
            
            # Copy Lambda function code
            Copy-Item "lambda_function.py" $tempDir
            if (Test-Path "requirements.txt") {
                Copy-Item "requirements.txt" $tempDir
            }
            
            # Create zip from temp directory
            Push-Location $tempDir
            $files = Get-ChildItem -Recurse -File | Where-Object { 
                $_.DirectoryName -notlike '*__pycache__*' -and
                $_.Extension -ne '.pyc'
            }
            Compress-Archive -Path $files -DestinationPath "..\$lambdaName.zip" -Force
            Pop-Location
            
            # Clean up temp directory
            Remove-Item $tempDir -Recurse -Force
        }
        else {
            # Simple package without dependencies
            Write-Host "    Creating package (no dependencies)..." -ForegroundColor Gray
            $files = @("lambda_function.py")
            if (Test-Path "requirements.txt") {
                $files += "requirements.txt"
            }
            Compress-Archive -Path $files -DestinationPath "$lambdaName.zip" -Force
        }
        
        # Upload to S3
        Write-Host "    Uploading to S3..." -ForegroundColor Gray
        aws s3 cp "$lambdaName.zip" "s3://$BucketName/" --region $Region
        
        if ($LASTEXITCODE -eq 0) {
            $size = (Get-Item "$lambdaName.zip").Length / 1MB
            Write-Host "    ✓ Uploaded: s3://$BucketName/$lambdaName.zip ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
        } else {
            Write-Host "    ❌ Failed to upload $lambdaName.zip" -ForegroundColor Red
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host "`n✅ All Lambda functions packaged and uploaded!" -ForegroundColor Green
Write-Host "`nBucket: s3://$BucketName" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "`nYou can now deploy CloudFormation stack with:" -ForegroundColor Yellow
Write-Host "  aws cloudformation deploy --template-file cloudformation/infrastructure.yaml --stack-name $ProjectName-$Environment --parameter-overrides Environment=$Environment ProjectName=$ProjectName --capabilities CAPABILITY_NAMED_IAM" -ForegroundColor Gray
