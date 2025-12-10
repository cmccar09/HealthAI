import json
import boto3
import os
import base64
import uuid
from datetime import datetime
from decimal import Decimal

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
bedrock_client = boto3.client('bedrock-runtime', region_name='us-east-1')

PAGES_TABLE = os.environ['PAGES_TABLE']
PATIENTS_TABLE = os.environ['PATIENTS_TABLE']
MEDICATIONS_TABLE = os.environ['MEDICATIONS_TABLE']
DIAGNOSES_TABLE = os.environ['DIAGNOSES_TABLE']
TESTS_TABLE = os.environ['TESTS_TABLE']
CATEGORIES_TABLE = os.environ['CATEGORIES_TABLE']
DOCUMENTS_TABLE = os.environ['DOCUMENTS_TABLE']

# Token-efficient system prompt
MEDINGEST_SYSTEM_PROMPT = """You are MedIngest-AI, an LLM used inside a parallelized AWS pipeline for medical-document ingestion.
You must produce strict, machine-friendly outputs that downstream Lambdas store in DynamoDB and S3.
You will be invoked hundreds of times in parallel, one page at a time, so your responses must be:

FAST • SMALL • STRUCTURED • DETERMINISTIC

No chain-of-thought. No extra text beyond required output.

GLOBAL RULES:
1. Token Efficiency: Keep outputs minimal. No repeated explanations. No restating instructions. No conversational filler.
2. Parallel-Safe: Every page is processed independently. Never depend on other pages.
3. DynamoDB Compatible: Produce clean JSON with no trailing whitespace, no nulls (use "Unknown"), no arrays beyond schema.

OUTPUT ONLY THE REQUIRED JSON. NO ADDITIONAL COMMENTARY."""

def lambda_handler(event, context):
    """
    Parallel AI processing of medical document pages.
    Extracts structured data and stores in DynamoDB.
    """
    
    for record in event['Records']:
        message = json.loads(record['body'])
        
        page_id = message['page_id']
        document_id = message['document_id']
        page_number = message['page_number']
        total_pages = message['total_pages']
        png_bucket = message['png_bucket']
        png_key = message['png_key']
        
        print(f"Processing page {page_number}/{total_pages} - Page ID: {page_id}")
        
        # Get PNG image from S3
        png_obj = s3_client.get_object(Bucket=png_bucket, Key=png_key)
        png_content = png_obj['Body'].read()
        base64_image = base64.b64encode(png_content).decode('utf-8')
        
        # Process page through multiple AI tasks in sequence (token-efficient)
        try:
            # Task 1: Extract patient details (first page only)
            if page_number == 1:
                patient_data = extract_patient_details(base64_image)
                if patient_data and patient_data.get('patient_first_name') != 'Unknown':
                    store_patient_data(document_id, patient_data)
            
            # Task 2: Categorize page
            categories = categorize_page(base64_image)
            store_categories(page_id, categories)
            
            # Task 3: Extract medications
            medications = extract_medications(base64_image)
            if medications:
                store_medications(document_id, page_id, medications)
            
            # Task 4: Extract diagnoses
            diagnoses = extract_diagnoses(base64_image)
            if diagnoses:
                store_diagnoses(document_id, page_id, diagnoses)
            
            # Task 5: Extract test results
            tests = extract_test_results(base64_image)
            if tests:
                store_test_results(document_id, page_id, tests)
            
            # Update page status
            pages_table = dynamodb.Table(PAGES_TABLE)
            pages_table.update_item(
                Key={'page_id': page_id},
                UpdateExpression='SET ai_processed = :processed, #status = :status, categories = :cats',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':processed': True,
                    ':status': 'PROCESSED',
                    ':cats': categories
                }
            )
            
            # Update document progress
            documents_table = dynamodb.Table(DOCUMENTS_TABLE)
            documents_table.update_item(
                Key={'document_id': document_id},
                UpdateExpression='ADD pages_processed :inc',
                ExpressionAttributeValues={':inc': 1}
            )
            
            print(f"Page {page_number} processed successfully")
            
        except Exception as e:
            print(f"Error processing page {page_id}: {str(e)}")
            # Update page with error status
            pages_table = dynamodb.Table(PAGES_TABLE)
            pages_table.update_item(
                Key={'page_id': page_id},
                UpdateExpression='SET #status = :status, error = :error',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'ERROR',
                    ':error': str(e)
                }
            )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'AI processing complete'})
    }


