import json
import boto3
import uuid
import os
import hashlib
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
    
    SUPPORTS CONCURRENT UPLOADS:
    - Each PDF gets a unique document_id (UUID)
    - Multiple patients (3-4+) can be uploaded simultaneously
    - Each document processes independently - no data mixing
    """
    
    for record in event['Records']:
        # Get uploaded file details
        bucket = record['s3']['bucket']['name']
        key = unquote_plus(record['s3']['object']['key'])
        
        # Generate unique IDs
        document_id = str(uuid.uuid4())
        
        print(f"[DOC:{document_id}] New upload: {key}")
        
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
        
        # Get PDF content for hashing and page counting
        pdf_obj = s3_client.get_object(Bucket=PDF_BUCKET, Key=pdf_key)
        pdf_content = pdf_obj['Body'].read()
        
        # Calculate SHA-256 hash of file content for duplicate detection
        file_hash = hashlib.sha256(pdf_content).hexdigest()
        print(f"[DOC:{document_id}] File hash: {file_hash}")
        
        # Check if this exact file has already been uploaded
        documents_table = dynamodb.Table(DOCUMENTS_TABLE)
        existing_docs = documents_table.scan(
            FilterExpression='file_hash = :hash',
            ExpressionAttributeValues={':hash': file_hash}
        )
        
        if existing_docs.get('Items'):
            existing_doc = existing_docs['Items'][0]
            existing_doc_id = existing_doc['document_id']
            existing_filename = existing_doc.get('filename', 'Unknown')
            existing_timestamp = existing_doc.get('upload_timestamp', 0)
            
            print(f"[DOC:{document_id}] DUPLICATE DETECTED! Same file already uploaded:")
            print(f"  Existing document_id: {existing_doc_id}")
            print(f"  Existing filename: {existing_filename}")
            print(f"  Uploaded: {datetime.fromtimestamp(existing_timestamp)}")
            print(f"[DOC:{document_id}] Cleaning up previous upload to reprocess...")
            
            # Clean up all data from previous upload
            try:
                # Delete all pages from S3 pages bucket
                print(f"[DOC:{document_id}] Deleting pages from S3 bucket {PAGES_BUCKET}")
                pages_response = s3_client.list_objects_v2(Bucket=PAGES_BUCKET, Prefix=f"{existing_doc_id}/")
                if 'Contents' in pages_response:
                    for obj in pages_response['Contents']:
                        s3_client.delete_object(Bucket=PAGES_BUCKET, Key=obj['Key'])
                    print(f"[DOC:{document_id}] Deleted {len(pages_response['Contents'])} page files from S3")
                
                # Delete from DynamoDB tables
                pages_table = dynamodb.Table('HealthAI-Pages')
                categories_table = dynamodb.Table('HealthAI-Categories')
                procedures_table = dynamodb.Table('HealthAI-Procedures')
                medications_table = dynamodb.Table('HealthAI-Medications')
                diagnoses_table = dynamodb.Table('HealthAI-Diagnoses')
                radiology_table = dynamodb.Table('HealthAI-Radiology')
                tests_table = dynamodb.Table('HealthAI-TestResults')
                
                # Delete pages
                pages_response = pages_table.scan(
                    FilterExpression='document_id = :doc_id',
                    ExpressionAttributeValues={':doc_id': existing_doc_id}
                )
                for page in pages_response.get('Items', []):
                    pages_table.delete_item(Key={'page_id': page['page_id']})
                print(f"[DOC:{document_id}] Deleted {len(pages_response.get('Items', []))} pages from DynamoDB")
                
                # Delete related data
                table_configs = [
                    ('Categories', categories_table, 'category_id'),
                    ('Procedures', procedures_table, 'procedure_id'),
                    ('Medications', medications_table, 'medication_id'),
                    ('Diagnoses', diagnoses_table, 'diagnosis_id'),
                    ('Radiology', radiology_table, 'radiology_id'),
                    ('TestResults', tests_table, 'test_id')
                ]
                
                for table_name, table, key_field in table_configs:
                    response = table.scan(
                        FilterExpression='document_id = :doc_id',
                        ExpressionAttributeValues={':doc_id': existing_doc_id}
                    )
                    for item in response.get('Items', []):
                        table.delete_item(Key={key_field: item[key_field]})
                    print(f"[DOC:{document_id}] Deleted {len(response.get('Items', []))} {table_name} records")
                
                # Delete document record
                documents_table.delete_item(Key={'document_id': existing_doc_id})
                print(f"[DOC:{document_id}] Deleted document record")
                
                # Delete old document file from S3
                old_s3_key = existing_doc.get('s3_key', pdf_key)
                s3_client.delete_object(Bucket=PDF_BUCKET, Key=old_s3_key)
                print(f"[DOC:{document_id}] Deleted old document file from S3")
                
                print(f"[DOC:{document_id}] Cleanup complete. Processing new upload...")
                
            except Exception as e:
                print(f"[DOC:{document_id}] Error during cleanup: {str(e)}")
                # Continue with processing even if cleanup fails
        
        # Get PDF page count using PyPDF2 (more reliable in Lambda)
        try:
            from PyPDF2 import PdfReader
            import io
            pdf_reader = PdfReader(io.BytesIO(pdf_content))
            total_pages = len(pdf_reader.pages)
            print(f"[DOC:{document_id}] PDF has {total_pages} pages")
        except Exception as e:
            print(f"[DOC:{document_id}] Error counting pages with PyPDF2: {e}")
            # Fallback: estimate based on file size (rough estimate)
            file_size_mb = len(pdf_content) / (1024 * 1024)
            total_pages = max(1, int(file_size_mb * 10))  # Rough estimate: ~10 pages per MB
            print(f"[DOC:{document_id}] Estimated {total_pages} pages based on file size")
        
        # Create document record in DynamoDB
        timestamp = int(datetime.utcnow().timestamp())
        
        documents_table.put_item(
            Item={
                'document_id': document_id,
                'patient_id': 'PENDING',  # Will be updated after extraction
                'filename': filename,
                'pdf_s3_key': pdf_key,
                'file_hash': file_hash,  # Store hash for duplicate detection
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
        print(f"[DOC:{document_id}] Queueing {total_pages} pages for parallel conversion...")
        
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
        
        print(f"[DOC:{document_id}] Document queued for processing. Pages: {total_pages}, Patient hint: {patient_name}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Upload processed successfully'})
    }
