# HealthAI Frontend

React-based medical document viewer for the HealthAI system.

🌐 **Live Application**: [https://master.d2u43pjwtpmlz9.amplifyapp.com](https://master.d2u43pjwtpmlz9.amplifyapp.com)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure AWS credentials:
   - Copy `.env.example` to `.env`
   - Add your AWS credentials:
     ```
     REACT_APP_AWS_ACCESS_KEY_ID=your_access_key
     REACT_APP_AWS_SECRET_ACCESS_KEY=your_secret_key
     REACT_APP_AWS_REGION=us-east-1
     ```

3. Start the development server:
```bash
npm start
```

## Features

- **Document Dashboard**: View all processed medical documents
- **Patient Summary**: Patient demographics and contact information
- **Medications**: Searchable table of all medications with dosage and frequency
- **Diagnoses**: Grid view of all diagnoses with codes and details
- **Test Results**: Filterable table of lab results with normal/abnormal indicators
- **Image Gallery**: View all document pages with category filters

## Architecture

- Direct DynamoDB queries using AWS SDK v3
- S3 presigned URLs for secure image viewing
- React Router for navigation
- Responsive design for mobile and desktop

## Tables Accessed

- HealthAI-Documents
- HealthAI-Pages
- HealthAI-Patients
- HealthAI-Medications
- HealthAI-Diagnoses
- HealthAI-TestResults
- HealthAI-Categories
