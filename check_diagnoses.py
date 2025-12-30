import boto3
from boto3.dynamodb.conditions import Key
from collections import defaultdict
import json

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('HealthAI-Diagnoses')

document_id = 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0'

response = table.scan(
    FilterExpression=Key('document_id').eq(document_id)
)

diagnoses = response.get('Items', [])
print(f"Total diagnoses found: {len(diagnoses)}\n")

# Show first 3 items with all fields
print("Sample diagnosis records:")
print("=" * 80)
for i, item in enumerate(diagnoses[:3]):
    print(f"\n#{i+1}:")
    print(json.dumps(item, indent=2, default=str))

# Group by diagnosis_description
grouped = defaultdict(list)
for d in diagnoses:
    diagnosis_name = d.get('diagnosis_description', d.get('diagnosis', 'Unknown'))
    grouped[diagnosis_name].append(d)

print("\n\nDiagnoses grouped by description:")
print("=" * 80)
for diagnosis_name, items in sorted(grouped.items()):
    if len(items) <= 3:  # Only show ones with 3 or fewer occurrences
        print(f"\n{diagnosis_name} ({len(items)} occurrences)")
        for item in items:
            icd_code = item.get('icd10_code', 'N/A')
            date = item.get('diagnosis_date', 'N/A')
            print(f"  - ICD-10: {icd_code} | Date: {date}")
