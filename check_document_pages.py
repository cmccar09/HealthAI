import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')

# Patient and document IDs
patient_id = '17afb113-a23c-4d80-b840-be9868bd8c9a'
document_id = 'df1c26ac-ab0c-4d9d-8e5c-4bbb8a3bded0'

print("=" * 70)
print("Checking Document Pages in DynamoDB")
print("=" * 70)
print()

# Check HealthAI-Pages table
pages_table = dynamodb.Table('HealthAI-Pages')
response = pages_table.scan(
    FilterExpression='document_id = :doc_id',
    ExpressionAttributeValues={':doc_id': document_id}
)

pages = response.get('Items', [])
print(f"Found {len(pages)} pages for document {document_id}")
print()

if pages:
    print("Page Details:")
    print("-" * 70)
    for page in sorted(pages, key=lambda x: x.get('page_number', 0)):
        page_num = page.get('page_number', 'N/A')
        page_id = page.get('page_id', 'N/A')
        webp_key = page.get('webp_s3_key', 'N/A')
        ai_processed = page.get('ai_processed', False)
        status = page.get('status', 'N/A')
        categories = page.get('categories', [])
        
        print(f"Page {page_num}:")
        print(f"  Page ID: {page_id}")
        print(f"  WebP S3 Key: {webp_key}")
        print(f"  AI Processed: {ai_processed}")
        print(f"  Status: {status}")
        print(f"  Categories: {len(categories)} categories")
        print()
else:
    print("⚠️ No pages found in database!")
    print()
    print("This could mean:")
    print("1. The document hasn't been uploaded yet")
    print("2. The document is still being processed")
    print("3. The document_id is incorrect")
    print()
    print("To fix: Upload a PDF through the frontend")

print()
print("=" * 70)

# Check Categories table
categories_table = dynamodb.Table('HealthAI-Categories')
response = categories_table.scan(
    FilterExpression='document_id = :doc_id',
    ExpressionAttributeValues={':doc_id': document_id}
)

categories = response.get('Items', [])
print(f"Found {len(categories)} category entries for this document")

if categories:
    unique_categories = set([cat.get('category_name') for cat in categories])
    print(f"Unique categories: {', '.join(unique_categories)}")

print()
print("=" * 70)
