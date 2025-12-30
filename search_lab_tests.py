"""
Search for specific lab test results (A/G RATIO, ALBUMIN, etc.)
"""
import boto3
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
test_results_table = dynamodb.Table('HealthAI-TestResults')

document_id = 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0'

# Get all test results for this document
response = test_results_table.scan(
    FilterExpression=Attr('document_id').eq(document_id)
)

print(f"Total test results: {len(response['Items'])}\n")

# Search for specific tests
search_terms = ['A/G RATIO', 'ALBUMIN', 'ALKALINE PHOSPHATASE', 'ALT', 'SGPT', 
                'AST', 'BILIRUBIN', 'PROTEIN', 'GLOBULIN']

print("="*100)
print("SEARCHING FOR LAB TABLE RESULTS:")
print("="*100)

for term in search_terms:
    print(f"\n\nSearching for: {term}")
    print("-"*100)
    
    found = [test for test in response['Items'] 
             if term.upper() in (test.get('test_name', '') or '').upper()]
    
    if found:
        print(f"✓ Found {len(found)} result(s):")
        for test in found[:5]:  # Show first 5
            print(f"  - Test Name: {test.get('test_name')}")
            print(f"    Date: {test.get('test_date', 'N/A')}")
            print(f"    Value: {test.get('result_value', 'N/A')} {test.get('result_unit', '')}")
            print(f"    Abnormal: {test.get('is_abnormal', 'N/A')}")
            print()
    else:
        print(f"  ✗ Not found")

# Also list all unique test names
print("\n\n" + "="*100)
print("ALL UNIQUE TEST NAMES IN DATABASE:")
print("="*100)
unique_tests = sorted(set([test.get('test_name', 'N/A') for test in response['Items']]))
for idx, test_name in enumerate(unique_tests, 1):
    print(f"{idx}. {test_name}")