def call_claude(prompt, image_base64):
    """
    Token-efficient Claude API call with prompt caching.
    """
    
    response = bedrock_client.invoke_model(
        modelId='anthropic.claude-3-5-sonnet-20240620-v1:0',
        contentType='application/json',
        accept='application/json',
        body=json.dumps({
            'anthropic_version': 'bedrock-2023-05-31',
            'max_tokens': 2000,
            'temperature': 0,
            'system': [
                {
                    'type': 'text',
                    'text': MEDINGEST_SYSTEM_PROMPT,
                    'cache_control': {'type': 'ephemeral'}
                }
            ],
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': 'image/png',
                                'data': image_base64
                            }
                        },
                        {
                            'type': 'text',
                            'text': prompt
                        }
                    ]
                }
            ]
        })
    )
    
    response_body = json.loads(response['body'].read())
    return response_body['content'][0]['text']


def extract_patient_details(image_base64):
    """Extract patient demographic information."""
    
    prompt = """Extract patient details. Output ONLY this JSON:
{
 "patient_first_name": "",
 "patient_last_name": "",
 "patient_dob": "",
 "patient_ssn": "",
 "patient_mrn": "",
 "medical_facility": "",
 "gender": "",
 "blood_type": "",
 "email": "",
 "phone_number": "",
 "address_line1": "",
 "city": "",
 "state": "",
 "postal_code": "",
 "country": "",
 "emergency_contact_name": "",
 "emergency_contact_phone": "",
 "allergies": "",
 "document_date": ""
}
Use "Unknown" for missing fields. Dates in ISO format."""
    
    result = call_claude(prompt, image_base64)
    try:
        return json.loads(result)
    except:
        return None


def categorize_page(image_base64):
    """Categorize medical page."""
    
    prompt = """Categorize this medical page. Output ONLY this JSON:
{"categories":[{"name":"<category>","reason":"<1 sentence>"}]}

Categories: Cardiology, Dermatology, Emergency Medicine, Endocrinology, Gastroenterology, Hematology, Hospitalization, Internal Medicine, Laboratories, Neurology, Oncology, Orthopedics, Pathology, Radiology, Surgery, Other"""
    
    result = call_claude(prompt, image_base64)
    try:
        data = json.loads(result)
        return data.get('categories', [])
    except:
        return [{'name': 'Other', 'reason': 'Unable to categorize'}]


def extract_medications(image_base64):
    """Extract medications from page."""
    
    prompt = """Extract medications. Output ONLY this JSON:
{"medications":[{"medication_name":"","dosage":"","frequency":"","start_date":"","is_current":"","notes":""}]}

Use "Unknown" for missing fields."""
    
    result = call_claude(prompt, image_base64)
    try:
        data = json.loads(result)
        return data.get('medications', [])
    except:
        return []


def extract_diagnoses(image_base64):
    """Extract diagnoses from page."""
    
    prompt = """Extract diagnoses. Output ONLY this JSON:
{"diagnosis":[{"diagnosis_description":"","diagnosis_code":"","diagnosed_date":"","is_current":"","diagnosing_doctor_first_name":"","diagnosing_doctor_last_name":"","diagnosing_facility_name":"","notes":""}]}

Use "Unknown" for missing fields."""
    
    result = call_claude(prompt, image_base64)
    try:
        data = json.loads(result)
        return data.get('diagnosis', [])
    except:
        return []


def extract_test_results(image_base64):
    """Extract test results from page."""
    
    prompt = """Extract test results. Output ONLY this JSON:
{"test_results":[{"test_name":"","test_date":"","result_value":"","result_unit":"","is_abnormal":"","normal_range_low":"","normal_range_high":"","notes":""}]}

Use "Unknown" for missing fields."""
    
    result = call_claude(prompt, image_base64)
    try:
        data = json.loads(result)
        return data.get('test_results', [])
    except:
        return []


def store_patient_data(document_id, patient_data):
    """Store patient data in DynamoDB."""
    
    patient_id = str(uuid.uuid4())
    patients_table = dynamodb.Table(PATIENTS_TABLE)
    
    # Convert to DynamoDB format
    item = {
        'patient_id': patient_id,
        'document_id': document_id,
        **patient_data,
        'created_timestamp': int(datetime.utcnow().timestamp())
    }
    
    patients_table.put_item(Item=item)
    
    # Update document with patient_id
    documents_table = dynamodb.Table(DOCUMENTS_TABLE)
    documents_table.update_item(
        Key={'document_id': document_id},
        UpdateExpression='SET patient_id = :pid',
        ExpressionAttributeValues={':pid': patient_id}
    )
    
    print(f"Stored patient data: {patient_id}")


