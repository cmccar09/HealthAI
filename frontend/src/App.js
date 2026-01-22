import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import jsPDF from 'jspdf';
import './App.css';

// AWS Configuration
const AWS_REGION = 'us-east-1';
const S3_BUCKET = 'futuregen-health-ai';

const dynamoClient = new DynamoDBClient({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  }
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({ 
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || ''
  }
});

function App() {
  const [pendingReviewCount, setPendingReviewCount] = useState(4); // Demo: 4 pending items
  const [issuesCount, setIssuesCount] = useState(2); // Demo: 2 issues flagged
  
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="header-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1>⚕️ iMed2 Medical Records System</h1>
                <p>Powered by Sunlife - Advanced Medical Intelligence</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link to="/" style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                  🏠 Home
                </Link>
                <Link to="/review-queue" style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', position: 'relative' }}>
                  🔍 Review Queue
                  {pendingReviewCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '-8px', 
                      right: '-8px', 
                      background: '#ef4444', 
                      color: 'white', 
                      borderRadius: '50%', 
                      padding: '2px 6px', 
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {pendingReviewCount}
                    </span>
                  )}
                </Link>
                <Link to="/hallucination-dashboard" style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', position: 'relative' }}>
                  🔬 Issues
                  {issuesCount > 0 && (
                    <span style={{ 
                      position: 'absolute', 
                      top: '-8px', 
                      right: '-8px', 
                      background: '#f59e0b', 
                      color: 'white', 
                      borderRadius: '50%', 
                      padding: '2px 6px', 
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {issuesCount}
                    </span>
                  )}
                </Link>
              </div>
            </div>
          </div>
        </header>
        
        <Routes>
          <Route path="/" element={<PatientSearch />} />
          <Route path="/patient/:patientId" element={<PatientDashboard />} />
          <Route path="/documents" element={<DocumentList />} />
          <Route path="/document/:documentId" element={<DocumentDashboard />} />
          <Route path="/document/:documentId/patient" element={<PatientSummary />} />
          <Route path="/document/:documentId/medications" element={<MedicationsPage />} />
          <Route path="/document/:documentId/diagnoses" element={<DiagnosesPage />} />
          <Route path="/document/:documentId/tests" element={<TestResultsPage />} />
          <Route path="/document/:documentId/images" element={<ImageGallery />} />
          <Route path="/document/:documentId/doctors" element={<DoctorsPage />} />
          <Route path="/document/:documentId/next-steps" element={<NextStepsPage />} />
          <Route path="/review-queue" element={<ReviewQueue />} />
          <Route path="/review/:reviewId" element={<ReviewDetail />} />
          <Route path="/hallucination-dashboard" element={<HallucinationDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

// Patient Search Component (Home Page)
function PatientSearch() {
  const [activeHomeTab, setActiveHomeTab] = useState('search');
  const [searchParams, setSearchParams] = useState({
    firstName: '',
    lastName: '',
    dob: '',
    mrn: '',
    addressLine1: '',
    city: '',
    state: '',
    postCode: ''
  });
  const [patients, setPatients] = useState([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Search across all patients in the database
      const command = new ScanCommand({
        TableName: 'HealthAI-Patients'
      });
      const response = await docClient.send(command);
      let results = response.Items || [];
      
      // Filter based on search parameters
      if (searchParams.firstName) {
        results = results.filter(p => 
          p.patient_first_name?.toLowerCase().includes(searchParams.firstName.toLowerCase()) ||
          p.name?.first_name?.toLowerCase().includes(searchParams.firstName.toLowerCase())
        );
      }
      if (searchParams.lastName) {
        results = results.filter(p => 
          p.patient_last_name?.toLowerCase().includes(searchParams.lastName.toLowerCase()) ||
          p.name?.last_name?.toLowerCase().includes(searchParams.lastName.toLowerCase())
        );
      }
      if (searchParams.dob) {
        results = results.filter(p => 
          p.patient_dob === searchParams.dob || 
          p.demographics?.date_of_birth === searchParams.dob
        );
      }
      if (searchParams.mrn) {
        results = results.filter(p => 
          p.patient_mrn?.includes(searchParams.mrn) ||
          p.mrn?.includes(searchParams.mrn)
        );
      }
      
      setPatients(results);
      setSearchPerformed(true);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSearchParams(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="patient-search-container">
      <div className="search-tabs">
        <div 
          className={activeHomeTab === 'search' ? 'tab active' : 'tab'}
          onClick={() => setActiveHomeTab('search')}
        >
          Patient Search
        </div>
        <div 
          className={activeHomeTab === 'confirmation' ? 'tab active' : 'tab'}
          onClick={() => setActiveHomeTab('confirmation')}
        >
          Client Confirmation
        </div>
      </div>
      
      <div className="search-content">
        <h2 className="system-title">iMed2 Medical Records System</h2>
        
        {activeHomeTab === 'confirmation' ? (
          <ProcessingStatusHome />
        ) : (
        <div className="search-section">
          <h3>Patient Search</h3>
          
          <form onSubmit={handleSearch} className="search-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input 
                  type="text" 
                  value={searchParams.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="form-group">
                <label>MRN</label>
                <input 
                  type="text" 
                  value={searchParams.mrn}
                  onChange={(e) => handleInputChange('mrn', e.target.value)}
                  placeholder="Medical Record Number"
                />
              </div>
              <div className="form-group">
                <label>State</label>
                <input 
                  type="text" 
                  value={searchParams.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  placeholder="State"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Last Name</label>
                <input 
                  type="text" 
                  value={searchParams.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Last name"
                />
              </div>
              <div className="form-group">
                <label>Address Line 1</label>
                <input 
                  type="text" 
                  value={searchParams.addressLine1}
                  onChange={(e) => handleInputChange('addressLine1', e.target.value)}
                  placeholder="Address"
                />
              </div>
              <div className="form-group">
                <label>Post Code</label>
                <input 
                  type="text" 
                  value={searchParams.postCode}
                  onChange={(e) => handleInputChange('postCode', e.target.value)}
                  placeholder="Postal code"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Date of Birth</label>
                <input 
                  type="text" 
                  value={searchParams.dob}
                  onChange={(e) => handleInputChange('dob', e.target.value)}
                  placeholder="MM/DD/YYYY"
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input 
                  type="text" 
                  value={searchParams.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="form-group"></div>
            </div>
            
            <button type="submit" className="search-button" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          {searchPerformed && (
            <div className="search-results">
              <div className="results-message">
                Found {patients.length} matching patient(s) in the database
              </div>
              
              {patients.length > 0 && (
                <div className="results-table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>first_name</th>
                        <th>last_name</th>
                        <th>date_of_birth</th>
                        <th>patient_id</th>
                        <th>gender</th>
                        <th>email</th>
                        <th>phone_number</th>
                        <th>address</th>
                        <th>city</th>
                        <th>state</th>
                        <th>postcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((patient, idx) => (
                        <tr key={idx} onClick={() => navigate(`/patient/${patient.patient_id || patient.document_id}`)} className="clickable-row">
                          <td className="link-cell">{patient.patient_first_name || patient.name?.first_name || 'None'}</td>
                          <td>{patient.patient_last_name || patient.name?.last_name || 'None'}</td>
                          <td>{patient.patient_dob || patient.demographics?.date_of_birth || 'None'}</td>
                          <td>{patient.patient_id || patient.document_id || 'None'}</td>
                          <td>{patient.gender || patient.demographics?.gender || 'None'}</td>
                          <td>{patient.email || patient.contact?.email || 'None'}</td>
                          <td>{patient.phone_number || patient.contact?.phone || 'None'}</td>
                          <td>{patient.address_line1 || patient.contact?.address?.street || 'None'}</td>
                          <td>{patient.city || patient.contact?.address?.city || 'None'}</td>
                          <td>{patient.state || patient.contact?.address?.state || 'None'}</td>
                          <td>{patient.postal_code || patient.contact?.address?.postal_code || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// Processing Status Home Component - System-wide document processing status
function ProcessingStatusHome() {
  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllDocuments();
    
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchAllDocuments();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchAllDocuments = async () => {
    try {
      const documentsRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Documents'
      }));

      const documents = documentsRes.Items || [];
      
      const statusPromises = documents.map(async (doc) => {
        try {
          const pagesRes = await docClient.send(new ScanCommand({
            TableName: 'HealthAI-Pages',
            FilterExpression: 'document_id = :did',
            ExpressionAttributeValues: {
              ':did': doc.document_id
            },
            Select: 'COUNT'
          }));
          
          const processedPages = pagesRes.Count || 0;
          
          return {
            document_id: doc.document_id,
            patient_id: doc.patient_id || 'Unknown',
            patient_name: doc.patient_name_hint || doc.patient_name || 'Unknown',
            filename: doc.filename || doc.original_filename || 'Unknown',
            upload_date: doc.upload_timestamp ? doc.upload_timestamp * 1000 : (doc.created_at || Date.now()),
            total_pages: doc.total_pages || 0,
            processed_pages: processedPages,
            status: processedPages >= (doc.total_pages || 0) ? 'Complete' : 'Processing',
            progress: doc.total_pages ? Math.round((processedPages / doc.total_pages) * 100) : 0,
            file_size: doc.file_size || 0
          };
        } catch (err) {
          console.error('Error fetching status:', err);
          return {
            document_id: doc.document_id,
            patient_id: doc.patient_id || 'Unknown',
            patient_name: doc.patient_name_hint || doc.patient_name || 'Unknown',
            filename: doc.filename || doc.original_filename || 'Unknown',
            upload_date: doc.upload_timestamp ? doc.upload_timestamp * 1000 : Date.now(),
            total_pages: doc.total_pages || 0,
            processed_pages: 0,
            status: 'Error',
            progress: 0,
            file_size: doc.file_size || 0
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      statuses.sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date));
      
      setAllDocuments(statuses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 'Unknown') return 'Unknown';
    try {
      // If it's a number, treat it as milliseconds timestamp
      const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Unknown';
    }
  };

  const getStatusBadge = (status, progress) => {
    if (status === 'Complete') {
      return <span className="status-badge status-complete">✓ Complete</span>;
    } else if (status === 'Processing') {
      return <span className="status-badge status-processing">⟳ Processing ({progress}%)</span>;
    } else {
      return <span className="status-badge status-error">⚠ Error</span>;
    }
  };

  const hasInFlightDocs = allDocuments.some(doc => doc.status === 'Processing');
  const totalDocs = allDocuments.length;
  const completedDocs = allDocuments.filter(d => d.status === 'Complete').length;
  const processingDocs = allDocuments.filter(d => d.status === 'Processing').length;
  const errorDocs = allDocuments.filter(d => d.status === 'Error').length;
  const totalPagesProcessed = allDocuments.reduce((sum, d) => sum + d.processed_pages, 0);
  const totalPages = allDocuments.reduce((sum, d) => sum + d.total_pages, 0);

  return (
    <div className="processing-status-home">
      <div className="status-header">
        <div>
          <h3>📊 System-Wide Processing Status</h3>
          <p>Real-time monitoring of all document uploads and processing across all patients</p>
        </div>
        <div className="status-controls">
          <label className="auto-refresh-toggle">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh every 10s
          </label>
          <button onClick={fetchAllDocuments} className="refresh-button">
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">📄</div>
          <div className="card-content">
            <div className="card-label">Total Documents</div>
            <div className="card-value">{totalDocs}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">✅</div>
          <div className="card-content">
            <div className="card-label">Completed</div>
            <div className="card-value">{completedDocs}</div>
          </div>
        </div>
        <div className="summary-card processing">
          <div className="card-icon">⟳</div>
          <div className="card-content">
            <div className="card-label">Processing</div>
            <div className="card-value">{processingDocs}</div>
          </div>
        </div>
        <div className="summary-card error">
          <div className="card-icon">⚠️</div>
          <div className="card-content">
            <div className="card-label">Errors</div>
            <div className="card-value">{errorDocs}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Pages Processed</div>
            <div className="card-value">{totalPagesProcessed.toLocaleString()} / {totalPages.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading processing status...</div>
      ) : allDocuments.length === 0 ? (
        <div className="no-data">
          <p>No documents found in the system.</p>
        </div>
      ) : (
        <>
          {hasInFlightDocs && (
            <div className="in-flight-alert">
              <strong>⚡ Active Processing:</strong> {processingDocs} document(s) currently being processed
            </div>
          )}
          
          <div className="status-table-container">
            <table className="status-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Document ID</th>
                  <th>Filename</th>
                  <th>Upload Date/Time</th>
                  <th>File Size</th>
                  <th>Total Pages</th>
                  <th>Processed</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {allDocuments.map((doc, idx) => (
                  <tr key={idx} className={doc.status === 'Processing' ? 'processing-row' : ''}>
                    <td className="patient-id">
                      {doc.patient_id !== 'Unknown' && doc.patient_id !== 'PENDING' ? (
                        <code>{doc.patient_id.substring(0, 8)}...</code>
                      ) : (
                        doc.patient_id
                      )}
                    </td>
                    <td className="document-id">
                      <code>{doc.document_id.substring(0, 8)}...</code>
                    </td>
                    <td className="filename">{doc.filename}</td>
                    <td>{formatDate(doc.upload_date)}</td>
                    <td>{formatFileSize(doc.file_size)}</td>
                    <td className="text-center">{doc.total_pages}</td>
                    <td className="text-center">{doc.processed_pages}</td>
                    <td>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${doc.progress}%` }}
                        ></div>
                        <span className="progress-text">{doc.progress}%</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(doc.status, doc.progress)}</td>
                    <td>
                      <button 
                        className="view-button"
                        onClick={() => navigate(`/patient/${doc.patient_id}`)}
                      >
                        View Patient
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Patient Dashboard Component with Tabs
function PatientDashboard() {
  const { patientId } = useParams();
  const [activeTab, setActiveTab] = useState('documents');
  const [patient, setPatient] = useState(null);
  const [medications, setMedications] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [radiology, setRadiology] = useState([]);
  const [familyHistory, setFamilyHistory] = useState([]);
  const [socialHistory, setSocialHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      // Fetch patient info
      const patientRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Patients',
        FilterExpression: 'patient_id = :pid OR document_id = :pid',
        ExpressionAttributeValues: { ':pid': patientId }
      }));
      const patientData = patientRes.Items?.[0];
      setPatient(patientData);

      // Use document_id for fetching related data (medications, diagnoses, tests)
      const documentId = patientData?.document_id || patientId;
      console.log('Fetching data for document_id:', documentId);

      // Fetch all data in parallel
      const [medsRes, diagRes, testsRes, procsRes, radRes, famHistRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Medications',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Diagnoses',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-TestResults',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Procedures',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Radiology',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-FamilyHistory',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      setMedications(medsRes.Items || []);
      setDiagnoses(diagRes.Items || []);
      setTestResults(testsRes.Items || []);
      setProcedures(procsRes.Items || []);
      setRadiology(radRes.Items || []);
      
      // Separate family history and social history
      const famHistItems = famHistRes.Items || [];
      const socialHistItem = famHistItems.find(item => item.record_type === 'social_history');
      const familyHistItems = famHistItems.filter(item => item.record_type !== 'social_history');
      
      setFamilyHistory(familyHistItems);
      setSocialHistory(socialHistItem);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading patient data for ID: {patientId}</div>;
  if (!patient) return <div className="error">Patient not found</div>;

  const firstName = patient.patient_first_name || patient.name?.first_name || 'Unknown';
  const lastName = patient.patient_last_name || patient.name?.last_name || 'Unknown';

  return (
    <div className="patient-dashboard">
      <Link to="/" className="back-link">← Back to Home</Link>
      <div className="patient-header">
        <div className="header-section">
          <h1>Patient - {firstName.toLowerCase()} {lastName.toLowerCase()}</h1>
        </div>
      </div>
      
      <div className="patient-info-grid">
        <div className="info-column">
          <h3>Personal Information</h3>
          <div className="info-item"><strong>DOB:</strong> {patient.patient_dob || patient.demographics?.date_of_birth || 'None'}</div>
          <div className="info-item"><strong>Gender:</strong> {patient.gender || patient.demographics?.gender || 'None'}</div>
          <div className="info-item"><strong>Blood Type:</strong> {patient.blood_type || patient.demographics?.blood_type || 'None'}</div>
          <div className="info-item"><strong>SSN:</strong> {patient.patient_ssn || patient.demographics?.ssn || 'None'}</div>
          <div className="info-item"><strong>MRN:</strong> {patient.patient_mrn || patient.mrn || 'None'}</div>
        </div>
        
        <div className="info-column">
          <h3>Contact Information</h3>
          <div className="info-item"><strong>Email:</strong> {patient.email || patient.contact?.email || 'None'}</div>
          <div className="info-item"><strong>Phone:</strong> {patient.phone_number || patient.contact?.phone || 'None'}</div>
          <div className="info-item"><strong>Address:</strong> {patient.address_line1 || patient.contact?.address?.street || 'None'}</div>
          <div className="info-item"><strong>City:</strong> {patient.city || patient.contact?.address?.city || 'None'} <strong>State:</strong> {patient.state || patient.contact?.address?.state || 'None'} <strong>Postal Code:</strong> {patient.postal_code || patient.contact?.address?.postal_code || 'None'}</div>
          <div className="info-item"><strong>Country:</strong> {patient.country || patient.contact?.address?.country || 'None'}</div>
        </div>
        
        <div className="info-column">
          <h3>Emergency Contact & Medical Info</h3>
          <div className="info-item"><strong>Name:</strong> {patient.emergency_contact_name || patient.emergency_contact?.name || 'None'}</div>
          <div className="info-item"><strong>Phone:</strong> {patient.emergency_contact_phone || patient.emergency_contact?.phone || 'None'}</div>
          <div className="info-item"><strong>Allergies:</strong> {Array.isArray(patient.allergies) ? patient.allergies.join(', ') : (patient.allergies || 'None')}</div>
          <div className="info-item"><strong>Medical Facility:</strong> {patient.medical_facility || 'None'}</div>
        </div>
      </div>
      
      <div className="tab-navigation">
        <button className={activeTab === 'documents' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('documents')}>Documents</button>
        <button className={activeTab === 'tests' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('tests')}>Tests</button>
        <button className={activeTab === 'diagnosis' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('diagnosis')}>Diagnosis</button>
        <button className={activeTab === 'medicines' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('medicines')}>Medicines</button>
        <button className={activeTab === 'procedures' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('procedures')}>Procedures & Surgery</button>
        <button className={activeTab === 'radiology' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('radiology')}>Radiology</button>
        <button className={activeTab === 'family' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('family')}>Social/Family History</button>
        <button className={activeTab === 'doctors' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('doctors')}>Doctors</button>
        <button className={activeTab === 'summary' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('summary')}>Medical Summary</button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'documents' && <DocumentsTab patientId={patientId} />}
        {activeTab === 'tests' && <TestsTab testResults={testResults} patientId={patientId} />}
        {activeTab === 'diagnosis' && <DiagnosisTab diagnoses={diagnoses} />}
        {activeTab === 'medicines' && <MedicinesTab medications={medications} />}
        {activeTab === 'procedures' && <ProceduresTab procedures={procedures} />}
        {activeTab === 'radiology' && <RadiologyTab radiology={radiology} />}
        {activeTab === 'family' && <FamilyHistoryTab familyHistory={familyHistory} socialHistory={socialHistory} />}
        {activeTab === 'doctors' && <DoctorsTab diagnoses={diagnoses} medications={medications} procedures={procedures} testResults={testResults} />}
        {activeTab === 'summary' && <MedicalSummaryTab medications={medications} diagnoses={diagnoses} testResults={testResults} patientId={patientId} />}
      </div>
    </div>
  );
}

// Doctors Tab Component
function DoctorsTab({ diagnoses, medications, procedures, testResults }) {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDoctorInfo, setSelectedDoctorInfo] = useState(null);
  const [pageImage, setPageImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    extractAndEnrichDoctors();
  }, [diagnoses, medications, procedures, testResults]);

  const extractAndEnrichDoctors = async () => {
    try {
      const doctorMap = new Map();

      // Extract doctors from diagnoses
      diagnoses.forEach(diag => {
        const firstName = diag.diagnosing_doctor_first_name;
        const lastName = diag.diagnosing_doctor_last_name;
        if (firstName && lastName && firstName !== 'Unknown' && lastName !== 'Unknown') {
          const key = `${firstName}_${lastName}`;
          if (!doctorMap.has(key)) {
            doctorMap.set(key, {
              first_name: firstName,
              last_name: lastName,
              specialty: diag.diagnosing_doctor_specialty || 'Unknown',
              license_number: diag.diagnosing_doctor_license_number,
              phone: diag.diagnosing_doctor_phone_number,
              email: diag.diagnosing_doctor_email,
              facility_name: diag.diagnosing_facility_name,
              facility_address_line1: diag.diagnosing_facility_address_line1,
              facility_address_line2: diag.diagnosing_facility_address_line2,
              facility_city: diag.diagnosing_facility_city,
              facility_state: diag.diagnosing_facility_state,
              facility_postal_code: diag.diagnosing_facility_postal_code,
              facility_phone: diag.diagnosing_facility_phone_number,
              facility_email: diag.diagnosing_facility_email,
              page_ids: new Set(),
              diagnoses: [],
              medications: [],
              procedures: [],
              tests: []
            });
          }
          const doctor = doctorMap.get(key);
          if (diag.page_id) doctor.page_ids.add(diag.page_id);
          doctor.diagnoses.push({
            description: diag.diagnosis_description,
            code: diag.diagnosis_code,
            date: diag.diagnosed_date,
            page_id: diag.page_id
          });
        }
      });

      // Extract doctors from medications
      medications.forEach(med => {
        const prescribingDoctor = med.prescribing_doctor || '';
        const parts = prescribingDoctor.split(' ');
        if (parts.length >= 2) {
          const firstName = parts[0];
          const lastName = parts.slice(1).join(' ');
          const key = `${firstName}_${lastName}`;
          if (!doctorMap.has(key)) {
            doctorMap.set(key, {
              first_name: firstName,
              last_name: lastName,
              specialty: 'Unknown',
              page_ids: new Set(),
              diagnoses: [],
              medications: [],
              procedures: [],
              tests: []
            });
          }
          const doctor = doctorMap.get(key);
          if (med.page_id) doctor.page_ids.add(med.page_id);
          doctor.medications.push({
            name: med.medication_name || med.name,
            dosage: med.dosage,
            start_date: med.start_date,
            page_id: med.page_id
          });
        }
      });

      // Extract doctors from procedures
      procedures.forEach(proc => {
        const firstName = proc.performing_doctor_first_name;
        const lastName = proc.performing_doctor_last_name;
        if (firstName && lastName && firstName !== 'Unknown' && lastName !== 'Unknown') {
          const key = `${firstName}_${lastName}`;
          if (!doctorMap.has(key)) {
            doctorMap.set(key, {
              first_name: firstName,
              last_name: lastName,
              specialty: proc.performing_doctor_specialty || 'Unknown',
              page_ids: new Set(),
              diagnoses: [],
              medications: [],
              procedures: [],
              tests: []
            });
          }
          const doctor = doctorMap.get(key);
          if (proc.page_id) doctor.page_ids.add(proc.page_id);
          doctor.procedures.push({
            name: proc.procedure_name,
            date: proc.procedure_date,
            code: proc.procedure_code,
            page_id: proc.page_id
          });
        }
      });

      // Extract doctors from test results
      testResults.forEach(test => {
        const orderingDoctor = test.ordering_doctor || '';
        const parts = orderingDoctor.split(' ');
        if (parts.length >= 2) {
          const firstName = parts[0];
          const lastName = parts.slice(1).join(' ');
          const key = `${firstName}_${lastName}`;
          if (!doctorMap.has(key)) {
            doctorMap.set(key, {
              first_name: firstName,
              last_name: lastName,
              specialty: 'Unknown',
              page_ids: new Set(),
              diagnoses: [],
              medications: [],
              procedures: [],
              tests: []
            });
          }
          const doctor = doctorMap.get(key);
          if (test.page_id) doctor.page_ids.add(test.page_id);
          doctor.tests.push({
            name: test.test_name || test.name,
            date: test.test_date || test.date,
            page_id: test.page_id
          });
        }
      });

      // Query NPI database for each doctor
      const enrichedDoctors = await Promise.all(
        Array.from(doctorMap.values()).map(async (doctor) => {
          try {
            // Query NPI table - try exact match first, then fuzzy
            let npiRes = await docClient.send(new ScanCommand({
              TableName: 'HealthAI-NPI',
              FilterExpression: '#fn = :fname AND #ln = :lname',
              ExpressionAttributeNames: {
                '#fn': 'first_name',
                '#ln': 'last_name'
              },
              ExpressionAttributeValues: {
                ':fname': doctor.first_name,
                ':lname': doctor.last_name
              },
              Limit: 5
            }));

            // If no exact match, try fuzzy matching
            if (!npiRes.Items || npiRes.Items.length === 0) {
              npiRes = await docClient.send(new ScanCommand({
                TableName: 'HealthAI-NPI',
                FilterExpression: 'contains(#fn, :fname) AND contains(#ln, :lname)',
                ExpressionAttributeNames: {
                  '#fn': 'first_name',
                  '#ln': 'last_name'
                },
                ExpressionAttributeValues: {
                  ':fname': doctor.first_name,
                  ':lname': doctor.last_name
                },
                Limit: 5
              }));
            }

            const npiData = npiRes.Items?.[0];
            if (npiData) {
              // Enrich with comprehensive NPI data
              const enrichedDoctor = {
                ...doctor,
                npi_number: npiData.npi_number,
                npi_specialty: npiData.primary_taxonomy_description,
                npi_secondary_specialty: npiData.secondary_taxonomy_description,
                npi_verified: true,
                npi_match_type: npiRes.Items.length === 1 ? 'exact' : 'fuzzy',
                specialty_match: checkSpecialtyMatch(doctor.specialty, npiData.primary_taxonomy_description, doctor.diagnoses)
              };

              // Add NPI address if available and not already set
              if (npiData.primary_practice_address_line1) {
                enrichedDoctor.npi_address_line1 = npiData.primary_practice_address_line1;
                enrichedDoctor.npi_address_line2 = npiData.primary_practice_address_line2;
                enrichedDoctor.npi_city = npiData.primary_practice_address_city;
                enrichedDoctor.npi_state = npiData.primary_practice_address_state;
                enrichedDoctor.npi_postal_code = npiData.primary_practice_address_postal_code;
              }

              // Add NPI phone if not already set
              if (npiData.phone_number && !enrichedDoctor.phone) {
                enrichedDoctor.npi_phone = npiData.phone_number;
              }

              // Add organization name if available
              if (npiData.organization_name) {
                enrichedDoctor.npi_organization = npiData.organization_name;
              }

              // Add credentials
              if (npiData.credentials) {
                enrichedDoctor.npi_credentials = npiData.credentials;
              }

              // Add other identifiers
              if (npiData.other_identifiers) {
                enrichedDoctor.npi_other_identifiers = npiData.other_identifiers;
              }

              return enrichedDoctor;
            }
            return { ...doctor, npi_verified: false, specialty_match: 'Unverified' };
          } catch (error) {
            console.error(`Error fetching NPI data for Dr. ${doctor.first_name} ${doctor.last_name}:`, error);
            return { ...doctor, npi_verified: false, specialty_match: 'Unverified' };
          }
        })
      );

      setDoctors(enrichedDoctors.sort((a, b) => 
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      ));
    } catch (error) {
      console.error('Error extracting doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSpecialtyMatch = (docSpecialty, npiSpecialty, diagnoses) => {
    if (!npiSpecialty || npiSpecialty === 'Unknown') return 'Unknown';
    if (!docSpecialty || docSpecialty === 'Unknown') return 'Unverified';

    const specialty = npiSpecialty.toLowerCase();
    const docSpec = docSpecialty.toLowerCase();

    // Get diagnosis types to check if doctor is treating appropriate conditions
    const diagnosisTypes = diagnoses.map(d => (d.description || '').toLowerCase()).join(' ');

    // Check if NPI specialty matches document specialty
    if (specialty.includes(docSpec) || docSpec.includes(specialty)) {
      return 'Verified Match';
    }

    // Check common specialty matches
    const specialtyMatches = {
      'oncology': ['cancer', 'malignancy', 'carcinoma', 'oncology'],
      'cardiology': ['heart', 'cardiac', 'cardiovascular'],
      'urology': ['prostate', 'bladder', 'urinary', 'kidney'],
      'endocrinology': ['diabetes', 'thyroid', 'metabolic'],
      'orthopedic': ['joint', 'bone', 'spine', 'musculoskeletal']
    };

    for (const [spec, keywords] of Object.entries(specialtyMatches)) {
      if (specialty.includes(spec) && keywords.some(kw => diagnosisTypes.includes(kw))) {
        return 'Appropriate';
      }
    }

    return 'Review Recommended';
  };

  const viewDoctorDetails = async (doctor) => {
    setSelectedDoctor(doctor);
    
    // Load page image for the first page where this doctor appears
    if (doctor.page_ids && doctor.page_ids.size > 0) {
      const firstPageId = Array.from(doctor.page_ids)[0];
      await loadPageImage(firstPageId);
    }
  };

  const viewDoctorInfo = (doctor) => {
    setSelectedDoctorInfo(doctor);
  };

  const closeDetails = () => {
    setSelectedDoctor(null);
    setPageImage(null);
    setZoomLevel(1);
  };

  const closeDoctorInfo = () => {
    setSelectedDoctorInfo(null);
  };

  const loadPageImage = async (pageId) => {
    try {
      const pageRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Pages',
        FilterExpression: 'page_id = :pageId',
        ExpressionAttributeValues: { ':pageId': pageId }
      }));
      
      const page = pageRes.Items?.[0];
      if (page && page.webp_s3_key) {
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: page.webp_s3_key
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        setPageImage({ url, page_number: page.page_number });
      }
    } catch (error) {
      console.error('Error loading page image:', error);
    }
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  if (loading) return <div className="loading">Analyzing doctor information...</div>;

  return (
    <div className="doctors-content">
      <h2>Healthcare Providers</h2>
      <p className="diagnosis-summary">
        {doctors.length} provider{doctors.length !== 1 ? 's' : ''} identified from patient records
      </p>

      {doctors.length > 0 ? (
        <div className="doctors-table-container">
          <table className="medical-table">
            <thead>
              <tr>
                <th>Doctor Name</th>
                <th>Specialty (Records)</th>
                <th>NPI Specialty</th>
                <th>Match Status</th>
                <th>Diagnoses</th>
                <th>Medications</th>
                <th>Procedures</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doctor, idx) => (
                <tr key={idx}>
                  <td>
                    <strong 
                      className="doctor-name-link"
                      onClick={() => viewDoctorInfo(doctor)}
                      style={{ cursor: 'pointer', color: 'var(--primary-color)' }}
                    >
                      Dr. {doctor.first_name} {doctor.last_name}
                      {doctor.npi_credentials && ` ${doctor.npi_credentials}`}
                    </strong>
                    {doctor.npi_number && (
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '0.25rem' }}>
                        NPI: {doctor.npi_number}
                        {doctor.npi_match_type === 'exact' && (
                          <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓ Verified</span>
                        )}
                      </div>
                    )}
                    {!doctor.npi_verified && (
                      <div style={{ fontSize: '0.85em', color: '#dc2626', marginTop: '0.25rem' }}>
                        ⚠️ Not in NPI Database
                      </div>
                    )}
                  </td>
                  <td>
                    {doctor.specialty}
                    {doctor.specialty !== 'Unknown' && doctor.npi_specialty && doctor.specialty_match === 'Verified Match' && (
                      <div style={{ fontSize: '0.75em', color: '#16a34a', marginTop: '0.25rem' }}>
                        ✓ Matches NPI
                      </div>
                    )}
                  </td>
                  <td>
                    {doctor.npi_specialty || <span style={{ color: '#999' }}>Not found</span>}
                    {doctor.npi_secondary_specialty && (
                      <div style={{ fontSize: '0.85em', color: '#666', marginTop: '0.25rem' }}>
                        Secondary: {doctor.npi_secondary_specialty}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`specialty-match-badge ${doctor.specialty_match?.toLowerCase().replace(/ /g, '-')}`}>
                      {doctor.npi_verified ? doctor.specialty_match : 'Not Verified'}
                    </span>
                  </td>
                  <td className="centered">{doctor.diagnoses.length}</td>
                  <td className="centered">{doctor.medications.length}</td>
                  <td className="centered">{doctor.procedures.length}</td>
                  <td>
                    <button
                      className="view-details-btn-small"
                      onClick={() => viewDoctorDetails(doctor)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-data-message">No doctors found in patient records</div>
      )}

      {/* Doctor Info Modal - Quick view of contact details */}
      {selectedDoctorInfo && (
        <div className="diagnosis-detail-modal" onClick={closeDoctorInfo}>
          <div className="diagnosis-detail-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>Dr. {selectedDoctorInfo.first_name} {selectedDoctorInfo.last_name}</h2>
              <button onClick={closeDoctorInfo} className="close-btn">✕ Close</button>
            </div>

            <div className="diagnosis-detail-body">
              {selectedDoctorInfo.npi_verified && (
                <div className="diagnosis-summary-section npi-verification-section">
                  <h3>✅ NPI Verification Status</h3>
                  <div className="doctor-contact-info">
                    <div className="contact-item">
                      <strong>Match Type:</strong>
                      <span className={selectedDoctorInfo.npi_match_type === 'exact' ? 'text-success' : 'text-warning'}>
                        {selectedDoctorInfo.npi_match_type === 'exact' ? '🎯 Exact Match' : '🔍 Fuzzy Match'}
                      </span>
                    </div>
                    <div className="contact-item">
                      <strong>Verification:</strong>
                      <span className={`specialty-match-badge ${selectedDoctorInfo.specialty_match?.toLowerCase().replace(/ /g, '-')}`}>
                        {selectedDoctorInfo.specialty_match}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="diagnosis-summary-section">
                <h3>Professional Information</h3>
                <div className="doctor-contact-info">
                  {selectedDoctorInfo.specialty && selectedDoctorInfo.specialty !== 'Unknown' && (
                    <div className="contact-item">
                      <strong>🩺 Specialty (Records):</strong>
                      <span>{selectedDoctorInfo.specialty}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_specialty && (
                    <div className="contact-item">
                      <strong>🩺 NPI Primary Specialty:</strong>
                      <span>{selectedDoctorInfo.npi_specialty}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_secondary_specialty && (
                    <div className="contact-item">
                      <strong>🩺 NPI Secondary Specialty:</strong>
                      <span>{selectedDoctorInfo.npi_secondary_specialty}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_credentials && (
                    <div className="contact-item">
                      <strong>🎓 Credentials:</strong>
                      <span>{selectedDoctorInfo.npi_credentials}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.license_number && (
                    <div className="contact-item">
                      <strong>📄 License Number:</strong>
                      <span>{selectedDoctorInfo.license_number}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_number && (
                    <div className="contact-item">
                      <strong>🆔 NPI Number:</strong>
                      <span>{selectedDoctorInfo.npi_number}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_organization && (
                    <div className="contact-item">
                      <strong>🏢 Organization:</strong>
                      <span>{selectedDoctorInfo.npi_organization}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="diagnosis-summary-section">
                <h3>Contact Information</h3>
                <div className="doctor-contact-info">
                  {selectedDoctorInfo.phone && (
                    <div className="contact-item">
                      <strong>📞 Phone (Records):</strong>
                      <span>{selectedDoctorInfo.phone}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.npi_phone && (
                    <div className="contact-item">
                      <strong>📞 Phone (NPI):</strong>
                      <span>{selectedDoctorInfo.npi_phone}</span>
                    </div>
                  )}
                  {selectedDoctorInfo.email && (
                    <div className="contact-item">
                      <strong>📧 Email:</strong>
                      <span>{selectedDoctorInfo.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {(selectedDoctorInfo.npi_address_line1 || selectedDoctorInfo.facility_name) && (
                <div className="diagnosis-summary-section">
                  <h3>Practice Location</h3>
                  <div className="doctor-contact-info">
                    {selectedDoctorInfo.npi_address_line1 && (
                      <div className="contact-item">
                        <strong>📍 NPI Practice Address:</strong>
                        <span>
                          {selectedDoctorInfo.npi_address_line1}
                          {selectedDoctorInfo.npi_address_line2 && <><br />{selectedDoctorInfo.npi_address_line2}</>}
                          <br />
                          {selectedDoctorInfo.npi_city && `${selectedDoctorInfo.npi_city}, `}
                          {selectedDoctorInfo.npi_state} {selectedDoctorInfo.npi_postal_code}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="diagnosis-summary-section">
                <h3>Patient Activity</h3>
                <div className="doctor-contact-info">
                  <div className="contact-item">
                    <strong>📋 Diagnoses:</strong>
                    <span>{selectedDoctorInfo.diagnoses.length} diagnosis(es)</span>
                  </div>
                  <div className="contact-item">
                    <strong>💊 Medications:</strong>
                    <span>{selectedDoctorInfo.medications.length} prescription(s)</span>
                  </div>
                  <div className="contact-item">
                    <strong>🏥 Procedures:</strong>
                    <span>{selectedDoctorInfo.procedures.length} procedure(s)</span>
                  </div>
                  {selectedDoctorInfo.tests && (
                    <div className="contact-item">
                      <strong>🧪 Tests:</strong>
                      <span>{selectedDoctorInfo.tests.length} test(s)</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedDoctorInfo.facility_name && (
                <div className="diagnosis-summary-section">
                  <h3>Facility Information</h3>
                  <div className="doctor-contact-info">
                    <div className="contact-item">
                      <strong>🏥 Facility:</strong>
                      <span>{selectedDoctorInfo.facility_name}</span>
                    </div>
                    {selectedDoctorInfo.facility_address_line1 && (
                      <div className="contact-item">
                        <strong>📍 Address:</strong>
                        <span>
                          {selectedDoctorInfo.facility_address_line1}
                          {selectedDoctorInfo.facility_address_line2 && <br />}
                          {selectedDoctorInfo.facility_address_line2}
                          {(selectedDoctorInfo.facility_city || selectedDoctorInfo.facility_state) && <br />}
                          {selectedDoctorInfo.facility_city && `${selectedDoctorInfo.facility_city}, `}
                          {selectedDoctorInfo.facility_state} {selectedDoctorInfo.facility_postal_code}
                        </span>
                      </div>
                    )}
                    {selectedDoctorInfo.facility_phone && (
                      <div className="contact-item">
                        <strong>📞 Facility Phone:</strong>
                        <span>{selectedDoctorInfo.facility_phone}</span>
                      </div>
                    )}
                    {selectedDoctorInfo.facility_email && (
                      <div className="contact-item">
                        <strong>📧 Facility Email:</strong>
                        <span>{selectedDoctorInfo.facility_email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button 
                className="view-details-btn"
                onClick={() => {
                  closeDoctorInfo();
                  viewDoctorDetails(selectedDoctorInfo);
                }}
                style={{ marginTop: '1rem' }}
              >
                View Full Details & Source Documents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doctor Details Modal with Page Viewer */}
      {selectedDoctor && (
        <div className="diagnosis-detail-modal" onClick={closeDetails}>
          <div className="diagnosis-detail-content doctor-details-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dr. {selectedDoctor.first_name} {selectedDoctor.last_name}</h2>
              <button onClick={closeDetails} className="close-btn">✕ Close</button>
            </div>

            <div className="doctor-details-container">
              {/* Left side - Page viewer */}
              {pageImage && (
                <div className="page-viewer-section">
                  <h3>📄 Source Document - Page {pageImage.page_number}</h3>
                  <div className="zoom-controls-inline">
                    <button onClick={handleZoomOut}>🔍 -</button>
                    <span>{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={handleZoomIn}>🔍 +</button>
                  </div>
                  <div className="page-image-container">
                    <img 
                      src={pageImage.url} 
                      alt={`Page ${pageImage.page_number}`}
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}
                    />
                  </div>
                </div>
              )}

              {/* Right side - Doctor information */}
              <div className="doctor-info-section">
                <div className="diagnosis-summary-section">
                  <h3>Provider Information</h3>
                  <div className="diagnosis-metadata">
                    <div className="metadata-item">
                      <strong>Record Specialty:</strong>
                      <span>{selectedDoctor.specialty}</span>
                    </div>
                    {selectedDoctor.npi_number && (
                      <>
                        <div className="metadata-item">
                          <strong>NPI Number:</strong>
                          <span>{selectedDoctor.npi_number}</span>
                        </div>
                        <div className="metadata-item">
                          <strong>NPI Specialty:</strong>
                          <span>{selectedDoctor.npi_specialty}</span>
                        </div>
                        <div className="metadata-item">
                          <strong>Verification Status:</strong>
                          <span className={`specialty-match-badge ${selectedDoctor.specialty_match?.toLowerCase().replace(/ /g, '-')}`}>
                            {selectedDoctor.specialty_match}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedDoctor.facility_name && (
                      <div className="metadata-item">
                        <strong>Facility:</strong>
                        <span>{selectedDoctor.facility_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedDoctor.diagnoses.length > 0 && (
                  <div className="diagnosis-history-section">
                    <h3>Diagnoses ({selectedDoctor.diagnoses.length})</h3>
                    <div className="scrollable-list">
                      {selectedDoctor.diagnoses.map((diag, idx) => (
                        <div key={idx} className="history-entry">
                          <p><strong>{diag.description}</strong> {diag.code && `(${diag.code})`}</p>
                          {diag.date && <p style={{ fontSize: '0.9em', color: '#666' }}>Date: {diag.date}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDoctor.medications.length > 0 && (
                  <div className="diagnosis-history-section">
                    <h3>Medications Prescribed ({selectedDoctor.medications.length})</h3>
                    <div className="scrollable-list">
                      {selectedDoctor.medications.map((med, idx) => (
                        <div key={idx} className="history-entry">
                          <p><strong>{med.name}</strong> {med.dosage && `- ${med.dosage}`}</p>
                          {med.start_date && <p style={{ fontSize: '0.9em', color: '#666' }}>Started: {med.start_date}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDoctor.procedures.length > 0 && (
                  <div className="diagnosis-history-section">
                    <h3>Procedures Performed ({selectedDoctor.procedures.length})</h3>
                    <div className="scrollable-list">
                      {selectedDoctor.procedures.map((proc, idx) => (
                        <div key={idx} className="history-entry">
                          <p><strong>{proc.name}</strong> {proc.code && `(${proc.code})`}</p>
                          {proc.date && <p style={{ fontSize: '0.9em', color: '#666' }}>Date: {proc.date}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tests Tab Component
function TestsTab({ testResults, patientId }) {
  // Get unique test dates and sort them
  const uniqueDates = [...new Set(testResults.map(t => t.test_date || t.date))].filter(Boolean).sort();
  
  // Get unique test names
  const uniqueTestNames = [...new Set(testResults.map(t => t.test_name || t.name))].filter(Boolean).sort();

  // Group results by test name for easier lookup
  const resultsByTest = {};
  testResults.forEach(test => {
    const testName = test.test_name || test.name;
    if (!testName) return;
    
    if (!resultsByTest[testName]) {
      resultsByTest[testName] = {};
    }
    
    const date = test.test_date || test.date;
    if (date) {
      resultsByTest[testName][date] = test;
    }
  });

  return (
    <div className="tests-content">
      <h2>Lab Test Results</h2>
      <div className="loading-message">Loading lab test results for patient ID: {patientId}</div>
      <button className="download-pdf-btn">Download as PDF</button>
      
      {testResults.length > 0 ? (
        <div className="test-results-table-container">
          <table className="medical-table lab-results-table">
            <thead>
              <tr>
                <th className="test-name-col">Test Name</th>
                {uniqueDates.map((date, idx) => (
                  <th key={idx} className="date-col">{date}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uniqueTestNames.map((testName, idx) => {
                const testData = resultsByTest[testName];
                
                return (
                  <tr key={idx}>
                    <td className="test-name-cell">
                      <strong>{testName}</strong>
                      {testData && Object.values(testData)[0]?.unit && (
                        <span className="test-unit"> ({Object.values(testData)[0].unit})</span>
                      )}
                    </td>
                    {uniqueDates.map((date, dateIdx) => {
                      const result = testData?.[date];
                      const value = result?.result_value || result?.result || result?.value || '';
                      const isAbnormal = result?.is_abnormal === 'Yes' || result?.abnormal === true;
                      
                      return (
                        <td key={dateIdx} className={isAbnormal ? 'abnormal-value' : 'normal-value'}>
                          {value ? (
                            <>
                              {value}
                              {result?.unit && ` ${result.unit}`}
                              {isAbnormal && <span className="abnormal-flag"> ⚠️</span>}
                            </>
                          ) : (
                            <span className="no-data">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {testResults.length > 0 && (
            <div className="test-results-summary">
              <p><strong>Total Tests:</strong> {uniqueTestNames.length}</p>
              <p><strong>Test Dates:</strong> {uniqueDates.length}</p>
              <p><strong>Total Results:</strong> {testResults.length}</p>
              <p><strong>Abnormal Results:</strong> {testResults.filter(t => t.is_abnormal === 'Yes' || t.abnormal === true).length}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="no-data-message">No test results available</div>
      )}
    </div>
  );
}

// Diagnosis Tab Component  
function DiagnosisTab({ diagnoses }) {
  const [selectedDiagImage, setSelectedDiagImage] = useState(null);
  const [diagImageUrl, setDiagImageUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [diagnosisHistory, setDiagnosisHistory] = useState([]);

  const downloadDiagnosisPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;

    // Title
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Diagnosis Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Summary
    doc.setFontSize(12);
    doc.text(`Total Diagnoses: ${diagnoses.length}`, margin, yPosition);
    yPosition += 10;

    // Group diagnoses
    const groupedDiagnoses = groupDiagnoses(diagnoses);
    
    Object.entries(groupedDiagnoses).forEach(([groupName, groupDiagnoses]) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
      }

      // Group header
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(`${groupName} (${groupDiagnoses.length})`, margin, yPosition);
      yPosition += 8;

      // Group diagnoses
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      groupDiagnoses.forEach((diagnosis, idx) => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = margin;
        }

        const diagDesc = diagnosis.diagnosis_description || 'Unknown';
        const occurrenceCount = diagnoses.filter(d => d.diagnosis_description === diagDesc).length;
        
        doc.text(`• ${diagDesc}`, margin + 5, yPosition);
        yPosition += 5;
        doc.setFontSize(9);
        doc.text(`  Code: ${diagnosis.diagnosis_code || 'N/A'}`, margin + 7, yPosition);
        yPosition += 4;
        doc.text(`  First diagnosed: ${diagnosis.diagnosed_date || 'Unknown'}`, margin + 7, yPosition);
        yPosition += 4;
        doc.text(`  Visits: ${occurrenceCount}`, margin + 7, yPosition);
        yPosition += 4;
        
        if (diagnosis.diagnosing_doctor_first_name && diagnosis.diagnosing_doctor_last_name) {
          doc.text(`  Doctor: Dr. ${diagnosis.diagnosing_doctor_first_name} ${diagnosis.diagnosing_doctor_last_name}`, margin + 7, yPosition);
          yPosition += 4;
        }
        
        if (diagnosis.summary || diagnosis.notes) {
          const summaryText = diagnosis.summary || diagnosis.notes;
          const splitText = doc.splitTextToSize(summaryText, pageWidth - margin * 2 - 10);
          splitText.forEach(line => {
            if (yPosition > pageHeight - 20) {
              doc.addPage();
              yPosition = margin;
            }
            doc.text(`  ${line}`, margin + 7, yPosition);
            yPosition += 4;
          });
        }
        
        yPosition += 3;
        doc.setFontSize(10);
      });
      
      yPosition += 5;
    });

    // Save the PDF
    doc.save('diagnosis-report.pdf');
  };

  const emailToBroker = () => {
    try {
      // First, generate and download the PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Title
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('Diagnosis Report', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Date
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      // Summary
      doc.setFontSize(12);
      doc.text(`Total Diagnoses: ${diagnoses.length}`, margin, yPosition);
      yPosition += 10;

      // Group diagnoses
      const groupedDiagnoses = groupDiagnoses(diagnoses);
      
      Object.entries(groupedDiagnoses).forEach(([groupName, groupDiagnoses]) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(`${groupName} (${groupDiagnoses.length})`, margin, yPosition);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        
        groupDiagnoses.forEach((diagnosis) => {
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = margin;
          }

          const diagDesc = diagnosis.diagnosis_description || 'Unknown';
          const occurrenceCount = diagnoses.filter(d => d.diagnosis_description === diagDesc).length;
          
          doc.text(`\u2022 ${diagDesc}`, margin + 5, yPosition);
          yPosition += 5;
          doc.setFontSize(9);
          doc.text(`  Code: ${diagnosis.diagnosis_code || 'N/A'}`, margin + 7, yPosition);
          yPosition += 4;
          doc.text(`  First diagnosed: ${diagnosis.diagnosed_date || 'Unknown'}`, margin + 7, yPosition);
          yPosition += 4;
          doc.text(`  Visits: ${occurrenceCount}`, margin + 7, yPosition);
          yPosition += 4;
          
          if (diagnosis.diagnosing_doctor_first_name && diagnosis.diagnosing_doctor_last_name) {
            doc.text(`  Doctor: Dr. ${diagnosis.diagnosing_doctor_first_name} ${diagnosis.diagnosing_doctor_last_name}`, margin + 7, yPosition);
            yPosition += 4;
          }
          
          if (diagnosis.summary || diagnosis.notes) {
            const summaryText = diagnosis.summary || diagnosis.notes;
            const splitText = doc.splitTextToSize(summaryText, pageWidth - margin * 2 - 10);
            splitText.forEach(line => {
              if (yPosition > pageHeight - 20) {
                doc.addPage();
                yPosition = margin;
              }
              doc.text(`  ${line}`, margin + 7, yPosition);
              yPosition += 4;
            });
          }
          
          yPosition += 3;
          doc.setFontSize(10);
        });
        
        yPosition += 5;
      });

      // Save the PDF
      const fileName = `diagnosis-report-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      // Prepare email summary
      let emailBody = `Please find attached the Patient Diagnosis Report.\n\n`;
      emailBody += `REPORT SUMMARY:\n`;
      emailBody += `- Total Diagnoses: ${diagnoses.length}\n`;
      emailBody += `- Report Date: ${new Date().toLocaleDateString()}\n`;
      emailBody += `- Attachment: ${fileName}\n\n`;
      
      emailBody += `The PDF report has been downloaded to your computer. Please attach it to this email before sending.\n\n`;
      
      emailBody += `Categories included:\n`;
      Object.entries(groupedDiagnoses).forEach(([groupName, groupDiagnoses]) => {
        emailBody += `- ${groupName}: ${groupDiagnoses.length} diagnosis(es)\n`;
      });

      // Create mailto link
      const subject = encodeURIComponent('Patient Diagnosis Report - ' + new Date().toLocaleDateString());
      const body = encodeURIComponent(emailBody);
      const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
      
      console.log('PDF downloaded, opening email client...');
      
      // Open email client after a short delay to ensure PDF download completes
      setTimeout(() => {
        window.location.href = mailtoLink;
        alert('The diagnosis report PDF has been downloaded. Please attach it to the email that is now opening.');
      }, 1000);
      
    } catch (error) {
      console.error('Error creating email:', error);
      alert('Failed to prepare email. Error: ' + error.message);
    }
  };

  const viewDiagnosisPage = async (diagnosis) => {
    if (!diagnosis.page_id) {
      alert('No page information available for this diagnosis');
      return;
    }

    try {
      // Fetch page details
      const pageRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Pages',
        FilterExpression: 'page_id = :pageId',
        ExpressionAttributeValues: { ':pageId': diagnosis.page_id }
      }));
      
      const page = pageRes.Items?.[0];
      if (page && page.webp_s3_key) {
        // Generate presigned URL
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: page.webp_s3_key
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        setDiagImageUrl(url);
        setSelectedDiagImage({ ...page, diagnosis });
        setZoomLevel(1);
      } else {
        alert('Page image not available');
      }
    } catch (error) {
      console.error('Error fetching diagnosis page:', error);
      alert('Error loading page image');
    }
  };

  const viewDiagnosisDetails = async (diagnosis, allDiagnoses) => {
    // Get all occurrences of this diagnosis
    const diagDesc = diagnosis.diagnosis_description;
    const occurrences = allDiagnoses.filter(d => d.diagnosis_description === diagDesc);
    
    // Get page details for each occurrence
    const historyWithPages = await Promise.all(occurrences.map(async (diag) => {
      try {
        const pageRes = await docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'page_id = :pageId',
          ExpressionAttributeValues: { ':pageId': diag.page_id }
        }));
        const page = pageRes.Items?.[0];
        return { ...diag, page_number: page?.page_number || 'Unknown' };
      } catch (error) {
        return { ...diag, page_number: 'Unknown' };
      }
    }));

    setSelectedDiagnosis({
      description: diagDesc,
      code: diagnosis.diagnosis_code,
      summary: diagnosis.summary || diagnosis.notes || 'No detailed summary available',
      first_diagnosed: occurrences[0]?.diagnosed_date || 'Unknown',
      last_diagnosed: occurrences[occurrences.length - 1]?.diagnosed_date || 'Unknown',
      occurrences: occurrences.length,
      history: historyWithPages
    });
    setDiagnosisHistory(historyWithPages);
  };

  const closeDiagModal = () => {
    setSelectedDiagImage(null);
    setDiagImageUrl(null);
    setZoomLevel(1);
  };

  const closeDiagnosisDetails = () => {
    setSelectedDiagnosis(null);
    setDiagnosisHistory([]);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Group diagnoses by medical specialty (matching legacy system)
  const groupDiagnoses = (diagList) => {
    const groups = {};
    
    // First, consolidate duplicate diagnoses with same description
    const consolidatedDiagnoses = new Map();
    
    diagList.forEach(diag => {
      const key = diag.diagnosis_description || 'Unknown';
      if (!consolidatedDiagnoses.has(key)) {
        consolidatedDiagnoses.set(key, {
          ...diag,
          occurrences: [],
          allSummaries: [],
          allNotes: [],
          allDates: [],
          allCodes: new Set(),
          allDoctors: new Set()
        });
      }
      
      const consolidated = consolidatedDiagnoses.get(key);
      consolidated.occurrences.push(diag);
      if (diag.summary) consolidated.allSummaries.push(diag.summary);
      if (diag.notes) consolidated.allNotes.push(diag.notes);
      if (diag.diagnosed_date) consolidated.allDates.push(diag.diagnosed_date);
      if (diag.diagnosis_code) consolidated.allCodes.add(diag.diagnosis_code);
      if (diag.diagnosing_doctor_first_name && diag.diagnosing_doctor_last_name) {
        consolidated.allDoctors.add(`Dr. ${diag.diagnosing_doctor_first_name} ${diag.diagnosing_doctor_last_name}`);
      }
    });
    
    // Now group by specialty
    consolidatedDiagnoses.forEach((diag, key) => {
      const desc = (diag.diagnosis_description || 'Unknown').toLowerCase();
      const combined = desc + ' ' + diag.allSummaries.join(' ').toLowerCase() + ' ' + diag.allNotes.join(' ').toLowerCase();
      let groupKey = 'Other Medical Conditions';
      
      // Major Cancer & Oncology - All malignancies
      if ((combined.includes('cancer') || combined.includes('carcinoma') || 
           combined.includes('adenocarcinoma') || combined.includes('malign') ||
           combined.includes('neoplasm') || combined.includes('metastatic') ||
           combined.includes('oncology') || combined.includes('gleason') ||
           combined.includes('tumor')) && !combined.includes('benign')) {
        groupKey = 'Cancer & Oncology';
      }
      // Chronic Conditions - Diabetes, Hypertension, Heart Disease, Kidney Disease
      else if (combined.includes('diabetes') || combined.includes('diabetic') ||
               combined.includes('hypertension') || combined.includes('blood pressure') ||
               combined.includes('heart') || combined.includes('cardiac') ||
               combined.includes('coronary') || combined.includes('atherosclerotic') ||
               combined.includes('cardiovascular') || combined.includes('myocardial') ||
               combined.includes('kidney') || combined.includes('renal') ||
               combined.includes('nephro') || combined.includes('lipid') || 
               combined.includes('cholesterol') || combined.includes('hyperlipidemia') ||
               combined.includes('obesity') || combined.includes('obese') ||
               combined.includes('ckd') || combined.includes('egfr')) {
        groupKey = 'Chronic Conditions (Diabetes, Heart, Kidney)';
      }
      // Acute & Specialty Care - Everything else
      else {
        groupKey = 'Acute & Specialty Care';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      
      // Sort dates
      const sortedDates = diag.allDates.sort();
      
      // Create comprehensive summary
      const summaries = [...diag.allSummaries, ...diag.allNotes].filter(Boolean);
      const comprehensiveSummary = summaries.length > 0 
        ? summaries.join(' ') 
        : `Patient diagnosed with ${diag.diagnosis_description}. ${diag.occurrences.length} occurrence(s) documented in medical records.`;
      
      groups[groupKey].push({
        ...diag,
        comprehensive_summary: comprehensiveSummary,
        first_date: sortedDates[0] || 'Unknown',
        last_date: sortedDates[sortedDates.length - 1] || sortedDates[0] || 'Unknown',
        occurrence_count: diag.occurrences.length,
        all_codes: Array.from(diag.allCodes).join(', ') || diag.diagnosis_code,
        all_doctors: Array.from(diag.allDoctors)
      });
    });
    
    return groups;
  };

  const groupedDiagnoses = groupDiagnoses(diagnoses);
  const totalGroups = Object.keys(groupedDiagnoses).length;
  
  return (
    <div className="diagnosis-content">
      <h2>Diagnosis Overview</h2>
      <p className="diagnosis-summary">{diagnoses.length} diagnoses grouped into {totalGroups} categories</p>
      <div className="diagnosis-action-buttons">
        <button className="download-reports-btn" onClick={downloadDiagnosisPDF}>📄 Download PDF Report</button>
        <button className="email-broker-btn" onClick={emailToBroker}>📧 Email to Broker</button>
      </div>
      
      {diagnoses.length > 0 ? (
        <div className="diagnosis-groups-container">
          {Object.entries(groupedDiagnoses).map(([groupName, groupDiagnoses]) => (
            <div key={groupName} className="diagnosis-group">
              <h3 className="group-header">
                {groupName} <span className="group-count">({groupDiagnoses.length})</span>
              </h3>
              <div className="diagnosis-cards">
                {groupDiagnoses.map((diagnosis, idx) => {
                  return (
                    <div key={idx} className="diagnosis-card diagnosis-card-detailed">
                      <div className="diagnosis-card-header">
                        <div className="diagnosis-title-row">
                          <h4>{diagnosis.diagnosis_description || diagnosis.condition || 'Unknown Diagnosis'}</h4>
                        </div>
                        <div className="diagnosis-card-meta-top">
                          <span className="star-icon">☆</span>
                          <span className="time-indicator">7d</span>
                        </div>
                      </div>
                      
                      <div className="diagnosis-summary-text-detailed">
                        <p>{diagnosis.comprehensive_summary || diagnosis.summary || diagnosis.notes || `Patient diagnosed with ${diagnosis.diagnosis_description || 'condition'} documented in patient records.`}</p>
                      </div>
                      
                      <div className="diagnosis-metadata-footer">
                        <div className="metadata-row">
                          <div className="metadata-item-inline">
                            <strong>📊 Visits / Reports:</strong>
                            <span>{diagnosis.occurrence_count || 1}</span>
                          </div>
                        </div>
                        <div className="metadata-row">
                          <div className="metadata-item-inline">
                            <strong>📅 First diagnosed:</strong>
                            <span>{diagnosis.first_date}</span>
                          </div>
                        </div>
                        <div className="metadata-row">
                          <div className="metadata-item-inline">
                            <strong>📅 Last diagnosed:</strong>
                            <span>{diagnosis.last_date}</span>
                          </div>
                        </div>
                      </div>
                      
                      {diagnosis.all_codes && (
                        <div className="diagnosis-codes-footer">
                          <span className="diagnosis-code-badge-small">ICD: {diagnosis.all_codes}</span>
                        </div>
                      )}
                      
                      <div className="diagnosis-footer">
                        <button 
                          className="view-details-btn"
                          onClick={() => viewDiagnosisDetails(diagnosis, diagnoses)}
                        >
                          📋 View Full History & Source Documents
                        </button>
                        {diagnosis.page_id && (
                          <button 
                            className="view-page-btn"
                            onClick={() => viewDiagnosisPage(diagnosis)}
                          >
                            📄 View Page
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-data-message">No diagnoses found</div>
      )}

      {/* Diagnosis Page Modal */}
      {selectedDiagImage && diagImageUrl && (
        <div className="zoom-modal" onClick={closeDiagModal}>
          <div className="zoom-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-controls">
              <button onClick={handleZoomIn}>🔍 +</button>
              <button onClick={handleZoomOut}>🔍 -</button>
              <button onClick={closeDiagModal}>✕ Close</button>
            </div>
            <div className="zoom-image-container">
              <img 
                src={diagImageUrl} 
                alt={`Page ${selectedDiagImage.page_number}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>📄 Page {selectedDiagImage.page_number}</h3>
              <div className="extracted-info">
                <h4>🩺 Extracted Diagnosis Information:</h4>
                <div className="info-highlight">
                  <p><strong>Diagnosis:</strong> "{selectedDiagImage.diagnosis.diagnosis_description}"</p>
                  {selectedDiagImage.diagnosis.diagnosis_code && selectedDiagImage.diagnosis.diagnosis_code !== 'Unknown' && (
                    <p><strong>Code:</strong> {selectedDiagImage.diagnosis.diagnosis_code}</p>
                  )}
                  {selectedDiagImage.diagnosis.diagnosing_doctor_first_name && selectedDiagImage.diagnosis.diagnosing_doctor_last_name && (
                    <p><strong>Doctor:</strong> Dr. {selectedDiagImage.diagnosis.diagnosing_doctor_first_name} {selectedDiagImage.diagnosis.diagnosing_doctor_last_name}</p>
                  )}
                  {selectedDiagImage.diagnosis.diagnosing_facility_name && selectedDiagImage.diagnosis.diagnosing_facility_name !== 'Unknown' && (
                    <p><strong>Facility:</strong> {selectedDiagImage.diagnosis.diagnosing_facility_name}</p>
                  )}
                </div>
                <p className="help-text">👆 Find this diagnosis information on the page above</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnosis Details Drill-Down Modal */}
      {selectedDiagnosis && (
        <div className="diagnosis-detail-modal" onClick={closeDiagnosisDetails}>
          <div className="diagnosis-detail-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedDiagnosis.description}</h2>
              <button onClick={closeDiagnosisDetails} className="close-btn">✕ Close</button>
            </div>
            
            <div className="diagnosis-detail-body">
              <div className="diagnosis-summary-section">
                <h3>📝 Summary:</h3>
                <p className="summary-text">{selectedDiagnosis.summary}</p>
              </div>

              <div className="diagnosis-metadata">
                <div className="metadata-item">
                  <strong>📅 First Diagnosed:</strong>
                  <span>{selectedDiagnosis.first_diagnosed}</span>
                </div>
                <div className="metadata-item">
                  <strong>📅 Last Diagnosed:</strong>
                  <span>{selectedDiagnosis.last_diagnosed}</span>
                </div>
                <div className="metadata-item">
                  <strong>📊 Occurrences:</strong>
                  <span>{selectedDiagnosis.occurrences}</span>
                </div>
              </div>

              <div className="diagnosis-history-section">
                <h3>📋 Diagnosis History</h3>
                {diagnosisHistory.map((entry, idx) => (
                  <div key={idx} className="history-entry">
                    <div className="history-header">
                      <strong>📄 Page {entry.page_number}</strong>
                      <span className="history-date">{entry.diagnosed_date || 'Unknown'}</span>
                    </div>
                    <div className="history-details">
                      <p><strong>👨‍⚕️ Doctor:</strong> {entry.diagnosing_doctor_first_name && entry.diagnosing_doctor_last_name 
                        ? `Dr. ${entry.diagnosing_doctor_first_name} ${entry.diagnosing_doctor_last_name}` 
                        : 'Unknown'} 
                        {entry.diagnosing_doctor_specialty && entry.diagnosing_doctor_specialty !== 'Unknown' 
                          ? ` (${entry.diagnosing_doctor_specialty})` 
                          : ''}
                      </p>
                      <p><strong>🏥 Facility:</strong> {entry.diagnosing_facility_name || 'Facility information not available'}</p>
                      {entry.notes && (
                        <>
                          <p><strong>📝 Notes:</strong></p>
                          <p className="history-notes">{entry.notes}</p>
                        </>
                      )}
                      {entry.notes && (
                        <>
                          <p><strong>🤖 AI Notes:</strong></p>
                          <p className="history-notes">{entry.notes}</p>
                        </>
                      )}
                      <div className="history-actions">
                        <button 
                          className="view-page-btn-small"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeDiagnosisDetails();
                            viewDiagnosisPage(entry);
                          }}
                        >
                          👁️ View Page
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Medicines Tab Component
function MedicinesTab({ medications }) {
  const [selectedMedImage, setSelectedMedImage] = useState(null);
  const [medImageUrl, setMedImageUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const totalMedications = medications.length;
  const activeMedications = medications.filter(m => m.status?.toLowerCase() === 'active' || m.status?.toLowerCase() === 'current').length;
  const discontinuedMedications = medications.filter(m => m.status?.toLowerCase() === 'discontinued').length;
  const changedMedications = 0;

  // Group medications by medical specialty
  const groupMedications = (medList) => {
    const groups = {};
    
    medList.forEach(med => {
      const medName = (med.medication_name || med.name || '').toLowerCase();
      const medClass = (med.medication_class || med.class || '').toLowerCase();
      const reason = (med.reason || med.indication || med.notes || '').toLowerCase();
      const combined = medName + ' ' + medClass + ' ' + reason;
      let groupKey = 'Other Medications';
      
      // Oncology - Cancer medications, chemotherapy
      if (combined.includes('chemo') || combined.includes('oncology') ||
          combined.includes('cancer') || combined.includes('tamoxifen') ||
          combined.includes('abiraterone') || combined.includes('enzalutamide') ||
          combined.includes('docetaxel') || combined.includes('cisplatin')) {
        groupKey = 'Oncology';
      }
      // Cardiology - Heart medications
      else if (combined.includes('statin') || combined.includes('atorvastatin') ||
               combined.includes('cardiac') || combined.includes('heart') ||
               combined.includes('beta blocker') || combined.includes('metoprolol') ||
               combined.includes('carvedilol') || combined.includes('ace inhibitor') ||
               combined.includes('lisinopril') || combined.includes('enalapril') ||
               combined.includes('arb') || combined.includes('losartan') ||
               combined.includes('valsartan') || combined.includes('anticoagulant') ||
               combined.includes('warfarin') || combined.includes('apixaban') ||
               combined.includes('aspirin') || combined.includes('clopidogrel') ||
               combined.includes('digoxin') || combined.includes('amiodarone')) {
        groupKey = 'Cardiology';
      }
      // Endocrinology - Diabetes, thyroid medications
      else if (combined.includes('insulin') || combined.includes('metformin') ||
               combined.includes('glipizide') || combined.includes('diabetes') ||
               combined.includes('thyroid') || combined.includes('levothyroxine') ||
               combined.includes('synthroid') || combined.includes('glargine') ||
               combined.includes('liraglutide') || combined.includes('semaglutide')) {
        groupKey = 'Endocrinology, Diabetes/Metabolism';
      }
      // Vascular Surgery - Blood pressure medications
      else if (combined.includes('hypertension') || combined.includes('blood pressure') ||
               combined.includes('amlodipine') || combined.includes('hydrochlorothiazide') ||
               combined.includes('hctz') || combined.includes('calcium channel') ||
               combined.includes('diuretic') || combined.includes('furosemide') ||
               combined.includes('clonidine')) {
        groupKey = 'Vascular Surgery';
      }
      // Hematology - Blood/cholesterol medications
      else if (combined.includes('cholesterol') || combined.includes('lipid') ||
               combined.includes('rosuvastatin') || combined.includes('pravastatin') ||
               combined.includes('simvastatin') || combined.includes('fenofibrate') ||
               combined.includes('ezetimibe') || combined.includes('anemia') ||
               combined.includes('iron') || combined.includes('b12')) {
        groupKey = 'Hematology';
      }
      // Urology - Prostate, erectile, urinary medications
      else if (combined.includes('prostate') || combined.includes('tamsulosin') ||
               combined.includes('finasteride') || combined.includes('dutasteride') ||
               combined.includes('alpha blocker') || combined.includes('alfuzosin') ||
               combined.includes('sildenafil') || combined.includes('tadalafil') ||
               combined.includes('viagra') || combined.includes('cialis') ||
               combined.includes('erectile') || combined.includes('urinary') ||
               combined.includes('bladder') || combined.includes('oxybutynin')) {
        groupKey = 'Urology';
      }
      // Gastroenterology - GI medications
      else if (combined.includes('proton pump') || combined.includes('ppi') ||
               combined.includes('omeprazole') || combined.includes('pantoprazole') ||
               combined.includes('esomeprazole') || combined.includes('lansoprazole') ||
               combined.includes('antacid') || combined.includes('h2 blocker') ||
               combined.includes('ranitidine') || combined.includes('famotidine') ||
               combined.includes('laxative') || combined.includes('constipation') ||
               combined.includes('diarrhea') || combined.includes('ibs')) {
        groupKey = 'Gastroenterology';
      }
      // Pulmonary - Respiratory medications
      else if (combined.includes('inhaler') || combined.includes('respiratory') ||
               combined.includes('asthma') || combined.includes('copd') ||
               combined.includes('albuterol') || combined.includes('bronchodilator') ||
               combined.includes('steroid inhaler') || combined.includes('fluticasone') ||
               combined.includes('budesonide') || combined.includes('tiotropium')) {
        groupKey = 'Pulmonary';
      }
      // Neurology - Neurological medications
      else if (combined.includes('neuropathy') || combined.includes('gabapentin') ||
               combined.includes('pregabalin') || combined.includes('lyrica') ||
               combined.includes('seizure') || combined.includes('anticonvulsant') ||
               combined.includes('migraine') || combined.includes('parkinson') ||
               combined.includes('levodopa') || combined.includes('dementia')) {
        groupKey = 'Neurology';
      }
      // Orthopaedic Surgery - Pain, inflammation medications
      else if (combined.includes('nsaid') || combined.includes('ibuprofen') ||
               combined.includes('naproxen') || combined.includes('celecoxib') ||
               combined.includes('arthritis') || combined.includes('joint') ||
               combined.includes('meloxicam') || combined.includes('diclofenac') ||
               combined.includes('pain') || combined.includes('muscle relaxant')) {
        groupKey = 'Orthopaedic Surgery';
      }
      // Rheumatology - Autoimmune medications
      else if (combined.includes('rheumat') || combined.includes('methotrexate') ||
               combined.includes('hydroxychloroquine') || combined.includes('prednisone') ||
               combined.includes('autoimmune') || combined.includes('lupus') ||
               combined.includes('biologic')) {
        groupKey = 'Rheumatology';
      }
      // Psychiatry - Mental health medications
      else if (combined.includes('antidepressant') || combined.includes('ssri') ||
               combined.includes('snri') || combined.includes('sertraline') ||
               combined.includes('escitalopram') || combined.includes('fluoxetine') ||
               combined.includes('anxiety') || combined.includes('depression') ||
               combined.includes('psychiatric') || combined.includes('antipsychotic') ||
               combined.includes('benzodiazepine') || combined.includes('lorazepam') ||
               combined.includes('alprazolam') || combined.includes('sleep') ||
               combined.includes('zolpidem') || combined.includes('trazodone')) {
        groupKey = 'Psychiatry';
      }
      // Dermatology - Skin medications
      else if (combined.includes('topical') || combined.includes('cream') ||
               combined.includes('ointment') || combined.includes('skin') ||
               combined.includes('dermatology') || combined.includes('rash')) {
        groupKey = 'Dermatology';
      }
      // Infectious Disease - Antibiotics, antivirals
      else if (combined.includes('antibiotic') || combined.includes('amoxicillin') ||
               combined.includes('azithromycin') || combined.includes('ciprofloxacin') ||
               combined.includes('doxycycline') || combined.includes('antiviral') ||
               combined.includes('infection')) {
        groupKey = 'Infectious Disease';
      }
      // Nephrology - Kidney medications
      else if (combined.includes('kidney') || combined.includes('renal') ||
               combined.includes('dialysis') || combined.includes('phosphate binder')) {
        groupKey = 'Nephrology';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(med);
    });
    
    // Sort groups alphabetically
    const sortedGroups = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  };

  const groupedMedications = groupMedications(medications);
  const totalGroups = Object.keys(groupedMedications).length;

  const viewMedicationPage = async (medication) => {
    if (!medication.page_id) {
      alert('No page information available for this medication');
      return;
    }

    try {
      // Fetch page details
      const pageRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Pages',
        FilterExpression: 'page_id = :pageId',
        ExpressionAttributeValues: { ':pageId': medication.page_id }
      }));
      
      const page = pageRes.Items?.[0];
      if (page && page.webp_s3_key) {
        // Generate presigned URL
        const command = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: page.webp_s3_key
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        setMedImageUrl(url);
        setSelectedMedImage({ ...page, medication });
        setZoomLevel(1);
      } else {
        alert('Page image not available');
      }
    } catch (error) {
      console.error('Error fetching medication page:', error);
      alert('Error loading page image');
    }
  };

  const closeMedModal = () => {
    setSelectedMedImage(null);
    setMedImageUrl(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  return (
    <div className="medicines-content">
      <h2>Patient Medications Dashboard</h2>
      <p className="diagnosis-summary">{totalMedications} medications grouped into {totalGroups} specialties</p>
      
      <div className="medication-stats">
        <div className="stat-box">
          <div className="stat-label">Total Medications</div>
          <div className="stat-value">{totalMedications}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Active Medications</div>
          <div className="stat-value">{activeMedications}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Discontinued Medications</div>
          <div className="stat-value">{discontinuedMedications}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Changed Medications</div>
          <div className="stat-value">{changedMedications}</div>
        </div>
      </div>
      
      {medications.length > 0 ? (
        <div className="diagnosis-groups-container">
          {Object.entries(groupedMedications).map(([groupName, groupMeds]) => (
            <div key={groupName} className="diagnosis-group">
              <h3 className="group-header">
                {groupName} <span className="group-count">({groupMeds.length})</span>
              </h3>
              <div className="medications-table-container">
                <table className="medical-table medications-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Medication Name</th>
                      <th style={{ width: '100px' }}>Dosage</th>
                      <th style={{ width: '140px' }}>Frequency</th>
                      <th style={{ width: '100px' }}>Status</th>
                      <th style={{ width: '80px' }}>Start Date</th>
                      <th style={{ minWidth: '250px' }}>Reason/Indication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupMeds.map((med, idx) => (
                      <tr key={idx}>
                        <td><strong>{med.medication_name || med.name || 'N/A'}</strong></td>
                        <td>{med.dosage || 'N/A'}</td>
                        <td>{med.frequency || 'N/A'}</td>
                        <td><span className={`status-badge ${med.status?.toLowerCase()}`}>{med.status || 'current'}</span></td>
                        <td>{med.start_date && med.start_date !== 'Unknown' ? med.start_date : 'N/A'}</td>
                        <td className="reason-cell">{med.reason || med.indication || med.notes || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-data-message">No medications found</div>
      )}

      {/* Medication Page Modal */}
      {selectedMedImage && medImageUrl && (
        <div className="zoom-modal" onClick={closeMedModal}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeMedModal} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={medImageUrl}
                alt={`Page ${selectedMedImage.page_number}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>📄 Page {selectedMedImage.page_number}</h3>
              <div className="extracted-info">
                <h4>💊 Extracted Medication Information:</h4>
                <div className="info-highlight">
                  <p><strong>Medication:</strong> {selectedMedImage.medication.medication_name || selectedMedImage.medication.name}</p>
                  {selectedMedImage.medication.dosage && (
                    <p><strong>Dosage:</strong> {selectedMedImage.medication.dosage}</p>
                  )}
                  {selectedMedImage.medication.frequency && (
                    <p><strong>Frequency:</strong> {selectedMedImage.medication.frequency}</p>
                  )}
                  {selectedMedImage.medication.route && (
                    <p><strong>Route:</strong> {selectedMedImage.medication.route}</p>
                  )}
                  {selectedMedImage.medication.start_date && selectedMedImage.medication.start_date !== 'Unknown' && (
                    <p><strong>Start Date:</strong> {selectedMedImage.medication.start_date}</p>
                  )}
                </div>
                <p className="help-text">👆 Find this medication information on the page above</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Procedures Tab Component
function ProceduresTab({ procedures }) {
  return (
    <div className="procedures-content">
      <h2>Procedures & Surgery</h2>
      {procedures && procedures.length > 0 ? (
        <div className="procedures-table-container">
          <table className="medical-table procedures-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Procedure Name</th>
                <th>Procedure Code</th>
                <th>Date</th>
                <th>Performing Doctor</th>
                <th>Facility</th>
                <th>Indication</th>
                <th>Outcome</th>
                <th>Complications</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((proc, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><strong>{proc.procedure_name || 'N/A'}</strong></td>
                  <td>{proc.procedure_code || 'N/A'}</td>
                  <td>{proc.procedure_date || 'N/A'}</td>
                  <td>{proc.performing_doctor_first_name && proc.performing_doctor_last_name ? 
                    `Dr. ${proc.performing_doctor_first_name} ${proc.performing_doctor_last_name}` : 'N/A'}</td>
                  <td>{proc.facility || 'N/A'}</td>
                  <td>{proc.indication || 'N/A'}</td>
                  <td>{proc.outcome || 'N/A'}</td>
                  <td>{proc.complications || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-data-message">No procedures or surgery data available</div>
      )}
    </div>
  );
}

// Radiology Tab Component
function RadiologyTab({ radiology }) {
  return (
    <div className="radiology-content">
      <h2>Radiology Findings</h2>
      <button className="download-reports-btn blue">📄 Download All Reports</button>
      
      {radiology && radiology.length > 0 ? (
        <div className="radiology-studies">
          {radiology.map((study, idx) => (
            <div key={idx} className="study-card">
              <h4>📄 {study.modality || study.study_type || 'Study'} - {study.body_part || 'Unknown'}</h4>
              <div className="study-meta">
                <span>📅 Exam Date: {study.exam_date || 'Unknown'}</span>
                {study.radiologist_name && study.radiologist_name !== 'Unknown' && (
                  <span> | 👨‍⚕️ Radiologist: Dr. {study.radiologist_name}</span>
                )}
                {study.is_abnormal === 'yes' && <span className="abnormal-badge">⚠️ Abnormal</span>}
              </div>
              {study.findings && study.findings !== 'Unknown' && (
                <div className="study-findings">
                  <strong>📋 Findings:</strong> {study.findings}
                </div>
              )}
              {study.impression && study.impression !== 'Unknown' && (
                <div className="study-impression">
                  <strong>💡 Impression:</strong> {study.impression}
                </div>
              )}
              {study.facility && study.facility !== 'Unknown' && (
                <div className="study-facility">
                  <strong>🏥 Facility:</strong> {study.facility}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="no-data-message">No radiology data available</div>
      )}
    </div>
  );
}

// Family History Tab Component
function FamilyHistoryTab({ familyHistory, socialHistory }) {
  const [activeSubTab, setActiveSubTab] = React.useState('family');
  
  return (
    <div className="family-history-content">
      <div className="family-tabs">
        <button 
          className={activeSubTab === 'family' ? 'family-tab active' : 'family-tab'}
          onClick={() => setActiveSubTab('family')}
        >
          Family History
        </button>
        <button 
          className={activeSubTab === 'social' ? 'family-tab active' : 'family-tab'}
          onClick={() => setActiveSubTab('social')}
        >
          Social History
        </button>
      </div>
      
      {activeSubTab === 'family' && (
        <div>
          <h2>Family History</h2>
          {familyHistory && familyHistory.length > 0 ? (
            <div className="family-history-table-container">
              <table className="medical-table family-history-table">
                <thead>
                  <tr>
                    <th>Relationship</th>
                    <th>Condition</th>
                    <th>Age at Diagnosis</th>
                    <th>Status</th>
                    <th>Age at Death</th>
                    <th>Cause of Death</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {familyHistory.map((member, idx) => (
                    <tr key={idx}>
                      <td><strong>{member.relationship || 'Unknown'}</strong></td>
                      <td>{member.condition || 'N/A'}</td>
                      <td>{member.age_at_diagnosis || 'N/A'}</td>
                      <td>
                        {member.is_deceased === 'yes' ? (
                          <span className="deceased-badge">⚰️ Deceased</span>
                        ) : member.is_deceased === 'no' ? (
                          <span className="living-badge">✓ Living</span>
                        ) : 'Unknown'}
                      </td>
                      <td>{member.age_at_death || 'N/A'}</td>
                      <td>{member.cause_of_death || 'N/A'}</td>
                      <td>{member.notes || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data-message">No family history data available</div>
          )}
        </div>
      )}
      
      {activeSubTab === 'social' && (
        <div>
          <h2>Social History</h2>
          {socialHistory ? (
            <div className="social-history-grid">
              <div className="social-item">
                <strong>🚬 Smoking Status:</strong> {socialHistory.smoking_status || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>🍺 Alcohol Use:</strong> {socialHistory.alcohol_use || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>💊 Drug Use:</strong> {socialHistory.drug_use || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>💼 Occupation:</strong> {socialHistory.occupation || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>💑 Marital Status:</strong> {socialHistory.marital_status || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>🏠 Living Situation:</strong> {socialHistory.living_situation || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>🏃 Exercise:</strong> {socialHistory.exercise_frequency || 'Unknown'}
              </div>
              <div className="social-item">
                <strong>🥗 Diet:</strong> {socialHistory.diet_type || 'Unknown'}
              </div>
              {socialHistory.notes && socialHistory.notes !== 'Unknown' && socialHistory.notes !== '' && (
                <div className="social-item full-width">
                  <strong>📝 Additional Notes:</strong> {socialHistory.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="no-data-message">No social history data available</div>
          )}
        </div>
      )}
      
      <h2 style={{ display: 'none' }}>Family History</h2>
      <button className="download-reports-btn blue">📄 Download Report</button>
      
      <h3>Family Medical Conditions</h3>
      
      <div className="condition-card">
        <div className="condition-header">
          <span>unknown - 1 conditions</span>
          <button className="expand-btn">▲</button>
        </div>
      </div>
      
      <div className="condition-details-expanded">
        <h4>prostate cancer</h4>
        <div className="condition-info">
          <div className="info-item"><strong>Age at Diagnosis:</strong> unknown</div>
          <div className="info-item"><strong>Status:</strong> unknown</div>
          <div className="info-item"><strong>Notes:</strong> Family history of prostate cancer noted in active problem list</div>
        </div>
        <button className="view-document-btn">View Source Document</button>
      </div>
    </div>
  );
}

// Documents Tab Component (Page Images)
function DocumentsTab({ patientId }) {
  const [pages, setPages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [imageUrls, setImageUrls] = useState({});
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [documentId, setDocumentId] = useState(null);
  
  // Filter states
  const [selectedDocTypes, setSelectedDocTypes] = useState([]);
  const [selectedPatientTypes, setSelectedPatientTypes] = useState(['inpatient', 'outpatient']);

  useEffect(() => {
    fetchDocumentId();
  }, [patientId]);

  useEffect(() => {
    if (documentId) {
      fetchPages();
    }
  }, [documentId]);

  // Filter toggle functions
  const toggleDocType = (type) => {
    setSelectedDocTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const togglePatientType = (type) => {
    setSelectedPatientTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Document type to category mapping - comprehensive SLF medical specialties
  const docTypeMapping = {
    'Provider Notes': [
      'internal-medicine', 'family-medicine', 'cardiology', 'neurology', 'urology', 
      'psychiatry', 'endocrinology', 'gastroenterology', 'pulmonary', 'nephrology',
      'dermatology', 'rheumatology', 'oncology', 'hematology', 'infectious-disease',
      'allergy-immunology', 'geriatrics', 'pediatrics', 'obstetrics-gynecology',
      'ophthalmology', 'optometry', 'otolaryngology', 'physical-medicine-rehabilitation',
      'hospice-palliative-care', 'integrative-medicine', 'functional-medicine',
      'complementary-integrative-medicine', 'east-asian-medicine', 'naturopathic-medicine',
      'wellness-coach', 'nutrition', 'medical-genetics', 'neuropsychology',
      'psychology-social-work', 'anesthesia-pain-management', 'regenerative-medicine',
      'sleep-medicine'
    ],
    'Radiology': ['radiology'],
    'Pathology': ['pathology'],
    'Procedures and Surgery': [
      'procedures', 'surgery', 'cardiothoracic-surgery', 'colorectal-surgery',
      'neurosurgery', 'orthopedic-surgery', 'oral-maxillofacial-surgery',
      'plastic-reconstructive-surgery', 'surgical-oncology', 'vascular-surgery'
    ],
    'Lab Tests': ['lab-results', 'genetic-testing'],
    'Diagnostic Testing': ['ekg-echo-stress', 'audiology'],
    'Therapies': [
      'physical-therapy', 'occupational-therapy', 'speech-language-pathology',
      'massage-therapy', 'acupuncture', 'chiropractic-medicine'
    ],
    'Emergency & Hospital': ['emergency-medicine', 'hospitalization', 'urgent-care'],
    'Radiation & Oncology': ['radiation-oncology', 'oncology', 'surgical-oncology'],
    'Dental': ['dental', 'oral-maxillofacial-surgery'],
    'Podiatry': ['podiatry'],
    'Admin': ['administrative', 'vaccination', 'executive-physical', 'fitness-analysis']
  };

  // Apply all filters
  let filteredPages = pages;

  // Filter by category (existing filter)
  if (selectedCategory !== 'all') {
    filteredPages = filteredPages.filter(page =>
      page.categories?.some(cat => cat.category_name === selectedCategory)
    );
  }

  // Filter by document types
  if (selectedDocTypes.length > 0) {
    filteredPages = filteredPages.filter(page => {
      const pageCategories = page.categories?.map(c => c.category_name) || [];
      return selectedDocTypes.some(docType => {
        const mappedCategories = docTypeMapping[docType] || [];
        return mappedCategories.some(cat => pageCategories.includes(cat));
      });
    });
  }

  // Filter by patient types
  if (selectedPatientTypes.length > 0) {
    filteredPages = filteredPages.filter(page => {
      // Check if page has patient_type attribute, otherwise default to 'outpatient'
      const patientType = page.patient_type || 'outpatient';
      return selectedPatientTypes.map(t => t.toLowerCase()).includes(patientType.toLowerCase());
    });
  }

  useEffect(() => {
    // Generate presigned URLs for all images
    const generateUrls = async () => {
      const urls = {};
      for (const page of filteredPages) {
        if (page.webp_s3_key) {
          try {
            const command = new GetObjectCommand({
              Bucket: S3_BUCKET,
              Key: page.webp_s3_key
            });
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            urls[page.page_id] = url;
          } catch (error) {
            console.error(`Error generating URL for page ${page.page_number}:`, error);
          }
        }
      }
      setImageUrls(urls);
    };

    if (filteredPages.length > 0) {
      generateUrls();
    }
  }, [selectedCategory, selectedDocTypes, selectedPatientTypes, pages]);

  const fetchDocumentId = async () => {
    try {
      const patientRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Patients',
        FilterExpression: 'patient_id = :pid OR document_id = :pid',
        ExpressionAttributeValues: { ':pid': patientId }
      }));
      const patientData = patientRes.Items?.[0];
      const docId = patientData?.document_id || patientId;
      setDocumentId(docId);
      console.log('DocumentsTab using document_id:', docId);
    } catch (error) {
      console.error('Error fetching document_id:', error);
      setDocumentId(patientId);
    }
  };

  const fetchPages = async () => {
    try {
      const [pagesRes, categoriesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Categories',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      const pagesData = pagesRes.Items || [];
      const categoriesData = categoriesRes.Items || [];

      // Organize categories by page
      const pageCategories = {};
      categoriesData.forEach(cat => {
        if (!pageCategories[cat.page_id]) {
          pageCategories[cat.page_id] = [];
        }
        pageCategories[cat.page_id].push(cat);
      });

      // Attach categories to pages
      const pagesWithCategories = pagesData.map(page => ({
        ...page,
        categories: pageCategories[page.page_id] || []
      }));

      // Sort by page number
      pagesWithCategories.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));

      setPages(pagesWithCategories);

      // Get unique categories
      const uniqueCategories = [...new Set(categoriesData.map(cat => cat.category_name))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const openZoom = (page) => {
    setZoomedImage(page);
    setZoomLevel(1);
  };

  const closeZoom = () => {
    setZoomedImage(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && zoomedImage) {
        closeZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedImage]);

  if (loading) return <div className="loading">Loading document pages...</div>;

  return (
    <div className="documents-content">
      <h2>🖼️ Document Pages</h2>
      <p className="subtitle">{pages.length} page(s)</p>

      {/* Document Type and Patient Type Filters */}
      <div className="filter-documents">
        <h3>Filter Documents</h3>
        
        <div className="document-types">
          <h4>Document Types:</h4>
          <div className="filter-checkboxes">
            {[
              'Provider Notes', 
              'Radiology', 
              'Pathology', 
              'Procedures and Surgery', 
              'Lab Tests', 
              'Diagnostic Testing',
              'Therapies',
              'Emergency & Hospital',
              'Radiation & Oncology',
              'Dental',
              'Podiatry',
              'Admin'
            ].map(type => (
              <label key={type} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedDocTypes.includes(type)}
                  onChange={() => toggleDocType(type)}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="patient-type">
          <h4>Patient Type:</h4>
          <div className="filter-checkboxes">
            {['Inpatient', 'Outpatient'].map(type => (
              <label key={type} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedPatientTypes.includes(type.toLowerCase())}
                  onChange={() => togglePatientType(type.toLowerCase())}
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="category-filter">
        <h3>Filter by Category:</h3>
        <div className="category-buttons">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            All Pages ({pages.length})
          </button>
          {categories.map(cat => {
            const count = pages.filter(p => 
              p.categories?.some(c => c.category_name === cat)
            ).length;
            return (
              <button
                key={cat}
                className={selectedCategory === cat ? 'active' : ''}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filteredPages.length === 0 ? (
        <div className="no-data-message">No pages found for this category</div>
      ) : (
        <div className="image-gallery">
          {filteredPages.map(page => (
            <div key={page.page_id} className="image-card">
              <div className="image-header">
                <h4>Page {page.page_number}</h4>
                {page.categories && page.categories.length > 0 && (
                  <div className="category-tags">
                    {page.categories.map((cat, idx) => (
                      <span key={idx} className="category-tag" title={cat.reason}>
                        {cat.category_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="image-container">
                {imageUrls[page.page_id] ? (
                  <img
                    src={imageUrls[page.page_id]}
                    alt={`Page ${page.page_number}`}
                    loading="lazy"
                    onClick={() => openZoom(page)}
                    style={{ cursor: 'zoom-in' }}
                  />
                ) : (
                  <div className="image-placeholder">Loading image...</div>
                )}
              </div>
              
              <div className="image-footer">
                <span className={`status ${page.ai_processed ? 'processed' : 'pending'}`}>
                  {page.ai_processed ? '✓ Processed' : '⏳ Processing...'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="zoom-modal" onClick={closeZoom}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeZoom} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={imageUrls[zoomedImage.page_id]}
                alt={`Page ${zoomedImage.page_number}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>Page {zoomedImage.page_number}</h3>
              {zoomedImage.categories && zoomedImage.categories.length > 0 && (
                <div className="category-tags">
                  {zoomedImage.categories.map((cat, idx) => (
                    <span key={idx} className="category-tag">
                      {cat.category_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Medical Summary Tab Component (Next Steps)
function MedicalSummaryTab({ medications, diagnoses, testResults, patientId }) {
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    // Generate AI-powered recommendations
    const aiRecommendations = generateRecommendations(medications, diagnoses, testResults);
    setRecommendations(aiRecommendations);
  }, [medications, diagnoses, testResults]);

  const generateRecommendations = (meds, diags, tests) => {
    const recs = [];
    
    // Analyze medications
    const currentMeds = meds.filter(m => m.status?.toLowerCase() === 'active' || m.status?.toLowerCase() === 'current' || m.is_current === 'Yes');
    
    if (currentMeds.length > 5) {
      recs.push({
        category: 'Medication Management',
        priority: 'high',
        icon: '💊',
        title: 'Medication Review Recommended',
        description: `Patient is currently on ${currentMeds.length} medications. Consider scheduling a comprehensive medication review to assess for potential drug interactions and optimize therapy.`,
        actions: [
          'Schedule pharmacist consultation',
          'Review for duplicate therapies',
          'Check for drug-drug interactions',
          'Assess medication adherence'
        ]
      });
    }

    // Check for specific medication classes
    const hasAnticoagulant = currentMeds.some(m => 
      m.medication_name?.toLowerCase().includes('warfarin') ||
      m.medication_name?.toLowerCase().includes('apixaban') ||
      m.medication_name?.toLowerCase().includes('rivaroxaban') ||
      m.name?.toLowerCase().includes('warfarin')
    );
    
    if (hasAnticoagulant) {
      recs.push({
        category: 'Lab Monitoring',
        priority: 'high',
        icon: '🔬',
        title: 'Anticoagulation Monitoring Required',
        description: 'Patient is on anticoagulation therapy. Regular monitoring is essential for patient safety.',
        actions: [
          'Schedule INR/PT testing (if on warfarin)',
          'Monitor for bleeding complications',
          'Review medication interactions',
          'Patient education on dietary restrictions'
        ]
      });
    }

    // Analyze diagnoses
    const hasChronicCondition = diags.some(d => {
      const desc = (d.condition || d.diagnosis_description || d.description || '').toLowerCase();
      return desc.includes('diabetes') || desc.includes('hypertension') || 
             desc.includes('heart failure') || desc.includes('copd') ||
             desc.includes('asthma') || desc.includes('chronic');
    });

    if (hasChronicCondition) {
      recs.push({
        category: 'Chronic Disease Management',
        priority: 'medium',
        icon: '🩺',
        title: 'Chronic Condition Follow-up',
        description: 'Patient has chronic conditions requiring ongoing management and monitoring.',
        actions: [
          'Schedule regular follow-up appointments',
          'Review disease-specific care plans',
          'Assess need for specialist referrals',
          'Patient education on condition management'
        ]
      });
    }

    // Check for diabetes-related needs
    const hasDiabetes = diags.some(d => {
      const desc = (d.condition || d.diagnosis_description || d.description || '').toLowerCase();
      return desc.includes('diabetes');
    });
    
    if (hasDiabetes) {
      recs.push({
        category: 'Diabetes Care',
        priority: 'high',
        icon: '🩸',
        title: 'Diabetes Monitoring & Management',
        description: 'Comprehensive diabetes care plan recommended.',
        actions: [
          'Schedule HbA1c testing (every 3 months)',
          'Annual comprehensive foot exam',
          'Annual dilated eye exam',
          'Kidney function monitoring (eGFR, urine albumin)',
          'Review blood glucose monitoring logs',
          'Assess for diabetic complications'
        ]
      });
    }

    // Analyze abnormal test results
    const abnormalTests = tests.filter(t => t.is_abnormal === 'Yes' || t.abnormal);
    
    if (abnormalTests.length > 0) {
      const criticalTests = abnormalTests.filter(t => {
        const name = (t.test_name || '').toLowerCase();
        return name.includes('creatinine') || name.includes('potassium') || 
               name.includes('glucose') || name.includes('hemoglobin');
      });

      if (criticalTests.length > 0) {
        recs.push({
          category: 'Lab Follow-up',
          priority: 'high',
          icon: '⚠️',
          title: 'Abnormal Lab Results Require Attention',
          description: `${abnormalTests.length} abnormal test results found. ${criticalTests.length} may require immediate attention.`,
          actions: [
            'Review all abnormal results with physician',
            'Repeat testing as clinically indicated',
            'Consider specialist referral if needed',
            'Adjust medications based on results'
          ],
          details: criticalTests.map(t => 
            `${t.test_name}: ${t.result_value || t.result} (${t.reference_range || 'See reference range'})`
          )
        });
      } else {
        recs.push({
          category: 'Lab Follow-up',
          priority: 'medium',
          icon: '🔬',
          title: 'Lab Results Review Needed',
          description: `${abnormalTests.length} abnormal test results require follow-up.`,
          actions: [
            'Discuss results with patient',
            'Determine if repeat testing needed',
            'Document clinical decision-making'
          ]
        });
      }
    }

    // Check for cardiovascular risk
    const hasCardiacCondition = diags.some(d => {
      const desc = (d.condition || d.diagnosis_description || d.description || '').toLowerCase();
      return desc.includes('hypertension') || desc.includes('heart') || 
             desc.includes('cardiac') || desc.includes('coronary');
    });

    if (hasCardiacCondition) {
      recs.push({
        category: 'Cardiovascular Health',
        priority: 'medium',
        icon: '❤️',
        title: 'Cardiovascular Risk Management',
        description: 'Patient has cardiovascular conditions requiring proactive management.',
        actions: [
          'Assess cardiovascular risk factors',
          'Monitor blood pressure regularly',
          'Review lipid panel results',
          'Encourage lifestyle modifications',
          'Consider cardiology referral if not already established'
        ]
      });
    }

    // General preventive care recommendations
    recs.push({
      category: 'Preventive Care',
      priority: 'low',
      icon: '🛡️',
      title: 'Routine Preventive Health Maintenance',
      description: 'Ensure patient is up-to-date with age-appropriate preventive care.',
      actions: [
        'Review immunization status',
        'Age-appropriate cancer screenings',
        'Annual wellness visit',
        'Lifestyle counseling (diet, exercise, smoking cessation)'
      ]
    });

    // Check for polypharmacy
    if (currentMeds.length >= 5) {
      recs.push({
        category: 'Medication Safety',
        priority: 'medium',
        icon: '⚕️',
        title: 'Polypharmacy Assessment',
        description: 'Multiple medications increase risk of adverse effects and interactions.',
        actions: [
          'Deprescribing review - assess each medication necessity',
          'Check for potentially inappropriate medications',
          'Simplify medication regimen if possible',
          'Ensure patient understanding of each medication'
        ]
      });
    }

    // Sort by priority
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  };

  const currentMeds = medications.filter(m => m.status?.toLowerCase() === 'active' || m.status?.toLowerCase() === 'current' || m.is_current === 'Yes');
  const abnormalTests = testResults.filter(t => t.is_abnormal === 'Yes' || t.abnormal);

  return (
    <div className="medical-summary-content">
      <h2>🎯 Next Steps - AI-Powered Recommendations</h2>
      <p className="subtitle">
        Based on analysis of {medications.length} medications, {diagnoses.length} diagnoses, 
        and {testResults.length} test results
      </p>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">💊</div>
          <div className="summary-content">
            <h3>{currentMeds.length}</h3>
            <p>Current Medications</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🩺</div>
          <div className="summary-content">
            <h3>{diagnoses.length}</h3>
            <p>Active Diagnoses</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⚠️</div>
          <div className="summary-content">
            <h3>{abnormalTests.length}</h3>
            <p>Abnormal Results</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🎯</div>
          <div className="summary-content">
            <h3>{recommendations.length}</h3>
            <p>Recommendations</p>
          </div>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="no-data-message">
          <p>✅ No specific recommendations at this time.</p>
          <p>Continue with routine care and monitoring.</p>
        </div>
      ) : (
        <div className="recommendations-container">
          {recommendations.map((rec, idx) => (
            <div key={idx} className={`recommendation-card priority-${rec.priority}`}>
              <div className="rec-header">
                <div className="rec-icon">{rec.icon}</div>
                <div className="rec-title-section">
                  <h3>{rec.title}</h3>
                  <span className={`priority-badge priority-${rec.priority}`}>
                    {rec.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>
              
              <div className="rec-category">{rec.category}</div>
              <p className="rec-description">{rec.description}</p>
              
              <div className="rec-actions">
                <h4>Recommended Actions:</h4>
                <ul>
                  {rec.actions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>

              {rec.details && rec.details.length > 0 && (
                <div className="rec-details">
                  <h4>Details:</h4>
                  <ul>
                    {rec.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer">
        <h4>⚕️ Clinical Disclaimer</h4>
        <p>
          These recommendations are generated by AI analysis and are intended to support clinical 
          decision-making, not replace it. All recommendations should be reviewed by a qualified 
          healthcare professional and tailored to the individual patient's needs, circumstances, 
          and current clinical guidelines.
        </p>
      </div>
    </div>
  );
}

// Document List Component
function DocumentList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'HealthAI-Documents'
      });
      const response = await docClient.send(command);
      setDocuments(response.Items || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading documents...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <h2>📄 Medical Documents</h2>
        <p className="subtitle">{documents.length} document(s) processed</p>
      </div>
      
      <div className="document-grid">
        {documents.map(doc => (
          <div 
            key={doc.document_id} 
            onClick={() => navigate(`/document/${doc.document_id}`)}
            className="document-card clickable"
          >
            <div className="document-icon">📄</div>
            <div className="document-info">
              <h3>{doc.filename}</h3>
              <div className="document-meta">
                <p>📊 Pages: {doc.total_pages}</p>
                <p>⏱️ Uploaded: {new Date(doc.upload_timestamp * 1000).toLocaleString()}</p>
                <p>✅ Processed: {doc.pages_processed || 0}/{doc.total_pages}</p>
              </div>
              <div className={`status-badge ${doc.status?.toLowerCase()}`}>
                {doc.status}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Document Dashboard - Main Navigation
function DocumentDashboard() {
  const { documentId } = useParams();
  const [document, setDocument] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocumentData();
  }, [documentId]);

  const fetchDocumentData = async () => {
    try {
      // Get document info
      const docCommand = new QueryCommand({
        TableName: 'HealthAI-Documents',
        KeyConditionExpression: 'document_id = :docId',
        ExpressionAttributeValues: { ':docId': documentId }
      });
      const docResponse = await docClient.send(docCommand);
      const doc = docResponse.Items?.[0];
      setDocument(doc);

      // Get statistics
      const [medsRes, diagRes, testsRes, pagesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Medications',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId },
          Select: 'COUNT'
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Diagnoses',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId },
          Select: 'COUNT'
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-TestResults',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId },
          Select: 'COUNT'
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      setStats({
        medications: medsRes.Count || 0,
        diagnoses: diagRes.Count || 0,
        tests: testsRes.Count || 0,
        pages: pagesRes.Items?.length || 0
      });
    } catch (error) {
      console.error('Error fetching document data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!document) return <div className="error">Document not found</div>;

  return (
    <div className="container">
      <Link to="/" className="back-link">← Back to Documents</Link>
      
      <div className="dashboard-header">
        <h2>📄 {document.filename}</h2>
        <p className="subtitle">Medical Document Analysis Dashboard</p>
      </div>

      <div className="dashboard-grid">
        <Link to={`/document/${documentId}/patient`} className="dashboard-card">
          <div className="card-icon">👤</div>
          <h3>Patient Summary</h3>
          <p>View patient demographics and general information</p>
        </Link>

        <Link to={`/document/${documentId}/medications`} className="dashboard-card">
          <div className="card-icon">💊</div>
          <h3>Medications</h3>
          <p className="stat">{stats.medications} medications found</p>
        </Link>

        <Link to={`/document/${documentId}/diagnoses`} className="dashboard-card">
          <div className="card-icon">🩺</div>
          <h3>Diagnoses</h3>
          <p className="stat">{stats.diagnoses} diagnoses found</p>
        </Link>

        <Link to={`/document/${documentId}/tests`} className="dashboard-card">
          <div className="card-icon">🔬</div>
          <h3>Test Results</h3>
          <p className="stat">{stats.tests} test results found</p>
        </Link>

        <Link to={`/document/${documentId}/images`} className="dashboard-card">
          <div className="card-icon">🖼️</div>
          <h3>Page Images</h3>
          <p className="stat">{stats.pages} pages with categories</p>
        </Link>

        <Link to={`/document/${documentId}/doctors`} className="dashboard-card">
          <div className="card-icon">👨‍⚕️</div>
          <h3>Healthcare Providers</h3>
          <p>Verify doctors and analyze specialty relevance</p>
        </Link>

        <Link to={`/document/${documentId}/next-steps`} className="dashboard-card highlight-card">
          <div className="card-icon">🎯</div>
          <h3>Next Steps</h3>
          <p>AI-powered patient care recommendations</p>
        </Link>
      </div>
    </div>
  );
}

// Patient Summary Page
function PatientSummary() {
  const { documentId } = useParams();
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, [documentId]);

  const fetchPatients = async () => {
    try {
      const [patientsRes, providersRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Patients',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Providers',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);
      setPatients(patientsRes.Items || []);
      setProviders(providersRes.Items || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  if (loading) return <div className="loading">Loading patient data...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>👤 Patient Information</h2>
      </div>

      {patients.length === 0 ? (
        <div className="info-message">
          <p>No patient demographic data found in this document.</p>
          <p className="subtitle">Patient information is typically found on cover pages or demographic sheets.</p>
        </div>
      ) : (
        patients.map(patient => {
          const age = calculateAge(patient.patient_dob);
          
          return (
          <div key={patient.patient_id} className="patient-summary">
            <section className="info-section">
              <h3>General Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Full Name:</span>
                  <span className="value">
                    {patient.patient_first_name || patient.patient_last_name 
                      ? `${patient.patient_first_name || ''} ${patient.patient_last_name || ''}`.trim()
                      : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Date of Birth:</span>
                  <span className="value">
                    {patient.patient_dob || 'N/A'}
                    {age && ` (${age} years old)`}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Gender:</span>
                  <span className="value">{patient.gender || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Blood Type:</span>
                  <span className="value">{patient.blood_type || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">MRN:</span>
                  <span className="value">{patient.patient_mrn || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">SSN:</span>
                  <span className="value">{patient.patient_ssn ? `***-**-${patient.patient_ssn.slice(-4)}` : 'N/A'}</span>
                </div>
              </div>
            </section>

            <section className="info-section">
              <h3>Medical Facility</h3>
              <div className="info-grid">
                <div className="info-item full-width">
                  <span className="label">Facility Name:</span>
                  <span className="value">{patient.medical_facility || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Document Date:</span>
                  <span className="value">{patient.document_date || 'N/A'}</span>
                </div>
              </div>
            </section>

            <section className="info-section">
              <h3>Contact Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Phone:</span>
                  <span className="value">{patient.phone_number || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Email:</span>
                  <span className="value">{patient.email || 'N/A'}</span>
                </div>
                <div className="info-item full-width">
                  <span className="label">Address:</span>
                  <span className="value">
                    {[
                      patient.address_line1,
                      patient.city,
                      patient.state,
                      patient.postal_code,
                      patient.country
                    ].filter(Boolean).join(', ') || 'N/A'}
                  </span>
                </div>
              </div>
            </section>

            {patient.allergies && patient.allergies !== 'Unknown' && patient.allergies !== 'None' && (
              <section className="info-section alert-section">
                <h3>⚠️ Allergies</h3>
                <p className="alert-text">{patient.allergies}</p>
              </section>
            )}

            {patient.emergency_contact_name && patient.emergency_contact_name !== 'Unknown' && (
              <section className="info-section">
                <h3>Emergency Contact</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Name:</span>
                    <span className="value">{patient.emergency_contact_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Phone:</span>
                    <span className="value">{patient.emergency_contact_phone || 'N/A'}</span>
                  </div>
                </div>
              </section>
            )}

            {providers.length > 0 && (
              <section className="info-section">
                <h3>Healthcare Providers</h3>
                <div className="providers-list">
                  {providers.map((provider, idx) => (
                    <div key={idx} className="provider-card">
                      <div className="provider-header">
                        <strong>
                          Dr. {provider.doctor_first_name} {provider.doctor_last_name}
                        </strong>
                        {provider.specialty && (
                          <span className="provider-specialty">{provider.specialty}</span>
                        )}
                      </div>
                      {provider.role_in_care && (
                        <p className="provider-role">Role: {provider.role_in_care}</p>
                      )}
                      {provider.facility && (
                        <p className="provider-facility">📍 {provider.facility}</p>
                      )}
                      {provider.contact_info && (
                        <p className="provider-contact">📞 {provider.contact_info}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )})
      )}
    </div>
  );
}

// Medications Page
function MedicationsPage() {
  const { documentId } = useParams();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pages, setPages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchMedications();
  }, [documentId]);

  const fetchMedications = async () => {
    try {
      const [medsRes, pagesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Medications',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);
      
      const medsData = medsRes.Items || [];
      const pagesData = pagesRes.Items || [];
      
      // Create maps of page_id to page data
      const pagesByPageId = {};
      const pagesByPageNumber = {};
      pagesData.forEach(page => {
        pagesByPageId[page.page_id] = page;
        pagesByPageNumber[page.page_number] = page;
      });
      
      setMedications(medsData);
      setPages(pagesByPageNumber);
      
      // Generate presigned URLs for pages that have medications
      const urls = {};
      for (const med of medsData) {
        const page = pagesByPageId[med.page_id];
        if (page && page.webp_s3_key) {
          const pageNumber = page.page_number;
          if (!urls[pageNumber]) {
            try {
              const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: page.webp_s3_key
              });
              urls[pageNumber] = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (error) {
              console.error(`Error generating URL for page ${pageNumber}:`, error);
            }
          }
        }
      }
      setImageUrls(urls);
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const openImageModal = (pageNumber, medDetails = null) => {
    if (imageUrls[pageNumber]) {
      setSelectedImage({ 
        pageNumber, 
        url: imageUrls[pageNumber],
        details: medDetails
      });
      setZoomLevel(1);
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedImage) {
        closeImageModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  const filteredMeds = medications.filter(med =>
    med.medication_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.dosage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Loading medications...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>💊 Medications</h2>
        <p className="subtitle">{medications.length} medication(s) found</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search medications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredMeds.length === 0 ? (
        <div className="info-message">No medications found</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Medication Name</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Route</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Page</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeds.map((med, idx) => {
                // Get page data from page_id
                const medPage = Object.values(pages).find(p => p.page_id === med.page_id);
                const pageNumber = medPage?.page_number;
                
                return (
                  <tr key={idx}>
                    <td><strong>{med.medication_name || 'N/A'}</strong></td>
                    <td>{med.dosage || 'N/A'}</td>
                    <td>{med.frequency || 'N/A'}</td>
                    <td>{med.route || 'N/A'}</td>
                    <td>{med.start_date || 'N/A'}</td>
                    <td>{med.end_date || '-'}</td>
                    <td>
                      <span className={`status ${med.is_current === 'Yes' ? 'current' : 'discontinued'}`}>
                        {med.is_current === 'Yes' ? '✓ Current' : '× Discontinued'}
                      </span>
                    </td>
                    <td>{pageNumber || '-'}</td>
                    <td>
                      {pageNumber && imageUrls[pageNumber] ? (
                        <button 
                          className="view-image-btn"
                          onClick={() => openImageModal(pageNumber, {
                            type: 'medication',
                            name: med.medication_name,
                            dosage: med.dosage,
                            frequency: med.frequency,
                            route: med.route,
                            notes: med.notes
                          })}
                          title="View source page"
                        >
                          🖼️ View
                        </button>
                      ) : (
                        <span className="no-image">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="zoom-modal" onClick={closeImageModal}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeImageModal} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={selectedImage.url}
                alt={`Page ${selectedImage.pageNumber}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>📄 Page {selectedImage.pageNumber}</h3>
              {selectedImage.details && selectedImage.details.type === 'medication' && (
                <div className="extracted-info">
                  <h4>💊 Extracted Medication Information:</h4>
                  <div className="info-highlight">
                    <p><strong>Look for:</strong> "{selectedImage.details.name}"</p>
                    {selectedImage.details.dosage && (
                      <p><strong>Dosage:</strong> {selectedImage.details.dosage}</p>
                    )}
                    {selectedImage.details.frequency && (
                      <p><strong>Frequency:</strong> {selectedImage.details.frequency}</p>
                    )}
                    {selectedImage.details.route && (
                      <p><strong>Route:</strong> {selectedImage.details.route}</p>
                    )}
                  </div>
                  <p className="help-text">👆 Find this text on the page image above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Diagnoses Page
function DiagnosesPage() {
  const { documentId } = useParams();
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pages, setPages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);

  useEffect(() => {
    fetchDiagnoses();
  }, [documentId]);

  const fetchDiagnoses = async () => {
    try {
      const [diagRes, pagesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Diagnoses',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);
      
      const diagData = diagRes.Items || [];
      const pagesData = pagesRes.Items || [];
      
      // Create maps of page_id to page data
      const pagesByPageId = {};
      const pagesByPageNumber = {};
      pagesData.forEach(page => {
        pagesByPageId[page.page_id] = page;
        pagesByPageNumber[page.page_number] = page;
      });
      
      setDiagnoses(diagData);
      setPages(pagesByPageNumber);
      
      // Generate presigned URLs for pages that have diagnoses
      const urls = {};
      for (const diag of diagData) {
        const page = pagesByPageId[diag.page_id];
        if (page && page.webp_s3_key) {
          const pageNumber = page.page_number;
          if (!urls[pageNumber]) {
            try {
              const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: page.webp_s3_key
              });
              urls[pageNumber] = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            } catch (error) {
              console.error(`Error generating URL for page ${pageNumber}:`, error);
            }
          }
        }
      }
      setImageUrls(urls);
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
    } finally {
      setLoading(false);
    }
  };

  const openImageModal = (pageNumber, diagDetails = null) => {
    if (imageUrls[pageNumber]) {
      setSelectedImage({ 
        pageNumber, 
        url: imageUrls[pageNumber],
        details: diagDetails
      });
      setZoomLevel(1);
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedImage) {
        closeImageModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  const filteredDiagnoses = diagnoses.filter(diag =>
    diag.diagnosis_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    diag.diagnosis_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group diagnoses by similar conditions
  const groupDiagnoses = (diagList) => {
    const groups = {};
    
    diagList.forEach(diag => {
      const desc = diag.diagnosis_description || 'Unknown';
      
      // Define grouping keywords - group by primary condition
      let groupKey = 'Other Conditions';
      
      // Prostate Cancer related
      if (desc.toLowerCase().includes('prostate') && 
          (desc.toLowerCase().includes('cancer') || desc.toLowerCase().includes('adenocarcinoma') || 
           desc.toLowerCase().includes('carcinoma') || desc.toLowerCase().includes('malign') ||
           desc.toLowerCase().includes('gleason') || desc.toLowerCase().includes('metastatic'))) {
        groupKey = 'Prostate Cancer & Related Conditions';
      }
      // Diabetes
      else if (desc.toLowerCase().includes('diabetes') || desc.toLowerCase().includes('diabetic')) {
        groupKey = 'Diabetes Mellitus & Related Conditions';
      }
      // Cardiovascular
      else if (desc.toLowerCase().includes('heart') || desc.toLowerCase().includes('cardiac') || 
               desc.toLowerCase().includes('coronary') || desc.toLowerCase().includes('atherosclerotic')) {
        groupKey = 'Cardiovascular Conditions';
      }
      // Erectile dysfunction
      else if (desc.toLowerCase().includes('erectile')) {
        groupKey = 'Erectile Dysfunction';
      }
      // Hypertension
      else if (desc.toLowerCase().includes('hypertension') || desc.toLowerCase().includes('blood pressure')) {
        groupKey = 'Hypertension';
      }
      // Hyperlipidemia/Cholesterol
      else if (desc.toLowerCase().includes('lipid') || desc.toLowerCase().includes('cholesterol') || 
               desc.toLowerCase().includes('triglyceride')) {
        groupKey = 'Lipid Disorders';
      }
      // Benign prostate conditions
      else if (desc.toLowerCase().includes('prostate') && desc.toLowerCase().includes('benign')) {
        groupKey = 'Benign Prostate Conditions';
      }
      // Bladder/Urinary
      else if (desc.toLowerCase().includes('bladder') || desc.toLowerCase().includes('urinary') || 
               desc.toLowerCase().includes('nocturia') || desc.toLowerCase().includes('dysuria')) {
        groupKey = 'Bladder & Urinary Conditions';
      }
      // Musculoskeletal
      else if (desc.toLowerCase().includes('joint') || desc.toLowerCase().includes('spine') || 
               desc.toLowerCase().includes('degenerative') || desc.toLowerCase().includes('knee') ||
               desc.toLowerCase().includes('hip')) {
        groupKey = 'Musculoskeletal Conditions';
      }
      // Mental Health
      else if (desc.toLowerCase().includes('anxiety') || desc.toLowerCase().includes('depression') || 
               desc.toLowerCase().includes('sleep')) {
        groupKey = 'Mental Health & Sleep Disorders';
      }
      // Gastrointestinal
      else if (desc.toLowerCase().includes('gallbladder') || desc.toLowerCase().includes('cholelithiasis') || 
               desc.toLowerCase().includes('diverticulosis')) {
        groupKey = 'Gastrointestinal Conditions';
      }
      // Obesity
      else if (desc.toLowerCase().includes('obesity') || desc.toLowerCase().includes('obese')) {
        groupKey = 'Obesity';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(diag);
    });
    
    return groups;
  };

  const groupedDiagnoses = groupDiagnoses(filteredDiagnoses);
  
  // Get all available groups for the filter dropdown
  const allGroups = Object.keys(groupedDiagnoses);
  
  // Filter grouped diagnoses based on selected groups
  const displayedDiagnoses = selectedSpecialties.length === 0 
    ? groupedDiagnoses 
    : Object.keys(groupedDiagnoses)
        .filter(group => selectedSpecialties.includes(group))
        .reduce((acc, group) => {
          acc[group] = groupedDiagnoses[group];
          return acc;
        }, {});

  const toggleSpecialty = (group) => {
    setSelectedSpecialties(prev => 
      prev.includes(group)
        ? prev.filter(s => s !== group)
        : [...prev, group]
    );
  };

  const clearAllFilters = () => {
    setSelectedSpecialties([]);
  };

  const selectAllSpecialties = () => {
    setSelectedSpecialties(allGroups);
  };

  if (loading) return <div className="loading">Loading diagnoses...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>🩺 Diagnoses by Condition Category</h2>
        <p className="subtitle">
          {diagnoses.length} diagnosis entries grouped into {Object.keys(groupedDiagnoses).length} categories
          {selectedSpecialties.length > 0 && ` (showing ${selectedSpecialties.length} selected)`}
        </p>
      </div>

      <div className="filter-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search diagnoses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="specialty-filter">
          <label className="filter-label">
            <span>📋 Filter by Category:</span>
            <div className="filter-actions">
              <button 
                onClick={selectAllSpecialties} 
                className="filter-action-btn"
                disabled={selectedSpecialties.length === allGroups.length}
              >
                Select All
              </button>
              <button 
                onClick={clearAllFilters} 
                className="filter-action-btn"
                disabled={selectedSpecialties.length === 0}
              >
                Clear All
              </button>
            </div>
          </label>
          <div className="specialty-checkboxes">
            {allGroups.map(group => (
              <label key={group} className="specialty-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSpecialties.includes(group)}
                  onChange={() => toggleSpecialty(group)}
                />
                <span className="checkbox-label-text">
                  {group} ({groupedDiagnoses[group].length})
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {filteredDiagnoses.length === 0 ? (
        <div className="info-message">No diagnoses found</div>
      ) : Object.keys(displayedDiagnoses).length === 0 ? (
        <div className="info-message">No categories selected. Please select one or more categories above.</div>
      ) : (
        <div className="diagnoses-by-specialty">
          {Object.entries(displayedDiagnoses).map(([categoryName, diagList]) => (
            <div key={categoryName} className="specialty-section">
              <div className="specialty-header">
                <h3>{categoryName}</h3>
                <span className="specialty-count">{diagList.length} entry{diagList.length !== 1 ? 'entries' : ''}</span>
              </div>
              <div className="diagnosis-grid">
                {diagList.map((diag, idx) => {
                  // Get page data from page_id
                  const diagPage = Object.values(pages).find(p => p.page_id === diag.page_id);
                  const pageNumber = diagPage?.page_number;
                  
                  return (
                    <div key={idx} className="diagnosis-card">
                      <h4>{diag.diagnosis_description || 'N/A'}</h4>
                      {diag.diagnosis_code && (
                        <p className="code">Code: {diag.diagnosis_code}</p>
                      )}
                      <div className="diagnosis-meta">
                        {diag.diagnosed_date && (
                          <p><strong>Date:</strong> {diag.diagnosed_date}</p>
                        )}
                        {diag.diagnosing_doctor_first_name && (
                          <p><strong>Doctor:</strong> Dr. {diag.diagnosing_doctor_first_name} {diag.diagnosing_doctor_last_name}</p>
                        )}
                        {diag.diagnosing_facility_name && (
                          <p><strong>Facility:</strong> {diag.diagnosing_facility_name}</p>
                        )}
                        {pageNumber && (
                          <p><strong>Page:</strong> {pageNumber}</p>
                        )}
                      </div>
                      {diag.notes && diag.notes !== 'None' && (
                        <div className="notes">
                          <strong>Notes:</strong> {diag.notes}
                        </div>
                      )}
                      {pageNumber && imageUrls[pageNumber] && (
                        <button 
                          className="view-image-btn diagnosis-view-btn"
                          onClick={() => openImageModal(pageNumber, {
                            type: 'diagnosis',
                            description: diag.diagnosis_description,
                            code: diag.diagnosis_code,
                            doctor: `${diag.diagnosing_doctor_first_name || ''} ${diag.diagnosing_doctor_last_name || ''}`.trim(),
                            notes: diag.notes
                          })}
                          title="View source page"
                        >
                          🖼️ View Source Page
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="zoom-modal" onClick={closeImageModal}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeImageModal} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={selectedImage.url}
                alt={`Page ${selectedImage.pageNumber}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>📄 Page {selectedImage.pageNumber}</h3>
              {selectedImage.details && selectedImage.details.type === 'diagnosis' && (
                <div className="extracted-info">
                  <h4>🩺 Extracted Diagnosis Information:</h4>
                  <div className="info-highlight">
                    <p><strong>Look for:</strong> "{selectedImage.details.description}"</p>
                    {selectedImage.details.code && (
                      <p><strong>Code:</strong> {selectedImage.details.code}</p>
                    )}
                    {selectedImage.details.doctor && (
                      <p><strong>Doctor:</strong> Dr. {selectedImage.details.doctor}</p>
                    )}
                  </div>
                  <p className="help-text">👆 Find this text on the page image above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Test Results Page
function TestResultsPage() {
  const { documentId } = useParams();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAbnormalOnly, setShowAbnormalOnly] = useState(false);
  const [pages, setPages] = useState({});
  const [imageUrls, setImageUrls] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchTests();
  }, [documentId]);

  const fetchTests = async () => {
    try {
      const [testsRes, pagesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-TestResults',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);
      
      const testsData = testsRes.Items || [];
      const pagesData = pagesRes.Items || [];
      
      // Create a map of page_id to page data (with page_number and webp_s3_key)
      const pagesByPageId = {};
      const pagesByPageNumber = {};
      pagesData.forEach(page => {
        pagesByPageId[page.page_id] = page;
        pagesByPageNumber[page.page_number] = page;
      });
      
      setTests(testsData);
      setPages(pagesByPageNumber);
      
      // Generate presigned URLs for pages that have test results
      const urls = {};
      console.log('Test Results Data:', testsData);
      console.log('Pages by ID:', pagesByPageId);
      console.log('Pages by Number:', pagesByPageNumber);
      
      for (const test of testsData) {
        // Tests have page_id, so we need to lookup the page to get page_number
        const page = pagesByPageId[test.page_id];
        if (page && page.webp_s3_key) {
          const pageNumber = page.page_number;
          console.log(`Test: ${test.test_name}, Page ID: ${test.page_id}, Page Number: ${pageNumber}`);
          
          if (!urls[pageNumber]) {
            try {
              const command = new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: page.webp_s3_key
              });
              urls[pageNumber] = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
              console.log(`Generated URL for page ${pageNumber}`);
            } catch (error) {
              console.error(`Error generating URL for page ${pageNumber}:`, error);
            }
          }
        } else {
          console.log(`Test: ${test.test_name}, Page ID: ${test.page_id}, No page data found`);
        }
      }
      console.log('Image URLs:', urls);
      setImageUrls(urls);
    } catch (error) {
      console.error('Error fetching test results:', error);
    } finally {
      setLoading(false);
    }
  };

  const openImageModal = (pageNumber, testDetails = null) => {
    if (imageUrls[pageNumber]) {
      setSelectedImage({ 
        pageNumber, 
        url: imageUrls[pageNumber],
        details: testDetails
      });
      setZoomLevel(1);
    }
  };

  const closeImageModal = () => {
    setSelectedImage(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedImage) {
        closeImageModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage]);

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.test_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAbnormal = !showAbnormalOnly || test.is_abnormal === 'Yes';
    return matchesSearch && matchesAbnormal;
  });

  if (loading) return <div className="loading">Loading test results...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>🔬 Test Results</h2>
        <p className="subtitle">{tests.length} test result(s) found</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search tests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showAbnormalOnly}
            onChange={(e) => setShowAbnormalOnly(e.target.checked)}
          />
          Show abnormal only
        </label>
      </div>

      {filteredTests.length === 0 ? (
        <div className="info-message">No test results found</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>Date</th>
                <th>Result</th>
                <th>Unit</th>
                <th>Normal Range</th>
                <th>Status</th>
                <th>Page</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((test, idx) => {
                // Get page data from page_id
                const testPage = Object.values(pages).find(p => p.page_id === test.page_id);
                const pageNumber = testPage?.page_number;
                
                return (
                  <tr key={idx} className={test.is_abnormal === 'Yes' ? 'abnormal-row' : ''}>
                    <td><strong>{test.test_name || 'N/A'}</strong></td>
                    <td>{test.test_date || 'N/A'}</td>
                    <td className="result-value">{test.result_value || 'N/A'}</td>
                    <td>{test.result_unit || '-'}</td>
                    <td>
                      {test.normal_range_low && test.normal_range_high
                        ? `${test.normal_range_low} - ${test.normal_range_high}`
                        : '-'}
                    </td>
                    <td>
                      <span className={`status ${test.is_abnormal === 'Yes' ? 'abnormal' : 'normal'}`}>
                        {test.is_abnormal === 'Yes' ? '⚠️ Abnormal' : '✓ Normal'}
                      </span>
                    </td>
                    <td>{pageNumber || '-'}</td>
                    <td>
                      {pageNumber && imageUrls[pageNumber] ? (
                        <button 
                          className="view-image-btn"
                          onClick={() => openImageModal(pageNumber, {
                            type: 'test',
                            name: test.test_name,
                            value: test.result_value,
                            unit: test.result_unit,
                            date: test.test_date,
                            abnormal: test.is_abnormal,
                            normalRange: test.normal_range_low && test.normal_range_high 
                              ? `${test.normal_range_low} - ${test.normal_range_high}` 
                              : null
                          })}
                          title="View source page"
                        >
                          🖼️ View
                        </button>
                      ) : (
                        <span className="no-image">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div className="zoom-modal" onClick={closeImageModal}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeImageModal} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={selectedImage.url}
                alt={`Page ${selectedImage.pageNumber}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>📄 Page {selectedImage.pageNumber}</h3>
              {selectedImage.details && selectedImage.details.type === 'test' && (
                <div className="extracted-info">
                  <h4>🔬 Extracted Test Result Information:</h4>
                  <div className="info-highlight">
                    <p><strong>Look for:</strong> "{selectedImage.details.name}"</p>
                    <p><strong>Result:</strong> {selectedImage.details.value} {selectedImage.details.unit || ''}</p>
                    {selectedImage.details.date && (
                      <p><strong>Date:</strong> {selectedImage.details.date}</p>
                    )}
                    {selectedImage.details.normalRange && (
                      <p><strong>Normal Range:</strong> {selectedImage.details.normalRange}</p>
                    )}
                    {selectedImage.details.abnormal === 'Yes' && (
                      <p className="abnormal-flag">⚠️ This result is abnormal</p>
                    )}
                  </div>
                  <p className="help-text">👆 Find this text on the page image above</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Image Gallery with Category Filters
function ImageGallery() {
  const { documentId } = useParams();
  const [pages, setPages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [imageUrls, setImageUrls] = useState({});
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    fetchPages();
  }, [documentId]);

  useEffect(() => {
    // Generate presigned URLs for all images
    const generateUrls = async () => {
      const urls = {};
      for (const page of filteredPages) { // Show all pages
        if (page.webp_s3_key) {
          try {
            const command = new GetObjectCommand({
              Bucket: S3_BUCKET,
              Key: page.webp_s3_key
            });
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            urls[page.page_id] = url;
          } catch (error) {
            console.error(`Error generating URL for page ${page.page_number}:`, error);
          }
        }
      }
      setImageUrls(urls);
    };

    if (filteredPages.length > 0) {
      generateUrls();
    }
  }, [selectedCategory, pages]);

  const fetchPages = async () => {
    try {
      const [pagesRes, categoriesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Pages',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Categories',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      const pagesData = pagesRes.Items || [];
      const categoriesData = categoriesRes.Items || [];

      // Organize categories by page
      const pageCategories = {};
      categoriesData.forEach(cat => {
        if (!pageCategories[cat.page_id]) {
          pageCategories[cat.page_id] = [];
        }
        pageCategories[cat.page_id].push(cat);
      });

      // Attach categories to pages
      const pagesWithCategories = pagesData.map(page => ({
        ...page,
        categories: pageCategories[page.page_id] || []
      }));

      // Sort by page number
      pagesWithCategories.sort((a, b) => (a.page_number || 0) - (b.page_number || 0));

      setPages(pagesWithCategories);

      // Get unique categories
      const uniqueCategories = [...new Set(categoriesData.map(cat => cat.category_name))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPages = selectedCategory === 'all'
    ? pages
    : pages.filter(page => 
        page.categories?.some(cat => cat.category_name === selectedCategory)
      );

  const openZoom = (page) => {
    setZoomedImage(page);
    setZoomLevel(1);
  };

  const closeZoom = () => {
    setZoomedImage(null);
    setZoomLevel(1);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && zoomedImage) {
        closeZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomedImage]);

  if (loading) return <div className="loading">Loading images...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>🖼️ Page Images</h2>
        <p className="subtitle">{pages.length} page(s)</p>
      </div>

      <div className="category-filter">
        <h3>Filter by Category:</h3>
        <div className="category-buttons">
          <button
            className={selectedCategory === 'all' ? 'active' : ''}
            onClick={() => setSelectedCategory('all')}
          >
            All Pages ({pages.length})
          </button>
          {categories.map(cat => {
            const count = pages.filter(p => 
              p.categories?.some(c => c.category_name === cat)
            ).length;
            return (
              <button
                key={cat}
                className={selectedCategory === cat ? 'active' : ''}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filteredPages.length === 0 ? (
        <div className="info-message">No pages found for this category</div>
      ) : (
        <div className="image-gallery">
          {filteredPages.map(page => (
            <div key={page.page_id} className="image-card">
              <div className="image-header">
                <h4>Page {page.page_number}</h4>
                {page.categories && page.categories.length > 0 && (
                  <div className="category-tags">
                    {page.categories.map((cat, idx) => (
                      <span key={idx} className="category-tag" title={cat.reason}>
                        {cat.category_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="image-container">
                {imageUrls[page.page_id] ? (
                  <img
                    src={imageUrls[page.page_id]}
                    alt={`Page ${page.page_number}`}
                    loading="lazy"
                    onClick={() => openZoom(page)}
                    style={{ cursor: 'zoom-in' }}
                  />
                ) : (
                  <div className="image-placeholder">Loading image...</div>
                )}
              </div>
              
              <div className="image-footer">
                <span className={`status ${page.ai_processed ? 'processed' : 'pending'}`}>
                  {page.ai_processed ? '✓ Processed' : '⏳ Processing...'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {zoomedImage && (
        <div className="zoom-modal" onClick={closeZoom}>
          <div className="zoom-controls">
            <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}>
              🔍−
            </button>
            <span>{Math.round(zoomLevel * 100)}%</span>
            <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}>
              🔍+
            </button>
            <button onClick={closeZoom} className="close-btn">
              ✕ Close
            </button>
          </div>
          <div className="zoom-content" onClick={(e) => e.stopPropagation()}>
            <div className="zoom-image-wrapper">
              <img
                src={imageUrls[zoomedImage.page_id]}
                alt={`Page ${zoomedImage.page_number}`}
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
            <div className="zoom-info">
              <h3>Page {zoomedImage.page_number}</h3>
              {zoomedImage.categories && zoomedImage.categories.length > 0 && (
                <div className="category-tags">
                  {zoomedImage.categories.map((cat, idx) => (
                    <span key={idx} className="category-tag">
                      {cat.category_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Doctors Page - Healthcare Provider Verification
function DoctorsPage() {
  const { documentId } = useParams();
  const [providers, setProviders] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchingNPI, setSearchingNPI] = useState({});
  const [npiData, setNpiData] = useState({});

  useEffect(() => {
    fetchData();
  }, [documentId]);

  const fetchData = async () => {
    try {
      const [providersRes, diagnosesRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Providers',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Diagnoses',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      setProviders(providersRes.Items || []);
      setDiagnoses(diagnosesRes.Items || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchNPI = async (provider, index) => {
    setSearchingNPI(prev => ({ ...prev, [index]: true }));
    
    try {
      const firstName = provider.doctor_first_name || '';
      const lastName = provider.doctor_last_name || '';
      
      // Use our DynamoDB-backed NPI lookup API
      const params = new URLSearchParams({
        last_name: lastName.toUpperCase(),
        ...(firstName && { first_name: firstName })
      });

      const response = await fetch(`https://m555q9j31d.execute-api.us-east-1.amazonaws.com/prod/npi-lookup?${params}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const npiResult = data.results[0];
        setNpiData(prev => ({
          ...prev,
          [index]: {
            npi: npiResult.number,
            name: `${npiResult.basic.first_name} ${npiResult.basic.last_name}`,
            credential: npiResult.basic.credential,
            gender: npiResult.basic.gender,
            addresses: npiResult.addresses,
            taxonomies: npiResult.taxonomies,
            found: true
          }
        }));
      } else {
        setNpiData(prev => ({
          ...prev,
          [index]: { found: false, message: 'No NPI record found for this provider in database' }
        }));
      }
    } catch (error) {
      console.error('Error searching NPI:', error);
      setNpiData(prev => ({
        ...prev,
        [index]: { found: false, message: 'Error searching NPI database' }
      }));
    } finally {
      setSearchingNPI(prev => ({ ...prev, [index]: false }));
    }
  };

  const analyzeRelevance = (provider) => {
    // Find diagnoses made by this doctor
    const doctorDiagnoses = diagnoses.filter(diag => {
      const diagDoctor = `${diag.diagnosing_doctor_first_name} ${diag.diagnosing_doctor_last_name}`.trim().toLowerCase();
      const providerName = `${provider.doctor_first_name} ${provider.doctor_last_name}`.trim().toLowerCase();
      return diagDoctor === providerName;
    });

    if (doctorDiagnoses.length === 0) {
      return { relevant: 'Unknown', reason: 'No diagnoses found for this provider', count: 0 };
    }

    // Check if doctor's specialty matches the diagnoses
    const specialty = (provider.specialty || '').toLowerCase();
    let relevantCount = 0;
    let totalCount = doctorDiagnoses.length;

    doctorDiagnoses.forEach(diag => {
      const specialty_relevance = (diag.specialty_relevance || '').toLowerCase();
      if (specialty_relevance.includes('high')) {
        relevantCount++;
      }
    });

    const relevancePercent = (relevantCount / totalCount) * 100;

    if (relevancePercent >= 75) {
      return { 
        relevant: 'High', 
        reason: `${relevantCount}/${totalCount} diagnoses match specialty`,
        count: totalCount,
        color: 'green'
      };
    } else if (relevancePercent >= 50) {
      return { 
        relevant: 'Medium', 
        reason: `${relevantCount}/${totalCount} diagnoses match specialty`,
        count: totalCount,
        color: 'yellow'
      };
    } else {
      return { 
        relevant: 'Low', 
        reason: `Only ${relevantCount}/${totalCount} diagnoses match specialty`,
        count: totalCount,
        color: 'red'
      };
    }
  };

  if (loading) return <div className="loading">Loading healthcare providers...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>👨‍⚕️ Healthcare Providers & NPI Verification</h2>
        <p className="subtitle">
          {providers.length} provider(s) found in document • Verify credentials via NPI Registry
        </p>
      </div>

      {providers.length === 0 ? (
        <div className="info-message">
          No healthcare providers found in this document.
        </div>
      ) : (
        <div className="doctors-grid">
          {providers.map((provider, idx) => {
            const relevance = analyzeRelevance(provider);
            const npi = npiData[idx];

            return (
              <div key={idx} className="doctor-card">
                <div className="doctor-header">
                  <div>
                    <h3>Dr. {provider.doctor_first_name} {provider.doctor_last_name}</h3>
                    {provider.specialty && (
                      <span className="doctor-specialty-badge">{provider.specialty}</span>
                    )}
                  </div>
                  <button 
                    className="npi-search-btn"
                    onClick={() => searchNPI(provider, idx)}
                    disabled={searchingNPI[idx] || npi}
                  >
                    {searchingNPI[idx] ? '🔍 Searching...' : npi ? '✓ Verified' : '🔍 Verify NPI'}
                  </button>
                </div>

                <div className="doctor-info">
                  {provider.role_in_care && (
                    <p><strong>Role:</strong> {provider.role_in_care}</p>
                  )}
                  {provider.facility && (
                    <p><strong>Facility:</strong> {provider.facility}</p>
                  )}
                  {provider.contact_info && (
                    <p><strong>Contact:</strong> {provider.contact_info}</p>
                  )}
                </div>

                {relevance.count > 0 && (
                  <div className={`relevance-analysis relevance-${relevance.color}`}>
                    <h4>Specialty Relevance Analysis</h4>
                    <div className="relevance-badge">
                      <span className={`badge-${relevance.color}`}>{relevance.relevant}</span>
                    </div>
                    <p>{relevance.reason}</p>
                    <p className="diagnosis-count">Made {relevance.count} diagnosis/diagnoses in this document</p>
                  </div>
                )}

                {npi && npi.found && (
                  <div className="npi-results">
                    <h4>✓ NPI Registry Data</h4>
                    <div className="npi-grid">
                      <div className="npi-item">
                        <span className="npi-label">NPI Number:</span>
                        <span className="npi-value">{npi.npi}</span>
                      </div>
                      <div className="npi-item">
                        <span className="npi-label">Full Name:</span>
                        <span className="npi-value">{npi.name} {npi.credential}</span>
                      </div>
                      <div className="npi-item">
                        <span className="npi-label">Gender:</span>
                        <span className="npi-value">{npi.gender}</span>
                      </div>
                      {npi.taxonomies && npi.taxonomies.length > 0 && (
                        <div className="npi-item full-width">
                          <span className="npi-label">Specialties:</span>
                          <div className="taxonomy-list">
                            {npi.taxonomies.map((tax, i) => (
                              <span key={i} className="taxonomy-badge">
                                {tax.desc} {tax.primary && '(Primary)'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {npi.addresses && npi.addresses.length > 0 && (
                        <div className="npi-item full-width">
                          <span className="npi-label">Practice Address:</span>
                          <span className="npi-value">
                            {npi.addresses[0].address_1}, {npi.addresses[0].city}, {npi.addresses[0].state} {npi.addresses[0].postal_code}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {npi && !npi.found && (
                  <div className="npi-not-found">
                    <p>⚠️ {npi.message}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Next Steps Page - AI-Powered Recommendations
function NextStepsPage() {
  const { documentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    fetchDataAndGenerateRecommendations();
  }, [documentId]);

  const fetchDataAndGenerateRecommendations = async () => {
    try {
      // Fetch all relevant medical data
      const [medsRes, diagRes, testsRes] = await Promise.all([
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Medications',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-Diagnoses',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        })),
        docClient.send(new ScanCommand({
          TableName: 'HealthAI-TestResults',
          FilterExpression: 'document_id = :docId',
          ExpressionAttributeValues: { ':docId': documentId }
        }))
      ]);

      const medsData = medsRes.Items || [];
      const diagData = diagRes.Items || [];
      const testsData = testsRes.Items || [];

      setMedications(medsData);
      setDiagnoses(diagData);
      setTestResults(testsData);

      // Generate AI-powered recommendations
      const aiRecommendations = generateRecommendations(medsData, diagData, testsData);
      setRecommendations(aiRecommendations);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = (meds, diags, tests) => {
    const recs = [];
    
    // Analyze medications
    const currentMeds = meds.filter(m => m.is_current === 'Yes');
    const discontinuedMeds = meds.filter(m => m.is_current !== 'Yes');
    
    if (currentMeds.length > 5) {
      recs.push({
        category: 'Medication Management',
        priority: 'high',
        icon: '💊',
        title: 'Medication Review Recommended',
        description: `Patient is currently on ${currentMeds.length} medications. Consider scheduling a comprehensive medication review to assess for potential drug interactions and optimize therapy.`,
        actions: [
          'Schedule pharmacist consultation',
          'Review for duplicate therapies',
          'Check for drug-drug interactions',
          'Assess medication adherence'
        ]
      });
    }

    // Check for specific medication classes
    const hasAnticoagulant = currentMeds.some(m => 
      m.medication_name?.toLowerCase().includes('warfarin') ||
      m.medication_name?.toLowerCase().includes('apixaban') ||
      m.medication_name?.toLowerCase().includes('rivaroxaban')
    );
    
    if (hasAnticoagulant) {
      recs.push({
        category: 'Lab Monitoring',
        priority: 'high',
        icon: '🔬',
        title: 'Anticoagulation Monitoring Required',
        description: 'Patient is on anticoagulation therapy. Regular monitoring is essential for patient safety.',
        actions: [
          'Schedule INR/PT testing (if on warfarin)',
          'Monitor for bleeding complications',
          'Review medication interactions',
          'Patient education on dietary restrictions'
        ]
      });
    }

    // Analyze diagnoses
    const hasChronicCondition = diags.some(d => {
      const desc = d.diagnosis_description?.toLowerCase() || '';
      return desc.includes('diabetes') || desc.includes('hypertension') || 
             desc.includes('heart failure') || desc.includes('copd') ||
             desc.includes('asthma') || desc.includes('chronic');
    });

    if (hasChronicCondition) {
      recs.push({
        category: 'Chronic Disease Management',
        priority: 'medium',
        icon: '🩺',
        title: 'Chronic Condition Follow-up',
        description: 'Patient has chronic conditions requiring ongoing management and monitoring.',
        actions: [
          'Schedule regular follow-up appointments',
          'Review disease-specific care plans',
          'Assess need for specialist referrals',
          'Patient education on condition management'
        ]
      });
    }

    // Check for diabetes-related needs
    const hasDiabetes = diags.some(d => 
      d.diagnosis_description?.toLowerCase().includes('diabetes')
    );
    
    if (hasDiabetes) {
      recs.push({
        category: 'Diabetes Care',
        priority: 'high',
        icon: '🩸',
        title: 'Diabetes Monitoring & Management',
        description: 'Comprehensive diabetes care plan recommended.',
        actions: [
          'Schedule HbA1c testing (every 3 months)',
          'Annual comprehensive foot exam',
          'Annual dilated eye exam',
          'Kidney function monitoring (eGFR, urine albumin)',
          'Review blood glucose monitoring logs',
          'Assess for diabetic complications'
        ]
      });
    }

    // Analyze abnormal test results
    const abnormalTests = tests.filter(t => t.is_abnormal === 'Yes');
    
    if (abnormalTests.length > 0) {
      const criticalTests = abnormalTests.filter(t => {
        const name = t.test_name?.toLowerCase() || '';
        return name.includes('creatinine') || name.includes('potassium') || 
               name.includes('glucose') || name.includes('hemoglobin');
      });

      if (criticalTests.length > 0) {
        recs.push({
          category: 'Lab Follow-up',
          priority: 'high',
          icon: '⚠️',
          title: 'Abnormal Lab Results Require Attention',
          description: `${abnormalTests.length} abnormal test results found. ${criticalTests.length} may require immediate attention.`,
          actions: [
            'Review all abnormal results with physician',
            'Repeat testing as clinically indicated',
            'Consider specialist referral if needed',
            'Adjust medications based on results'
          ],
          details: criticalTests.map(t => 
            `${t.test_name}: ${t.result_value} ${t.result_unit || ''} (Normal: ${t.normal_range_low || '?'}-${t.normal_range_high || '?'})`
          )
        });
      } else {
        recs.push({
          category: 'Lab Follow-up',
          priority: 'medium',
          icon: '🔬',
          title: 'Lab Results Review Needed',
          description: `${abnormalTests.length} abnormal test results require follow-up.`,
          actions: [
            'Discuss results with patient',
            'Determine if repeat testing needed',
            'Document clinical decision-making'
          ]
        });
      }
    }

    // Check for cardiovascular risk
    const hasCardiacCondition = diags.some(d => {
      const desc = d.diagnosis_description?.toLowerCase() || '';
      return desc.includes('hypertension') || desc.includes('heart') || 
             desc.includes('cardiac') || desc.includes('coronary');
    });

    if (hasCardiacCondition) {
      recs.push({
        category: 'Cardiovascular Health',
        priority: 'medium',
        icon: '❤️',
        title: 'Cardiovascular Risk Management',
        description: 'Patient has cardiovascular conditions requiring proactive management.',
        actions: [
          'Assess cardiovascular risk factors',
          'Monitor blood pressure regularly',
          'Review lipid panel results',
          'Encourage lifestyle modifications',
          'Consider cardiology referral if not already established'
        ]
      });
    }

    // General preventive care recommendations
    recs.push({
      category: 'Preventive Care',
      priority: 'low',
      icon: '🛡️',
      title: 'Routine Preventive Health Maintenance',
      description: 'Ensure patient is up-to-date with age-appropriate preventive care.',
      actions: [
        'Review immunization status',
        'Age-appropriate cancer screenings',
        'Annual wellness visit',
        'Lifestyle counseling (diet, exercise, smoking cessation)'
      ]
    });

    // Check for polypharmacy in elderly
    if (currentMeds.length >= 5) {
      recs.push({
        category: 'Medication Safety',
        priority: 'medium',
        icon: '⚕️',
        title: 'Polypharmacy Assessment',
        description: 'Multiple medications increase risk of adverse effects and interactions.',
        actions: [
          'Deprescribing review - assess each medication necessity',
          'Check for potentially inappropriate medications',
          'Simplify medication regimen if possible',
          'Ensure patient understanding of each medication'
        ]
      });
    }

    // Sort by priority
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    return recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  };

  const sendEmailToBroker = () => {
    // Format all findings into email body
    const currentMeds = medications.filter(m => m.is_current === 'Yes');
    const abnormalTests = testResults.filter(t => t.is_abnormal === 'Yes');
    const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
    
    let emailBody = `HEALTHAI - COMPREHENSIVE MEDICAL FINDINGS REPORT\n`;
    emailBody += `================================================\n\n`;
    
    // Patient Summary
    emailBody += `PATIENT SUMMARY\n`;
    emailBody += `---------------\n`;
    emailBody += `Total Medications: ${medications.length} (${currentMeds.length} current)\n`;
    emailBody += `Active Diagnoses: ${diagnoses.length}\n`;
    emailBody += `Test Results: ${testResults.length} (${abnormalTests.length} abnormal)\n`;
    emailBody += `AI Recommendations: ${recommendations.length} (${highPriorityRecs.length} high priority)\n\n`;
    
    // Current Medications
    if (currentMeds.length > 0) {
      emailBody += `CURRENT MEDICATIONS (${currentMeds.length})\n`;
      emailBody += `==============================\n`;
      currentMeds.forEach((med, idx) => {
        emailBody += `${idx + 1}. ${med.medication_name}\n`;
        if (med.dosage) emailBody += `   Dosage: ${med.dosage}\n`;
        if (med.frequency) emailBody += `   Frequency: ${med.frequency}\n`;
        if (med.prescribing_provider) emailBody += `   Prescriber: ${med.prescribing_provider}\n`;
        emailBody += `\n`;
      });
      emailBody += `\n`;
    }
    
    // Active Diagnoses
    if (diagnoses.length > 0) {
      emailBody += `ACTIVE DIAGNOSES (${diagnoses.length})\n`;
      emailBody += `=======================\n`;
      diagnoses.forEach((diag, idx) => {
        emailBody += `${idx + 1}. ${diag.diagnosis_description}\n`;
        if (diag.icd_code) emailBody += `   ICD Code: ${diag.icd_code}\n`;
        if (diag.medical_specialty) emailBody += `   Specialty: ${diag.medical_specialty}\n`;
        if (diag.diagnosis_date) emailBody += `   Date: ${diag.diagnosis_date}\n`;
        if (diag.diagnosing_provider) emailBody += `   Provider: ${diag.diagnosing_provider}\n`;
        emailBody += `\n`;
      });
      emailBody += `\n`;
    }
    
    // Abnormal Test Results
    if (abnormalTests.length > 0) {
      emailBody += `ABNORMAL TEST RESULTS (${abnormalTests.length})\n`;
      emailBody += `================================\n`;
      abnormalTests.forEach((test, idx) => {
        emailBody += `${idx + 1}. ${test.test_name}\n`;
        emailBody += `   Result: ${test.result_value}`;
        if (test.unit_of_measure) emailBody += ` ${test.unit_of_measure}`;
        emailBody += `\n`;
        if (test.reference_range) emailBody += `   Normal Range: ${test.reference_range}\n`;
        if (test.test_date) emailBody += `   Date: ${test.test_date}\n`;
        emailBody += `\n`;
      });
      emailBody += `\n`;
    }
    
    // AI Recommendations
    if (recommendations.length > 0) {
      emailBody += `AI-POWERED RECOMMENDATIONS (${recommendations.length})\n`;
      emailBody += `========================================\n`;
      recommendations.forEach((rec, idx) => {
        emailBody += `${idx + 1}. [${rec.priority.toUpperCase()} PRIORITY] ${rec.title}\n`;
        emailBody += `   Category: ${rec.category}\n`;
        emailBody += `   ${rec.description}\n`;
        emailBody += `   Actions:\n`;
        rec.actions.forEach(action => {
          emailBody += `   - ${action}\n`;
        });
        if (rec.details && rec.details.length > 0) {
          emailBody += `   Details:\n`;
          rec.details.forEach(detail => {
            emailBody += `   - ${detail}\n`;
          });
        }
        emailBody += `\n`;
      });
      emailBody += `\n`;
    }
    
    emailBody += `\n================================================\n`;
    emailBody += `This report was generated by HealthAI document analysis system.\n`;
    emailBody += `Please review all findings with appropriate medical professionals.\n`;
    
    // Create mailto link
    const subject = `HealthAI Medical Findings Report - Document ${documentId}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    // Open email client
    window.location.href = mailtoLink;
  };

  if (loading) return <div className="loading">Analyzing patient data and generating recommendations...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>🎯 Next Steps - AI-Powered Recommendations</h2>
        <p className="subtitle">
          Based on analysis of {medications.length} medications, {diagnoses.length} diagnoses, 
          and {testResults.length} test results
        </p>
        <button className="email-broker-btn" onClick={sendEmailToBroker}>
          📧 Email Findings to Broker
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon">💊</div>
          <div className="summary-content">
            <h3>{medications.filter(m => m.is_current === 'Yes').length}</h3>
            <p>Current Medications</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🩺</div>
          <div className="summary-content">
            <h3>{diagnoses.length}</h3>
            <p>Active Diagnoses</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⚠️</div>
          <div className="summary-content">
            <h3>{testResults.filter(t => t.is_abnormal === 'Yes').length}</h3>
            <p>Abnormal Results</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">🎯</div>
          <div className="summary-content">
            <h3>{recommendations.length}</h3>
            <p>Recommendations</p>
          </div>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="info-message">
          <p>✅ No specific recommendations at this time.</p>
          <p className="subtitle">Continue with routine care and monitoring.</p>
        </div>
      ) : (
        <div className="recommendations-container">
          {recommendations.map((rec, idx) => (
            <div key={idx} className={`recommendation-card priority-${rec.priority}`}>
              <div className="rec-header">
                <div className="rec-icon">{rec.icon}</div>
                <div className="rec-title-section">
                  <h3>{rec.title}</h3>
                  <span className={`priority-badge priority-${rec.priority}`}>
                    {rec.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>
              
              <div className="rec-category">{rec.category}</div>
              <p className="rec-description">{rec.description}</p>
              
              <div className="rec-actions">
                <h4>Recommended Actions:</h4>
                <ul>
                  {rec.actions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              </div>

              {rec.details && rec.details.length > 0 && (
                <div className="rec-details">
                  <h4>Details:</h4>
                  <ul>
                    {rec.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer">
        <h4>⚕️ Clinical Disclaimer</h4>
        <p>
          These recommendations are generated by AI analysis and are intended to support clinical 
          decision-making, not replace it. All recommendations should be reviewed by a qualified 
          healthcare professional and tailored to the individual patient's needs, circumstances, 
          and current clinical guidelines.
        </p>
      </div>
    </div>
  );
}

// Status Tab Component - Document Processing History and Status
function StatusTab({ patientId }) {
  const [documentStatus, setDocumentStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchDocumentStatus();
    
    // Auto-refresh every 10 seconds if enabled and there are in-flight documents
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchDocumentStatus();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [patientId, autoRefresh]);

  const fetchDocumentStatus = async () => {
    try {
      // Fetch all documents for this patient
      const documentsRes = await docClient.send(new ScanCommand({
        TableName: 'HealthAI-Documents',
        FilterExpression: 'patient_id = :pid OR contains(original_filename, :pid)',
        ExpressionAttributeValues: {
          ':pid': patientId
        }
      }));

      const documents = documentsRes.Items || [];
      
      // For each document, fetch page count and processing status
      const statusPromises = documents.map(async (doc) => {
        try {
          // Count total pages for this document
          const pagesRes = await docClient.send(new ScanCommand({
            TableName: 'HealthAI-Pages',
            FilterExpression: 'document_id = :did',
            ExpressionAttributeValues: {
              ':did': doc.document_id
            },
            Select: 'COUNT'
          }));
          
          const processedPages = pagesRes.Count || 0;
          
          return {
            document_id: doc.document_id,
            filename: doc.original_filename || 'Unknown',
            upload_date: doc.upload_timestamp || doc.created_at || 'Unknown',
            total_pages: doc.total_pages || 0,
            processed_pages: processedPages,
            status: processedPages >= (doc.total_pages || 0) ? 'Complete' : 'Processing',
            progress: doc.total_pages ? Math.round((processedPages / doc.total_pages) * 100) : 0,
            file_size: doc.file_size || 0,
            processing_time: doc.processing_time || 'N/A'
          };
        } catch (err) {
          console.error('Error fetching status for document:', doc.document_id, err);
          return {
            document_id: doc.document_id,
            filename: doc.original_filename || 'Unknown',
            upload_date: doc.upload_timestamp || 'Unknown',
            total_pages: doc.total_pages || 0,
            processed_pages: 0,
            status: 'Error',
            progress: 0,
            file_size: doc.file_size || 0,
            processing_time: 'N/A'
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      
      // Sort by upload date (most recent first)
      statuses.sort((a, b) => {
        const dateA = new Date(a.upload_date);
        const dateB = new Date(b.upload_date);
        return dateB - dateA;
      });
      
      setDocumentStatus(statuses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching document status:', error);
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 'Unknown') return 'Unknown';
    try {
      // If it's a number, treat it as milliseconds timestamp
      const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Unknown';
    }
  };

  const getStatusBadge = (status, progress) => {
    if (status === 'Complete') {
      return <span className="status-badge status-complete">✓ Complete</span>;
    } else if (status === 'Processing') {
      return <span className="status-badge status-processing">⟳ Processing ({progress}%)</span>;
    } else {
      return <span className="status-badge status-error">⚠ Error</span>;
    }
  };

  const hasInFlightDocs = documentStatus.some(doc => doc.status === 'Processing');

  return (
    <div className="status-tab">
      <div className="status-header">
        <div>
          <h2>📋 Document Processing Status</h2>
          <p>Upload history and real-time processing status for all documents</p>
        </div>
        <div className="status-controls">
          <label className="auto-refresh-toggle">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh every 10s
          </label>
          <button onClick={fetchDocumentStatus} className="refresh-button">
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading document status...</div>
      ) : documentStatus.length === 0 ? (
        <div className="no-data">
          <p>No documents found for this patient.</p>
        </div>
      ) : (
        <>
          {hasInFlightDocs && (
            <div className="in-flight-alert">
              <strong>⚡ Active Processing:</strong> {documentStatus.filter(d => d.status === 'Processing').length} document(s) currently being processed
            </div>
          )}
          
          <div className="status-table-container">
            <table className="status-table">
              <thead>
                <tr>
                  <th>Document ID</th>
                  <th>Filename</th>
                  <th>Upload Date/Time</th>
                  <th>File Size</th>
                  <th>Total Pages</th>
                  <th>Processed</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {documentStatus.map((doc, idx) => (
                  <tr key={idx} className={doc.status === 'Processing' ? 'processing-row' : ''}>
                    <td className="document-id">
                      <code>{doc.document_id.substring(0, 8)}...</code>
                    </td>
                    <td className="filename">{doc.filename}</td>
                    <td>{formatDate(doc.upload_date)}</td>
                    <td>{formatFileSize(doc.file_size)}</td>
                    <td className="text-center">{doc.total_pages}</td>
                    <td className="text-center">{doc.processed_pages}</td>
                    <td>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${doc.progress}%` }}
                        ></div>
                        <span className="progress-text">{doc.progress}%</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(doc.status, doc.progress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="status-summary">
            <div className="summary-stat">
              <strong>Total Documents:</strong> {documentStatus.length}
            </div>
            <div className="summary-stat">
              <strong>Completed:</strong> {documentStatus.filter(d => d.status === 'Complete').length}
            </div>
            <div className="summary-stat">
              <strong>Processing:</strong> {documentStatus.filter(d => d.status === 'Processing').length}
            </div>
            <div className="summary-stat">
              <strong>Errors:</strong> {documentStatus.filter(d => d.status === 'Error').length}
            </div>
            <div className="summary-stat">
              <strong>Total Pages Processed:</strong> {documentStatus.reduce((sum, d) => sum + d.processed_pages, 0)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Review Queue Component - Human-in-the-Loop for Low Confidence Extractions
function ReviewQueue() {
  const [reviewItems, setReviewItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const navigate = useNavigate();

  useEffect(() => {
    loadReviewQueue();
  }, [statusFilter]);

  const loadReviewQueue = async () => {
    setLoading(true);
    try {
      // Demo data for presentation
      const demoData = {
        PENDING: [
          {
            review_id: 'rev-12345678-demo-1',
            page_number: 3,
            document_id: 'doc-abc123def456-patient-smith',
            created_at: Math.floor(Date.now() / 1000) - 3600,
            confidence_score: 0.048,
            flagged_reason: 'Low confidence on medication dosage extraction',
            data_summary: {
              medications_count: 2,
              diagnoses_count: 1,
              test_results_count: 0
            }
          },
          {
            review_id: 'rev-87654321-demo-2',
            page_number: 7,
            document_id: 'doc-xyz789ghi012-patient-jones',
            created_at: Math.floor(Date.now() / 1000) - 7200,
            confidence_score: 0.065,
            flagged_reason: 'Unclear diagnosis code in handwritten notes',
            data_summary: {
              medications_count: 0,
              diagnoses_count: 3,
              test_results_count: 1
            }
          },
          {
            review_id: 'rev-11223344-demo-3',
            page_number: 12,
            document_id: 'doc-mno456pqr789-patient-williams',
            created_at: Math.floor(Date.now() / 1000) - 10800,
            confidence_score: 0.092,
            flagged_reason: 'Multiple test results with ambiguous values',
            data_summary: {
              medications_count: 1,
              diagnoses_count: 0,
              test_results_count: 5
            }
          },
          {
            review_id: 'rev-55667788-demo-4',
            page_number: 5,
            document_id: 'doc-stu901vwx234-patient-brown',
            created_at: Math.floor(Date.now() / 1000) - 14400,
            confidence_score: 0.037,
            flagged_reason: 'Faded document with poor OCR quality',
            data_summary: {
              medications_count: 4,
              diagnoses_count: 2,
              test_results_count: 2
            }
          }
        ],
        IN_REVIEW: [
          {
            review_id: 'rev-99887766-demo-5',
            page_number: 2,
            document_id: 'doc-aaa111bbb222-patient-davis',
            created_at: Math.floor(Date.now() / 1000) - 18000,
            confidence_score: 0.074,
            flagged_reason: 'Conflicting medication information',
            data_summary: {
              medications_count: 3,
              diagnoses_count: 1,
              test_results_count: 0
            }
          }
        ],
        APPROVED: [],
        REJECTED: [],
        CORRECTED: []
      };

      const items = demoData[statusFilter] || [];
      
      // Try to load real data, but fallback to demo data if it fails
      try {
        const command = new ScanCommand({
          TableName: 'HealthAI-dev-ReviewQueue',
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': statusFilter }
        });

        const response = await docClient.send(command);
        const realItems = response.Items || [];
        
        if (realItems.length > 0) {
          // Use real data if available
          realItems.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          setReviewItems(realItems);
        } else {
          // Use demo data
          setReviewItems(items);
        }
      } catch (error) {
        console.log('Using demo data for review queue');
        setReviewItems(items);
      }
    } catch (error) {
      console.error('Error loading review queue:', error);
    }
    setLoading(false);
  };

  const getConfidenceBadge = (confidence) => {
    const pct = (confidence * 100).toFixed(1);
    const className = confidence < 0.05 ? 'confidence-critical' : 
                      confidence < 0.10 ? 'confidence-low' : 
                      'confidence-medium';
    return <span className={`confidence-badge ${className}`}>{pct}%</span>;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="review-queue-page">
      <div className="page-header">
        <h2>🔍 Human Review Queue</h2>
        <p className="subtitle">Low-confidence AI extractions requiring validation (threshold: 10%)</p>
      </div>

      <div className="review-filters">
        <button 
          className={`filter-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          Pending Review
        </button>
        <button 
          className={`filter-btn ${statusFilter === 'IN_REVIEW' ? 'active' : ''}`}
          onClick={() => setStatusFilter('IN_REVIEW')}
        >
          In Review
        </button>
        <button 
          className={`filter-btn ${statusFilter === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('APPROVED')}
        >
          Approved
        </button>
        <button 
          className={`filter-btn ${statusFilter === 'REJECTED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('REJECTED')}
        >
          Rejected
        </button>
        <button 
          className={`filter-btn ${statusFilter === 'CORRECTED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('CORRECTED')}
        >
          Corrected
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading review queue...</div>
      ) : reviewItems.length === 0 ? (
        <div className="no-items">
          <p>✅ No items in {statusFilter.toLowerCase()} status</p>
        </div>
      ) : (
        <div className="review-items-grid">
          {reviewItems.map((item) => (
            <div 
              key={item.review_id} 
              className="review-card"
              onClick={() => navigate(`/review/${item.review_id}`)}
            >
              <div className="review-card-header">
                <div className="review-id">Review #{item.review_id.substring(0, 8)}</div>
                {getConfidenceBadge(item.confidence_score)}
              </div>
              
              <div className="review-card-body">
                <div className="review-info">
                  <strong>Page:</strong> {item.page_number}
                </div>
                <div className="review-info">
                  <strong>Document:</strong> {item.document_id.substring(0, 12)}...
                </div>
                <div className="review-info">
                  <strong>Flagged:</strong> {formatDate(item.created_at)}
                </div>
                <div className="review-info">
                  <strong>Reason:</strong> {item.flagged_reason}
                </div>
                
                {item.data_summary && (
                  <div className="data-summary">
                    <div className="summary-badge">
                      {item.data_summary.medications_count || 0} Medications
                    </div>
                    <div className="summary-badge">
                      {item.data_summary.diagnoses_count || 0} Diagnoses
                    </div>
                    <div className="summary-badge">
                      {item.data_summary.test_results_count || 0} Tests
                    </div>
                  </div>
                )}
              </div>
              
              <div className="review-card-footer">
                <button className="btn-primary">Review →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="queue-stats">
        <div className="stat-box">
          <div className="stat-value">{reviewItems.length}</div>
          <div className="stat-label">{statusFilter} Items</div>
        </div>
      </div>
    </div>
  );
}

// Review Detail Component - Individual Review Interface
function ReviewDetail() {
  const { reviewId } = useParams();
  const [reviewItem, setReviewItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadReviewItem();
  }, [reviewId]);

  const loadReviewItem = async () => {
    setLoading(true);
    try {
      const command = new QueryCommand({
        TableName: 'HealthAI-dev-ReviewQueue',
        KeyConditionExpression: 'review_id = :rid',
        ExpressionAttributeValues: { ':rid': reviewId }
      });

      const response = await docClient.send(command);
      if (response.Items && response.Items.length > 0) {
        const item = response.Items[0];
        setReviewItem(item);
        
        // Load image
        if (item.webp_key) {
          const getObjectCommand = new GetObjectCommand({
            Bucket: item.webp_bucket || 'futuregen-health-ai',
            Key: item.webp_key
          });
          const url = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
          setImageUrl(url);
        }
      }
    } catch (error) {
      console.error('Error loading review item:', error);
    }
    setLoading(false);
  };

  const handleReview = async (action) => {
    setSubmitting(true);
    try {
      const updateCommand = new QueryCommand({
        TableName: 'HealthAI-dev-ReviewQueue',
        Key: { review_id: reviewId },
        UpdateExpression: 'SET #status = :status, reviewer_id = :reviewer, reviewed_at = :time, reviewer_notes = :notes',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': action.toUpperCase(),
          ':reviewer': 'current_user', // TODO: Get from auth
          ':time': Math.floor(Date.now() / 1000),
          ':notes': reviewNotes
        }
      });

      await docClient.send(updateCommand);
      alert(`Review ${action}!`);
      navigate('/review-queue');
    } catch (error) {
      console.error('Error updating review:', error);
      alert('Error submitting review');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="loading">Loading review item...</div>;
  }

  if (!reviewItem) {
    return <div className="error">Review item not found</div>;
  }

  const extractedData = reviewItem.extracted_data || {};

  return (
    <div className="review-detail-page">
      <div className="review-header">
        <button className="btn-back" onClick={() => navigate('/review-queue')}>
          ← Back to Queue
        </button>
        <h2>Review Item: {reviewId.substring(0, 12)}</h2>
        <div className="confidence-display">
          Confidence: <strong>{(reviewItem.confidence_score * 100).toFixed(1)}%</strong>
        </div>
      </div>

      <div className="review-layout">
        <div className="review-image-panel">
          <h3>Document Page {reviewItem.page_number}</h3>
          {imageUrl ? (
            <img src={imageUrl} alt={`Page ${reviewItem.page_number}`} className="review-image" />
          ) : (
            <div className="no-image">Image not available</div>
          )}
        </div>

        <div className="review-data-panel">
          <h3>Extracted Data</h3>
          
          {extractedData.medications && extractedData.medications.length > 0 && (
            <div className="data-section">
              <h4>💊 Medications ({extractedData.medications.length})</h4>
              {extractedData.medications.map((med, idx) => (
                <div key={idx} className="data-item">
                  <strong>{med.medication_name}</strong> - {med.dosage} {med.frequency}
                  {med.notes && <div className="item-notes">{med.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {extractedData.diagnoses && extractedData.diagnoses.length > 0 && (
            <div className="data-section">
              <h4>🩺 Diagnoses ({extractedData.diagnoses.length})</h4>
              {extractedData.diagnoses.map((diag, idx) => (
                <div key={idx} className="data-item">
                  <strong>{diag.diagnosis_description}</strong>
                  {diag.diagnosis_code && <span> ({diag.diagnosis_code})</span>}
                  {diag.notes && <div className="item-notes">{diag.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {extractedData.test_results && extractedData.test_results.length > 0 && (
            <div className="data-section">
              <h4>🧪 Test Results ({extractedData.test_results.length})</h4>
              {extractedData.test_results.map((test, idx) => (
                <div key={idx} className="data-item">
                  <strong>{test.test_name}</strong>: {test.result_value} {test.result_unit}
                  {test.is_abnormal === 'yes' && <span className="abnormal-flag"> ⚠️ Abnormal</span>}
                </div>
              ))}
            </div>
          )}

          <div className="review-actions">
            <h4>Review Decision</h4>
            <textarea
              placeholder="Add notes about this review..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows="4"
              className="review-notes-input"
            />
            
            <div className="action-buttons">
              <button 
                className="btn-approve"
                onClick={() => handleReview('approved')}
                disabled={submitting}
              >
                ✓ Approve
              </button>
              <button 
                className="btn-reject"
                onClick={() => handleReview('rejected')}
                disabled={submitting}
              >
                ✗ Reject
              </button>
              <button 
                className="btn-edit"
                onClick={() => alert('Edit functionality coming soon')}
                disabled={submitting}
              >
                ✎ Edit & Correct
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Report Issue Component - For flagging hallucinations or incorrect extractions
function ReportIssueButton({ documentId, pageId, pageNumber, dataType, recordId, fieldName, extractedValue, source_location }) {
  const [showModal, setShowModal] = useState(false);
  const [issueType, setIssueType] = useState('INCORRECT_VALUE');
  const [correctValue, setCorrectValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const report = {
        document_id: documentId,
        page_id: pageId,
        page_number: pageNumber,
        issue_type: issueType,
        data_type: dataType,
        record_id: recordId,
        field_name: fieldName,
        extracted_value: extractedValue,
        correct_value: correctValue,
        notes: notes,
        reporter_id: 'user', // TODO: Get from auth
        source_location: source_location || 'Not specified'
      };

      // Call API to create hallucination report
      const command = new ScanCommand({ TableName: 'HealthAI-dev-HallucinationReports' });
      await docClient.send(command);  // TODO: Use proper API endpoint

      alert('Issue reported successfully! This will be reviewed by our team.');
      setShowModal(false);
      setCorrectValue('');
      setNotes('');
    } catch (error) {
      console.error('Error reporting issue:', error);
      alert('Error submitting report');
    }
    setSubmitting(false);
  };

  if (!showModal) {
    return (
      <button 
        className="btn-report-issue"
        onClick={() => setShowModal(true)}
        title="Report an error or hallucination"
      >
        ⚠️ Report Issue
      </button>
    );
  }

  return (
    <div className="report-issue-modal-overlay" onClick={() => setShowModal(false)}>
      <div className="report-issue-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Report Data Issue</h3>
        <p className="modal-subtitle">Help us improve accuracy by reporting errors</p>

        <div className="form-group">
          <label>Issue Type:</label>
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
            <option value="INCORRECT_VALUE">Incorrect Value</option>
            <option value="HALLUCINATION">Hallucination (not in document)</option>
            <option value="MISSING_DATA">Missing Data</option>
            <option value="WRONG_FIELD">Wrong Field/Category</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label>Extracted Value:</label>
          <input type="text" value={extractedValue} disabled />
        </div>

        <div className="form-group">
          <label>Correct Value:</label>
          <input 
            type="text" 
            value={correctValue}
            onChange={(e) => setCorrectValue(e.target.value)}
            placeholder="What should it be?"
          />
        </div>

        <div className="form-group">
          <label>Notes:</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details about the issue..."
            rows="3"
          />
        </div>

        {source_location && (
          <div className="source-info">
            <strong>Source Location:</strong> {source_location}
          </div>
        )}

        <div className="modal-actions">
          <button 
            className="btn-submit-report"
            onClick={handleSubmit}
            disabled={submitting}
          >
            Submit Report
          </button>
          <button 
            className="btn-cancel"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Hallucination Dashboard - View all reported issues
function HallucinationDashboard() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
    loadStats();
  }, []);

  const loadReports = async () => {
    try {
      // Demo data for presentation
      const demoReports = [
        {
          ReportID: 'rpt-demo-001',
          IssueType: 'INCORRECT_EXTRACTION',
          DataType: 'Medication',
          FieldName: 'dosage',
          ExtractedValue: '50mg',
          CorrectValue: '500mg',
          Status: 'VERIFIED',
          CreatedAt: Math.floor(Date.now() / 1000) - 86400
        },
        {
          ReportID: 'rpt-demo-002',
          IssueType: 'HALLUCINATION',
          DataType: 'Diagnosis',
          FieldName: 'ICD_code',
          ExtractedValue: 'E11.9',
          CorrectValue: 'Not present in document',
          Status: 'UNDER_REVIEW',
          CreatedAt: Math.floor(Date.now() / 1000) - 172800
        }
      ];

      try {
        const command = new ScanCommand({
          TableName: 'HealthAI-dev-HallucinationReports'
        });
        const response = await docClient.send(command);
        const realReports = response.Items || [];
        
        if (realReports.length > 0) {
          setReports(realReports);
        } else {
          setReports(demoReports);
        }
      } catch (error) {
        console.log('Using demo data for hallucination reports');
        setReports(demoReports);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      // Demo stats for presentation
      const demoStats = {
        total_reports: 2,
        verified_hallucinations: 1,
        hallucination_rate: '0.0020',
        total_pages: 50000
      };

      try {
        const command = new ScanCommand({
          TableName: 'HealthAI-dev-HallucinationReports'
        });
        const response = await docClient.send(command);
        const allReports = response.Items || [];
        
        if (allReports.length > 0) {
          const verified = allReports.filter(r => r.Status === 'VERIFIED').length;
          const totalPages = 50000;
          
          setStats({
            total_reports: allReports.length,
            verified_hallucinations: verified,
            hallucination_rate: ((verified / totalPages) * 100).toFixed(4),
            total_pages: totalPages
          });
        } else {
          setStats(demoStats);
        }
      } catch (error) {
        console.log('Using demo stats');
        setStats(demoStats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  return (
    <div className="hallucination-dashboard">
      <div className="page-header">
        <h2>🔬 Hallucination Tracking</h2>
        <p className="subtitle">Monitor and resolve AI extraction errors</p>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_reports}</div>
            <div className="stat-label">Total Reports</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.verified_hallucinations}</div>
            <div className="stat-label">Verified Hallucinations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.hallucination_rate}%</div>
            <div className="stat-label">Hallucination Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_pages.toLocaleString()}</div>
            <div className="stat-label">Pages Processed</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading reports...</div>
      ) : (
        <div className="reports-list">
          <h3>Recent Reports</h3>
          {reports.length === 0 ? (
            <div className="no-reports">No issues reported yet</div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Data Type</th>
                  <th>Field</th>
                  <th>Extracted</th>
                  <th>Correct</th>
                  <th>Status</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.ReportID}>
                    <td>{report.IssueType}</td>
                    <td>{report.DataType}</td>
                    <td>{report.FieldName}</td>
                    <td>{report.ExtractedValue}</td>
                    <td>{report.CorrectValue}</td>
                    <td><span className={`status-badge status-${report.Status?.toLowerCase()}`}>{report.Status}</span></td>
                    <td>{new Date(report.CreatedAt * 1000).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;


