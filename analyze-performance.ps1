#!/usr/bin/env pwsh
# Comprehensive Performance Analysis for HealthAI Processing

param(
    [string]$DocumentId = "ae4571a1-0e5f-4ce0-9c5e-91df480f2b6b"
)

$ErrorActionPreference = "Continue"

Write-Host "`n📊 HealthAI Performance Analysis" -ForegroundColor Cyan
Write-Host "=================================`n" -ForegroundColor Cyan

$REGION = "us-east-1"

# Get document details
Write-Host "📄 Document Information" -ForegroundColor Yellow
$doc = aws dynamodb get-item --table-name HealthAI-Documents --key "{`"document_id`":{`"S`":`"$DocumentId`"}}" --region $REGION | ConvertFrom-Json
$uploadTime = [DateTimeOffset]::FromUnixTimeSeconds([int]$doc.Item.upload_timestamp.N)
$totalPages = [int]$doc.Item.total_pages.N
$filename = $doc.Item.filename.S

Write-Host "  File: $filename" -ForegroundColor White
Write-Host "  Upload Time: $($uploadTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host "  Total Pages: $totalPages" -ForegroundColor White
Write-Host "  Status: $($doc.Item.status.S)" -ForegroundColor White

# Get page processing statistics
Write-Host "`n📊 Page Processing Statistics" -ForegroundColor Yellow
$allPages = aws dynamodb scan --table-name HealthAI-Pages --filter-expression "document_id = :did" --expression-attribute-values "{`":did`":{`"S`":`"$DocumentId`"}}" --region $REGION | ConvertFrom-Json

$processedPages = ($allPages.Items | Where-Object { $_.ai_processed.BOOL -eq $true }).Count
$errorPages = ($allPages.Items | Where-Object { $_.error }).Count
$pendingPages = $totalPages - $processedPages - $errorPages

Write-Host "  ✅ Processed: $processedPages / $totalPages ($([math]::Round($processedPages/$totalPages*100, 1))%)" -ForegroundColor Green
Write-Host "  ❌ Errors: $errorPages" -ForegroundColor Red
Write-Host "  ⏳ Pending: $pendingPages" -ForegroundColor Yellow

# Analyze errors
if ($errorPages -gt 0) {
    Write-Host "`n❌ Error Analysis" -ForegroundColor Red
    $errorSamples = $allPages.Items | Where-Object { $_.error } | Select-Object -First 5
    $errorTypes = @{}
    
    foreach ($page in ($allPages.Items | Where-Object { $_.error })) {
        $errorMsg = $page.error.S
        if ($errorMsg -match "ThrottlingException") { $errorTypes["Throttling"] = ($errorTypes["Throttling"] ?? 0) + 1 }
        elseif ($errorMsg -match "image exceeds|ValidationException") { $errorTypes["Image Too Large"] = ($errorTypes["Image Too Large"] ?? 0) + 1 }
        elseif ($errorMsg -match "timeout") { $errorTypes["Timeout"] = ($errorTypes["Timeout"] ?? 0) + 1 }
        else { $errorTypes["Other"] = ($errorTypes["Other"] ?? 0) + 1 }
    }
    
    foreach ($type in $errorTypes.Keys) {
        $count = $errorTypes[$type]
        Write-Host "  $type : $count" -ForegroundColor White
    }
}

# Calculate timing
Write-Host "`n⏱️  Timing Analysis" -ForegroundColor Yellow
$now = Get-Date
$totalElapsed = ($now - $uploadTime.LocalDateTime).TotalMinutes

Write-Host "  Total Time: $([math]::Round($totalElapsed, 1)) minutes" -ForegroundColor White
if ($processedPages -gt 0) {
    $avgPerPage = $totalElapsed / $processedPages
    Write-Host "  Avg per Page: $([math]::Round($avgPerPage, 2)) minutes" -ForegroundColor White
    Write-Host "  Throughput: $([math]::Round(60/$avgPerPage, 1)) pages/hour" -ForegroundColor White
}

# Lambda metrics (last hour)
Write-Host "`n🔧 Lambda Performance (Last Hour)" -ForegroundColor Yellow
$startTime = (Get-Date).AddHours(-1).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss')
$endTime = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss')

$invocations = aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=HealthAI-AIProcessor --start-time $startTime --end-time $endTime --period 3600 --statistics Sum --region $REGION 2>$null | ConvertFrom-Json
$errors = aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=HealthAI-AIProcessor --start-time $startTime --end-time $endTime --period 3600 --statistics Sum --region $REGION 2>$null | ConvertFrom-Json
$duration = aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Duration --dimensions Name=FunctionName,Value=HealthAI-AIProcessor --start-time $startTime --end-time $endTime --period 3600 --statistics Average --region $REGION 2>$null | ConvertFrom-Json

if ($invocations.Datapoints) {
    Write-Host "  Invocations: $($invocations.Datapoints[0].Sum)" -ForegroundColor White
}
if ($errors.Datapoints) {
    Write-Host "  Errors: $($errors.Datapoints[0].Sum)" -ForegroundColor White
}
if ($duration.Datapoints) {
    Write-Host "  Avg Duration: $([math]::Round($duration.Datapoints[0].Average/1000, 1))s" -ForegroundColor White
}

