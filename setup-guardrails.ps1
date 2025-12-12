#!/usr/bin/env pwsh
# Create Bedrock Guardrail for Medical Data Processing

$ErrorActionPreference = "Stop"

Write-Host "`n🛡️ Creating Bedrock Guardrail for Medical Data" -ForegroundColor Cyan
Write-Host "==============================================`n" -ForegroundColor Cyan

$REGION = "us-east-1"
$GUARDRAIL_NAME = "HealthAI-Medical-Guardrail"

# Create guardrail configuration
$guardrailConfig = @{
    name = $GUARDRAIL_NAME
    description = "Content filtering for medical document processing"
    blockedInputMessaging = "This content contains sensitive medical information that cannot be processed."
    blockedOutputsMessaging = "The AI response contains sensitive information that cannot be returned."
    contentPolicyConfig = @{
        filtersConfig = @(
            @{
                type = "SEXUAL"
                inputStrength = "HIGH"
                outputStrength = "HIGH"
            },
            @{
                type = "VIOLENCE"
                inputStrength = "MEDIUM"
                outputStrength = "MEDIUM"
            },
            @{
                type = "HATE"
                inputStrength = "HIGH"
                outputStrength = "HIGH"
            },
            @{
                type = "INSULTS"
                inputStrength = "LOW"
                outputStrength = "LOW"
            },
            @{
                type = "MISCONDUCT"
                inputStrength = "MEDIUM"
                outputStrength = "MEDIUM"
            }
        )
    }
    sensitiveInformationPolicyConfig = @{
        piiEntitiesConfig = @(
            @{ type = "EMAIL"; action = "ANONYMIZE" },
            @{ type = "PHONE"; action = "ANONYMIZE" },
            @{ type = "NAME"; action = "ANONYMIZE" },
            @{ type = "ADDRESS"; action = "ANONYMIZE" },
            @{ type = "AGE"; action = "BLOCK" },
            @{ type = "DRIVER_ID"; action = "BLOCK" },
            @{ type = "LICENSE_PLATE"; action = "BLOCK" },
            @{ type = "VEHICLE_IDENTIFICATION_NUMBER"; action = "BLOCK" },
            @{ type = "US_SOCIAL_SECURITY_NUMBER"; action = "BLOCK" },
            @{ type = "US_BANK_ACCOUNT_NUMBER"; action = "BLOCK" },
            @{ type = "CREDIT_DEBIT_CARD_NUMBER"; action = "BLOCK" }
        )
        regexesConfig = @(
            @{
                name = "MRN-Pattern"
                description = "Medical Record Number pattern"
                pattern = "MRN[:\s]*\d{6,10}"
                action = "ANONYMIZE"
            },
            @{
                name = "Patient-ID-Pattern"
                description = "Patient ID pattern"
                pattern = "(?i)patient\s*id[:\s]*\d+"
                action = "ANONYMIZE"
            }
        )
    }
    wordPolicyConfig = @{
        wordsConfig = @(
            @{ text = "CONFIDENTIAL" },
            @{ text = "DO NOT SHARE" }
        )
        managedWordListsConfig = @(
            @{ type = "PROFANITY" }
        )
    }
}

Write-Host "Creating guardrail: $GUARDRAIL_NAME" -ForegroundColor Yellow

# Note: This is a template. Actual creation requires proper JSON formatting
# and may need to be done via AWS Console for complex configurations

Write-Host @"

⚠️  IMPORTANT: Bedrock Guardrails Setup

To enable content filtering like your work account:

1. Go to AWS Console > Bedrock > Guardrails
2. Create a new guardrail with these settings:
   
   Content Filters:
   - Sexual: HIGH
   - Violence: MEDIUM  
   - Hate: HIGH
   - Insults: LOW
   - Misconduct: MEDIUM
   
   PII Protection:
   - Email, Phone, Name, Address: ANONYMIZE
   - SSN, Bank Account, Credit Card: BLOCK
   - Medical Record Numbers: ANONYMIZE
   
   Word Filters:
   - Add medical-specific sensitive terms
   - Block profanity

3. Note the Guardrail ID

4. Update Lambda to use guardrail:
   Add to invoke_model call:
   guardrailIdentifier='your-guardrail-id'
   guardrailVersion='1'

This will match enterprise content filtering!
"@ -ForegroundColor Cyan

Write-Host "`n📝 To test guardrails, you would need:" -ForegroundColor Yellow
Write-Host "  1. Real medical data (not fake)" -ForegroundColor White
Write-Host "  2. Guardrail configured and active" -ForegroundColor White
Write-Host "  3. Updated Lambda code to use guardrail" -ForegroundColor White
