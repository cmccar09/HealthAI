#!/usr/bin/env pwsh
# Monitor document reprocessing with time and cost tracking

param(
    [string]$DocumentId = "",
    [int]$RefreshInterval = 5
)

$ErrorActionPreference = "Stop"

Write-Host "`n📊 HealthAI Document Processing Monitor" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Pricing (approximate)
$BEDROCK_PRICE_PER_1K_INPUT = 0.003  # $3 per 1M input tokens (Claude Sonnet)
$BEDROCK_PRICE_PER_1K_OUTPUT = 0.015 # $15 per 1M output tokens
$AVG_INPUT_TOKENS = 2000  # Approximate for image + prompt
$AVG_OUTPUT_TOKENS = 500  # Approximate JSON response

function Get-DocumentStatus {
    param([string]$docId)
    
    if ([string]::IsNullOrEmpty($docId)) {
        # Get most recent document
        $docs = aws dynamodb scan --table-name HealthAI-Documents --region us-east-1 | ConvertFrom-Json
        $latestDoc = $docs.Items | Sort-Object { [int]$_.upload_timestamp.N } -Descending | Select-Object -First 1
        return $latestDoc
    } else {
        $result = aws dynamodb get-item --table-name HealthAI-Documents --key "{`"document_id`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
        return $result.Item
    }
}

function Get-ProcessedPages {
    param([string]$docId)
    
    $pages = aws dynamodb scan --table-name HealthAI-Pages --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 | ConvertFrom-Json
    return $pages.Items
}

function Get-ExtractedData {
    param([string]$docId)
    
    $medications = aws dynamodb scan --table-name HealthAI-Medications --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 --select COUNT | ConvertFrom-Json
    $diagnoses = aws dynamodb scan --table-name HealthAI-Diagnoses --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 --select COUNT | ConvertFrom-Json
    $tests = aws dynamodb scan --table-name HealthAI-TestResults --filter-expression "document_id = :docId" --expression-attribute-values "{`":docId`":{`"S`":`"$docId`"}}" --region us-east-1 --select COUNT | ConvertFrom-Json
    
    return @{
        medications = $medications.Count
        diagnoses = $diagnoses.Count
        tests = $tests.Count
    }
}

# Monitor loop
Write-Host "Monitoring document processing..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop monitoring`n" -ForegroundColor Gray

$startTime = Get-Date
$lastProcessedCount = 0

while ($true) {
    Clear-Host
    
    Write-Host "`n📊 HealthAI Document Processing Monitor" -ForegroundColor Cyan
    Write-Host "======================================`n" -ForegroundColor Cyan
    
    # Get document status
    $doc = Get-DocumentStatus -docId $DocumentId
    
    if ($null -eq $doc) {
        Write-Host "❌ No document found" -ForegroundColor Red
        Start-Sleep -Seconds $RefreshInterval
        continue
    }
    
    $docId = $doc.document_id.S
    $filename = $doc.filename.S
    $totalPages = [int]$doc.total_pages.N
    $pagesProcessed = [int]$doc.pages_processed.N
    $status = $doc.status.S
    $uploadTime = [DateTimeOffset]::FromUnixTimeSeconds([int]$doc.upload_timestamp.N).LocalDateTime
    
    # Get pages data
    $pages = Get-ProcessedPages -docId $docId
    $aiProcessedPages = ($pages | Where-Object { $_.ai_processed.BOOL -eq $true }).Count
    
    # Get extracted data counts
    $extracted = Get-ExtractedData -docId $docId
    
    # Calculate progress
    $progressPercent = if ($totalPages -gt 0) { [math]::Round(($pagesProcessed / $totalPages) * 100, 1) } else { 0 }
    $aiProgressPercent = if ($totalPages -gt 0) { [math]::Round(($aiProcessedPages / $totalPages) * 100, 1) } else { 0 }
    
    # Time calculations
    $elapsedTime = (Get-Date) - $startTime
    $avgTimePerPage = if ($aiProcessedPages -gt 0) { $elapsedTime.TotalSeconds / $aiProcessedPages } else { 0 }
    $estimatedTimeRemaining = if ($avgTimePerPage -gt 0) { ($totalPages - $aiProcessedPages) * $avgTimePerPage } else { 0 }
    
    # Cost calculations
    $totalCalls = $aiProcessedPages
    $estimatedInputTokens = $totalCalls * $AVG_INPUT_TOKENS
    $estimatedOutputTokens = $totalCalls * $AVG_OUTPUT_TOKENS
    $inputCost = ($estimatedInputTokens / 1000) * $BEDROCK_PRICE_PER_1K_INPUT
    $outputCost = ($estimatedOutputTokens / 1000) * $BEDROCK_PRICE_PER_1K_OUTPUT
    $totalCost = $inputCost + $outputCost
    $estimatedTotalCost = ($totalPages / [Math]::Max($aiProcessedPages, 1)) * $totalCost
    
    # Display information
    Write-Host "📄 Document: " -NoNewline -ForegroundColor White
    Write-Host $filename -ForegroundColor Cyan
    Write-Host "🆔 Document ID: " -NoNewline -ForegroundColor White
    Write-Host $docId -ForegroundColor Gray
    Write-Host "📅 Upload Time: " -NoNewline -ForegroundColor White
    Write-Host $uploadTime -ForegroundColor Gray
    Write-Host "📊 Status: " -NoNewline -ForegroundColor White
    
    $statusColor = switch ($status) {
        "COMPLETED" { "Green" }
        "PROCESSING" { "Yellow" }
        "FAILED" { "Red" }
        default { "Gray" }
    }
    Write-Host $status -ForegroundColor $statusColor
    
    Write-Host "`n⏱️  TIMING" -ForegroundColor Yellow
    Write-Host "─────────" -ForegroundColor DarkGray
    Write-Host ("Elapsed Time:          {0:hh\:mm\:ss}" -f $elapsedTime) -ForegroundColor White
    Write-Host ("Avg Time/Page:         {0:F2} seconds" -f $avgTimePerPage) -ForegroundColor White
    Write-Host ("Est. Time Remaining:   {0:hh\:mm\:ss}" -f [TimeSpan]::FromSeconds($estimatedTimeRemaining)) -ForegroundColor White
    
    Write-Host "`n📈 PROGRESS" -ForegroundColor Yellow
    Write-Host "───────────" -ForegroundColor DarkGray
    Write-Host "PDF Conversion: " -NoNewline -ForegroundColor White
    Write-Host ("{0}/{1} pages ({2}%)" -f $pagesProcessed, $totalPages, $progressPercent) -ForegroundColor Cyan
    
    # Progress bar for PDF conversion
    $barLength = 40
    $filledLength = [math]::Min([math]::Floor($barLength * $progressPercent / 100), $barLength)
    $emptyLength = [math]::Max(0, $barLength - $filledLength)
    $bar = "█" * $filledLength + "░" * $emptyLength
    Write-Host "[$bar]" -ForegroundColor Green
    
    Write-Host "`nAI Processing:  " -NoNewline -ForegroundColor White
    Write-Host ("{0}/{1} pages ({2}%)" -f $aiProcessedPages, $totalPages, $aiProgressPercent) -ForegroundColor Cyan
    
    # Progress bar for AI processing
    $filledLength = [math]::Min([math]::Floor($barLength * $aiProgressPercent / 100), $barLength)
    $emptyLength = [math]::Max(0, $barLength - $filledLength)
    $bar = "█" * $filledLength + "░" * $emptyLength
    Write-Host "[$bar]" -ForegroundColor Blue
    
    Write-Host "`n💰 COST ESTIMATE" -ForegroundColor Yellow
    Write-Host "────────────────" -ForegroundColor DarkGray
    Write-Host ("Bedrock API Calls:     {0}" -f $totalCalls) -ForegroundColor White
    Write-Host ("Est. Input Tokens:     {0:N0}" -f $estimatedInputTokens) -ForegroundColor Gray
    Write-Host ("Est. Output Tokens:    {0:N0}" -f $estimatedOutputTokens) -ForegroundColor Gray
    Write-Host ("Cost So Far:           `${0:F4}" -f $totalCost) -ForegroundColor Cyan
    Write-Host ("Estimated Total Cost:  `${0:F4}" -f $estimatedTotalCost) -ForegroundColor Green
    
    Write-Host "`n📋 EXTRACTED DATA" -ForegroundColor Yellow
    Write-Host "─────────────────" -ForegroundColor DarkGray
    Write-Host ("💊 Medications:  {0}" -f $extracted.medications) -ForegroundColor White
    Write-Host ("🩺 Diagnoses:    {0}" -f $extracted.diagnoses) -ForegroundColor White
    Write-Host ("🔬 Test Results: {0}" -f $extracted.tests) -ForegroundColor White
    
    # Check if processing is complete
    if ($status -eq "COMPLETED") {
        Write-Host "`n✅ Processing Complete!" -ForegroundColor Green
        Write-Host "`n📊 FINAL STATISTICS" -ForegroundColor Cyan
        Write-Host "───────────────────" -ForegroundColor DarkGray
        Write-Host ("Total Time:      {0:hh\:mm\:ss}" -f $elapsedTime) -ForegroundColor White
        Write-Host ("Total Pages:     {0}" -f $totalPages) -ForegroundColor White
        Write-Host ("Avg Time/Page:   {0:F2} seconds" -f $avgTimePerPage) -ForegroundColor White
        Write-Host ("Total Cost:      `${0:F4}" -f $totalCost) -ForegroundColor Green
        Write-Host ("Cost per Page:   `${0:F4}" -f ($totalCost / [Math]::Max($totalPages, 1))) -ForegroundColor Green
        break
    }
    
    if ($status -eq "FAILED") {
        Write-Host "`n❌ Processing Failed" -ForegroundColor Red
        break
    }
    
    # Detect if processing has stalled
    if ($aiProcessedPages -eq $lastProcessedCount -and $status -eq "PROCESSING") {
        Write-Host "`n⚠️  Processing may have stalled (no new pages in {0}s)" -f $RefreshInterval -ForegroundColor Yellow
    }
    $lastProcessedCount = $aiProcessedPages
    
    Write-Host "`n⟳ Refreshing in $RefreshInterval seconds... (Ctrl+C to stop)" -ForegroundColor DarkGray
    Start-Sleep -Seconds $RefreshInterval
}

Write-Host "`n" -ForegroundColor White
