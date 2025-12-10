import json
import boto3
import os
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3_client = boto3.client('s3')

PATIENTS_TABLE = os.environ['PATIENTS_TABLE']
DOCUMENTS_TABLE = os.environ['DOCUMENTS_TABLE']
PAGES_TABLE = os.environ['PAGES_TABLE']
MEDICATIONS_TABLE = os.environ['MEDICATIONS_TABLE']
DIAGNOSES_TABLE = os.environ['DIAGNOSES_TABLE']
TESTS_TABLE = os.environ['TESTS_TABLE']
PNG_BUCKET = os.environ['PNG_BUCKET']
WEBP_BUCKET = os.environ['WEBP_BUCKET']

def lambda_handler(event, context):
    """
    API Gateway handler for HealthAI frontend.
    Provides REST API for patient data, documents, and images.
    """
    
    http_method = event['httpMethod']
    path = event['path']
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }
    
    try:
        # Route requests
        if path == '/patients' and http_method == 'GET':
            return respond(200, get_all_patients(), headers)
        
        elif path.startswith('/patient/') and http_method == 'GET':
            patient_id = path.split('/')[2]
            
            if '/documents' in path:
                return respond(200, get_patient_documents(patient_id), headers)
            elif '/medications' in path:
                return respond(200, get_patient_medications(patient_id), headers)
            elif '/diagnoses' in path:
                return respond(200, get_patient_diagnoses(patient_id), headers)
            elif '/tests' in path:
                return respond(200, get_patient_tests(patient_id), headers)
            else:
                return respond(200, get_patient(patient_id), headers)
        
        elif path.startswith('/document/') and http_method == 'GET':
            document_id = path.split('/')[2]
            
            if '/pages' in path:
                return respond(200, get_document_pages(document_id), headers)
            else:
                return respond(200, get_document(document_id), headers)
        
        elif path.startswith('/image/') and http_method == 'GET':
            s3_key = '/'.join(path.split('/')[2:])
            bucket = PNG_BUCKET if '.png' in s3_key else WEBP_BUCKET
            return get_image(bucket, s3_key, headers)
        
        else:
            return respond(404, {'error': 'Not found'}, headers)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return respond(500, {'error': str(e)}, headers)


def respond(status_code, body, headers):
    """Helper function to create API Gateway response."""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps(body, default=decimal_default)
    }


def decimal_default(obj):
    """JSON encoder for Decimal types."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def get_all_patients():
    """Get all patients."""
    table = dynamodb.Table(PATIENTS_TABLE)
    response = table.scan()
    return {'patients': response.get('Items', [])}


def get_patient(patient_id):
    """Get patient details."""
    table = dynamodb.Table(PATIENTS_TABLE)
    response = table.get_item(Key={'patient_id': patient_id})
    return {'patient': response.get('Item')}


def get_patient_documents(patient_id):
    """Get all documents for a patient."""
    table = dynamodb.Table(DOCUMENTS_TABLE)
    response = table.query(
        IndexName='PatientDocuments-Index',
        KeyConditionExpression='patient_id = :pid',
        ExpressionAttributeValues={':pid': patient_id},
        ScanIndexForward=False
    )
    return {'documents': response.get('Items', [])}


def get_patient_medications(patient_id):
    """Get all medications for a patient."""
    table = dynamodb.Table(MEDICATIONS_TABLE)
    response = table.query(
        IndexName='PatientMedications-Index',
        KeyConditionExpression='patient_id = :pid',
        ExpressionAttributeValues={':pid': patient_id},
        ScanIndexForward=False
    )
    return {'medications': response.get('Items', [])}


def get_patient_diagnoses(patient_id):
    """Get all diagnoses for a patient."""
    table = dynamodb.Table(DIAGNOSES_TABLE)
    response = table.query(
        IndexName='PatientDiagnoses-Index',
        KeyConditionExpression='patient_id = :pid',
        ExpressionAttributeValues={':pid': patient_id},
        ScanIndexForward=False
    )
    return {'diagnoses': response.get('Items', [])}


def get_patient_tests(patient_id):
    """Get all test results for a patient."""
    table = dynamodb.Table(TESTS_TABLE)
    response = table.query(
        IndexName='PatientTests-Index',
        KeyConditionExpression='patient_id = :pid',
        ExpressionAttributeValues={':pid': patient_id},
        ScanIndexForward=False
    )
    return {'tests': response.get('Items', [])}


def get_document(document_id):
    """Get document details."""
    table = dynamodb.Table(DOCUMENTS_TABLE)
    response = table.get_item(Key={'document_id': document_id})
    return {'document': response.get('Item')}


def get_document_pages(document_id):
    """Get all pages for a document."""
    table = dynamodb.Table(PAGES_TABLE)
    response = table.query(
        IndexName='DocumentPages-Index',
        KeyConditionExpression='document_id = :did',
        ExpressionAttributeValues={':did': document_id},
        ScanIndexForward=True
    )
    return {'pages': response.get('Items', [])}


def get_image(bucket, key, headers):
    """Serve image from S3."""
    try:
        s3_obj = s3_client.get_object(Bucket=bucket, Key=key)
        
        # Determine content type
        content_type = 'image/png' if '.png' in key else 'image/webp'
        
        return {
            'statusCode': 200,
            'headers': {
                **headers,
                'Content-Type': content_type
            },
            'body': s3_obj['Body'].read().decode('latin1'),
            'isBase64Encoded': True
        }
    except Exception as e:
        return respond(404, {'error': f'Image not found: {str(e)}'}, headers)
