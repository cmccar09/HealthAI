Write-Host "`n🎯 Setting Lambda Concurrency Limits" -ForegroundColor Cyan
Write-Host "====================================`n" -ForegroundColor Cyan

# Set reserved concurrent executions to limit parallel processing
# This prevents overwhelming Bedrock API with too many simultaneous requests
$concurrency = 5  # Process max 5 pages simultaneously

Write-Host "Setting AI Processor concurrency to $concurrency..." -ForegroundColor Yellow

try {
    aws lambda put-function-concurrency `
        --function-name HealthAI-AIProcessor `
        --reserved-concurrent-executions $concurrency | Out-Null
    
    Write-Host "✅ Concurrency limit set successfully!" -ForegroundColor Green
    Write-Host "`nThis limits parallel processing to $concurrency pages at a time" -ForegroundColor White
    Write-Host "Reduces Bedrock API throttling while maintaining good speed`n" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Error setting concurrency: $_" -ForegroundColor Red
}
