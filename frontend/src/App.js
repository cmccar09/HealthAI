import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
          <Route path="/" element={<DocumentList />} />
          <Route path="/document/:documentId" element={<DocumentDashboard />} />
          <Route path="/document/:documentId/patient" element={<PatientSummary />} />
          <Route path="/document/:documentId/medications" element={<MedicationsPage />} />
          <Route path="/document/:documentId/diagnoses" element={<DiagnosesPage />} />
          <Route path="/document/:documentId/tests" element={<TestResultsPage />} />
          <Route path="/document/:documentId/images" element={<ImageGallery />} />
        </Routes>
      </div>
    </Router>
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
      </div>
    </div>
  );
}

// Patient Summary Page
function PatientSummary() {
  const { documentId } = useParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPatients();
  }, [documentId]);

  const fetchPatients = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'HealthAI-Patients',
        FilterExpression: 'document_id = :docId',
        ExpressionAttributeValues: { ':docId': documentId }
      });
      const response = await docClient.send(command);
      setPatients(response.Items || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
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
        patients.map(patient => (
          <div key={patient.patient_id} className="patient-summary">
            <section className="info-section">
              <h3>General Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">First Name:</span>
                  <span className="value">{patient.patient_first_name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Last Name:</span>
                  <span className="value">{patient.patient_last_name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Date of Birth:</span>
                  <span className="value">{patient.patient_dob || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Gender:</span>
                  <span className="value">{patient.gender || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">MRN:</span>
                  <span className="value">{patient.patient_mrn || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="label">Blood Type:</span>
                  <span className="value">{patient.blood_type || 'N/A'}</span>
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
                    {[patient.address_line1, patient.address_line2, patient.city, patient.state, patient.postal_code]
                      .filter(Boolean).join(', ') || 'N/A'}
                  </span>
                </div>
              </div>
            </section>

            {patient.allergies && patient.allergies !== 'Unknown' && (
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
          </div>
        ))
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

  useEffect(() => {
    fetchMedications();
  }, [documentId]);

  const fetchMedications = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'HealthAI-Medications',
        FilterExpression: 'document_id = :docId',
        ExpressionAttributeValues: { ':docId': documentId }
      });
      const response = await docClient.send(command);
      setMedications(response.Items || []);
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setLoading(false);
    }
  };

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
              </tr>
            </thead>
            <tbody>
              {filteredMeds.map((med, idx) => (
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
                  <td>{med.page_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

  useEffect(() => {
    fetchDiagnoses();
  }, [documentId]);

  const fetchDiagnoses = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'HealthAI-Diagnoses',
        FilterExpression: 'document_id = :docId',
        ExpressionAttributeValues: { ':docId': documentId }
      });
      const response = await docClient.send(command);
      setDiagnoses(response.Items || []);
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiagnoses = diagnoses.filter(diag =>
    diag.diagnosis_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    diag.diagnosis_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="loading">Loading diagnoses...</div>;

  return (
    <div className="container">
      <Link to={`/document/${documentId}`} className="back-link">← Back to Dashboard</Link>
      
      <div className="page-header">
        <h2>🩺 Diagnoses</h2>
        <p className="subtitle">{diagnoses.length} diagnosis/diagnoses found</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search diagnoses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredDiagnoses.length === 0 ? (
        <div className="info-message">No diagnoses found</div>
      ) : (
        <div className="diagnosis-grid">
          {filteredDiagnoses.map((diag, idx) => (
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
                {diag.page_number && (
                  <p><strong>Page:</strong> {diag.page_number}</p>
                )}
              </div>
              {diag.notes && diag.notes !== 'None' && (
                <div className="notes">
                  <strong>Notes:</strong> {diag.notes}
                </div>
              )}
            </div>
          ))}
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

  useEffect(() => {
    fetchTests();
  }, [documentId]);

  const fetchTests = async () => {
    try {
      const command = new ScanCommand({
        TableName: 'HealthAI-TestResults',
        FilterExpression: 'document_id = :docId',
        ExpressionAttributeValues: { ':docId': documentId }
      });
      const response = await docClient.send(command);
      setTests(response.Items || []);
    } catch (error) {
      console.error('Error fetching test results:', error);
    } finally {
      setLoading(false);
    }
  };

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
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((test, idx) => (
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
                  <td>{test.page_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

export default App;
