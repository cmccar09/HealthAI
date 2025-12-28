"""
Reprocess page 1 of documents to extract patient information
"""
import boto3
import json

sqs = boto3.client('sqs', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

# Get the queue URL
queue_name = 'HealthAI-AI.fifo'
response = sqs.get_queue_url(QueueName=queue_name)
queue_url = response['QueueUrl']

# Get all page 1 entries
pages_table = dynamodb.Table('HealthAI-Pages')
response = pages_table.scan()

page1_items = [item for item in response['Items'] if item.get('page_number') == 1]

print(f"Found {len(page1_items)} page 1 entries")

for item in page1_items:
    document_id = item['document_id']
    page_id = item['page_id']
    
    # Get total pages for this document
    all_pages = [p for p in response['Items'] if p['document_id'] == document_id]
    total_pages = len(all_pages)
    
    # Send to SQS for reprocessing
    message = {
        'page_id': page_id,
        'document_id': document_id,
        'page_number': 1,
        'total_pages': total_pages,
        'webp_bucket': item['webp_bucket'],
        'webp_key': item['webp_s3_key']
    }
    
    sqs.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps(message),
        MessageGroupId=document_id,
        MessageDeduplicationId=f"{page_id}-reprocess-{int(boto3.client('sts').get_caller_identity()['Account'])}"
    )
    
    print(f"Queued for reprocessing: Document {document_id}, Page 1")

print(f"\n✅ Queued {len(page1_items)} page 1 entries for reprocessing")
print("Patient information will be extracted shortly")
