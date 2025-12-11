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
PNG_BUCKET = os.environ['PNG_BUCKET']  # Same bucket, different prefix
WEBP_BUCKET = os.environ['WEBP_BUCKET']  # Same bucket, different prefix
AI_QUEUE_URL = os.environ['AI_QUEUE_URL']
PAGES_TABLE = os.environ['PAGES_TABLE']
DOCUMENTS_TABLE = os.environ['DOCUMENTS_TABLE']

# S3 prefixes for organization
PNG_PREFIX = 'health-ai-png/'
WEBP_PREFIX = 'health-ai-webp/'

def lambda_handler(event, context):
    """
    Converts a single PDF page to PNG and WebP formats.
    Each page is processed in parallel via separate Lambda invocations.
    """
    
    import fitz  # PyMuPDF
    
    for record in event['Records']:
        message = json.loads(record['body'])
        
        document_id = message['document_id']
        pdf_bucket = message['pdf_bucket']
        pdf_key = message['pdf_key']
        total_pages = message['total_pages']
        page_number = message['page_number']  # 1-indexed
        
        print(f"Converting page {page_number}/{total_pages} of document {document_id}")
        
        # Download PDF from S3
        pdf_obj = s3_client.get_object(Bucket=pdf_bucket, Key=pdf_key)
        pdf_content = pdf_obj['Body'].read()
        
        # Open PDF and get specific page
        pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
        page = pdf_doc[page_number - 1]  # Convert to 0-indexed
        
        pages_table = dynamodb.Table(PAGES_TABLE)
        documents_table = dynamodb.Table(DOCUMENTS_TABLE)
        
        # Update document status on first page
        if page_number == 1:
            documents_table.update_item(
                Key={'document_id': document_id},
                UpdateExpression='SET #status = :status, processing_started = :started',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={
                    ':status': 'CONVERTING',
                    ':started': True
                }
            )
        
        # Convert this page
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
        
        png_key = f"{PNG_PREFIX}{document_id}/page_{page_number:04d}.png"
        s3_client.put_object(
            Bucket=PNG_BUCKET,
            Key=png_key,
            Body=png_buffer.getvalue(),
            ContentType='image/png'
        )
        
        # Save as WebP with optimized compression (quality=75 to stay under 5MB)
        # This prevents runtime compression in AI processor
        webp_buffer = io.BytesIO()
        pil_image.save(webp_buffer, format='WEBP', quality=75, method=6)
        webp_content = webp_buffer.getvalue()
        
        # If still >4.5MB, compress further
        MAX_SIZE = 4.5 * 1024 * 1024
        quality = 75
        while len(webp_content) > MAX_SIZE and quality > 35:
            quality -= 10
            webp_buffer = io.BytesIO()
            pil_image.save(webp_buffer, format='WEBP', quality=quality, method=6)
            webp_content = webp_buffer.getvalue()
            print(f"Compressed to quality={quality}, size={len(webp_content)} bytes")
        
        webp_key = f"{WEBP_PREFIX}{document_id}/page_{page_number:04d}.webp"
        s3_client.put_object(
            Bucket=WEBP_BUCKET,
            Key=webp_key,
            Body=webp_content,
            ContentType='image/webp'
        )
        
        # Create page record in DynamoDB
        pages_table.put_item(
            Item={
                'page_id': page_id,
                'document_id': document_id,
                'page_number': page_number,
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
        # Use unique MessageGroupId per page for parallel AI processing
        ai_message = {
            'page_id': page_id,
            'document_id': document_id,
            'page_number': page_number,
            'total_pages': total_pages,
            'png_bucket': PNG_BUCKET,
            'png_key': png_key,
            'webp_bucket': WEBP_BUCKET,
            'webp_key': webp_key
        }
        
        # Each page gets unique MessageGroupId for parallel processing (up to 50 concurrent)
        sqs_client.send_message(
            QueueUrl=AI_QUEUE_URL,
            MessageBody=json.dumps(ai_message),
            MessageGroupId=page_id,  # Unique per page = parallel AI processing
            MessageDeduplicationId=f"{page_id}-convert"
        )
        
        print(f"Page {page_number}/{total_pages} converted and queued")
        
        pdf_doc.close()
        
        # Increment pages_processed counter
        documents_table.update_item(
            Key={'document_id': document_id},
            UpdateExpression='ADD pages_processed :inc',
            ExpressionAttributeValues={':inc': 1}
        )
    
    return {
        'statusCode': 200,
        'body': json.dumps({'message': 'Page conversion complete'})
    }
