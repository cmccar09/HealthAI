# Convert Markdown files to HTML (then save as PDF from browser)

Write-Host "Converting Executive Summary to HTML..." -ForegroundColor Cyan

$execSummary = Get-Content "PITCH_MATERIALS\Executive_Summary.md" -Raw

$htmlExec = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HealthAI - Executive Summary</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        h3 { color: #555; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
        strong { color: #2c3e50; }
        a { color: #3498db; text-decoration: none; }
        a:hover { text-decoration: underline; }
        hr { border: none; border-top: 2px solid #ddd; margin: 30px 0; }
        .highlight { background: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 15px 0; }
    </style>
</head>
<body>
$($execSummary -replace '```','<pre>' -replace '###','<h3>' -replace '##','<h2>' -replace '^# ','<h1>' -replace '\*\*([^*]+)\*\*','<strong>$1</strong>' -replace '---','<hr>' -replace '• ','<li>' -replace '\n\n','</p><p>')
</body>
</html>
"@

$htmlExec | Out-File "PITCH_MATERIALS\Executive_Summary.html" -Encoding UTF8

Write-Host "✓ Created Executive_Summary.html" -ForegroundColor Green

Write-Host "`nConverting Pitch Deck to HTML..." -ForegroundColor Cyan

$pitchDeck = Get-Content "PITCH_MATERIALS\KKR_Pitch_Deck.md" -Raw

$htmlDeck = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>HealthAI - Investment Pitch Deck</title>
    <style>
        @page { size: A4; margin: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
        .slide { page-break-after: always; padding: 60px; min-height: 90vh; box-sizing: border-box; }
        .slide:last-child { page-break-after: auto; }
        h1 { color: #2c3e50; font-size: 36px; margin-bottom: 20px; }
        h2 { color: #34495e; font-size: 28px; margin-top: 30px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h3 { color: #555; font-size: 20px; }
        ul { font-size: 16px; line-height: 1.8; }
        li { margin: 10px 0; }
        strong { color: #2c3e50; }
        .bullet { color: #3498db; font-weight: bold; }
        hr { border: none; border-top: 3px solid #3498db; margin: 40px 0; }
        code { background: #f8f9fa; padding: 2px 6px; border-radius: 3px; }
        blockquote { background: #f8f9fa; padding: 20px; border-left: 5px solid #3498db; font-style: italic; margin: 20px 0; }
    </style>
</head>
<body>
$($pitchDeck -replace '## SLIDE \d+:','</div><div class="slide"><h2>' -replace '###','<h3>' -replace '##','<h2>' -replace '^# ','<h1>' -replace '\*\*([^*]+)\*\*','<strong>$1</strong>' -replace '```','<code>' -replace '---','<hr>' -replace '• ','<li>' -replace '^>','<blockquote>' -replace '\n\n','</p><p>')
</body>
</html>
"@

$htmlDeck | Out-File "PITCH_MATERIALS\KKR_Pitch_Deck.html" -Encoding UTF8

Write-Host "✓ Created KKR_Pitch_Deck.html" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "HTML files created successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "`nTO CONVERT TO PDF:" -ForegroundColor Cyan
Write-Host "1. Open the HTML files in your browser" -ForegroundColor White
Write-Host "2. Press Ctrl+P (Print)" -ForegroundColor White
Write-Host "3. Select 'Save as PDF'" -ForegroundColor White
Write-Host "4. Save as:" -ForegroundColor White
Write-Host "   - HealthAI_Executive_Summary.pdf" -ForegroundColor Yellow
Write-Host "   - HealthAI_Pitch_Deck.pdf" -ForegroundColor Yellow
Write-Host "`nFiles location:" -ForegroundColor Cyan
Write-Host "   $PWD\PITCH_MATERIALS\" -ForegroundColor Yellow

# Open the files in default browser
Write-Host "`nOpening files in browser..." -ForegroundColor Cyan
Start-Process "PITCH_MATERIALS\Executive_Summary.html"
Start-Sleep -Seconds 2
Start-Process "PITCH_MATERIALS\KKR_Pitch_Deck.html"
