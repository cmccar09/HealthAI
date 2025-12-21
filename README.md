# HealthAI Medical Document Processing System

Intelligent medical document processing platform using AWS Lambda, Claude AI, and React.

🌐 **Live Demo**: [https://master.d2u43pjwtpmlz9.amplifyapp.com](https://master.d2u43pjwtpmlz9.amplifyapp.com)

## Architecture

```
health-ai-upload (S3)
    ↓
Upload Handler Lambda
    ↓
processing-queue (SQS FIFO)
    ↓
PDF Converter Lambda (Parallel)
    ├→ health-ai-pdf (S3)
    ├→ health-ai-png (S3)
    └→ health-ai-webp (S3)
    ↓
ai-processing-queue (SQS FIFO)
    ↓
AI Processor Lambda (Parallel, Claude 3.5 Sonnet)
    ↓
DynamoDB Tables:
    ├→ HealthAI-Patients
    ├→ HealthAI-Documents
    ├→ HealthAI-Pages
    ├→ HealthAI-Medications
    ├→ HealthAI-Diagnoses
    ├→ HealthAI-TestResults
    └→ HealthAI-Categories
    ↓
API Gateway + API Handler Lambda
    ↓
React Frontend (AWS Amplify)
```

## Features

- **Parallel Processing**: Process hundreds of pages simultaneously using SQS FIFO queues
- **Token-Efficient AI**: Optimized Claude prompts with prompt caching for cost savings
- **Multi-Format Storage**: PNG (high quality) + WebP (optimized) for different use cases
- **Structured Data Extraction**:
  - Patient demographics
  - Medications
  - Diagnoses
  - Test results
  - Page categorization
- **Real-Time Frontend**: React dashboard showing patient data, documents, and images

## AWS Services Used

- **Lambda**: 4 functions (upload-handler, pdf-converter, ai-processor, api-handler)
- **S3**: 4 buckets (upload, pdf, png, webp)
- **DynamoDB**: 7 tables (patients, documents, pages, medications, diagnoses, tests, categories)
- **SQS**: 2 FIFO queues (processing-queue, ai-processing-queue)
- **API Gateway**: REST API for frontend
- **Bedrock**: Claude 3.5 Sonnet for medical data extraction
- **Amplify**: Frontend hosting

## Quick Start

### Try the Live Demo
Visit [https://master.d2u43pjwtpmlz9.amplifyapp.com](https://master.d2u43pjwtpmlz9.amplifyapp.com)

### Process Documents
1. Upload PDF to `health-ai-upload` bucket
2. System automatically processes document
3. View results in React frontend dashboard

## License

MIT
