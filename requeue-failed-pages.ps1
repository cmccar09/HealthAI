#!/usr/bin/env pwsh
# Requeue failed pages for AI processing

param(
    [string]$DocumentId = "ae4571a1-0e5f-4ce0-9c5e-91df480f2b6b"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🔄 Requeuing Failed Pages for AI Processing" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$REGION = "us-east-1"
$PAGES_TABLE = "HealthAI-Pages"
$AI_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/813281204422/HealthAI-AI.fifo"

# Get all pages with errors for this document
Write-Host "Finding failed pages for document: $DocumentId" -ForegroundColor Yellow

$failedPages = aws dynamodb scan `
    --table-name $PAGES_TABLE `
    --filter-expression "document_id = :did AND attribute_exists(#err)" `
    --expression-attribute-names "{`"#err`":`"error`"}" `
    --expression-attribute-values "{`":did`":{`"S`":`"$DocumentId`"}}" `
    --region $REGION | ConvertFrom-Json

$pageCount = $failedPages.Count
Write-Host "Found $pageCount failed pages`n" -ForegroundColor White

if ($pageCount -eq 0) {
    Write-Host "No failed pages to requeue!" -ForegroundColor Green
    exit 0
}

# Requeue each failed page
$requeued = 0
foreach ($item in $failedPages.Items) {
    $pageId = $item.page_id.S
    $pageNumber = [int]$item.page_number.N
    $webpBucket = $item.webp_bucket.S
    $webpKey = $item.webp_s3_key.S
    $totalPages = 237  # You may want to get this from the document
    
    # Create SQS message
    $message = @{
        page_id = $pageId
        document_id = $DocumentId
        page_number = $pageNumber
        total_pages = $totalPages
        webp_bucket = $webpBucket
        webp_key = $webpKey
    } | ConvertTo-Json -Compress
    
    # Send to SQS
    try {
        aws sqs send-message `
            --queue-url $AI_QUEUE_URL `
            --message-body $message `
            --message-group-id $pageId `
            --message-deduplication-id "$pageId-retry-$(Get-Date -Format 'yyyyMMddHHmmss')" `
            --region $REGION | Out-Null
        
        # Clear error from page record
        aws dynamodb update-item `
            --table-name $PAGES_TABLE `
            --key "{`"page_id`":{`"S`":`"$pageId`"}}" `
            --update-expression "REMOVE #err SET #status = :status" `
            --expression-attribute-names "{`"#err`":`"error`",`"#status`":`"status`"}" `
            --expression-attribute-values "{`":status`":{`"S`":`"QUEUED`"}}" `
            --region $REGION | Out-Null
        
        $requeued++
        if ($requeued % 10 -eq 0) {
            Write-Host "  Requeued $requeued / $pageCount pages..." -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Failed to requeue page $pageNumber : $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ Requeued $requeued pages successfully!" -ForegroundColor Green
Write-Host "`nWith new throttling configuration:" -ForegroundColor Cyan
Write-Host "  • Max 10 concurrent Lambda executions" -ForegroundColor White
Write-Host "  • Exponential backoff (1s → 2s → 4s → 8s → 16s)" -ForegroundColor White
Write-Host "  • Image compression for >5MB files" -ForegroundColor White
Write-Host "  • 5 retry attempts per page" -ForegroundColor White
Write-Host "`nProcessing should complete without throttling errors." -ForegroundColor Green
Write-Host "Monitor progress with: .\monitor-processing.ps1 -DocumentId $DocumentId" -ForegroundColor Yellow
