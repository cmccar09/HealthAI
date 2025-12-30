# HealthAI Multi-Account Deployment - Quick Start

## TL;DR - Fast Track Deployment

### Prerequisites
```powershell
# Configure AWS CLI profiles
aws configure --profile innovation
aws configure --profile stg  
aws configure --profile prd

# Get account IDs
$INNOVATION_ACCOUNT_ID = (aws sts get-caller-identity --profile innovation --query Account --output text)
$STG_ACCOUNT_ID = (aws sts get-caller-identity --profile stg --query Account --output text)
$PRD_ACCOUNT_ID = (aws sts get-caller-identity --profile prd --query Account --output text)

# Setup GitHub
# 1. Create GitHub repo: https://github.com/new
# 2. Get personal access token: https://github.com/settings/tokens
$GITHUB_OWNER = "your-username"
$GITHUB_TOKEN = "ghp_xxxxx"
```

### Step 1: Setup Cross-Account Access (5 minutes)

**In STG Account:**
```powershell
.\setup-cross-account.ps1 `
    -InnovationAccountId $INNOVATION_ACCOUNT_ID `
    -Profile stg
```

**In PRD Account:**
```powershell
.\setup-cross-account.ps1 `
    -InnovationAccountId $INNOVATION_ACCOUNT_ID `
    -Profile prd
```

### Step 2: Deploy to Innovation Account (10 minutes)

```powershell
# Deploy Dev environment
.\deploy-innovation.ps1 -Profile innovation
```

### Step 3: Setup CI/CD Pipeline (5 minutes)

```powershell
.\deploy-pipeline.ps1 `
    -GitHubOwner $GITHUB_OWNER `
    -GitHubToken $GITHUB_TOKEN `
    -STGAccountId $STG_ACCOUNT_ID `
    -PRDAccountId $PRD_ACCOUNT_ID `
    -Profile innovation
```

### Step 4: Push Code to GitHub (2 minutes)

```powershell
# Initialize git if needed
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/$GITHUB_OWNER/HealthAI.git
git branch -M main
git push -u origin main
```

### Step 5: Monitor & Approve (ongoing)

```powershell
# Watch pipeline
Start-Process "https://console.aws.amazon.com/codesuite/codepipeline/pipelines/HealthAI-Pipeline/view"

# When ready, approve STG deployment (in AWS Console)
# Then approve PRD deployment (in AWS Console)
```

## What Gets Deployed?

### Innovation Account (Dev)
- ✅ S3 buckets (upload, pdf, png, webp)
- ✅ DynamoDB tables (8 tables)
- ✅ SQS queues (2 FIFO queues + DLQs)
- ✅ Lambda functions (4 functions)
- ✅ IAM roles
- ✅ CloudWatch alarms
- ✅ CodePipeline + CodeBuild

### STG Account
- ✅ Same as Dev (via pipeline)
- ✅ Higher memory/timeout
- ✅ Cross-account IAM roles

### PRD Account
- ✅ Same as STG (via pipeline)
- ✅ Production settings
- ✅ Point-in-time recovery
- ✅ Enhanced monitoring

## Pipeline Flow

```
GitHub Push → Build (Innovation) → Approve → STG → Approve → PRD
```

## Troubleshooting

**Pipeline fails at Build:**
```powershell
# Check CodeBuild logs
aws codebuild batch-get-builds --ids $(aws codepipeline get-pipeline-state --name HealthAI-Pipeline --query 'stageStates[1].latestExecution.latestExecutionId' --output text) --profile innovation
```

**Can't deploy to STG/PRD:**
```powershell
# Verify cross-account roles
aws iam get-role --role-name HealthAI-CrossAccount-Role --profile stg
aws iam get-role --role-name HealthAI-CloudFormation-Role --profile stg
```

**Lambda packages missing:**
```powershell
# Re-package and upload
.\package-lambdas.ps1 -Environment dev -Profile innovation
```

## Full Documentation

See [MULTI_ACCOUNT_DEPLOYMENT.md](MULTI_ACCOUNT_DEPLOYMENT.md) for complete guide.

## Architecture

```
┌─────────────┐
│   Laptop    │ (Your local machine)
└──────┬──────┘
       │ git push
       ▼
┌─────────────────────────────────┐
│   Innovation Account            │
│   ┌─────────────────────────┐   │
│   │     CodePipeline        │   │
│   │  ┌─────────┐            │   │
│   │  │ GitHub  │            │   │
│   │  └────┬────┘            │   │
│   │       ▼                 │   │
│   │  ┌─────────┐            │   │
│   │  │CodeBuild│            │   │
│   │  └────┬────┘            │   │
│   │       ▼                 │   │
│   │  ┌─────────┐            │   │
│   │  │Deploy   │            │   │
│   │  │Dev      │            │   │
│   │  └─────────┘            │   │
│   └─────────────────────────┘   │
│   Dev Environment               │
│   - S3, DynamoDB, Lambda, SQS   │
└────────┬────────────────────────┘
         │
    ┌────┴────┐ Approve Deployments
    ▼         ▼
┌────────┐  ┌────────┐
│  STG   │  │  PRD   │
│Account │  │Account │
└────────┘  └────────┘
```

## Cost Estimate

- Innovation: ~$100/month (dev + CI/CD)
- STG: ~$150/month
- PRD: ~$500-1000/month (depends on usage)

Total: **$750-1250/month**

## Security Features

✅ Encryption at rest (S3, DynamoDB)  
✅ Cross-account access via IAM roles  
✅ No hardcoded credentials  
✅ VPC endpoints (optional)  
✅ CloudTrail logging  
✅ Point-in-time recovery (PRD)  
✅ Dead letter queues  
✅ CloudWatch alarms  

## Support

Questions? Check [MULTI_ACCOUNT_DEPLOYMENT.md](MULTI_ACCOUNT_DEPLOYMENT.md) for detailed instructions.
