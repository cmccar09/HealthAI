import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-content">
            <h1>🏥 HealthAI</h1>
            <p>Medical Document Intelligence Platform</p>
          </div>
        </header>
        
        <Routes>
          <Route path="/" element={<PatientList />} />
          <Route path="/patient/:patientId" element={<PatientDetail />} />
          <Route path="/document/:documentId" element={<DocumentPages />} />
        </Routes>
      </div>
    </Router>
  );
}

function PatientList() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await axios.get(`${API_URL}/patients`);
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading patients...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <h2>Patients</h2>
        <p className="subtitle">{patients.length} patient records</p>
      </div>
      
      <div className="patient-grid">
        {patients.map(patient => (
          <Link 
            key={patient.patient_id} 
            to={`/patient/${patient.patient_id}`}
            className="patient-card"
          >
            <div className="patient-card-header">
              <div className="patient-avatar">
                {patient.patient_first_name?.[0]}{patient.patient_last_name?.[0]}
              </div>
              <div className="patient-info">
                <h3>{patient.patient_first_name} {patient.patient_last_name}</h3>
                <p className="patient-meta">
                  DOB: {patient.patient_dob || 'Unknown'}
                </p>
                <p className="patient-meta">
                  MRN: {patient.patient_mrn || 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="patient-card-details">
              <div className="detail-item">
                <span className="label">Facility:</span>
                <span>{patient.medical_facility || 'Unknown'}</span>
              </div>
              <div className="detail-item">
                <span className="label">Gender:</span>
                <span>{patient.gender || 'Unknown'}</span>
              </div>
              {patient.allergies && patient.allergies !== 'Unknown' && (
                <div className="detail-item alert">
                  <span className="label">⚠️ Allergies:</span>
                  <span>{patient.allergies}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PatientDetail() {
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [medications, setMedications] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      const [patientRes, docsRes, medsRes, diagRes, testsRes] = await Promise.all([
        axios.get(`${API_URL}/patient/${patientId}`),
        axios.get(`${API_URL}/patient/${patientId}/documents`),
        axios.get(`${API_URL}/patient/${patientId}/medications`),
        axios.get(`${API_URL}/patient/${patientId}/diagnoses`),
        axios.get(`${API_URL}/patient/${patientId}/tests`)
      ]);

      setPatient(patientRes.data.patient);
      setDocuments(docsRes.data.documents || []);
      setMedications(medsRes.data.medications || []);
      setDiagnoses(diagRes.data.diagnoses || []);
      setTests(testsRes.data.tests || []);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading patient data...</div>;
  if (!patient) return <div className="error">Patient not found</div>;

  return (
    <div className="container">
      <Link to="/" className="back-link">← Back to Patients</Link>
      
      <div className="patient-detail-header">
        <div className="patient-avatar large">
          {patient.patient_first_name?.[0]}{patient.patient_last_name?.[0]}
        </div>
        <div>
          <h2>{patient.patient_first_name} {patient.patient_last_name}</h2>
          <div className="patient-meta-group">
            <p>DOB: {patient.patient_dob}</p>
            <p>MRN: {patient.patient_mrn}</p>
            <p>Gender: {patient.gender}</p>
            <p>Blood Type: {patient.blood_type || 'Unknown'}</p>
          </div>
        </div>
      </div>

      <div className="patient-sections">
        {/* Contact Information */}
        <section className="info-section">
          <h3>Contact Information</h3>
          <div className="info-grid">
            <div><strong>Email:</strong> {patient.email || 'N/A'}</div>
            <div><strong>Phone:</strong> {patient.phone_number || 'N/A'}</div>
            <div><strong>Address:</strong> {patient.address_line1 || 'N/A'}</div>
            <div><strong>City:</strong> {patient.city || 'N/A'}</div>
            <div><strong>State:</strong> {patient.state || 'N/A'}</div>
            <div><strong>ZIP:</strong> {patient.postal_code || 'N/A'}</div>
          </div>
        </section>

        {/* Emergency Contact */}
        {patient.emergency_contact_name && patient.emergency_contact_name !== 'Unknown' && (
          <section className="info-section">
            <h3>Emergency Contact</h3>
            <div className="info-grid">
              <div><strong>Name:</strong> {patient.emergency_contact_name}</div>
              <div><strong>Phone:</strong> {patient.emergency_contact_phone || 'N/A'}</div>
            </div>
          </section>
        )}

        {/* Allergies */}
        {patient.allergies && patient.allergies !== 'Unknown' && (
          <section className="info-section alert-section">
            <h3>⚠️ Allergies</h3>
            <p className="allergy-text">{patient.allergies}</p>
          </section>
        )}

        {/* Medications */}
        <section className="info-section">
          <h3>💊 Medications ({medications.length})</h3>
          {medications.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Start Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {medications.map(med => (
                    <tr key={med.medication_id}>
                      <td><strong>{med.medication_name}</strong></td>
                      <td>{med.dosage}</td>
                      <td>{med.frequency}</td>
                      <td>{med.start_date}</td>
                      <td>
                        <span className={`status ${med.is_current === 'Yes' ? 'active' : 'inactive'}`}>
                          {med.is_current === 'Yes' ? 'Current' : 'Discontinued'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No medications recorded</p>
          )}
        </section>

        {/* Diagnoses */}
        <section className="info-section">
          <h3>🩺 Diagnoses ({diagnoses.length})</h3>
          {diagnoses.length > 0 ? (
            <div className="diagnosis-list">
              {diagnoses.map(diag => (
                <div key={diag.diagnosis_id} className="diagnosis-card">
                  <h4>{diag.diagnosis_description}</h4>
                  <p><strong>Code:</strong> {diag.diagnosis_code}</p>
                  <p><strong>Date:</strong> {diag.diagnosed_date}</p>
                  <p><strong>Doctor:</strong> Dr. {diag.diagnosing_doctor_first_name} {diag.diagnosing_doctor_last_name}</p>
                  <p><strong>Facility:</strong> {diag.diagnosing_facility_name}</p>
                  {diag.notes && <p><strong>Notes:</strong> {diag.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No diagnoses recorded</p>
          )}
        </section>

        {/* Test Results */}
        <section className="info-section">
          <h3>🔬 Test Results ({tests.length})</h3>
          {tests.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Normal Range</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map(test => (
                    <tr key={test.test_id} className={test.is_abnormal === 'Yes' ? 'abnormal-result' : ''}>
                      <td><strong>{test.test_name}</strong></td>
                      <td>{test.test_date}</td>
                      <td>{test.result_value} {test.result_unit}</td>
                      <td>{test.normal_range_low} - {test.normal_range_high}</td>
                      <td>
                        <span className={`status ${test.is_abnormal === 'Yes' ? 'abnormal' : 'normal'}`}>
                          {test.is_abnormal === 'Yes' ? '⚠️ Abnormal' : '✓ Normal'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No test results recorded</p>
          )}
        </section>

        {/* Documents */}
        <section className="info-section">
          <h3>📄 Documents ({documents.length})</h3>
          {documents.length > 0 ? (
            <div className="document-list">
              {documents.map(doc => (
                <Link 
                  key={doc.document_id} 
                  to={`/document/${doc.document_id}`}
                  className="document-card"
                >
                  <div className="document-icon">📄</div>
                  <div className="document-info">
                    <h4>{doc.filename}</h4>
                    <p>Pages: {doc.total_pages} | Processed: {doc.pages_processed}/{doc.total_pages}</p>
                    <p className="document-date">
                      Uploaded: {new Date(doc.upload_timestamp * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`document-status ${doc.status.toLowerCase()}`}>
                    {doc.status}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="no-data">No documents uploaded</p>
          )}
        </section>
      </div>
    </div>
  );
}

function DocumentPages() {
  const { documentId } = useParams();
  const [document, setDocument] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('webp'); // 'png' or 'webp'

  useEffect(() => {
    fetchDocumentPages();
  }, [documentId]);

  const fetchDocumentPages = async () => {
    try {
      const [docRes, pagesRes] = await Promise.all([
        axios.get(`${API_URL}/document/${documentId}`),
        axios.get(`${API_URL}/document/${documentId}/pages`)
      ]);

      setDocument(docRes.data.document);
      setPages(pagesRes.data.pages || []);
    } catch (error) {
      console.error('Error fetching document pages:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading document...</div>;
  if (!document) return <div className="error">Document not found</div>;

  return (
    <div className="container">
      <Link to={`/patient/${document.patient_id}`} className="back-link">
        ← Back to Patient
      </Link>
      
      <div className="document-header">
        <h2>{document.filename}</h2>
        <div className="document-meta">
          <span>Total Pages: {document.total_pages}</span>
          <span>Status: {document.status}</span>
          <div className="view-toggle">
            <button 
              className={viewMode === 'png' ? 'active' : ''}
              onClick={() => setViewMode('png')}
            >
              PNG (High Quality)
            </button>
            <button 
              className={viewMode === 'webp' ? 'active' : ''}
              onClick={() => setViewMode('webp')}
            >
              WebP (Optimized)
            </button>
          </div>
        </div>
      </div>

      <div className="pages-grid">
        {pages.map(page => (
          <div key={page.page_id} className="page-card">
            <div className="page-header">
              <h4>Page {page.page_number}</h4>
              {page.categories && page.categories.length > 0 && (
                <div className="page-categories">
                  {page.categories.map((cat, idx) => (
                    <span key={idx} className="category-badge" title={cat.reason}>
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="page-image-container">
              <img 
                src={`${API_URL}/image/${viewMode === 'png' ? page.png_s3_key : page.webp_s3_key}`}
                alt={`Page ${page.page_number}`}
                className="page-image"
                loading="lazy"
              />
            </div>
            
            <div className="page-status">
              {page.ai_processed ? '✓ Processed' : '⏳ Processing...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
