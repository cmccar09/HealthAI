#!/usr/bin/env pwsh
# Monitor HealthAI Document Processing Progress
param(
    [string]$DocumentId = "fbcd5409-aaab-4db4-8f71-a41f042c74a9"
)

$ErrorActionPreference = "SilentlyContinue"
$startTime = Get-Date

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "🏥 HealthAI Processing Monitor" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Document ID: $DocumentId" -ForegroundColor White
Write-Host "Start Time: $($startTime.ToString('HH:mm:ss'))`n" -ForegroundColor Yellow

$region = "us-east-1"
$docTable = "HealthAI-Documents"
$pagesTable = "HealthAI-Pages"
$patientsTable = "HealthAI-Patients"
$s3Bucket = "futuregen-health-ai"

function Get-ElapsedTime {
    $elapsed = (Get-Date) - $startTime
    return "{0:mm}:{0:ss}" -f $elapsed
}

function Check-Document {
    $doc = aws dynamodb get-item --table-name $docTable --key "{`"document_id`":{`"S`":`"$DocumentId`"}}" --region $region 2>$null | ConvertFrom-Json
    if ($doc.Item) {
        return @{
            Status = $doc.Item.status.S
            TotalPages = [int]$doc.Item.total_pages.N
            ProcessedPages = if ($doc.Item.pages_processed.N) { [int]$doc.Item.pages_processed.N } else { 0 }
            PatientId = if ($doc.Item.patient_id.S) { $doc.Item.patient_id.S } else { "PENDING" }
        }
    }
    return $null
}

function Check-Pages {
    $count = aws dynamodb query --table-name $pagesTable --index-name DocumentPages --key-condition-expression "document_id = :did" --expression-attribute-values "{`":did`":{`"S`":`"$DocumentId`"}}" --select COUNT --region $region 2>$null | ConvertFrom-Json
    return $count.Count
}

function Check-PNGImages {
    $pngs = aws s3 ls s3://$s3Bucket/health-ai-png/ --recursive 2>$null | Where-Object { $_ -like "*$DocumentId*" }
    return ($pngs | Measure-Object).Count
}

function Check-WebPImages {
    $webps = aws s3 ls s3://$s3Bucket/health-ai-webp/ --recursive 2>$null | Where-Object { $_ -like "*$DocumentId*" }
    return ($webps | Measure-Object).Count
}

function Check-QueueDepth {
    $processing = aws sqs get-queue-attributes --queue-url "https://sqs.$region.amazonaws.com/813281204422/HealthAI-Processing.fifo" --attribute-names All --region $region 2>$null | ConvertFrom-Json
    $ai = aws sqs get-queue-attributes --queue-url "https://sqs.$region.amazonaws.com/813281204422/HealthAI-AI.fifo" --attribute-names All --region $region 2>$null | ConvertFrom-Json
    
    return @{
        ProcessingQueue = [int]$processing.Attributes.ApproximateNumberOfMessages
        AIQueue = [int]$ai.Attributes.ApproximateNumberOfMessages
        ProcessingInFlight = [int]$processing.Attributes.ApproximateNumberOfMessagesNotVisible
        AIInFlight = [int]$ai.Attributes.ApproximateNumberOfMessagesNotVisible
    }
}

# Monitoring loop
$iteration = 0
$lastStatus = ""
$lastPageCount = 0

while ($true) {
    $iteration++
    Clear-Host
    
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🏥 HealthAI Processing Monitor - Iteration $iteration" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "Elapsed: $(Get-ElapsedTime) | Refresh: Every 10s`n" -ForegroundColor Yellow
    
    # Get document status
    $doc = Check-Document
    
    if ($doc) {
        Write-Host "📄 Document Status" -ForegroundColor Green
        Write-Host "  Status: $($doc.Status)" -ForegroundColor White
        Write-Host "  Total Pages: $($doc.TotalPages)" -ForegroundColor White
        Write-Host "  Processed Pages: $($doc.ProcessedPages)" -ForegroundColor White
        
        if ($doc.TotalPages -gt 0) {
            $pct = [math]::Round(($doc.ProcessedPages / $doc.TotalPages) * 100, 1)
            Write-Host "  Progress: $pct%" -ForegroundColor Cyan
            
            # Progress bar
            $barLength = 40
            $filled = [math]::Floor($barLength * $pct / 100)
            $bar = "█" * $filled + "░" * ($barLength - $filled)
            Write-Host "  [$bar]" -ForegroundColor Cyan
        }
        
        Write-Host "  Patient ID: $($doc.PatientId)`n" -ForegroundColor Gray
        
        # Check if status changed
        if ($doc.Status -ne $lastStatus) {
            Write-Host "  🔔 Status changed: $lastStatus → $($doc.Status)" -ForegroundColor Yellow
            $lastStatus = $doc.Status
        }
    } else {
        Write-Host "📄 Document: Not found or pending...`n" -ForegroundColor Red
    }
    
    # Check pages in DynamoDB
    $pageCount = Check-Pages
    Write-Host "📊 Pages Table" -ForegroundColor Green
    Write-Host "  Pages in DynamoDB: $pageCount" -ForegroundColor White
    
    if ($pageCount -gt $lastPageCount) {
        Write-Host "  📈 +$($pageCount - $lastPageCount) new pages processed!" -ForegroundColor Green
        $lastPageCount = $pageCount
    }
    Write-Host ""
    
    # Check S3 images
    $pngCount = Check-PNGImages
    $webpCount = Check-WebPImages
    
    Write-Host "🖼️  Images in S3" -ForegroundColor Green
    Write-Host "  PNG files: $pngCount" -ForegroundColor White
    Write-Host "  WebP files: $webpCount`n" -ForegroundColor White
    
    # Check queue status
    $queues = Check-QueueDepth
    Write-Host "📮 Queue Status" -ForegroundColor Green
    Write-Host "  Processing Queue: $($queues.ProcessingQueue) waiting | $($queues.ProcessingInFlight) in-flight" -ForegroundColor White
    Write-Host "  AI Queue: $($queues.AIQueue) waiting | $($queues.AIInFlight) in-flight`n" -ForegroundColor White
    
    # Check if complete
    if ($doc -and $doc.Status -eq "COMPLETED" -and $doc.ProcessedPages -eq $doc.TotalPages -and $queues.AIQueue -eq 0 -and $queues.AIInFlight -eq 0) {
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "✅ PROCESSING COMPLETE!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
        Write-Host "Total Time: $(Get-ElapsedTime)" -ForegroundColor Yellow
        Write-Host "Pages Processed: $($doc.TotalPages)" -ForegroundColor White
        Write-Host "Average Time/Page: $([math]::Round(((Get-Date) - $startTime).TotalSeconds / $doc.TotalPages, 2))s`n" -ForegroundColor Gray
        break
    }
    
    Write-Host "Press Ctrl+C to stop monitoring..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 10
}