# Cost estimation
Write-Host "`n💰 Cost Estimation" -ForegroundColor Yellow
$totalInvocations = $processedPages * 5  # ~5 Bedrock calls per page
$bedrockInputTokens = $totalInvocations * 2000  # ~2k tokens per call (with caching)
$bedrockOutputTokens = $totalInvocations * 500  # ~500 tokens output
$lambdaDurationMins = ($processedPages * 60) / 60  # Assuming 60s avg per page

Write-Host "  Bedrock API Calls: ~$totalInvocations" -ForegroundColor White
Write-Host "  Bedrock Input Tokens: ~$([math]::Round($bedrockInputTokens/1000000, 2))M" -ForegroundColor White
Write-Host "  Bedrock Output Tokens: ~$([math]::Round($bedrockOutputTokens/1000000, 2))M" -ForegroundColor White
Write-Host "  Lambda GB-seconds: ~$([math]::Round($lambdaDurationMins * 60, 0))" -ForegroundColor White

$bedrockCost = ($bedrockInputTokens * 0.003 / 1000) + ($bedrockOutputTokens * 0.015 / 1000)  # Claude Sonnet pricing
$lambdaCost = ($lambdaDurationMins * 60 * 1.024 * 0.0000166667)  # 1GB Lambda
$s3Cost = ($totalPages * 2 * 0.0000004)  # Storage for PNG+WebP
$dynamodbCost = (($totalPages * 5) * 0.00000025)  # Write units

Write-Host "  Estimated Bedrock: `$$([math]::Round($bedrockCost, 2))" -ForegroundColor Cyan
Write-Host "  Estimated Lambda: `$$([math]::Round($lambdaCost, 4))" -ForegroundColor Cyan
Write-Host "  Estimated S3: `$$([math]::Round($s3Cost, 4))" -ForegroundColor Cyan
Write-Host "  Estimated DynamoDB: `$$([math]::Round($dynamodbCost, 4))" -ForegroundColor Cyan
Write-Host "  Total: `$$([math]::Round($bedrockCost + $lambdaCost + $s3Cost + $dynamodbCost, 2))" -ForegroundColor Green

# Recommendations
Write-Host "`n💡 Performance Recommendations" -ForegroundColor Yellow

Write-Host "`n1. THROTTLING ISSUES" -ForegroundColor Cyan
Write-Host "   Problem: Bedrock rate limits caused ~229 pages to fail initially" -ForegroundColor White
Write-Host "   Solution Applied:" -ForegroundColor Green
Write-Host "     ✅ SQS MaxConcurrency limited to 10" -ForegroundColor Gray
Write-Host "     ✅ Exponential backoff (1s → 16s)" -ForegroundColor Gray
Write-Host "     ✅ Jitter to prevent thundering herd" -ForegroundColor Gray
Write-Host "   Future Improvement:" -ForegroundColor Yellow
Write-Host "     • Request Bedrock quota increase (currently ~10-20 req/sec)" -ForegroundColor White
Write-Host "     • Consider batching similar pages together" -ForegroundColor White

Write-Host "`n2. IMAGE SIZE ISSUES" -ForegroundColor Cyan
Write-Host "   Problem: Some images >5MB exceed Bedrock limits" -ForegroundColor White
Write-Host "   Solution Applied:" -ForegroundColor Green
Write-Host "     ✅ Automatic compression for oversized images" -ForegroundColor Gray
Write-Host "   Future Improvement:" -ForegroundColor Yellow
Write-Host "     • Compress all images during conversion (not at AI time)" -ForegroundColor White
Write-Host "     • Use lower quality WebP (quality=75 instead of 90)" -ForegroundColor White

Write-Host "`n3. PROCESSING TIME" -ForegroundColor Cyan
Write-Host "   Current: ~$([math]::Round($avgPerPage, 2)) min/page" -ForegroundColor White
Write-Host "   Bottleneck: 5 sequential Bedrock API calls per page" -ForegroundColor White
Write-Host "   Improvements:" -ForegroundColor Yellow
Write-Host "     • Combine extractions into 1-2 calls instead of 5" -ForegroundColor White
Write-Host "     • Use prompt caching more aggressively" -ForegroundColor White
Write-Host "     • Process only relevant pages (skip blank/cover pages)" -ForegroundColor White

Write-Host "`n4. COST OPTIMIZATION" -ForegroundColor Cyan
Write-Host "   Current: ~`$$([math]::Round($bedrockCost/$totalPages, 3))/page" -ForegroundColor White
Write-Host "   Improvements:" -ForegroundColor Yellow
Write-Host "     • Reduce token usage with shorter prompts" -ForegroundColor White
Write-Host "     • Use Claude Haiku for simple categorization" -ForegroundColor White
Write-Host "     • Skip AI processing for empty/irrelevant pages" -ForegroundColor White

Write-Host "`n5. SCALABILITY" -ForegroundColor Cyan
Write-Host "   Current Limit: 10 concurrent executions" -ForegroundColor White
Write-Host "   Improvements:" -ForegroundColor Yellow
Write-Host "     • Request higher Bedrock quotas from AWS" -ForegroundColor White
Write-Host "     • Implement cross-region Bedrock routing" -ForegroundColor White
Write-Host "     • Use Reserved Capacity for Bedrock" -ForegroundColor White

Write-Host "`n✅ Analysis Complete!" -ForegroundColor Green
