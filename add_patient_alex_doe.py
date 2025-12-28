"""
Manually add Alex Doe patient information
"""
import boto3
import uuid
from datetime import datetime

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
patients_table = dynamodb.Table('HealthAI-Patients')
documents_table = dynamodb.Table('HealthAI-Documents')

# Patient data from the logs
patient_data = {
    'patient_id': str(uuid.uuid4()),
    'document_id': 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0',
    'patient_first_name': 'Alex',
    'patient_last_name': 'Doe',
    'patient_dob': '01/01/2001',
    'patient_ssn': '',
    'patient_mrn': '',
    'medical_facility': 'TriStar Medical Group Family Practice Associates of Southern Hills',
    'gender': '',
    'blood_type': '',
    'email': '',
    'phone_number': '',
    'address_line1': '',
    'city': '',
    'state': '',
    'postal_code': '',
    'country': '',
    'emergency_contact_name': '',
    'emergency_contact_phone': '',
    'allergies': '',
    'document_date': '',
    'created_timestamp': int(datetime.utcnow().timestamp())
}

# Store patient
patients_table.put_item(Item=patient_data)
print(f"✅ Added patient: {patient_data['patient_first_name']} {patient_data['patient_last_name']}")
print(f"   Patient ID: {patient_data['patient_id']}")
print(f"   DOB: {patient_data['patient_dob']}")
print(f"   Facility: {patient_data['medical_facility']}")

# Update document
documents_table.update_item(
    Key={'document_id': patient_data['document_id']},
    UpdateExpression='SET patient_id = :pid',
    ExpressionAttributeValues={':pid': patient_data['patient_id']}
)
print(f"✅ Updated document with patient_id")
