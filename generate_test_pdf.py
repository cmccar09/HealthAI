"""
Generate a fake medical health PDF for testing purposes
Creates a ~300 page PDF with realistic medical content
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import random
from datetime import datetime, timedelta

# Medical terminology and data for realistic content
MEDICAL_CONDITIONS = [
    "Type 2 Diabetes Mellitus", "Hypertension", "Coronary Artery Disease",
    "Chronic Obstructive Pulmonary Disease", "Asthma", "Osteoarthritis",
    "Hyperlipidemia", "Gastroesophageal Reflux Disease", "Anxiety Disorder",
    "Major Depressive Disorder", "Hypothyroidism", "Atrial Fibrillation",
    "Chronic Kidney Disease Stage 3", "Sleep Apnea", "Osteoporosis"
]

MEDICATIONS = [
    "Metformin 1000mg BID", "Lisinopril 10mg QD", "Atorvastatin 20mg QHS",
    "Aspirin 81mg QD", "Levothyroxine 75mcg QD", "Omeprazole 20mg QD",
    "Albuterol MDI PRN", "Sertraline 50mg QD", "Gabapentin 300mg TID",
    "Furosemide 40mg QD", "Warfarin 5mg QD", "Insulin Glargine 20 units QHS"
]

VITAL_SIGNS = {
    "BP": ["120/80", "135/85", "142/90", "118/76", "130/82"],
    "HR": ["72", "68", "82", "76", "88"],
    "RR": ["16", "18", "20", "14", "17"],
    "Temp": ["98.6", "98.4", "99.1", "97.8", "98.2"],
    "SpO2": ["98", "99", "97", "96", "98"]
}

LAB_TESTS = {
    "Hemoglobin": (12.0, 16.0, "g/dL"),
    "WBC": (4.5, 11.0, "K/uL"),
    "Platelets": (150, 400, "K/uL"),
    "Glucose": (70, 100, "mg/dL"),
    "Creatinine": (0.6, 1.2, "mg/dL"),
    "Sodium": (135, 145, "mEq/L"),
    "Potassium": (3.5, 5.0, "mEq/L"),
    "Total Cholesterol": (125, 200, "mg/dL"),
    "LDL": (0, 100, "mg/dL"),
    "HDL": (40, 60, "mg/dL"),
    "Triglycerides": (0, 150, "mg/dL"),
    "HbA1c": (4.0, 5.6, "%"),
    "TSH": (0.4, 4.0, "mIU/L"),
}

PATIENT_NAMES = [
    "John Anderson", "Mary Johnson", "Robert Williams", "Patricia Brown",
    "Michael Davis", "Jennifer Miller", "William Wilson", "Elizabeth Moore",
    "David Taylor", "Linda Anderson", "Richard Thomas", "Barbara Jackson"
]

def generate_patient_info():
    """Generate random patient information"""
    name = random.choice(PATIENT_NAMES)
    dob = datetime.now() - timedelta(days=random.randint(18*365, 85*365))
    mrn = f"MRN-{random.randint(100000, 999999)}"
    return {
        "name": name,
        "dob": dob.strftime("%m/%d/%Y"),
        "mrn": mrn,
        "age": (datetime.now() - dob).days // 365
    }

def generate_progress_note(patient, date, visit_num):
    """Generate a medical progress note"""
    conditions = random.sample(MEDICAL_CONDITIONS, random.randint(2, 5))
    meds = random.sample(MEDICATIONS, random.randint(3, 7))
    
    note = f"""
    <b>PROGRESS NOTE - Visit #{visit_num}</b><br/>
    <b>Date:</b> {date.strftime("%m/%d/%Y %H:%M")}<br/>
    <b>Patient:</b> {patient['name']}<br/>
    <b>MRN:</b> {patient['mrn']}<br/>
    <b>DOB:</b> {patient['dob']} (Age: {patient['age']})<br/>
    <br/>
    <b>CHIEF COMPLAINT:</b><br/>
    Follow-up visit for chronic disease management and medication review.<br/>
    <br/>
    <b>VITAL SIGNS:</b><br/>
    BP: {random.choice(VITAL_SIGNS['BP'])} mmHg | 
    HR: {random.choice(VITAL_SIGNS['HR'])} bpm | 
    RR: {random.choice(VITAL_SIGNS['RR'])} /min<br/>
    Temp: {random.choice(VITAL_SIGNS['Temp'])} °F | 
    SpO2: {random.choice(VITAL_SIGNS['SpO2'])}% on room air<br/>
    <br/>
    <b>ACTIVE PROBLEMS:</b><br/>
    """
    
    for i, condition in enumerate(conditions, 1):
        note += f"{i}. {condition}<br/>"
    
    note += f"""
    <br/>
    <b>CURRENT MEDICATIONS:</b><br/>
    """
    
    for i, med in enumerate(meds, 1):
        note += f"{i}. {med}<br/>"
    
    note += f"""
    <br/>
    <b>REVIEW OF SYSTEMS:</b><br/>
    Constitutional: Denies fever, chills, or weight changes<br/>
    Cardiovascular: Denies chest pain, palpitations, or edema<br/>
    Respiratory: Denies shortness of breath or cough<br/>
    Gastrointestinal: Denies nausea, vomiting, or abdominal pain<br/>
    Musculoskeletal: Reports mild joint stiffness, improved with activity<br/>
    Neurological: Denies headaches, dizziness, or weakness<br/>
    Psychiatric: Reports stable mood, denies anxiety or depression<br/>
    <br/>
    <b>PHYSICAL EXAMINATION:</b><br/>
    General: Alert and oriented x3, appears stated age, in no acute distress<br/>
    HEENT: Normocephalic, atraumatic. PERRLA. TMs clear bilaterally<br/>
    Cardiovascular: Regular rate and rhythm, no murmurs, rubs, or gallops<br/>
    Respiratory: Clear to auscultation bilaterally, no wheezes or rales<br/>
    Abdomen: Soft, non-tender, non-distended, normal bowel sounds<br/>
    Extremities: No edema, normal range of motion, pulses 2+ bilaterally<br/>
    <br/>
    <b>ASSESSMENT AND PLAN:</b><br/>
    Patient continues to do well on current regimen. Vital signs stable.<br/>
    Laboratory results reviewed and within acceptable ranges.<br/>
    Will continue current medications with no changes at this time.<br/>
    Patient counseled on diet, exercise, and medication compliance.<br/>
    Follow-up appointment scheduled in 3 months or sooner if needed.<br/>
    <br/>
    Electronically signed by Dr. Sarah Mitchell, MD<br/>
    """
    
    return note

def generate_lab_report(patient, date, report_num):
    """Generate a laboratory report"""
    report = f"""
    <b>LABORATORY REPORT #{report_num}</b><br/>
    <b>Date Collected:</b> {date.strftime("%m/%d/%Y %H:%M")}<br/>
    <b>Date Reported:</b> {(date + timedelta(hours=4)).strftime("%m/%d/%Y %H:%M")}<br/>
    <b>Patient:</b> {patient['name']}<br/>
    <b>MRN:</b> {patient['mrn']}<br/>
    <b>DOB:</b> {patient['dob']}<br/>
    <b>Ordering Physician:</b> Dr. Sarah Mitchell, MD<br/>
    <br/>
    <b>COMPREHENSIVE METABOLIC PANEL WITH LIPID PANEL</b><br/>
    <br/>
    """
    
    # Create lab results table
    lab_data = [["Test", "Result", "Reference Range", "Units", "Flag"]]
    
    for test_name, (low, high, unit) in LAB_TESTS.items():
        # Generate value that's usually normal but sometimes abnormal
        if random.random() < 0.8:  # 80% normal
            result = round(random.uniform(low, high), 1)
            flag = ""
        else:  # 20% abnormal
            if random.random() < 0.5:
                result = round(random.uniform(low * 0.8, low), 1)
                flag = "L"
            else:
                result = round(random.uniform(high, high * 1.2), 1)
                flag = "H"
        
        lab_data.append([
            test_name,
            str(result),
            f"{low} - {high}",
            unit,
            flag
        ])
    
    return report, lab_data

def create_medical_pdf(filename, num_pages=300):
    """Create a multi-page medical PDF"""
    doc = SimpleDocTemplate(filename, pagesize=letter,
                          topMargin=0.75*inch, bottomMargin=0.75*inch,
                          leftMargin=0.75*inch, rightMargin=0.75*inch)
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a5490'),
        spaceAfter=20,
        alignment=TA_CENTER
    )
    
    header_style = ParagraphStyle(
        'CustomHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2c5aa0'),
        spaceAfter=12
    )
    
    normal_style = styles['Normal']
    normal_style.fontSize = 10
    normal_style.leading = 14
    
    # Build document content
    story = []
    
    # Title page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("HEALTHAI MEDICAL CENTER", title_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("COMPREHENSIVE PATIENT MEDICAL RECORDS", header_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Electronic Health Record System v2.5", normal_style))
    story.append(Spacer(1, 0.2*inch))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", normal_style))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("CONFIDENTIAL MEDICAL INFORMATION", ParagraphStyle(
        'Warning',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.red,
        alignment=TA_CENTER
    )))
    story.append(PageBreak())
    
    # Generate patient
    patient = generate_patient_info()
    
    # Patient summary page
    story.append(Paragraph("PATIENT SUMMARY", header_style))
    story.append(Paragraph(f"<b>Name:</b> {patient['name']}", normal_style))
    story.append(Paragraph(f"<b>Medical Record Number:</b> {patient['mrn']}", normal_style))
    story.append(Paragraph(f"<b>Date of Birth:</b> {patient['dob']}", normal_style))
    story.append(Paragraph(f"<b>Age:</b> {patient['age']} years", normal_style))
    story.append(Paragraph(f"<b>Primary Care Physician:</b> Dr. Sarah Mitchell, MD", normal_style))
    story.append(Spacer(1, 0.3*inch))
    
    story.append(Paragraph("<b>Medical Record Contents:</b>", normal_style))
    story.append(Paragraph("• Progress Notes (Multiple Visits)", normal_style))
    story.append(Paragraph("• Laboratory Results", normal_style))
    story.append(Paragraph("• Diagnostic Imaging Reports", normal_style))
    story.append(Paragraph("• Medication History", normal_style))
    story.append(Paragraph("• Consultation Reports", normal_style))
    story.append(PageBreak())
    
    # Generate content for remaining pages
    visit_num = 1
    lab_num = 1
    start_date = datetime.now() - timedelta(days=365*2)  # 2 years of records
    
    pages_generated = 2  # Already have title and summary pages
    
    while pages_generated < num_pages:
        visit_date = start_date + timedelta(days=random.randint(30, 90))
        
        # Alternate between progress notes and lab reports
        if visit_num % 4 != 0:  # 3 progress notes for every lab report
            story.append(Paragraph(f"MEDICAL RECORD - Page {pages_generated + 1}", 
                                 ParagraphStyle('PageNum', parent=styles['Normal'], 
                                              fontSize=8, textColor=colors.grey, alignment=TA_RIGHT)))
            story.append(Spacer(1, 0.1*inch))
            
            note = generate_progress_note(patient, visit_date, visit_num)
            story.append(Paragraph(note, normal_style))
            story.append(PageBreak())
            pages_generated += 1
            visit_num += 1
        else:
            # Lab report
            story.append(Paragraph(f"MEDICAL RECORD - Page {pages_generated + 1}", 
                                 ParagraphStyle('PageNum', parent=styles['Normal'], 
                                              fontSize=8, textColor=colors.grey, alignment=TA_RIGHT)))
            story.append(Spacer(1, 0.1*inch))
            
            report_text, lab_data = generate_lab_report(patient, visit_date, lab_num)
            story.append(Paragraph(report_text, normal_style))
            
            # Create table for lab results
            table = Table(lab_data, colWidths=[2*inch, 1*inch, 1.5*inch, 0.8*inch, 0.5*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5aa0')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
            ]))
            
            story.append(table)
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("<b>Note:</b> Results reviewed by Dr. Sarah Mitchell, MD", normal_style))
            story.append(PageBreak())
            pages_generated += 1
            lab_num += 1
            visit_num += 1
        
        start_date = visit_date
    
    # Build PDF
    doc.build(story)
    print(f"✓ Generated {filename} with approximately {num_pages} pages")

if __name__ == "__main__":
    create_medical_pdf("fake_medical_record_300pages.pdf", num_pages=300)
    print("\nPDF generation complete!")
    print("File: fake_medical_record_300pages.pdf")
