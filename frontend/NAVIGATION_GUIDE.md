# HealthAI Frontend - Navigation Guide

## Page Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Home Page (/)                         │
│                                                          │
│  📄 AlexDoe_MedicalRecords(fake).pdf                    │
│  ├─ 237 pages total                                     │
│  ├─ Uploaded: 2025-12-12 13:08:20                       │
│  ├─ Processed: 234/237 pages (98.73%)                   │
│  └─ Status: CONVERTING                                  │
│                                                          │
│  [Click document to open dashboard]                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           Document Dashboard (/document/:id)             │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │    👤    │  │    💊    │  │    🩺    │             │
│  │ Patient  │  │   Meds   │  │ Diagnoses│             │
│  │ Summary  │  │ 220 found│  │ 367 found│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐                            │
│  │    🔬    │  │    🖼️    │                            │
│  │  Tests   │  │  Images  │                            │
│  │ 707 found│  │ 234 pages│                            │
│  └──────────┘  └──────────┘                            │
└─────────────────────────────────────────────────────────┘
     ↓              ↓              ↓              ↓        ↓
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Patient │  │   Meds   │  │Diagnoses │  │  Tests   │  │  Images  │
│ Summary │  │  Page    │  │  Page    │  │  Page    │  │  Gallery │
└─────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## Patient Summary Page

```
┌─────────────────────────────────────────────────────────┐
│  👤 Patient Information                                  │
│                                                          │
│  ┌─ General Information ────────────────────────────┐   │
│  │ First Name: [Alex]      Gender: [Male]          │   │
│  │ Last Name: [Doe]        MRN: [12345678]         │   │
│  │ DOB: [1965-03-15]       Blood Type: [O+]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Contact Information ────────────────────────────┐   │
│  │ Phone: [(555) 123-4567]                          │   │
│  │ Email: [alex.doe@email.com]                      │   │
│  │ Address: [123 Main St, Anytown, CA 90210]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ ⚠️  Allergies ──────────────────────────────────┐   │
│  │ Penicillin, Shellfish                            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Medications Page

```
┌─────────────────────────────────────────────────────────┐
│  💊 Medications (220)                                    │
│                                                          │
│  [Search: _________________]                             │
│                                                          │
│  ┌─ Medications Table ──────────────────────────────┐   │
│  │ Name        │Dosage│Frequency│Route│Status     │   │
│  ├──────────────┼──────┼─────────┼─────┼──────────┤   │
│  │ JARDIANCE   │25mg  │daily    │oral │✓ Current │   │
│  │ triamcinolone│0.1% │twice/day│topical│✓ Current│   │
│  │ econazole   │1%    │as needed│topical│✓ Current│   │
│  │ Valsartan   │160mg │daily    │oral │✓ Current │   │
│  │ Niacin ER   │500mg │bedtime  │oral │✓ Current │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Diagnoses Page

```
┌─────────────────────────────────────────────────────────┐
│  🩺 Diagnoses (367)                                      │
│                                                          │
│  [Search: _________________]                             │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ Prostate cancer│  │ Heart murmur   │                │
│  │ Code: C61      │  │ Code: I36.9    │                │
│  │ Date: 2024-03  │  │ Date: 2024-01  │                │
│  │ Dr. Smith      │  │ Dr. Johnson    │                │
│  │ Memorial Hosp  │  │ City Clinic    │                │
│  │ Gleason 4+4=8  │  │ Systolic       │                │
│  └────────────────┘  └────────────────┘                │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ Hypertension   │  │ Diabetes Type2 │                │
│  │ Code: I10      │  │ Code: E11.9    │                │
│  │ ...            │  │ ...            │                │
│  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

## Test Results Page

```
┌─────────────────────────────────────────────────────────┐
│  🔬 Test Results (707)                                   │
│                                                          │
│  [Search: _________]  ☑ Show abnormal only              │
│                                                          │
│  ┌─ Test Results Table ────────────────────────────┐   │
│  │ Test     │Date   │Result│Unit│Range  │Status  │   │
│  ├──────────┼───────┼──────┼────┼───────┼────────┤   │
│  │Temperature│Jan 15│97.8  │°F  │96-99  │✓ Normal│   │
│  │HDL       │Jan 20│41    │mg/dL│40-60  │✓ Normal│   │
│  │WBC       │Jan 20│6.3   │k/uL│4.5-11 │✓ Normal│   │
│  │PSA       │Mar 10│12.5  │ng/mL│0-4    │⚠️ Abnormal│ (red bg)
│  │CRP       │Jan 15│4.6   │mg/L│0-3    │⚠️ Abnormal│ (red bg)
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Image Gallery Page