def store_categories(page_id, categories):
    """Store page categories in DynamoDB."""
    
    categories_table = dynamodb.Table(CATEGORIES_TABLE)
    
    for cat in categories:
        category_id = str(uuid.uuid4())
        categories_table.put_item(
            Item={
                'category_id': category_id,
                'page_id': page_id,
                'category_name': cat.get('name', 'Other'),
                'reason': cat.get('reason', 'Unknown')
            }
        )


def store_medications(document_id, page_id, medications):
    """Store medications in DynamoDB."""
    
    medications_table = dynamodb.Table(MEDICATIONS_TABLE)
    documents_table = dynamodb.Table(DOCUMENTS_TABLE)
    
    # Get patient_id from document
    doc_response = documents_table.get_item(Key={'document_id': document_id})
    patient_id = doc_response.get('Item', {}).get('patient_id', 'PENDING')
    
    for med in medications:
        medication_id = str(uuid.uuid4())
        medications_table.put_item(
            Item={
                'medication_id': medication_id,
                'patient_id': patient_id,
                'document_id': document_id,
                'page_id': page_id,
                'medication_name': med.get('medication_name', 'Unknown'),
                'dosage': med.get('dosage', 'Unknown'),
                'frequency': med.get('frequency', 'Unknown'),
                'start_date': med.get('start_date', 'Unknown'),
                'is_current': med.get('is_current', 'Unknown'),
                'notes': med.get('notes', ''),
                'created_timestamp': int(datetime.utcnow().timestamp())
            }
        )


def store_diagnoses(document_id, page_id, diagnoses):
    """Store diagnoses in DynamoDB."""
    
    diagnoses_table = dynamodb.Table(DIAGNOSES_TABLE)
    documents_table = dynamodb.Table(DOCUMENTS_TABLE)
    
    doc_response = documents_table.get_item(Key={'document_id': document_id})
    patient_id = doc_response.get('Item', {}).get('patient_id', 'PENDING')
    
    for diag in diagnoses:
        diagnosis_id = str(uuid.uuid4())
        diagnoses_table.put_item(
            Item={
                'diagnosis_id': diagnosis_id,
                'patient_id': patient_id,
                'document_id': document_id,
                'page_id': page_id,
                'diagnosis_description': diag.get('diagnosis_description', 'Unknown'),
                'diagnosis_code': diag.get('diagnosis_code', 'Unknown'),
                'diagnosed_date': diag.get('diagnosed_date', 'Unknown'),
                'is_current': diag.get('is_current', 'Unknown'),
                'diagnosing_doctor_first_name': diag.get('diagnosing_doctor_first_name', 'Unknown'),
                'diagnosing_doctor_last_name': diag.get('diagnosing_doctor_last_name', 'Unknown'),
                'diagnosing_facility_name': diag.get('diagnosing_facility_name', 'Unknown'),
                'notes': diag.get('notes', ''),
                'created_timestamp': int(datetime.utcnow().timestamp())
            }
        )


def store_test_results(document_id, page_id, tests):
    """Store test results in DynamoDB."""
    
    tests_table = dynamodb.Table(TESTS_TABLE)
    documents_table = dynamodb.Table(DOCUMENTS_TABLE)
    
    doc_response = documents_table.get_item(Key={'document_id': document_id})
    patient_id = doc_response.get('Item', {}).get('patient_id', 'PENDING')
    
    for test in tests:
        test_id = str(uuid.uuid4())
        tests_table.put_item(
            Item={
                'test_id': test_id,
                'patient_id': patient_id,
                'document_id': document_id,
                'page_id': page_id,
                'test_name': test.get('test_name', 'Unknown'),
                'test_date': test.get('test_date', 'Unknown'),
                'result_value': test.get('result_value', 'Unknown'),
                'result_unit': test.get('result_unit', 'Unknown'),
                'is_abnormal': test.get('is_abnormal', 'Unknown'),
                'normal_range_low': test.get('normal_range_low', 'Unknown'),
                'normal_range_high': test.get('normal_range_high', 'Unknown'),
                'notes': test.get('notes', ''),
                'created_timestamp': int(datetime.utcnow().timestamp())
            }
        )
