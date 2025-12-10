import json
import boto3
import uuid
import os
import io
from PIL import Image
from datetime import datetime

s3_client = boto3.client('s3')
sqs_client = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

PDF_BUCKET = os.environ['PDF_BUCKET']
PNG_BUCKET = os.environ['PNG_BUCKET']  # health-ai-png
WEBP_BUCKET = os.environ['WEBP_BUCKET']  # health-ai-webp
AI_QUEUE_URL = os.environ['AI_QUEUE_URL']
PAGES_TABLE = os.environ['PAGES_TABLE']
DOCUMENTS_TABLE = os.environ['DOCUMENTS_TABLE']

def lambda_handler(event, context):
    """
    Converts each PDF page to PNG and WebP formats in parallel.
    Stores images in S3 and queues pages for AI processing.
    """
    
    import fitz  # PyMuPDF
    
    for record in event['Records']:
        message = json.loads(record['body'])
        
        document_id = message['document_id']
        pdf_bucket = message['pdf_bucket']
        pdf_key = message['pdf_key']
        total_pages = message['total_pages']
        
        print(f"Converting document {document_id}: {total_pages} pages")
        
        # Download PDF from S3
        pdf_obj = s3_client.get_object(Bucket=pdf_bucket, Key=pdf_key)
        pdf_content = pdf_obj['Body'].read()
        
        # Open PDF
        pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        # Process pages in parallel by creating multiple SQS messages
        pages_table = dynamodb.Table(PAGES_TABLE)
        documents_table = dynamodb.Table(DOCUMENTS_TABLE)
        
        # Update document status
        documents_table.update_item(
            Key={'document_id': document_id},
            UpdateExpression='SET #status = :status, processing_started = :started',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'CONVERTING',
                ':started': True
            }
        )
        
        # Convert each page
        for page_num in range(len(pdf_doc)):
            page = pdf_doc[page_num]
            page_id = str(uuid.uuid4())
            
            # Render page to high-quality image
            # Use matrix for 300 DPI (2x scale)
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convert to PIL Image
            img_data = pix.tobytes("png")
            pil_image = Image.open(io.BytesIO(img_data))
            
            # Save as PNG (lossless, medical quality)
            png_buffer = io.BytesIO()
            pil_image.save(png_buffer, format='PNG', optimize=True)
            png_buffer.seek(0)
            
            png_key = f"{document_id}/page_{page_num + 1:04d}.png"
            s3_client.put_object(
                Bucket=PNG_BUCKET,
                Key=png_key,
                Body=png_buffer.getvalue(),
                ContentType='image/png'
            )
            
            # Save as WebP (smaller size, still high quality)
            webp_buffer = io.BytesIO()
            pil_image.save(webp_buffer, format='WEBP', quality=95, method=6)
            webp_buffer.seek(0)
            
            webp_key = f"{document_id}/page_{page_num + 1:04d}.webp"
            s3_client.put_object(
                Bucket=WEBP_BUCKET,
                Key=webp_key,
                Body=webp_buffer.getvalue(),
                ContentType='image/webp'
            )
            
            # Create page record in DynamoDB
            pages_table.put_item(
                Item={
                    'page_id': page_id,
                    'document_id': document_id,
                    'page_number': page_num + 1,
                    'png_s3_key': png_key,
                    'webp_s3_key': webp_key,
                    'png_bucket': PNG_BUCKET,
                    'webp_bucket': WEBP_BUCKET,
                    'status': 'CONVERTED',
                    'ai_processed': False,
                    'created_timestamp': int(datetime.utcnow().timestamp())
                }
            )
            
            # Queue page for AI processing
            ai_message = {
                'page_id': page_id,
                'document_id': document_id,
                'page_number': page_num + 1,
                'total_pages': total_pages,
                'png_bucket': PNG_BUCKET,
                'png_key': png_key,
                'webp_bucket': WEBP_BUCKET,
                'webp_key': webp_key
            }
            
            sqs_client.send_message(
                QueueUrl=AI_QUEUE_URL,
                MessageBody=json.dumps(ai_message),
                MessageGroupId=document_id,
                MessageDeduplicationId=f"{page_id}-convert"
            )
            
            print(f"Page {page_num + 1}/{total_pages} converted and queued")
        
        pdf_doc.close()
        
        # Update document status
        documents_table.update_item(
            Key={'document_id': document_id},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'CONVERTED'}
        )
        
        print(f"Document {document_id} conversion complete")
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Conversion complete'})
    }
