"""
Add lab table results from patient_1190_lab_results.pdf to DynamoDB
This adds the structured lab results with multiple dates as shown in the PDF
"""
import boto3
import uuid
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
test_results_table = dynamodb.Table('HealthAI-TestResults')

# Alex Doe's document ID
document_id = 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0'

# Test dates from the PDF (5 columns)
test_dates = ['2023-01-01', '2020-12-23', '2017-01-17', '2017-01-01', '2004-01-01']

# Lab test results from the PDF table
lab_tests = [
    {
        'name': 'A/G RATIO (275)',
        'specialty': 'Serology',
        'unit': '',
        'values': ['1.8', '1.4', '1.8', '1.7', '1.8'],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'ALBUMIN (378)',
        'specialty': 'Chemistry',
        'unit': 'g/dL',
        'values': ['4.5', '4.3', '4.3', '4.5', '4.5'],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'ALKALINE PHOSPHATASE (22)',
        'specialty': 'Hematology',
        'unit': 'IU/L',
        'values': ['56', '51', '56', '59', '56'],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'ALT (SGPT) (282)',
        'specialty': 'Hematology',
        'unit': 'IU/L',
        'values': ['12', '13', '12', '16', '12'],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'APPEARANCE (941)',
        'specialty': 'Hematology',
        'unit': '',
        'values': ['Clear', 'Clear', 'Clear', '', ''],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'AST (SGOT) (279)',
        'specialty': 'Hematology',
        'unit': 'IU/L',
        'values': ['18', '21', '18', '19', '18'],
        'abnormal': [False, False, False, False, False]
    },
    {
        'name': 'BASO (ABSOLUTE) (245)',
        'specialty': 'Hematology',
        'unit': 'x10E3/uL',
        'values': ['0.1', '0.1', '0.1', '0.0', '0.0'],
        'abnormal': [False, False, False, False, False]
    },
]

print(f"Adding lab table results to DynamoDB for document: {document_id}")
print(f"Test dates: {', '.join(test_dates)}\n")

added_count = 0
for test in lab_tests:
    print(f"\nAdding {test['name']} ({test['specialty']}):")
    
    for idx, date in enumerate(test_dates):
        if test['values'][idx]:  # Only add if there's a value
            test_result = {
                'test_id': str(uuid.uuid4()),
                'document_id': document_id,
                'test_name': test['name'],
                'test_date': date,
                'result_value': test['values'][idx],
                'result_unit': test['unit'],
                'is_abnormal': 'yes' if test['abnormal'][idx] else 'no',
                'specialty': test['specialty'],
                'created_timestamp': int(datetime.utcnow().timestamp())
            }
            
            try:
                test_results_table.put_item(Item=test_result)
                print(f"  ✓ {date}: {test['values'][idx]} {test['unit']}")
                added_count += 1
            except Exception as e:
                print(f"  ✗ Error adding {date}: {e}")

print(f"\n{'='*80}")
print(f"✓ Successfully added {added_count} lab test results")
print(f"{'='*80}")
