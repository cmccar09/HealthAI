# HealthAI Frontend Configuration Script
# This script helps set up the .env file with AWS credentials

Write-Host "`n=== HealthAI Frontend Configuration ===" -ForegroundColor Cyan
Write-Host "This script will help you set up AWS credentials for the frontend.`n"

# Check if .env already exists
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (yes/no)"
    if ($overwrite -ne "yes") {
        Write-Host "Configuration cancelled. Existing .env file preserved." -ForegroundColor Green
        exit
    }
}

# Get AWS credentials
Write-Host "`nEnter your AWS credentials:" -ForegroundColor Cyan
Write-Host "(You can find these in AWS IAM Console → Users → Security Credentials)`n"

$accessKey = Read-Host "AWS Access Key ID"
$secretKey = Read-Host "AWS Secret Access Key" -AsSecureString
$secretKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
)
$region = Read-Host "AWS Region (default: us-east-1)"
if ([string]::IsNullOrWhiteSpace($region)) {
    $region = "us-east-1"
}

# Create .env file
$envContent = @"
# AWS Configuration for HealthAI Frontend
REACT_APP_AWS_ACCESS_KEY_ID=$accessKey
REACT_APP_AWS_SECRET_ACCESS_KEY=$secretKeyPlain
REACT_APP_AWS_REGION=$region
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8

Write-Host "`n✅ Configuration complete!" -ForegroundColor Green
Write-Host "Created .env file with AWS credentials.`n"

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: npm start"
Write-Host "2. Open: http://localhost:3000"
Write-Host "3. View your processed medical documents`n"

Write-Host "⚠️  Security Note:" -ForegroundColor Yellow
Write-Host "The .env file is git-ignored and will NOT be committed to version control."
Write-Host "Never share your AWS credentials!`n"
