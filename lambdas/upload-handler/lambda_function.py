import json
import boto3
import uuid
import os
from datetime import datetime
from decimal import Decimal
from urllib.parse import unquote_plus

s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

UPLOAD_BUCKET = os.environ['UPLOAD_BUCKET']  # health-ai-upload
PDF_BUCKET = os.environ['PDF_BUCKET']  # health-ai-pdf
PROCESSING_QUEUE_URL = os.environ['PROCESSING_QUEUE_URL']
DOCUMENTS_TABLE = os.environ['DOCUMENTS_TABLE']  # HealthAI-Documents

def lambda_handler(event, context):
    """
    Triggered when a PDF is uploaded to health-ai-upload bucket.
    Creates document record and triggers parallel page processing.
    """
    
    for record in event['Records']:
        # Get uploaded file details
        bucket = record['s3']['bucket']['name']
        key = unquote_plus(record['s3']['object']['key'])
        
        print(f"Processing upload: {key}")
        
        # Generate unique IDs
        document_id = str(uuid.uuid4())
        
        # Extract patient info from filename (e.g., "AlexDoe_MedicalRecords.pdf")
        filename = key.split('/')[-1]
        patient_name = filename.split('_')[0] if '_' in filename else 'Unknown'
        
        # Copy PDF to permanent storage
        pdf_key = f"documents/{document_id}/{filename}"
        copy_source = {'Bucket': bucket, 'Key': key}
        s3_client.copy_object(
            CopySource=copy_source,
            Bucket=PDF_BUCKET,
            Key=pdf_key
        )
        
        # Get PDF page count using PyPDF2 (more reliable in Lambda)
        pdf_obj = s3_client.get_object(Bucket=PDF_BUCKET, Key=pdf_key)
        pdf_content = pdf_obj['Body'].read()
        
        try:
            from PyPDF2 import PdfReader
            import io
            pdf_reader = PdfReader(io.BytesIO(pdf_content))
            total_pages = len(pdf_reader.pages)
            print(f"PDF has {total_pages} pages")
        except Exception as e:
            print(f"Error counting pages with PyPDF2: {e}")
            # Fallback: estimate based on file size (rough estimate)
            file_size_mb = len(pdf_content) / (1024 * 1024)
            total_pages = max(1, int(file_size_mb * 10))  # Rough estimate: ~10 pages per MB
            print(f"Estimated {total_pages} pages based on file size")
        
        # Create document record in DynamoDB
        documents_table = dynamodb.Table(DOCUMENTS_TABLE)
        timestamp = int(datetime.utcnow().timestamp())
        
        documents_table.put_item(
            Item={
                'document_id': document_id,
                'patient_id': 'PENDING',  # Will be updated after extraction
                'filename': filename,
                'pdf_s3_key': pdf_key,
                'upload_timestamp': timestamp,
                'total_pages': total_pages,
                'status': 'UPLOADED',
                'processing_started': False,
                'pages_processed': 0,
                'patient_name_hint': patient_name
            }
        )
        
        # Send one SQS message per page for parallel processing
        # Use unique MessageGroupId per page to enable parallel processing
        print(f"Queueing {total_pages} pages for parallel conversion...")
        
        for page_num in range(total_pages):
            message = {
                'document_id': document_id,
                'pdf_bucket': PDF_BUCKET,
                'pdf_key': pdf_key,
                'filename': filename,
                'total_pages': total_pages,
                'page_number': page_num + 1  # 1-indexed
            }
            
            # Unique MessageGroupId per page enables parallel Lambda invocations
            sqs_client.send_message(
                QueueUrl=PROCESSING_QUEUE_URL,
                MessageBody=json.dumps(message),
                MessageGroupId=f"{document_id}-page-{page_num + 1}",  # Unique per page
                MessageDeduplicationId=f"{document_id}-page-{page_num + 1}-{timestamp}"
            )
        
        print(f"Document {document_id} queued for processing. Pages: {total_pages}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Upload processed successfully'})
    }
