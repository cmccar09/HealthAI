# HealthAI Multi-Account Deployment Guide

## Overview

This guide will help you deploy HealthAI from your local laptop to a business/corporate Innovation AWS account, then promote to STG and PRD accounts using CloudFormation and CodePipeline.

## Architecture

```
┌─────────────────┐
│  Your Laptop    │
│  (Development)  │
└────────┬────────┘
         │
         │ Initial Deploy
         ▼
┌─────────────────────────────────┐
│  Innovation Account             │
│  - CodePipeline                 │
│  - CodeBuild                    │
│  - S3 (Pipeline Artifacts)      │
│  - Dev Environment              │
└────────┬────────────────────────┘
         │
         │ Auto Promote (Manual Approval)
         │
    ┌────┴────┐
    ▼         ▼
┌──────┐  ┌──────┐
│ STG  │  │ PRD  │
│Account│  │Account│
└──────┘  └──────┘
```

## Prerequisites

1. **AWS Accounts**
   - Innovation Account (Dev + CI/CD)
   - STG Account
   - PRD Account

2. **AWS CLI Profiles** - Configure in `~/.aws/config`:
   ```ini
   [profile innovation]
   region = us-east-1
   
   [profile stg]
   region = us-east-1
   
   [profile prd]
   region = us-east-1
   ```

3. **GitHub Repository**
   - Create a GitHub repository for your code
   - Generate a Personal Access Token (Settings > Developer settings > Personal access tokens)

4. **Tools Installed**
   - AWS CLI v2
   - Git
   - Python 3.11+
   - Node.js 18+

## Step-by-Step Deployment

### Phase 1: Prepare Your Code

#### 1. Initialize Git Repository

```powershell
cd C:\Users\charl\OneDrive\futuregenAI\HealthAI

# Initialize git if not already done
git init

# Create .gitignore
@"
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.env
*.egg-info/
dist/
build/

# Node
node_modules/
npm-debug.log*
build/
.env.local
.env.production

# AWS
*.zip
temp_table.json

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
"@ | Out-File -FilePath .gitignore -Encoding utf8

# Add all files
git add .
git commit -m "Initial commit - HealthAI multi-account deployment"

# Create GitHub repo and push
# (Follow GitHub instructions to create repo)
git remote add origin https://github.com/YOUR_USERNAME/HealthAI.git
git branch -M main
git push -u origin main
```

#### 2. Update Lambda Package Structure

The CloudFormation templates expect Lambda packages in S3. We'll create a packaging script:

```powershell
# Create package-lambdas.ps1
@'
#!/usr/bin/env pwsh
param(
    [string]$Environment = "dev",
    [string]$Region = "us-east-1"
)

$ProjectName = "HealthAI"
$AccountId = (aws sts get-caller-identity --query Account --output text)
$BucketName = "$ProjectName-$Environment-lambda-code-$AccountId"

Write-Host "Creating Lambda code bucket: $BucketName" -ForegroundColor Yellow
aws s3 mb s3://$BucketName --region $Region 2>$null

Write-Host "`nPackaging Lambda functions..." -ForegroundColor Yellow

# Package each Lambda
$lambdas = @("upload-handler", "pdf-converter", "ai-processor", "api-handler")

foreach ($lambda in $lambdas) {
    Write-Host "  Packaging $lambda..." -ForegroundColor Cyan
    
    Push-Location "lambdas/$lambda"
    
    # Install dependencies if requirements.txt exists
    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt -t . --upgrade
    }
    
    # Create zip (exclude existing zips and __pycache__)
    $files = Get-ChildItem -Recurse -File | Where-Object { 
        $_.Extension -ne '.zip' -and $_.DirectoryName -notlike '*__pycache__*' 
    }
    
    Compress-Archive -Path $files -DestinationPath "$lambda.zip" -Force
    
    # Upload to S3
    aws s3 cp "$lambda.zip" "s3://$BucketName/" --region $Region
    
    Write-Host "    ✓ Uploaded to s3://$BucketName/$lambda.zip" -ForegroundColor Green
    
    Pop-Location
}

Write-Host "`n✓ All Lambda functions packaged and uploaded!" -ForegroundColor Green
'@ | Out-File -FilePath package-lambdas.ps1 -Encoding utf8
```

### Phase 2: Setup STG and PRD Accounts

#### 3. Deploy Cross-Account Roles

**In STG Account:**
```powershell
# Get Innovation account ID
$INNOVATION_ACCOUNT_ID = "123456789012"  # Replace with your Innovation account ID

