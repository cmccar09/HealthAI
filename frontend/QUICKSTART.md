# HealthAI Frontend - Quick Start Guide

## Setup Instructions

### 1. Configure AWS Credentials

Create a `.env` file in the `frontend` folder with your AWS credentials:

```bash
cd frontend
copy .env.example .env
```

Edit `.env` and add your AWS credentials:
```
REACT_APP_AWS_ACCESS_KEY_ID=YOUR_ACCESS_KEY
REACT_APP_AWS_SECRET_ACCESS_KEY=YOUR_SECRET_KEY
REACT_APP_AWS_REGION=us-east-1
```

**Important**: The `.env` file is git-ignored for security.

### 2. Start the Development Server

```bash
npm start
```

The app will open at http://localhost:3000

## Features

### 📄 Document Dashboard
- View all processed medical documents
- Click any document to see detailed analysis
- Shows upload time, page count, and processing status

### 👤 Patient Summary
- Patient demographics (name, DOB, gender, MRN)
- Contact information and address
- Allergies and emergency contact
- **Note**: Patient data is typically on page 1 of medical records

### 💊 Medications Page
- Searchable table of all medications
- Columns: Name, Dosage, Frequency, Route, Dates, Status
- Shows current vs discontinued medications

### 🩺 Diagnoses Page
- Grid cards showing all diagnoses
- ICD codes and descriptions
- Diagnosing doctor and facility
- Date and clinical notes

### 🔬 Test Results Page
- Comprehensive table of lab results
- Filter for abnormal results only
- Columns: Test name, Date, Result, Units, Normal range
- Color-coded abnormal values (red background)

### 🖼️ Page Images
- View all document pages as WebP images
- **Category Filters**: Filter by document type
  - Lab Results
  - Medications
  - Diagnoses
  - Demographics
  - Visit Notes
  - Imaging Reports
  - Other
- Images ordered by page number
- Shows AI processing status

## Navigation Flow

```
Documents List
    ↓ (click document)
Document Dashboard
    ↓ (choose section)
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Patient  │  Meds    │Diagnoses │  Tests   │ Images   │
│ Summary  │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

## Data Sources

All data comes directly from DynamoDB tables:
- `HealthAI-Documents` - Document metadata
- `HealthAI-Pages` - Page information and status
- `HealthAI-Patients` - Patient demographics
- `HealthAI-Medications` - Medication list
- `HealthAI-Diagnoses` - Diagnoses and ICD codes
- `HealthAI-TestResults` - Lab and test results
- `HealthAI-Categories` - Page classifications

Images are served from S3 using presigned URLs:
- Bucket: `futuregen-health-ai`
- Prefix: `health-ai-webp/`
- Expiration: 1 hour

## Current Document

The processed document is: **AlexDoe_MedicalRecords(fake).pdf**
- 237 pages total
- 234 pages AI processed (98.73%)
- 220 medications extracted
- 367 diagnoses extracted
- 707 test results extracted

## Important Notes

### Patient Demographics
- Patient data is usually on page 1
- If no patient summary shows, the document may not have a structured demographics page
- Medical records vary in format

### Image Loading
- First 50 images load presigned URLs automatically
- Scroll down to load more
- Images are compressed WebP format (~4.5MB each)

### Search and Filters
- Medications: Search by name or dosage
- Diagnoses: Search by description or ICD code
- Tests: Search by test name + toggle abnormal filter
- Images: Filter by document category

## Security

**Never commit the `.env` file to git!**

The `.gitignore` already excludes:
- `.env`
- `.env.local`
- `.env.*.local`

For production, use AWS IAM roles instead of access keys.

## Troubleshooting

### "No documents found"
- Check AWS credentials in `.env`
- Verify DynamoDB table names match: `HealthAI-*`
- Ensure IAM user has DynamoDB read permissions

### Images not loading
- Check S3 bucket access permissions
- Verify bucket name: `futuregen-health-ai`
- Presigned URLs expire after 1 hour (reload page)

### Console errors about AWS SDK
- Make sure `npm install` completed successfully
- Check that AWS credentials are valid
- Verify region is `us-east-1`

## Next Steps

1. **Upload a new document**: Drop PDF in `s3://futuregen-health-ai/health-ai-upload/`
2. **Monitor processing**: Refresh documents list to see progress
3. **View results**: Click document when status shows "COMPLETED"
4. **Filter images**: Use category buttons to find specific page types

## Development

To build for production:
```bash
npm run build
```

Creates optimized bundle in `build/` folder.

To deploy to S3:
```bash
aws s3 sync build/ s3://your-bucket-name/ --delete
```

Then configure S3 static website hosting.
