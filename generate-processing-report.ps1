#!/usr/bin/env pwsh
# Generate comprehensive processing report for HealthAI document

param(
    [string]$DocumentId = ""
)

$ErrorActionPreference = "Stop"

Write-Host "`n📊 Generating Processing Report..." -ForegroundColor Cyan

# Get document data
if ([string]::IsNullOrEmpty($DocumentId)) {
    $docs = aws dynamodb scan --table-name HealthAI-Documents --region us-east-1 | ConvertFrom-Json
    $doc = $docs.Items | Sort-Object { [int]$_.upload_timestamp.N } -Descending | Select-Object -First 1
} else {
    $result = aws dynamodb get-item --table-name HealthAI-Documents --key "{`"document_id`":{`"S`":`"$DocumentId`"}}" --region us-east-1 | ConvertFrom-Json
    $doc = $result.Item
}

if ($null -eq $doc) {
    Write-Host "❌ No document found" -ForegroundColor Red
    exit 1
}

$docId = $doc.document_id.S
$filename = $doc.filename.S
$totalPages = [int]$doc.total_pages.N
$pagesProcessed = [int]$doc.pages_processed.N
$status = $doc.status.S
$uploadTime = [DateTimeOffset]::FromUnixTimeSeconds([int]$doc.upload_timestamp.N).LocalDateTime

# Get pages data
$pages = aws dynamodb scan --table-name HealthAI-Pages --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
$pagesData = $pages.Items

# Get all pages with timestamps
$aiProcessedPages = @()
foreach ($page in $pagesData) {
    if ($page.ai_processed.BOOL -eq $true) {
        $aiProcessedPages += @{
            page_number = [int]$page.page_number.N
            created = if ($page.created_timestamp.N) { [int]$page.created_timestamp.N } else { 0 }
        }
    }
}

# Calculate timing
if ($aiProcessedPages.Count -gt 0) {
    $timestamps = $aiProcessedPages | Where-Object { $_.created -gt 0 } | ForEach-Object { $_.created } | Sort-Object
    if ($timestamps.Count -gt 1) {
        $firstTime = [DateTimeOffset]::FromUnixTimeSeconds($timestamps[0]).LocalDateTime
        $lastTime = [DateTimeOffset]::FromUnixTimeSeconds($timestamps[-1]).LocalDateTime
        $totalDuration = ($lastTime - $firstTime).TotalSeconds
    } else {
        $totalDuration = 0
    }
} else {
    $totalDuration = 0
}

# Get extracted data
$medications = aws dynamodb scan --table-name HealthAI-Medications --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
$diagnoses = aws dynamodb scan --table-name HealthAI-Diagnoses --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
$tests = aws dynamodb scan --table-name HealthAI-TestResults --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
$categories = aws dynamodb scan --table-name HealthAI-Categories --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json

$medsCount = $medications.Count
$diagsCount = $diagnoses.Count
$testsCount = $tests.Count

# Calculate metrics
$avgTimePerPage = if ($aiProcessedPages.Count -gt 0 -and $totalDuration -gt 0) { $totalDuration / $aiProcessedPages.Count } else { 0 }
$pagesPerHour = if ($avgTimePerPage -gt 0) { 3600 / $avgTimePerPage } else { 0 }

# Cost calculations (Claude Sonnet 4.5)
$BEDROCK_PRICE_PER_1K_INPUT = 0.003  # $3 per 1M input tokens
$BEDROCK_PRICE_PER_1K_OUTPUT = 0.015 # $15 per 1M output tokens
$CACHE_PRICE_PER_1K = 0.0003  # $0.30 per 1M cached tokens (90% discount)

# First page (no cache)
$firstPageInputTokens = 2000
$firstPageOutputTokens = 500
$firstPageCost = ($firstPageInputTokens / 1000) * $BEDROCK_PRICE_PER_1K_INPUT + ($firstPageOutputTokens / 1000) * $BEDROCK_PRICE_PER_1K_OUTPUT

