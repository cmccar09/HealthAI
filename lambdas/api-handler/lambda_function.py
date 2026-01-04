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
REVIEW_QUEUE_TABLE = os.environ.get('REVIEW_QUEUE_TABLE', 'HealthAI-ReviewQueue')
HALLUCINATION_REPORTS_TABLE = os.environ.get('HALLUCINATION_REPORTS_TABLE', 'HealthAI-HallucinationReports')
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
        
        elif path == '/review-queue' and http_method == 'GET':
            status = event.get('queryStringParameters', {}).get('status', 'PENDING') if event.get('queryStringParameters') else 'PENDING'
            return respond(200, get_review_queue(status), headers)
        
        elif path.startswith('/review-queue/') and http_method == 'GET':
            review_id = path.split('/')[2]
            return respond(200, get_review_item(review_id), headers)
        
        elif path.startswith('/review-queue/') and http_method == 'PUT':
            review_id = path.split('/')[2]
            body_data = json.loads(event.get('body', '{}'))
            return respond(200, update_review_item(review_id, body_data), headers)
        
        elif path == '/hallucination-reports' and http_method == 'GET':
            return respond(200, get_hallucination_reports(), headers)
        
        elif path == '/hallucination-reports' and http_method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            return respond(201, create_hallucination_report(body_data), headers)
        
        elif path == '/hallucination-stats' and http_method == 'GET':
            return respond(200, get_hallucination_stats(), headers)
        
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


def get_review_queue(status='PENDING'):
    """Get review queue items by status."""
    table = dynamodb.Table(REVIEW_QUEUE_TABLE)
    
    response = table.query(
        IndexName='StatusIndex',
        KeyConditionExpression='#status = :status',
        ExpressionAttributeNames={'#status': 'Status'},
        ExpressionAttributeValues={':status': status},
        ScanIndexForward=False,  # Most recent first
        Limit=100
    )
    
    return {'review_items': response.get('Items', []), 'count': len(response.get('Items', []))}


def get_review_item(review_id):
    """Get single review queue item."""
    table = dynamodb.Table(REVIEW_QUEUE_TABLE)
    
    response = table.get_item(Key={'ReviewID': review_id})
    
    if 'Item' not in response:
        return {'error': 'Review item not found'}
    
    return {'review_item': response.get('Item')}


def update_review_item(review_id, data):
    """Update review queue item (approve/reject/edit)."""
    from datetime import datetime
    
    table = dynamodb.Table(REVIEW_QUEUE_TABLE)
    
    action = data.get('action')  # 'approve', 'reject', 'edit'
    reviewer_id = data.get('reviewer_id', 'system')
    reviewer_notes = data.get('reviewer_notes', '')
    
    if action == 'approve':
        # Mark as approved
        table.update_item(
            Key={'ReviewID': review_id},
            UpdateExpression='SET #status = :status, reviewer_id = :reviewer, reviewed_at = :time, reviewer_notes = :notes',
            ExpressionAttributeNames={'#status': 'Status'},
            ExpressionAttributeValues={
                ':status': 'APPROVED',
                ':reviewer': reviewer_id,
                ':time': Decimal(str(int(datetime.utcnow().timestamp()))),
                ':notes': reviewer_notes
            }
        )
        return {'message': 'Review item approved', 'review_id': review_id}
    
    elif action == 'reject':
        # Mark as rejected
        table.update_item(
            Key={'ReviewID': review_id},
            UpdateExpression='SET #status = :status, reviewer_id = :reviewer, reviewed_at = :time, reviewer_notes = :notes',
            ExpressionAttributeNames={'#status': 'Status'},
            ExpressionAttributeValues={
                ':status': 'REJECTED',
                ':reviewer': reviewer_id,
                ':time': Decimal(str(int(datetime.utcnow().timestamp()))),
                ':notes': reviewer_notes
            }
        )
        return {'message': 'Review item rejected', 'review_id': review_id}
    
    elif action == 'edit':
        # Update with corrected data
        corrected_data = data.get('corrected_data', {})
        
        table.update_item(
            Key={'ReviewID': review_id},
            UpdateExpression='SET #status = :status, reviewer_id = :reviewer, reviewed_at = :time, reviewer_notes = :notes, corrected_data = :corrected',
            ExpressionAttributeNames={'#status': 'Status'},
            ExpressionAttributeValues={
                ':status': 'CORRECTED',
                ':reviewer': reviewer_id,
                ':time': Decimal(str(int(datetime.utcnow().timestamp()))),
                ':notes': reviewer_notes,
                ':corrected': json.loads(json.dumps(corrected_data), parse_float=Decimal)
            }
        )
        
        # TODO: Apply corrected data to actual data tables (medications, diagnoses, etc.)
        
        return {'message': 'Review item corrected', 'review_id': review_id}
    
    else:
        return {'error': 'Invalid action. Must be approve, reject, or edit'}