# Deploy cross-account roles
aws cloudformation deploy `
  --template-file cloudformation/cross-account-roles.yaml `
  --stack-name HealthAI-CrossAccount-Roles `
  --parameter-overrides InnovationAccountId=$INNOVATION_ACCOUNT_ID `
  --capabilities CAPABILITY_NAMED_IAM `
  --profile stg
```

**In PRD Account:**
```powershell
aws cloudformation deploy `
  --template-file cloudformation/cross-account-roles.yaml `
  --stack-name HealthAI-CrossAccount-Roles `
  --parameter-overrides InnovationAccountId=$INNOVATION_ACCOUNT_ID `
  --capabilities CAPABILITY_NAMED_IAM `
  --profile prd
```

### Phase 3: Setup Innovation Account (CI/CD)

#### 4. Package and Upload Lambda Functions

```powershell
# Switch to Innovation account
$env:AWS_PROFILE = "innovation"

# Package all Lambda functions
.\package-lambdas.ps1 -Environment dev -Region us-east-1
```

#### 5. Deploy Infrastructure Stack (Dev Environment)

```powershell
aws cloudformation deploy `
  --template-file cloudformation/infrastructure.yaml `
  --stack-name HealthAI-dev `
  --parameter-overrides Environment=dev ProjectName=HealthAI `
  --capabilities CAPABILITY_NAMED_IAM `
  --profile innovation
```

#### 6. Setup CodePipeline

```powershell
# Get account IDs
$STG_ACCOUNT_ID = "234567890123"  # Replace with STG account ID
$PRD_ACCOUNT_ID = "345678901234"  # Replace with PRD account ID
$GITHUB_OWNER = "your-github-username"
$GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"  # Your GitHub token

# Deploy pipeline
aws cloudformation deploy `
  --template-file cloudformation/pipeline.yaml `
  --stack-name HealthAI-Pipeline `
  --parameter-overrides `
    GitHubOwner=$GITHUB_OWNER `
    GitHubToken=$GITHUB_TOKEN `
    STGAccountId=$STG_ACCOUNT_ID `
    PRDAccountId=$PRD_ACCOUNT_ID `
  --capabilities CAPABILITY_NAMED_IAM `
  --profile innovation
```

### Phase 4: Configure and Test

#### 7. Test the Pipeline

```powershell
# Make a change and push to GitHub
echo "# Test" >> README.md
git add README.md
git commit -m "Test pipeline trigger"
git push origin main
```

View pipeline execution:
```powershell
# Open pipeline in browser
$PIPELINE_URL = (aws cloudformation describe-stacks `
  --stack-name HealthAI-Pipeline `
  --query 'Stacks[0].Outputs[?OutputKey==`PipelineUrl`].OutputValue' `
  --output text `
  --profile innovation)

Start-Process $PIPELINE_URL
```

#### 8. Monitor Deployment

```powershell
# Check pipeline status
aws codepipeline get-pipeline-state `
  --name HealthAI-Pipeline `
  --profile innovation

# Check CloudFormation stack status in each environment
aws cloudformation describe-stacks `
  --stack-name HealthAI-dev `
  --profile innovation

aws cloudformation describe-stacks `
  --stack-name HealthAI-stg `
  --profile stg

aws cloudformation describe-stacks `
  --stack-name HealthAI-prd `
  --profile prd
```

## Pipeline Flow

1. **Source Stage**: Triggered by GitHub push
2. **Build-Innovation Stage**: 
   - Packages Lambda functions
   - Deploys to Innovation account (dev)
   - Runs tests
3. **Deploy-Staging Stage**:
   - **Manual Approval Required**
   - Deploys to STG account
   - Runs smoke tests
4. **Deploy-Production Stage**:
   - **Manual Approval Required**
   - Deploys to PRD account
   - Production deployment

## Approval Process

When pipeline reaches approval stages:

```powershell
# Approve STG deployment
aws codepipeline put-approval-result `
  --pipeline-name HealthAI-Pipeline `
  --stage-name Deploy-Staging `
  --action-name ApprovalForStaging `
  --result summary="Approved by Ops",status=Approved `
  --token <TOKEN-FROM-CONSOLE> `
  --profile innovation

# Approve PRD deployment
aws codepipeline put-approval-result `
  --pipeline-name HealthAI-Pipeline `
  --stage-name Deploy-Production `
  --action-name ApprovalForProduction `
  --result summary="Approved by Management",status=Approved `
  --token <TOKEN-FROM-CONSOLE> `
  --profile innovation