# Subsequent pages (with cache)
$otherPageInputTokens = 500  # Only user prompt + image tokens
$cacheTokens = 1500  # System prompt cached
$otherPageOutputTokens = 500
$otherPageCost = (($otherPageInputTokens / 1000) * $BEDROCK_PRICE_PER_1K_INPUT) + (($cacheTokens / 1000) * $CACHE_PRICE_PER_1K) + (($otherPageOutputTokens / 1000) * $BEDROCK_PRICE_PER_1K_OUTPUT)

$totalCost = $firstPageCost + (([Math]::Max($aiProcessedPages.Count - 1, 0)) * $otherPageCost)
$avgCostPerPage = if ($aiProcessedPages.Count -gt 0) { $totalCost / $aiProcessedPages.Count } else { 0 }

# Generate report
$reportContent = @"
# HEALTHAI PROCESSING REPORT
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## Document Information
- **Filename**: $filename
- **Document ID**: $docId
- **Upload Time**: $uploadTime
- **Status**: $status
- **Total Pages**: $totalPages
- **Pages Processed (PDF)**: $pagesProcessed
- **Pages AI Processed**: $($aiProcessedPages.Count)

## Processing Performance

### Timing Metrics
- **Total Processing Time**: $(if ($totalDuration -gt 0) { [TimeSpan]::FromSeconds($totalDuration).ToString("hh\:mm\:ss") } else { "N/A" })
- **Average Time per Page**: $(if ($avgTimePerPage -gt 0) { "{0:F2} seconds" -f $avgTimePerPage } else { "N/A" })
- **Processing Rate**: $(if ($pagesPerHour -gt 0) { "{0:F0} pages/hour" -f $pagesPerHour } else { "N/A" })

### Cost Analysis (Claude Sonnet 4.5)
- **First Page Cost**: `$$("{0:F4}" -f $firstPageCost)
- **Other Pages Cost (avg)**: `$$("{0:F4}" -f $otherPageCost)
- **Average Cost per Page**: `$$("{0:F4}" -f $avgCostPerPage)
- **Total Processing Cost**: `$$("{0:F2}" -f $totalCost)
- **Cost Savings (vs no cache)**: ~90% on pages 2+

### Projected Costs
- **100-page document**: `$$("{0:F2}" -f ($firstPageCost + (99 * $otherPageCost)))
- **500-page document**: `$$("{0:F2}" -f ($firstPageCost + (499 * $otherPageCost)))
- **1000-page document**: `$$("{0:F2}" -f ($firstPageCost + (999 * $otherPageCost)))

## Extracted Medical Data

### Summary
- **Medications**: $medsCount
- **Diagnoses**: $diagsCount
- **Test Results**: $testsCount
- **Categories**: $($categories.Count)

### Medications Breakdown
"@

# Add medications details
if ($medsCount -gt 0) {
    $currentMeds = ($medications.Items | Where-Object { $_.is_current.S -eq "Yes" }).Count
    $reportContent += @"

- **Current Medications**: $currentMeds
- **Discontinued/Historical**: $($medsCount - $currentMeds)

#### Top Medications
"@
    $topMeds = $medications.Items | Select-Object -First 10
    foreach ($med in $topMeds) {
        $medName = $med.medication_name.S
        $dosage = $med.dosage.S
        $isCurrent = $med.is_current.S
        $reportContent += "`n- **$medName** ($dosage) - Status: $isCurrent"
    }
}

$reportContent += @"


### Diagnoses Breakdown
"@

# Add diagnoses details
if ($diagsCount -gt 0) {
    $currentDiags = ($diagnoses.Items | Where-Object { $_.is_current.S -eq "Yes" }).Count
    $reportContent += @"

- **Current Diagnoses**: $currentDiags
- **Historical**: $($diagsCount - $currentDiags)

#### Diagnoses List
"@
    $topDiags = $diagnoses.Items | Select-Object -First 15
    foreach ($diag in $topDiags) {
        $diagDesc = $diag.diagnosis_description.S
        $diagCode = if ($diag.diagnosis_code.S -ne "Unknown") { $diag.diagnosis_code.S } else { "N/A" }
        $specialty = if ($diag.diagnosing_doctor_specialty -and $diag.diagnosing_doctor_specialty.S -ne "Unknown") { $diag.diagnosing_doctor_specialty.S } else { "N/A" }
        $reportContent += "`n- **$diagDesc** (Code: $diagCode) - Specialty: $specialty"
    }
}

