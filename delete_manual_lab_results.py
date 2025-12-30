import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
tests_table = dynamodb.Table('HealthAI-TestResults')

# Document ID for Alex Doe
document_id = 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0'

# Test dates we manually added
manual_test_dates = ['2023-01-01', '2020-12-23', '2017-01-17', '2017-01-01', '2004-01-01']

# Tests we manually added
manual_test_names = [
    'A/G RATIO (275)',
    'ALBUMIN (378)',
    'ALKALINE PHOSPHATASE (22)',
    'ALT (SGPT) (282)',
    'APPEARANCE (941)',
    'AST (SGOT) (279)',
    'BASO (ABSOLUTE) (245)'
]

print(f"Deleting manually added lab results for document: {document_id}")
print(f"Test dates: {manual_test_dates}")
print(f"Test names: {manual_test_names}\n")

deleted_count = 0

# Query all test results for this document
response = tests_table.scan(
    FilterExpression='document_id = :doc_id',
    ExpressionAttributeValues={':doc_id': document_id}
)

for item in response.get('Items', []):
    test_name = item.get('test_name', '')
    test_date = item.get('test_date', '')
    
    # Check if this is one of our manually added results
    is_manual = False
    for manual_name in manual_test_names:
        if manual_name in test_name and test_date in manual_test_dates:
            is_manual = True
            break
    
    if is_manual:
        test_id = item['test_id']
        tests_table.delete_item(Key={'test_id': test_id})
        deleted_count += 1
        print(f"✓ Deleted: {test_name} - {test_date}")

print(f"\n{'='*70}")
print(f"✓ Deleted {deleted_count} manually added test results")
print(f"AI-extracted results remain in the database")
print(f"{'='*70}")
