"""
Background NPI Data Loader
This script loads NPI data in the background and can be run unattended.
It will continue loading until reaching 100,000 records or being stopped.
"""
import csv
import boto3
import time
import signal
import sys

# Initialize
dynamodb_client = boto3.client('dynamodb', region_name='us-east-1')
running = True

def signal_handler(sig, frame):
    global running
    print('\n\nGracefully stopping...')
    running = False

signal.signal(signal.SIGINT, signal_handler)

def load_batch(items):
    if not items:
        return 0
    request_items = {'HealthAI-NPI': [{'PutRequest': {'Item': item}} for item in items]}
    try:
        response = dynamodb_client.batch_write_item(RequestItems=request_items)
        retries = 0
        while response.get('UnprocessedItems') and retries < 5:
            time.sleep(0.5 * (2 ** retries))
            response = dynamodb_client.batch_write_item(RequestItems=response['UnprocessedItems'])
            retries += 1
        return len(items)
    except Exception as e:
        print(f"Batch error: {e}")
        time.sleep(2)
        return 0

def parse_npi_record(row):
    try:
        npi = row[0].strip()
        if not npi:
            return None
        entity_type = row[1].strip()
        item = {'npi': {'S': npi}, 'entity_type': {'S': entity_type}}
        
        if entity_type == '1':
            last_name = row[5].strip().upper()
            first_name = row[6].strip()
            if last_name:
                item['provider_last_name'] = {'S': last_name}
            if first_name:
                item['provider_first_name'] = {'S': first_name}
                item['provider_name'] = {'S': f"{first_name} {last_name}".strip()}
        else:
            org_name = row[4].strip()
            if org_name:
                item['provider_last_name'] = {'S': org_name.upper()}
                item['provider_name'] = {'S': org_name}
        
        if len(row) > 30:
            city = row[30].strip()
            state = row[31].strip()
            if city or state:
                item['practice_address'] = {'M': {}}
                if city:
                    item['practice_address']['M']['city'] = {'S': city}
                if state:
                    item['practice_address']['M']['state'] = {'S': state}
        
        return item
    except:
        return None

print("NPI Background Loader Started")
print("Press Ctrl+C to stop gracefully")
print("=" * 50)

csv_file = r"C:\Users\charl\Downloads\NPPES_Data\npidata_pfile_20050523-20251207.csv"
batch = []
total_written = 0
target = 100000
start_time = time.time()

try:
    with open(csv_file, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        next(reader)
        
        for row in reader:
            if not running or total_written >= target:
                break
            
            item = parse_npi_record(row)
            if item:
                batch.append(item)
                
                if len(batch) >= 25:
                    written = load_batch(batch)
                    total_written += written
                    batch = []
                    
                    if total_written % 5000 == 0:
                        elapsed = time.time() - start_time
                        rate = total_written / elapsed
                        print(f"{total_written:,}/{target:,} loaded ({rate:.0f}/sec)")
        
        if batch and running:
            total_written += load_batch(batch)

except Exception as e:
    print(f"Error: {e}")

elapsed = time.time() - start_time
print(f"\n✅ Completed: {total_written:,} records in {elapsed/60:.1f} minutes")
