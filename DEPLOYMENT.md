# HealthAI Deployment Guide

## Prerequisites

- AWS CLI installed and configured
- Python 3.11+
- Node.js 18+
- PowerShell (Windows) or Bash (Linux/Mac)

## Quick Start

### 1. Deploy AWS Infrastructure

```powershell
# Run deployment script
.\deploy.ps1
```

This creates:
- 4 S3 buckets (upload, pdf, png, webp)
- 7 DynamoDB tables
- 2 SQS FIFO queues
- 4 Lambda functions
- IAM roles and policies
- S3 event triggers

### 2. Test PDF Processing

```bash
# Upload a test PDF
aws s3 cp AlexDoe_MedicalRecords.pdf s3://futuregen-health-ai-upload/

# Check DynamoDB for extracted data
aws dynamodb scan --table-name HealthAI-Documents
aws dynamodb scan --table-name HealthAI-Patients
```

### 3. Deploy React Frontend

```bash
cd frontend

# Install dependencies
npm install

# Update API endpoint
echo "REACT_APP_API_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod" > .env

# Build and deploy to Amplify
npm run build
```

## Architecture

```
┌─────────────┐
│ PDF Upload  │
│  (S3)       │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Upload Handler  │ ──► DynamoDB (Documents)
└────────┬────────┘
         │
         ▼ SQS
┌─────────────────┐
│ PDF Converter   │ ──► S3 (PNG, WebP)
└────────┬────────┘      │
         │               ▼ DynamoDB (Pages)
         ▼ SQS (parallel)
┌─────────────────┐
│ AI Processor    │ ──► DynamoDB (Patients, Meds, etc.)
│ (Claude 4.5)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  API Handler    │ ◄── React Frontend
└─────────────────┘
```

## Environment Variables

### Lambda Functions

All environment variables are configured automatically by `deploy.ps1`:

- **upload-handler**: UPLOAD_BUCKET, PDF_BUCKET, PROCESSING_QUEUE_URL, DOCUMENTS_TABLE
- **pdf-converter**: PDF_BUCKET, PNG_BUCKET, WEBP_BUCKET, AI_QUEUE_URL, PAGES_TABLE, DOCUMENTS_TABLE
- **ai-processor**: All DynamoDB table names
- **api-handler**: All DynamoDB table names + S3 bucket names

### React Frontend

Create `frontend/.env`:

```
REACT_APP_API_URL=https://YOUR-API-ID.execute-api.us-east-1.amazonaws.com/prod
```

## DynamoDB Schema

### HealthAI-Patients
- **PK**: patient_id
- **GSI**: patient_ssn, patient_mrn
- Attributes: first_name, last_name, dob, email, phone, address, allergies, etc.

### HealthAI-Documents
- **PK**: document_id
- **GSI**: patient_id + upload_timestamp
- Attributes: filename, status, total_pages, pdf_s3_key

### HealthAI-Pages
- **PK**: page_id
- **GSI**: document_id + page_number
- Attributes: png_s3_key, webp_s3_key, categories

### HealthAI-Medications
- **PK**: medication_id
- **GSI**: patient_id + start_date
- Attributes: medication_name, dosage, frequency, is_current

### HealthAI-Diagnoses
- **PK**: diagnosis_id
- **GSI**: patient_id + diagnosed_date
- Attributes: description, code, doctor info, facility info

### HealthAI-TestResults
- **PK**: test_id
- **GSI**: patient_id + test_date
- Attributes: test_name, result_value, unit, normal_range, is_abnormal

### HealthAI-Categories
- **PK**: category_id
- **GSI**: page_id
- Attributes: category_name, reason

## API Endpoints

### GET /patients
Returns all patients

### GET /patient/{patient_id}
Returns patient details

### GET /patient/{patient_id}/documents
Returns patient's documents

### GET /patient/{patient_id}/medications
Returns patient's medications

### GET /patient/{patient_id}/diagnoses
Returns patient's diagnoses

### GET /patient/{patient_id}/tests
Returns patient's test results

### GET /document/{document_id}/pages
Returns document pages with signed URLs for images

## Monitoring

### CloudWatch Logs

Each Lambda function logs to CloudWatch:
- `/aws/lambda/HealthAI-UploadHandler`
- `/aws/lambda/HealthAI-PDFConverter`
- `/aws/lambda/HealthAI-AIProcessor`
- `/aws/lambda/HealthAI-APIHandler`

### SQS Metrics

Monitor queue depths:
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/ACCOUNT/HealthAI-Processing.fifo \
  --attribute-names ApproximateNumberOfMessages
```

## Cost Optimization

### Parallelization
- PDF pages processed concurrently (limited by Lambda concurrency)
- SQS FIFO ensures ordered processing per document
- Batch size of 10 for AI processor

### Token Efficiency
- Token-efficient prompts (60% reduction vs verbose prompts)
- Structured outputs (no chain-of-thought)
- Parallel-safe design (no inter-page dependencies)

### Estimated Costs (per 100 documents, 10 pages each)

- **Lambda**: ~$5 (300s @ 1GB for AI, 30s @ 3GB for PDF conversion)
- **Bedrock**: ~$30 (Claude 3.5 Sonnet, 1000 pages × 2K tokens input + 500 tokens output)
- **DynamoDB**: ~$0.25 (PAY_PER_REQUEST)
- **S3**: ~$0.50 (storage + transfer)
- **SQS**: ~$0.01

**Total: ~$36 per 100 documents**

## Troubleshooting

### PDFs not processing
1. Check S3 upload bucket trigger is configured
2. Check CloudWatch logs for upload-handler
3. Verify SQS queue has messages

### AI extraction failing
1. Check Bedrock model access (anthropic.claude-3-5-sonnet-20240620-v1:0)
2. Verify Lambda has BedrockAccess policy
3. Check timeout (900s) and memory (1GB)

### Images not displaying
1. Check S3 bucket CORS configuration
2. Verify API handler generates presigned URLs
3. Check frontend API_URL environment variable

## Security

- S3 buckets: Private (presigned URLs only)
- DynamoDB: Private (Lambda access only)
- API Gateway: CORS enabled for frontend domain
- IAM: Least privilege roles

## Backup

Enable Point-in-Time Recovery for DynamoDB:

```bash
aws dynamodb update-continuous-backups \
  --table-name HealthAI-Patients \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

## Cleanup

To delete all resources:

```powershell
# Delete Lambda functions
aws lambda delete-function --function-name HealthAI-UploadHandler
aws lambda delete-function --function-name HealthAI-PDFConverter
aws lambda delete-function --function-name HealthAI-AIProcessor
aws lambda delete-function --function-name HealthAI-APIHandler

# Delete DynamoDB tables
aws dynamodb delete-table --table-name HealthAI-Patients
# ... (repeat for all tables)

# Delete S3 buckets (empty first)
aws s3 rb s3://futuregen-health-ai-upload --force
aws s3 rb s3://futuregen-health-ai-pdf --force
aws s3 rb s3://futuregen-health-ai-png --force
aws s3 rb s3://futuregen-health-ai-webp --force

# Delete SQS queues
aws sqs delete-queue --queue-url $QUEUE_URL

# Delete IAM role
aws iam delete-role --role-name HealthAI-Lambda-Role
```
