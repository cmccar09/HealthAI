"""
Check test results in DynamoDB for Alex Doe patient
"""
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Get Alex Doe's document/patient ID
patients_table = dynamodb.Table('HealthAI-Patients')
print("Searching for Alex Doe patient...")
response = patients_table.scan(
    FilterExpression=Attr('patient_first_name').eq('Alex') & Attr('patient_last_name').eq('Doe')
)

if response['Items']:
    patient = response['Items'][0]
    print(f"\n✓ Found patient: {patient.get('patient_first_name')} {patient.get('patient_last_name')}")
    print(f"  Patient ID: {patient.get('patient_id')}")
    print(f"  Document ID: {patient.get('document_id')}")
    
    document_id = patient.get('document_id')
    patient_id = patient.get('patient_id')
    
    # Check test results
    test_results_table = dynamodb.Table('HealthAI-TestResults')
    print(f"\n\nChecking test results for document_id: {document_id}")
    
    test_response = test_results_table.scan(
        FilterExpression=Attr('document_id').eq(document_id)
    )
    
    print(f"\n✓ Found {len(test_response['Items'])} test results")
    
    if test_response['Items']:
        print("\n" + "="*80)
        print("TEST RESULTS:")
        print("="*80)
        
        for idx, test in enumerate(test_response['Items'][:10], 1):  # Show first 10
            print(f"\n{idx}. Test Name: {test.get('test_name', 'N/A')}")
            print(f"   Test Date: {test.get('test_date', 'N/A')}")
            print(f"   Result Value: {test.get('result_value', 'N/A')}")
            print(f"   Unit: {test.get('result_unit', 'N/A')}")
            print(f"   Is Abnormal: {test.get('is_abnormal', 'N/A')}")
            print(f"   Normal Range: {test.get('normal_range_low', 'N/A')} - {test.get('normal_range_high', 'N/A')}")
            print(f"   Document ID: {test.get('document_id', 'N/A')}")
            print(f"   Page ID: {test.get('page_id', 'N/A')}")
        
        if len(test_response['Items']) > 10:
            print(f"\n... and {len(test_response['Items']) - 10} more test results")
    else:
        print("\n⚠️  No test results found!")
        print("\nThis means the AI processor hasn't extracted test results from the PDF pages yet.")
        print("Check if the pages have been processed by the AI processor Lambda.")
        
else:
    print("\n✗ Alex Doe patient not found in database")
    print("\nSearching all patients...")
    all_patients = patients_table.scan()
    print(f"Total patients in database: {len(all_patients['Items'])}")
    for p in all_patients['Items']:
        print(f"  - {p.get('patient_first_name', 'N/A')} {p.get('patient_last_name', 'N/A')} (ID: {p.get('patient_id', 'N/A')})")