$reportContent += @"


### Test Results Breakdown
"@

# Add test results details
if ($testsCount -gt 0) {
    $abnormalTests = ($tests.Items | Where-Object { $_.is_abnormal.S -eq "Yes" }).Count
    $reportContent += @"

- **Normal Results**: $($testsCount - $abnormalTests)
- **Abnormal Results**: $abnormalTests

#### Abnormal Test Results (Requiring Attention)
"@
    $abnormalTestsList = $tests.Items | Where-Object { $_.is_abnormal.S -eq "Yes" } | Select-Object -First 10
    foreach ($test in $abnormalTestsList) {
        $testName = $test.test_name.S
        $resultValue = $test.result_value.S
        $unit = if ($test.result_unit.S -ne "Unknown") { $test.result_unit.S } else { "" }
        $reportContent += "`n- **$testName**: $resultValue $unit"
    }
}

$reportContent += @"


## Categories Found
"@

# Add categories
$uniqueCategories = $categories.Items | ForEach-Object { $_.category_name.S } | Select-Object -Unique
foreach ($cat in $uniqueCategories) {
    $count = ($categories.Items | Where-Object { $_.category_name.S -eq $cat }).Count
    $reportContent += "`n- **$cat**: $count pages"
}

$reportContent += @"


## System Performance

### Optimization Features
- ✅ Prompt Caching (90% cost reduction)
- ✅ Single API call per page (5x faster than sequential)
- ✅ Parallel processing via SQS
- ✅ Image compression for large files
- ✅ Exponential backoff retry logic

### Technology Stack
- **AI Model**: Claude Sonnet 4.5 (Bedrock)
- **PDF Processing**: PyMuPDF (conversion to WebP)
- **Database**: DynamoDB
- **Storage**: S3 (WebP images)
- **Compute**: AWS Lambda
- **Queue**: SQS for parallel processing

## Next Steps Recommendations

Based on the extracted data, the system has generated AI-powered care recommendations available in the "Next Steps" section of the UI.

---
*Report generated by HealthAI Processing System*
*Document ID: $docId*
"@

# Save report
$reportPath = "C:\Users\charl\OneDrive\futuregenAI\HealthAI\processing-report-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').md"
$reportContent | Out-File -FilePath $reportPath -Encoding UTF8

Write-Host "`n✅ Report Generated Successfully!" -ForegroundColor Green
Write-Host "`n📄 Report saved to:" -ForegroundColor Cyan
Write-Host "   $reportPath`n" -ForegroundColor White

# Display summary
Write-Host "📊 QUICK SUMMARY" -ForegroundColor Yellow
Write-Host "───────────────" -ForegroundColor DarkGray
Write-Host ("Pages Processed:     {0}/{1}" -f $aiProcessedPages.Count, $totalPages) -ForegroundColor White
Write-Host ("Avg Time/Page:       {0:F2}s" -f $avgTimePerPage) -ForegroundColor White
Write-Host ("Pages/Hour:          {0:F0}" -f $pagesPerHour) -ForegroundColor White
Write-Host ("Avg Cost/Page:       `${0:F4}" -f $avgCostPerPage) -ForegroundColor White
Write-Host ("Total Cost:          `${0:F2}" -f $totalCost) -ForegroundColor Green
Write-Host "`nMedications:         $medsCount" -ForegroundColor Cyan
Write-Host "Diagnoses:           $diagsCount" -ForegroundColor Cyan
Write-Host "Test Results:        $testsCount" -ForegroundColor Cyan
Write-Host "`n"

# Return report path
return $reportPath
