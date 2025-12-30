"""
Fix Categories table to add missing document_id field.
Queries Pages table to get document_id for each page_id.
"""

import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
categories_table = dynamodb.Table('HealthAI-Categories')
pages_table = dynamodb.Table('HealthAI-Pages')

def fix_categories():
    """Add document_id to all category records and normalize category names to lowercase."""
    
    # Scan all categories
    response = categories_table.scan()
    categories = response.get('Items', [])
    
    # Handle pagination
    while 'LastEvaluatedKey' in response:
        response = categories_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        categories.extend(response.get('Items', []))
    
    print(f"Found {len(categories)} category records to fix")
    
    fixed_count = 0
    error_count = 0
    
    for cat in categories:
        category_id = cat['category_id']
        page_id = cat['page_id']
        category_name = cat.get('category_name', 'other')
        
        # Skip if already has document_id
        if 'document_id' in cat:
            print(f"Category {category_id} already has document_id, skipping...")
            continue
        
        # Get document_id from Pages table
        try:
            page_response = pages_table.get_item(Key={'page_id': page_id})
            page = page_response.get('Item')
            
            if not page:
                print(f"ERROR: Page {page_id} not found for category {category_id}")
                error_count += 1
                continue
            
            document_id = page.get('document_id')
            if not document_id:
                print(f"ERROR: Page {page_id} has no document_id")
                error_count += 1
                continue
            
            # Update category with document_id and normalize category_name to lowercase
            categories_table.update_item(
                Key={'category_id': category_id},
                UpdateExpression='SET document_id = :doc_id, category_name = :cat_name',
                ExpressionAttributeValues={
                    ':doc_id': document_id,
                    ':cat_name': category_name.lower()  # Normalize to lowercase
                }
            )
            
            fixed_count += 1
            if fixed_count % 10 == 0:
                print(f"Fixed {fixed_count} categories...")
            
        except Exception as e:
            print(f"ERROR updating category {category_id}: {e}")
            error_count += 1
    
    print(f"\nComplete!")
    print(f"Fixed: {fixed_count}")
    print(f"Errors: {error_count}")
    print(f"Total: {len(categories)}")

if __name__ == '__main__':
    fix_categories()