```
┌─────────────────────────────────────────────────────────┐
│  🖼️  Page Images (234 pages)                            │
│                                                          │
│  Filter by Category:                                     │
│  [All Pages (234)] [Lab Results (45)] [Medications (12)]│
│  [Diagnoses (8)] [Demographics (1)] [Visit Notes (120)] │
│  [Imaging Reports (15)] [Other (33)]                     │
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Page 1    │  │  Page 2    │  │  Page 3    │        │
│  │ Demographics│  │Lab Results │  │ Visit Note │        │
│  │            │  │            │  │            │        │
│  │  [WebP     │  │  [WebP     │  │  [WebP     │        │
│  │   Image]   │  │   Image]   │  │   Image]   │        │
│  │            │  │            │  │            │        │
│  │✓ Processed │  │✓ Processed │  │✓ Processed │        │
│  └────────────┘  └────────────┘  └────────────┘        │
│                                                          │
│  [More images load as you scroll...]                    │
└─────────────────────────────────────────────────────────┘
```

## Data Sources

### DynamoDB Tables
```
HealthAI-Documents      → Document metadata, upload time, status
HealthAI-Pages          → Page images, processing status
HealthAI-Patients       → Demographics, contact info, allergies
HealthAI-Medications    → Drug names, dosages, frequencies
HealthAI-Diagnoses      → ICD codes, descriptions, doctors
HealthAI-TestResults    → Lab values, normal ranges, dates
HealthAI-Categories     → Page classifications for filtering
```

### S3 Bucket
```
s3://futuregen-health-ai/
├── health-ai-upload/    ← Original PDFs
├── health-ai-png/       ← High-quality images
└── health-ai-webp/      ← Compressed images (displayed in app)
```

## Key Features

### Search Functionality
- **Medications**: Search by medication name or dosage
- **Diagnoses**: Search by description or ICD code
- **Tests**: Search by test name

### Filter Options
- **Tests**: Toggle "Show abnormal only" checkbox
- **Images**: Category buttons (Lab Results, Meds, Diagnoses, etc.)

### Status Indicators
- ✓ **Green badges**: Current medication, Normal result, Processed page
- × **Red badges**: Discontinued medication, Abnormal result
- ⏳ **Yellow badges**: Processing in progress
- ⚠️ **Warning color**: Abnormal results, Allergies

### Responsive Design
- Desktop: Multi-column grids
- Tablet: 2-column grids
- Mobile: Single column stacks

## Performance Features

1. **Lazy Loading**: Images load as you scroll
2. **Presigned URLs**: S3 URLs generated with 1-hour expiration
3. **Client-side Filtering**: No database re-queries for search
4. **First 50 Images**: Only first 50 presigned URLs generated initially
5. **Parallel Queries**: Statistics fetched simultaneously

## Security Notes

- AWS credentials in `.env` file (git-ignored)
- Presigned S3 URLs expire after 1 hour
- Never commit `.env` to version control
- Use IAM roles in production (not access keys)

## Development Commands

```bash
cd frontend

# First time setup
npm install
.\setup-env.ps1

# Start development server
npm start

# Build for production
npm run build

# Test the build
npm run test
```

## URLs in Development

- App: http://localhost:3000
- Document List: http://localhost:3000/
- Dashboard: http://localhost:3000/document/{documentId}
- Patient: http://localhost:3000/document/{documentId}/patient
- Medications: http://localhost:3000/document/{documentId}/medications
- Diagnoses: http://localhost:3000/document/{documentId}/diagnoses
- Tests: http://localhost:3000/document/{documentId}/tests
- Images: http://localhost:3000/document/{documentId}/images

## Browser Support

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ❌ Internet Explorer (not supported)

## Mobile Experience

All pages are fully responsive:
- Touch-friendly buttons and cards
- Single-column layouts on small screens
- Swipe-friendly image gallery
- Optimized font sizes
- Mobile-first CSS approach

---

**Ready to use!** Just configure AWS credentials and run `npm start`. 🚀