def get_hallucination_reports():
    """Get all hallucination reports."""
    table = dynamodb.Table(HALLUCINATION_REPORTS_TABLE)
    
    response = table.scan(Limit=100)
    items = response.get('Items', [])
    
    # Sort by created_at descending
    items.sort(key=lambda x: x.get('CreatedAt', 0), reverse=True)
    
    return {
        'reports': items,
        'count': len(items),
        'total_pages_processed': 50000  # TODO: Get from actual metrics
    }


def create_hallucination_report(data):
    """Create a new hallucination report."""
    import uuid
    from datetime import datetime
    
    table = dynamodb.Table(HALLUCINATION_REPORTS_TABLE)
    
    report_id = str(uuid.uuid4())
    
    # Extract report data
    issue_type = data.get('issue_type', 'OTHER')  # HALLUCINATION, INCORRECT_VALUE, MISSING_DATA, WRONG_FIELD, OTHER
    field_name = data.get('field_name', '')
    extracted_value = data.get('extracted_value', '')
    correct_value = data.get('correct_value', '')
    document_id = data.get('document_id', '')
    page_id = data.get('page_id', '')
    page_number = data.get('page_number', 0)
    data_type = data.get('data_type', '')  # medication, diagnosis, test_result, etc.
    record_id = data.get('record_id', '')  # ID of the specific record (medication_id, diagnosis_id, etc.)
    reporter_notes = data.get('notes', '')
    reporter_id = data.get('reporter_id', 'user')
    
    # Store report
    table.put_item(
        Item={
            'ReportID': report_id,
            'DocumentID': document_id,
            'PageID': page_id,
            'PageNumber': Decimal(str(page_number)),
            'IssueType': issue_type,
            'DataType': data_type,
            'RecordID': record_id,
            'FieldName': field_name,
            'ExtractedValue': extracted_value,
            'CorrectValue': correct_value,
            'ReporterID': reporter_id,
            'ReporterNotes': reporter_notes,
            'CreatedAt': Decimal(str(int(datetime.utcnow().timestamp()))),
            'Status': 'OPEN',  # OPEN, VERIFIED, RESOLVED, FALSE_POSITIVE
            'Resolution': '',
            'ResolvedBy': '',
            'ResolvedAt': None
        }
    )
    
    return {
        'message': 'Hallucination report created',
        'report_id': report_id
    }


def get_hallucination_stats():
    """Calculate hallucination statistics."""
    table = dynamodb.Table(HALLUCINATION_REPORTS_TABLE)
    
    response = table.scan()
    reports = response.get('Items', [])
    
    total_reports = len(reports)
    verified_reports = len([r for r in reports if r.get('Status') == 'VERIFIED'])
    false_positives = len([r for r in reports if r.get('Status') == 'FALSE_POSITIVE'])
    
    # Group by issue type
    by_type = {}
    for report in reports:
        issue_type = report.get('IssueType', 'OTHER')
        by_type[issue_type] = by_type.get(issue_type, 0) + 1
    
    # Group by data type
    by_data_type = {}
    for report in reports:
        data_type = report.get('DataType', 'unknown')
        by_data_type[data_type] = by_data_type.get(data_type, 0) + 1
    
    # Calculate rate (assuming 50,000 pages processed - TODO: get real number)
    total_pages = 50000
    hallucination_rate = (verified_reports / total_pages * 100) if total_pages > 0 else 0
    
    return {
        'total_reports': total_reports,
        'verified_hallucinations': verified_reports,
        'false_positives': false_positives,
        'by_issue_type': by_type,
        'by_data_type': by_data_type,
        'total_pages_processed': total_pages,
        'hallucination_rate_percent': round(hallucination_rate, 4),
        'extractions_per_hallucination': int(total_pages / verified_reports) if verified_reports > 0 else 0
    }

