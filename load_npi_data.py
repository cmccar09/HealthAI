import csv
import boto3
from decimal import Decimal
import time
from botocore.exceptions import ClientError

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
table = dynamodb.Table('HealthAI-NPI')

def batch_write_items(items):
    """Write items to DynamoDB in batches with retry logic"""
    max_retries = 5
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            with table.batch_writer(overwrite_by_pkeys=['npi']) as batch:
                for item in items:
                    batch.put_item(Item=item)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ProvisionedThroughputExceededException':
                retry_count += 1
                wait_time = 2 ** retry_count  # Exponential backoff
                print(f"  Throttled, waiting {wait_time}s before retry {retry_count}/{max_retries}")
                time.sleep(wait_time)
            else:
                print(f"  Error: {e}")
                raise
        except Exception as e:
            print(f"  Unexpected error: {e}")
            raise
    
    print(f"  Failed after {max_retries} retries")
    return False

def parse_npi_record(row):
    """Parse a CSV row into a DynamoDB item"""
    try:
        # Extract key fields
        npi = row[0].strip()
        if not npi:
            return None
            
        entity_type = row[1].strip()  # 1 = Individual, 2 = Organization
        
        # Build item based on entity type
        item = {
            'npi': npi,
            'entity_type': entity_type,
        }
        
        # Individual provider (Type 1)
        if entity_type == '1':
            provider_last_name = row[5].strip()
            provider_first_name = row[6].strip()
            provider_middle_name = row[7].strip()
            provider_credential = row[10].strip()
            
            if provider_last_name:
                item['provider_last_name'] = provider_last_name
            if provider_first_name:
                item['provider_first_name'] = provider_first_name
            if provider_middle_name:
                item['provider_middle_name'] = provider_middle_name
            if provider_credential:
                item['provider_credential'] = provider_credential
                
            # Provider name for display
            name_parts = [provider_first_name, provider_middle_name, provider_last_name, provider_credential]
            item['provider_name'] = ' '.join([p for p in name_parts if p]).strip()
        
        # Organization (Type 2)
        else:
            org_name = row[4].strip()
            if org_name:
                item['provider_name'] = org_name
                item['provider_last_name'] = org_name  # For searching
                item['organization_name'] = org_name
        
        # Practice location address
        address_line1 = row[28].strip()
        address_line2 = row[29].strip()
        city = row[30].strip()
        state = row[31].strip()
        postal_code = row[32].strip()
        phone = row[34].strip()
        
        if address_line1 or city:
            item['practice_address'] = {
                'address_line1': address_line1,
                'address_line2': address_line2,
                'city': city,
                'state': state,
                'postal_code': postal_code,
                'phone': phone
            }
        
        # Primary taxonomy (specialty)
        taxonomy_code_1 = row[47].strip()
        if taxonomy_code_1:
            item['primary_taxonomy'] = taxonomy_code_1
            
        # Collect all taxonomies
        taxonomies = []
        for i in range(15):  # Up to 15 taxonomies
            tax_idx = 47 + (i * 4)  # Taxonomy codes are every 4 columns
            if tax_idx < len(row):
                tax_code = row[tax_idx].strip()
                if tax_code:
                    taxonomies.append(tax_code)
        
        if taxonomies:
            item['taxonomies'] = taxonomies
        
        # Enumeration date
        enum_date = row[36].strip()
        if enum_date:
            item['enumeration_date'] = enum_date
            
        # Last update date
        update_date = row[37].strip()
        if update_date:
            item['last_update_date'] = update_date
        
        return item
    except Exception as e:
        print(f"Error parsing record: {e}")
        return None

def load_npi_data(csv_file_path, max_records=None):
    """Load NPI data from CSV file into DynamoDB"""
    batch = []
    batch_size = 25  # DynamoDB batch write limit
    total_processed = 0
    total_written = 0
    
    print(f"Starting NPI data load from {csv_file_path}")
    print("This may take a while for large files...")
    
    start_time = time.time()
    
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        # Skip header
        next(reader)
        
        for row in reader:
            if max_records and total_processed >= max_records:
                break
                
            total_processed += 1
            
            # Parse the record
            item = parse_npi_record(row)
            
            if item:
                batch.append(item)
                
                # Write batch when full
                if len(batch) >= batch_size:
                    try:
                        batch_write_items(batch)
                        total_written += len(batch)
                        batch = []
                        
                        # Progress update
                        if total_written % 1000 == 0:
                            elapsed = time.time() - start_time
                            rate = total_written / elapsed
                            print(f"Processed: {total_processed:,} | Written: {total_written:,} | Rate: {rate:.0f} records/sec")
                    except ClientError as e:
                        print(f"Error writing batch: {e}")
                        time.sleep(1)  # Brief pause on error
        
        # Write remaining items
        if batch:
            try:
                batch_write_items(batch)
                total_written += len(batch)
            except ClientError as e:
                print(f"Error writing final batch: {e}")
    
    elapsed = time.time() - start_time
    print(f"\n✅ Load complete!")
    print(f"Total processed: {total_processed:,}")
    print(f"Total written: {total_written:,}")
    print(f"Time elapsed: {elapsed:.1f} seconds")
    print(f"Average rate: {total_written/elapsed:.0f} records/sec")

if __name__ == "__main__":
    # Path to extracted CSV file
    csv_file = r"C:\Users\charl\Downloads\NPPES_Data\npidata_pfile_20050523-20251207.csv"
    
    # Load 100,000 records
    # Remove max_records parameter to load all data (will take hours)
    load_npi_data(csv_file, max_records=100000)
    
    print("\n📊 Table statistics:")
    response = table.describe()
    print(f"Item count: {response['Table']['ItemCount']:,}")
