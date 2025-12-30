import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.client('dynamodb')

tables_to_create = [
    {
        'TableName': 'HealthAI-Procedures',
        'KeySchema': [
            {'AttributeName': 'procedure_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'procedure_id', 'AttributeType': 'S'},
            {'AttributeName': 'patient_id', 'AttributeType': 'S'},
            {'AttributeName': 'document_id', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'patient-index',
                'KeySchema': [{'AttributeName': 'patient_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            },
            {
                'IndexName': 'document-index',
                'KeySchema': [{'AttributeName': 'document_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            }
        ]
    },
    {
        'TableName': 'HealthAI-Radiology',
        'KeySchema': [
            {'AttributeName': 'radiology_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'radiology_id', 'AttributeType': 'S'},
            {'AttributeName': 'patient_id', 'AttributeType': 'S'},
            {'AttributeName': 'document_id', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'patient-index',
                'KeySchema': [{'AttributeName': 'patient_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            },
            {
                'IndexName': 'document-index',
                'KeySchema': [{'AttributeName': 'document_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            }
        ]
    },
    {
        'TableName': 'HealthAI-FamilyHistory',
        'KeySchema': [
            {'AttributeName': 'family_history_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'family_history_id', 'AttributeType': 'S'},
            {'AttributeName': 'patient_id', 'AttributeType': 'S'},
            {'AttributeName': 'document_id', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'patient-index',
                'KeySchema': [{'AttributeName': 'patient_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            },
            {
                'IndexName': 'document-index',
                'KeySchema': [{'AttributeName': 'document_id', 'KeyType': 'HASH'}],
                'Projection': {'ProjectionType': 'ALL'},
                'ProvisionedThroughput': {'ReadCapacityUnits': 5, 'WriteCapacityUnits': 5}
            }
        ]
    }
]

print("=" * 70)
print("Creating DynamoDB Tables for Procedures, Radiology, Family History")
print("=" * 70)
print()

for table_config in tables_to_create:
    table_name = table_config['TableName']
    
    try:
        # Check if table already exists
        existing = dynamodb.describe_table(TableName=table_name)
        print(f"✓ {table_name} already exists")
        continue
    except ClientError as e:
        if e.response['Error']['Code'] != 'ResourceNotFoundException':
            print(f"✗ Error checking {table_name}: {e}")
            continue
    
    # Create table
    try:
        print(f"Creating {table_name}...")
        response = dynamodb.create_table(
            TableName=table_config['TableName'],
            KeySchema=table_config['KeySchema'],
            AttributeDefinitions=table_config['AttributeDefinitions'],
            GlobalSecondaryIndexes=table_config['GlobalSecondaryIndexes'],
            BillingMode='PROVISIONED',
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            },
            Tags=[
                {'Key': 'Environment', 'Value': 'dev'},
                {'Key': 'Project', 'Value': 'HealthAI'}
            ]
        )
        
        # Wait for table to be active
        print(f"  Waiting for {table_name} to become active...")
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=table_name)
        
        print(f"✓ {table_name} created successfully")
        
    except ClientError as e:
        print(f"✗ Error creating {table_name}: {e}")

print()
print("=" * 70)
print("✓ All tables processed")
print("=" * 70)
print()
print("Next steps:")
print("1. Update Lambda environment variables to include:")
print("   - PROCEDURES_TABLE=HealthAI-Procedures")
print("   - RADIOLOGY_TABLE=HealthAI-Radiology")
print("   - FAMILY_HISTORY_TABLE=HealthAI-FamilyHistory")
print("2. Redeploy Lambda function")
print("3. Re-upload patient PDFs to extract new data types")
