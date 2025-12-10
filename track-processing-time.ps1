param(
    [Parameter(Mandatory=$true)]
    [string]$DocumentId
)

$docKey = "{`"document_id`": {`"S`": `"$DocumentId`"}}"
$region = "us-east-1"

# Get initial document info
$doc = aws dynamodb get-item --table-name HealthAI-Documents --key $docKey --region $region --output json | ConvertFrom-Json | Select-Object -ExpandProperty Item
$startTime = [DateTimeOffset]::FromUnixTimeSeconds([long]$doc.upload_timestamp.N).DateTime
$filename = $doc.filename.S

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         HealthAI - End-to-End Processing Timer           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Write-Host "`nDocument: $filename" -ForegroundColor Yellow
Write-Host "Document ID: $DocumentId" -ForegroundColor Yellow
Write-Host "Start Time: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Yellow
Write-Host "`n" + ("=" * 60) -ForegroundColor DarkGray

$iteration = 0
$lastStatus = ""
$pdfStartTime = $null
$aiStartTime = $null
$completionTime = $null

while ($true) {
    $iteration++
    $now = Get-Date
    $elapsed = $now - $startTime
    
    # Get document status
    $doc = aws dynamodb get-item --table-name HealthAI-Documents --key $docKey --region $region --output json | ConvertFrom-Json | Select-Object -ExpandProperty Item
    $status = $doc.status.S
    $totalPages = [int]$doc.total_pages.N
    $processedPages = [int]$doc.pages_processed.N
    
    # Track status changes
    if ($status -ne $lastStatus) {
        $timestamp = $now.ToString('HH:mm:ss')
        $timeSinceStart = "{0:D2}:{1:D2}" -f [math]::Floor($elapsed.TotalMinutes), $elapsed.Seconds
        
        switch ($status) {
            "UPLOADED" {
                Write-Host "[$timestamp] ✓ Upload Handler completed (+$timeSinceStart)" -ForegroundColor Green
            }
            "PROCESSING" {
                Write-Host "[$timestamp] ⚙️  PDF Conversion started (+$timeSinceStart)" -ForegroundColor Yellow
                $pdfStartTime = $now
            }
            "AI_PROCESSING" {
                Write-Host "[$timestamp] 🤖 AI Extraction started (+$timeSinceStart)" -ForegroundColor Magenta
                $aiStartTime = $now
            }
            "COMPLETED" {
                Write-Host "[$timestamp] ✅ Processing COMPLETED (+$timeSinceStart)" -ForegroundColor Green
                $completionTime = $now
            }
        }
        $lastStatus = $status
    }
    
    # Progress display
    $progressBar = ""
    if ($totalPages -gt 0) {
        $percentComplete = [math]::Round(($processedPages / $totalPages) * 100)
        $barLength = 40
        $filledLength = [math]::Floor(($percentComplete / 100) * $barLength)
        $progressBar = "[" + ("█" * $filledLength) + ("░" * ($barLength - $filledLength)) + "] $percentComplete%"
    }
    
    Clear-Host
    Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║         HealthAI - End-to-End Processing Timer           ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host "`nDocument: $filename" -ForegroundColor Yellow
    Write-Host "Start Time: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor Yellow
    Write-Host "Elapsed: $([math]::Floor($elapsed.TotalMinutes))m $($elapsed.Seconds)s" -ForegroundColor Magenta
    Write-Host "`n" + ("=" * 60) -ForegroundColor DarkGray
    
    Write-Host "`nCurrent Status: $status" -ForegroundColor Yellow
    Write-Host "Total Pages: $totalPages" -ForegroundColor White
    Write-Host "Processed Pages: $processedPages" -ForegroundColor White
    
    if ($progressBar) {
        Write-Host "`nProgress: $progressBar" -ForegroundColor Cyan
    }
    
    # Check queues
    $processingQueue = aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/813281204422/HealthAI-Processing.fifo --attribute-names All --region $region --output json | ConvertFrom-Json
    $aiQueue = aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/813281204422/HealthAI-AI.fifo --attribute-names All --region $region --output json | ConvertFrom-Json
    
    $pdfQueueWaiting = [int]$processingQueue.Attributes.ApproximateNumberOfMessages
    $pdfQueueInflight = [int]$processingQueue.Attributes.ApproximateNumberOfMessagesNotVisible
    $aiQueueWaiting = [int]$aiQueue.Attributes.ApproximateNumberOfMessages
    $aiQueueInflight = [int]$aiQueue.Attributes.ApproximateNumberOfMessagesNotVisible
    
    Write-Host "`nQueue Status:" -ForegroundColor Yellow
    Write-Host "  PDF Processing: $pdfQueueWaiting waiting | $pdfQueueInflight in-flight" -ForegroundColor White
    Write-Host "  AI Processing: $aiQueueWaiting waiting | $aiQueueInflight in-flight" -ForegroundColor White
    
    # Check if completed
    if ($status -eq "COMPLETED") {
        Write-Host "`n" + ("=" * 60) -ForegroundColor DarkGray
        Write-Host "`n🎉 PROCESSING COMPLETE!" -ForegroundColor Green
        Write-Host "`n📊 TIMING BREAKDOWN:" -ForegroundColor Cyan
        Write-Host "  Total Processing Time: $([math]::Floor($elapsed.TotalMinutes))m $($elapsed.Seconds)s" -ForegroundColor White
        
        if ($pdfStartTime) {
            $pdfDuration = $aiStartTime - $pdfStartTime
            Write-Host "  PDF Conversion: $([math]::Floor($pdfDuration.TotalMinutes))m $($pdfDuration.Seconds)s" -ForegroundColor White
        }
        
        if ($aiStartTime -and $completionTime) {
            $aiDuration = $completionTime - $aiStartTime
            Write-Host "  AI Extraction: $([math]::Floor($aiDuration.TotalMinutes))m $($aiDuration.Seconds)s" -ForegroundColor White
        }
        
        Write-Host "`n  Pages Processed: $processedPages" -ForegroundColor White
        
        if ($totalPages -gt 0) {
            $timePerPage = $elapsed.TotalSeconds / $totalPages
            Write-Host "  Time per Page: $([math]::Round($timePerPage, 2))s" -ForegroundColor White
        }
        
        Write-Host "`n" + ("=" * 60) -ForegroundColor DarkGray
        break
    }
    
    Write-Host "`nRefreshing in 10s... (Iteration $iteration) Press Ctrl+C to stop" -ForegroundColor DarkGray
    Start-Sleep -Seconds 10
}
