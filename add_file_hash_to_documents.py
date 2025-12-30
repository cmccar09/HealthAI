"""
Add file_hash to existing documents for duplicate detection.
Calculates SHA-256 hash of each PDF and updates the Documents table.
"""

import boto3
import hashlib

s3_client = boto3.client('s3', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
documents_table = dynamodb.Table('HealthAI-Documents')

def add_hashes():
    """Add file_hash to all existing documents."""
    
    # Scan all documents
    response = documents_table.scan()
    documents = response.get('Items', [])
    
    # Handle pagination
    while 'LastEvaluatedKey' in response:
        response = documents_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        documents.extend(response.get('Items', []))
    
    print(f"Found {len(documents)} documents to process")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for doc in documents:
        document_id = doc['document_id']
        
        # Skip if already has hash
        if 'file_hash' in doc:
            print(f"Document {document_id} already has hash, skipping...")
            skipped_count += 1
            continue
        
        pdf_s3_key = doc.get('pdf_s3_key')
        if not pdf_s3_key:
            print(f"ERROR: Document {document_id} has no pdf_s3_key")
            error_count += 1
            continue
        
        try:
            # Download PDF from S3
            bucket = 'futuregen-health-ai'
            pdf_obj = s3_client.get_object(Bucket=bucket, Key=pdf_s3_key)
            pdf_content = pdf_obj['Body'].read()
            
            # Calculate SHA-256 hash
            file_hash = hashlib.sha256(pdf_content).hexdigest()
            
            # Update document with hash
            documents_table.update_item(
                Key={'document_id': document_id},
                UpdateExpression='SET file_hash = :hash',
                ExpressionAttributeValues={':hash': file_hash}
            )
            
            print(f"Updated {document_id} with hash: {file_hash[:16]}...")
            updated_count += 1
            
        except Exception as e:
            print(f"ERROR processing document {document_id}: {e}")
            error_count += 1
    
    print(f"\nComplete!")
    print(f"Updated: {updated_count}")
    print(f"Skipped: {skipped_count}")
    print(f"Errors: {error_count}")
    print(f"Total: {len(documents)}")

if __name__ == '__main__':
    add_hashes()
