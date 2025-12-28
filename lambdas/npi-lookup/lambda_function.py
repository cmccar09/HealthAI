import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
npi_table = dynamodb.Table('HealthAI-NPI')

# Taxonomy code to specialty mapping
TAXONOMY_SPECIALTIES = {
    '207Q00000X': 'Family Medicine',
    '208D00000X': 'General Practice',
    '207R00000X': 'Internal Medicine',
    '207RC0000X': 'Cardiovascular Disease',
    '207RI0000X': 'Infectious Disease',
    '207RN0300X': 'Nephrology',
    '208000000X': 'Pediatrics',
    '207T00000X': 'Neurological Surgery',
    '2080P0216X': 'Pulmonology',
    '207RE0101X': 'Endocrinology',
    '207RG0100X': 'Gastroenterology',
    '207RH0000X': 'Hematology',
    '207RM1200X': 'Medical Oncology',
    # Add more as needed
}

def decimal_default(obj):
    """JSON encoder for Decimal types"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def search_npi_by_name(last_name, first_name=None):
    """Search for providers by name"""
    try:
        # Query by last name using GSI
        response = npi_table.query(
            IndexName='ProviderNameIndex',
            KeyConditionExpression='provider_last_name = :lastname',
            ExpressionAttributeValues={
                ':lastname': last_name.upper()
            },
            Limit=20  # Limit results
        )
        
        results = response.get('Items', [])
        
        # Filter by first name if provided
        if first_name and results:
            first_name_lower = first_name.lower()
            results = [r for r in results if 
                      r.get('provider_first_name', '').lower().startswith(first_name_lower)]
        
        # Format results
        formatted_results = []
        for item in results:
            result = {
                'number': item['npi'],
                'enumeration_type': 'Individual' if item['entity_type'] == '1' else 'Organization',
                'basic': {
                    'first_name': item.get('provider_first_name', ''),
                    'last_name': item.get('provider_last_name', ''),
                    'middle_name': item.get('provider_middle_name', ''),
                    'credential': item.get('provider_credential', ''),
                    'name': item.get('provider_name', ''),
                    'organization_name': item.get('organization_name', '')
                },
                'addresses': []
            }
            
            # Add practice address
            if 'practice_address' in item:
                addr = item['practice_address']
                result['addresses'].append({
                    'address_1': addr.get('address_line1', ''),
                    'address_2': addr.get('address_line2', ''),
                    'city': addr.get('city', ''),
                    'state': addr.get('state', ''),
                    'postal_code': addr.get('postal_code', ''),
                    'telephone_number': addr.get('phone', '')
                })
            
            # Add taxonomies
            result['taxonomies'] = []
            if 'taxonomies' in item:
                for tax_code in item['taxonomies']:
                    result['taxonomies'].append({
                        'code': tax_code,
                        'desc': TAXONOMY_SPECIALTIES.get(tax_code, 'Unknown Specialty'),
                        'primary': tax_code == item.get('primary_taxonomy', '')
                    })
            
            formatted_results.append(result)
        
        return formatted_results
        
    except Exception as e:
        print(f"Error searching NPI: {e}")
        return []

def get_npi_by_number(npi_number):
    """Get provider details by NPI number"""
    try:
        response = npi_table.get_item(Key={'npi': npi_number})
        
        if 'Item' not in response:
            return None
        
        item = response['Item']
        
        # Format result same as search
        result = {
            'number': item['npi'],
            'enumeration_type': 'Individual' if item['entity_type'] == '1' else 'Organization',
            'basic': {
                'first_name': item.get('provider_first_name', ''),
                'last_name': item.get('provider_last_name', ''),
                'middle_name': item.get('provider_middle_name', ''),
                'credential': item.get('provider_credential', ''),
                'name': item.get('provider_name', ''),
                'organization_name': item.get('organization_name', '')
            },
            'addresses': []
        }
        
        # Add practice address
        if 'practice_address' in item:
            addr = item['practice_address']
            result['addresses'].append({
                'address_1': addr.get('address_line1', ''),
                'address_2': addr.get('address_line2', ''),
                'city': addr.get('city', ''),
                'state': addr.get('state', ''),
                'postal_code': addr.get('postal_code', ''),
                'telephone_number': addr.get('phone', '')
            })
        
        # Add taxonomies
        result['taxonomies'] = []
        if 'taxonomies' in item:
            for tax_code in item['taxonomies']:
                result['taxonomies'].append({
                    'code': tax_code,
                    'desc': TAXONOMY_SPECIALTIES.get(tax_code, 'Unknown Specialty'),
                    'primary': tax_code == item.get('primary_taxonomy', '')
                })
        
        return result
        
    except Exception as e:
        print(f"Error getting NPI: {e}")
        return None

def lambda_handler(event, context):
    """Handle NPI lookup requests"""
    try:
        # Parse request
        params = event.get('queryStringParameters', {}) or {}
        
        # Search by name
        if 'last_name' in params:
            last_name = params['last_name']
            first_name = params.get('first_name')
            
            results = search_npi_by_name(last_name, first_name)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'result_count': len(results),
                    'results': results
                }, default=decimal_default)
            }
        
        # Get by NPI number
        elif 'npi' in params:
            npi_number = params['npi']
            result = get_npi_by_number(npi_number)
            
            if result:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'result_count': 1,
                        'results': [result]
                    }, default=decimal_default)
                }
            else:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({'error': 'NPI not found'})
                }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'Missing required parameters: last_name or npi'})
            }
            
    except Exception as e:
        print(f"Lambda error: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
