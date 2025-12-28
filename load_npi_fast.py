import csv
import boto3
import time
from botocore.exceptions import ClientError

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('HealthAI-NPI')
dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')

def parse_npi_record(row):
    """Parse a CSV row into a DynamoDB item"""
    try:
        npi = row[0].strip()
        if not npi:
            return None
            
        entity_type = row[1].strip()
        item = {'npi': {'S': npi}, 'entity_type': {'S': entity_type}}
        
        # Individual provider
        if entity_type == '1':
            last_name = row[5].strip().upper()
            first_name = row[6].strip()
            middle_name = row[7].strip()
            credential = row[10].strip()
            
            if last_name:
                item['provider_last_name'] = {'S': last_name}
            if first_name:
                item['provider_first_name'] = {'S': first_name}
            if middle_name:
                item['provider_middle_name'] = {'S': middle_name}
            if credential:
                item['provider_credential'] = {'S': credential}
            
            name_parts = [first_name, middle_name, last_name, credential]
            provider_name = ' '.join([p for p in name_parts if p]).strip()
            if provider_name:
                item['provider_name'] = {'S': provider_name}
        else:
            # Organization
            org_name = row[4].strip()
            if org_name:
                item['provider_name'] = {'S': org_name}
                item['provider_last_name'] = {'S': org_name.upper()}
                item['organization_name'] = {'S': org_name}
        
        # Practice address
        addr_parts = {
            'address_line1': row[28].strip(),
            'city': row[30].strip(),
            'state': row[31].strip(),
            'postal_code': row[32].strip(),
            'phone': row[34].strip()
        }
        
        if any(addr_parts.values()):
            item['practice_address'] = {'M': {
                k: {'S': v} for k, v in addr_parts.items() if v
            }}
        
        # Primary taxonomy
        if len(row) > 47 and row[47].strip():
            item['primary_taxonomy'] = {'S': row[47].strip()}
            
        return item
    except:
        return None

def load_batch(items):
    """Load a batch using batch_write_item"""
    if not items:
        return 0
        
    request_items = {'HealthAI-NPI': [{'PutRequest': {'Item': item}} for item in items]}
    
    try:
        response = dynamodb_client.batch_write_item(RequestItems=request_items)
        
        # Handle unprocessed items
        retries = 0
        while response.get('UnprocessedItems') and retries < 5:
            time.sleep(0.5 * (2 ** retries))  # Exponential backoff
            response = dynamodb_client.batch_write_item(RequestItems=response['UnprocessedItems'])
            retries += 1
            
        return len(items)
    except Exception as e:
        print(f"Error: {e}")
        return 0

def load_npi_data_fast(csv_file, target_count=100000):
    """Fast load of NPI data"""
    batch = []
    batch_size = 25
    total_processed = 0
    total_written = 0
    
    print(f"Loading NPI data to {target_count} records...")
    start_time = time.time()
    
    with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        
        for row in reader:
            if total_written >= target_count:
                break
                
            total_processed += 1
            item = parse_npi_record(row)
            
            if item:
                batch.append(item)
                
                if len(batch) >= batch_size:
                    written = load_batch(batch)
                    total_written += written
                    batch = []
                    
                    if total_written % 1000 == 0:
                        elapsed = time.time() - start_time
                        rate = total_written / elapsed if elapsed > 0 else 0
                        eta = (target_count - total_written) / rate if rate > 0 else 0
                        print(f"Written: {total_written:,}/{target_count:,} | Rate: {rate:.0f}/sec | ETA: {eta/60:.1f}min")
        
        # Write remaining
        if batch:
            total_written += load_batch(batch)
    
    elapsed = time.time() - start_time
    print(f"\n✅ Complete! Written: {total_written:,} in {elapsed:.1f}s ({total_written/elapsed:.0f}/sec)")

if __name__ == "__main__":
    csv_file = r"C:\Users\charl\Downloads\NPPES_Data\npidata_pfile_20050523-20251207.csv"
    load_npi_data_fast(csv_file, target_count=100000)