```

Or approve via AWS Console: CodePipeline → HealthAI-Pipeline → Review

## Environment Configuration

Each environment has different configurations (defined in CloudFormation Mappings):

| Config | DEV | STG | PRD |
|--------|-----|-----|-----|
| Lambda Memory | 512MB | 1024MB | 2048MB |
| Lambda Timeout | 300s | 600s | 900s |
| SQS Concurrency | 5 | 10 | 20 |
| Encryption | AES256 | AES256 | KMS |
| Backups | None | Daily | PITR |

## Rollback Procedures

### Rollback via CloudFormation

```powershell
# Rollback STG
aws cloudformation rollback-stack `
  --stack-name HealthAI-stg `
  --profile stg

# Rollback PRD
aws cloudformation rollback-stack `
  --stack-name HealthAI-prd `
  --profile prd
```

### Rollback via Pipeline

1. Go to CodePipeline console
2. Select HealthAI-Pipeline
3. Click "Release change" with previous commit SHA
4. Approve through stages

## Disaster Recovery

### Backup Strategy

```powershell
# Enable DynamoDB backups (already in CloudFormation)
# Verify backup status
aws dynamodb describe-continuous-backups `
  --table-name HealthAI-prd-Patients `
  --profile prd

# Create on-demand backup
aws dynamodb create-backup `
  --table-name HealthAI-prd-Patients `
  --backup-name HealthAI-Patients-Manual-$(Get-Date -Format 'yyyyMMdd-HHmmss') `
  --profile prd
```

### Restore from Backup

```powershell
# List available backups
aws dynamodb list-backups `
  --table-name HealthAI-prd-Patients `
  --profile prd

# Restore from backup
aws dynamodb restore-table-from-backup `
  --target-table-name HealthAI-prd-Patients-Restored `
  --backup-arn <BACKUP-ARN> `
  --profile prd
```

## Cost Estimation

| Account | Monthly Cost (Est.) |
|---------|---------------------|
| Innovation (Dev + CI/CD) | $50-100 |
| STG | $100-200 |
| PRD | $500-1000 (based on usage) |

**Cost Breakdown:**
- Lambda: Pay per execution
- DynamoDB: PAY_PER_REQUEST mode
- S3: Storage + requests
- CodePipeline: $1/month + CodeBuild minutes
- Data transfer between accounts

## Security Checklist

- [ ] Cross-account roles use least privilege
- [ ] S3 buckets have encryption enabled
- [ ] DynamoDB tables have encryption enabled
- [ ] Point-in-time recovery enabled for PRD
- [ ] CloudWatch alarms configured
- [ ] GitHub webhooks use HMAC validation
- [ ] No hardcoded credentials in code
- [ ] IAM policies reviewed and scoped
- [ ] CloudTrail enabled in all accounts
- [ ] VPC endpoints for AWS services (optional)

## Troubleshooting

### Pipeline Fails at Build Stage

```powershell
# Check CodeBuild logs
aws codebuild batch-get-builds `
  --ids <BUILD-ID> `
  --profile innovation
```

### Cross-Account Deployment Fails

1. Verify cross-account roles exist:
```powershell
aws iam get-role --role-name HealthAI-CrossAccount-Role --profile stg
aws iam get-role --role-name HealthAI-CloudFormation-Role --profile stg
```

2. Check S3 bucket policy allows cross-account access
3. Verify account IDs are correct

### Lambda Function Not Deploying

```powershell
# Check if Lambda package exists in S3
aws s3 ls s3://HealthAI-dev-lambda-code-<ACCOUNT-ID>/ --profile innovation

# Verify Lambda function
aws lambda get-function `
  --function-name HealthAI-dev-upload-handler `
  --profile innovation
```

## Monitoring and Alerts

### CloudWatch Dashboard

```powershell
# Create dashboard for all environments
aws cloudwatch put-dashboard `
  --dashboard-name HealthAI-Overview `
  --dashboard-body file://cloudwatch-dashboard.json `
  --profile innovation
```

### SNS Notifications

Add to CloudFormation template:
```yaml
SNSTopic:
  Type: AWS::SNS::Topic
  Properties:
    TopicName: !Sub '${ProjectName}-${Environment}-Alerts'
    Subscription:
      - Endpoint: devops@company.com
        Protocol: email
```

## Next Steps

1. **Add Integration Tests**: Create test scripts in `tests/` directory
2. **Implement Blue/Green Deployments**: Use Lambda aliases
3. **Add Canary Deployments**: Gradual traffic shifting
4. **Setup CloudWatch Synthetics**: Monitor endpoints
5. **Implement Cost Alerts**: Budget alerts per environment
6. **Add Compliance Scanning**: AWS Config rules
7. **Setup Secrets Manager**: For GitHub tokens and API keys

## Support

- Check CloudFormation events for deployment issues
- Review CodeBuild logs for build failures
- Monitor CloudWatch Logs for Lambda errors
- Use AWS X-Ray for distributed tracing

---

**Last Updated**: December 28, 2025
**Version**: 1.0
