import boto3
import uuid
from datetime import datetime

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
documents_table = dynamodb.Table('HealthAI-Documents')
patients_table = dynamodb.Table('HealthAI-Patients')
procedures_table = dynamodb.Table('HealthAI-Procedures')
radiology_table = dynamodb.Table('HealthAI-Radiology')
medications_table = dynamodb.Table('HealthAI-Medications')
diagnoses_table = dynamodb.Table('HealthAI-Diagnoses')
tests_table = dynamodb.Table('HealthAI-TestResults')

# Document ID
document_id = '612d07e4-4aa2-4ccf-a596-7bb2d36c1624'

# Get document
doc_response = documents_table.get_item(Key={'document_id': document_id})
document = doc_response.get('Item', {})

print(f"Document: {document.get('filename')}")
print(f"Patient name hint: {document.get('patient_name_hint')}")

# Create patient ID
patient_id = str(uuid.uuid4())
print(f"\nCreating patient with ID: {patient_id}")

# Create patient record
patient_data = {
    'patient_id': patient_id,
    'document_id': document_id,
    'patient_first_name': 'Alex',
    'patient_last_name': 'Doe',
    'patient_dob': '01/01/2001',
    'gender': 'Male',
    'email': '',
    'phone_number': '',
    'address_line1': '',
    'city': '',
    'state': '',
    'postal_code': '',
    'country': '',
    'patient_mrn': '',
    'patient_ssn': '',
    'allergies': '',
    'blood_type': '',
    'emergency_contact_name': '',
    'emergency_contact_phone': '',
    'medical_facility': '',
    'document_date': '',
    'created_timestamp': int(datetime.utcnow().timestamp())
}

patients_table.put_item(Item=patient_data)
print("✓ Patient record created")

# Update document with patient_id
documents_table.update_item(
    Key={'document_id': document_id},
    UpdateExpression='SET patient_id = :pid',
    ExpressionAttributeValues={':pid': patient_id}
)
print("✓ Document updated with patient_id")

# Update all related records
tables_to_update = [
    ('Procedures', procedures_table, 'procedure_id'),
    ('Radiology', radiology_table, 'radiology_id'),
    ('Medications', medications_table, 'medication_id'),
    ('Diagnoses', diagnoses_table, 'diagnosis_id'),
    ('Tests', tests_table, 'test_id')
]

for table_name, table, key_name in tables_to_update:
    # Scan for records with this document_id
    response = table.scan(
        FilterExpression='document_id = :doc_id',
        ExpressionAttributeValues={':doc_id': document_id}
    )
    
    items = response.get('Items', [])
    print(f"\nUpdating {len(items)} {table_name} records...")
    
    for item in items:
        table.update_item(
            Key={key_name: item[key_name]},
            UpdateExpression='SET patient_id = :pid',
            ExpressionAttributeValues={':pid': patient_id}
        )
    
    print(f"✓ Updated {len(items)} {table_name} records")

print(f"\n✅ Patient created successfully!")
print(f"Navigate to: http://localhost:3000/patient/{patient_id}")
