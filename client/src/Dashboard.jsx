import React, { useState, useEffect } from 'react';

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tests, setTests] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Batch Form State
  const [batchNumber, setBatchNumber] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [manufactureDate, setManufactureDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchMessage, setBatchMessage] = useState(null);

  // Test Logging Form State
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedTestId, setSelectedTestId] = useState('');
  const [measuredValue, setMeasuredValue] = useState('');
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      const [productsRes, batchesRes, testsRes, resultsRes] = await Promise.all([
        fetch('http://127.0.0.1:5000/api/products').then(r => r.json()),
        fetch('http://127.0.0.1:5000/api/batches').then(r => r.json()),
        fetch('http://127.0.0.1:5000/api/tests').then(r => r.json()),
        fetch('http://127.0.0.1:5000/api/test-results').then(r => r.json())
      ]);

      setProducts(productsRes);
      setBatches(batchesRes);
      setTests(testsRes);
      setTestResults(resultsRes);

      if (productsRes.length > 0 && !selectedProductId) {
        setSelectedProductId(productsRes[0].product_id);
      }
      if (batchesRes.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchesRes[0].batch_id);
      }
      if (testsRes.length > 0 && !selectedTestId) {
        setSelectedTestId(testsRes[0].test_id);
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to connect to PharmaLab API');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Batch Registration
  const handleRegisterBatch = async (e) => {
    e.preventDefault();
    setBatchSubmitting(true);
    setBatchMessage(null);

    if (new Date(expiryDate) <= new Date(manufactureDate)) {
      setBatchMessage({ type: 'error', text: 'Expiry date must be after manufacture date.' });
      setBatchSubmitting(false);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5000/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_number: batchNumber,
          product_id: parseInt(selectedProductId, 10),
          manufacture_date: manufactureDate,
          expiry_date: expiryDate,
          created_by: 1
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to register batch');

      setBatchMessage({ type: 'success', text: result.message });
      setBatchNumber('');
      setManufactureDate('');
      setExpiryDate('');
      fetchData();
    } catch (err) {
      setBatchMessage({ type: 'error', text: err.message });
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Handle Quality Test Submission
  const handleLogTest = async (e) => {
    e.preventDefault();
    setTestSubmitting(true);
    setTestMessage(null);

    try {
      const response = await fetch('http://127.0.0.1:5000/api/test-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: parseInt(selectedBatchId, 10),
          test_id: parseInt(selectedTestId, 10),
          measured_value: parseFloat(measuredValue),
          tested_by: 1
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to log test');

      const isPass = result.evaluation.status === 'Pass';
      setTestMessage({
        type: isPass ? 'success' : 'error',
        text: `Result evaluated: ${result.evaluation.status.toUpperCase()} (${result.evaluation.measured_value} vs spec ${result.evaluation.specification})`
      });

      setMeasuredValue('');
      fetchData();
    } catch (err) {
      setTestMessage({ type: 'error', text: err.message });
    } finally {
      setTestSubmitting(false);
    }
  };

  // Helper for status badge colors
  const getStatusBadge = (status) => {
    const isPass = status === 'Pass' || status === 'Approved';
    const isFail = status === 'Fail' || status === 'Quarantined' || status === 'Rejected';
    return {
      backgroundColor: isPass ? '#d4edda' : isFail ? '#f8d7da' : '#e2e8f0',
      color: isPass ? '#155724' : isFail ? '#721c24' : '#2d3748',
      padding: '3px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'inline-block'
    };
  };

  // Find active selected test to show technician acceptable limits inline
  const currentTestSpec = tests.find(t => t.test_id === parseInt(selectedTestId, 10));

  if (loading) return <div style={{ padding: '24px' }}>Loading quality records...</div>;
  if (error) return <div style={{ padding: '24px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', padding: '24px', maxWidth: '1000px', margin: '0 auto', color: '#2c3e50' }}>
      {/* Header with clean separation */}
      <header style={{ borderBottom: '2px solid #3498db', paddingBottom: '16px', marginBottom: '24px', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 6px 0', color: '#1a365d', fontSize: '30px' }}>
          PharmaLab Quality Management
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Pharmaceutical Batch Tracking & Quality Workflow System
        </p>
      </header>

      {/* Grid: 2 Columns for Registration & Testing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        
        {/* Section 1: Batch Registration Form */}
        <section style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, color: '#2980b9' }}>1. Register New Batch</h3>

          {batchMessage && (
            <div style={{
              padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '13px',
              background: batchMessage.type === 'success' ? '#d4edda' : '#f8d7da',
              color: batchMessage.type === 'success' ? '#155724' : '#721c24'
            }}>
              {batchMessage.text}
            </div>
          )}

          <form onSubmit={handleRegisterBatch} style={{ display: 'grid', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Batch Number:</label>
              <input
                type="text"
                placeholder="e.g. BATCH-2026-002"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                required
                style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Product:</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name} ({p.strength})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Mfg Date:</label>
                <input
                  type="date"
                  value={manufactureDate}
                  onChange={(e) => setManufactureDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Exp Date:</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={batchSubmitting}
              style={{
                backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: '4px', cursor: batchSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '6px'
              }}
            >
              {batchSubmitting ? 'Registering...' : '+ Register Batch'}
            </button>
          </form>
        </section>

        {/* Section 2: Quality Testing Form */}
        <section style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginTop: 0, color: '#8e44ad' }}>2. Record QC Test Result</h3>

          {testMessage && (
            <div style={{
              padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '13px',
              background: testMessage.type === 'success' ? '#d4edda' : '#f8d7da',
              color: testMessage.type === 'success' ? '#155724' : '#721c24'
            }}>
              {testMessage.text}
            </div>
          )}

          <form onSubmit={handleLogTest} style={{ display: 'grid', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Target Batch:</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                required
                style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_number} - {b.product_name} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Quality Test Definition:</label>
              <select
                value={selectedTestId}
                onChange={(e) => setSelectedTestId(e.target.value)}
                required
                style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                {tests.map((t) => (
                  <option key={t.test_id} value={t.test_id}>
                    {t.test_name} (Limits: {t.min_limit} - {t.max_limit} {t.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                Measured Value {currentTestSpec ? `(${currentTestSpec.unit})` : ''}:
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={currentTestSpec ? `Spec: ${currentTestSpec.min_limit} - ${currentTestSpec.max_limit}` : 'Measured value'}
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                required
                style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>

            <button
              type="submit"
              disabled={testSubmitting}
              style={{
                backgroundColor: '#8e44ad', color: 'white', border: 'none', padding: '8px 16px',
                borderRadius: '4px', cursor: testSubmitting ? 'not-allowed' : 'pointer', fontWeight: 'bold', marginTop: '6px'
              }}
            >
              {testSubmitting ? 'Evaluating...' : '⚡ Submit Test & Evaluate'}
            </button>
          </form>
        </section>
      </div>

      {/* Section 3: QC Test Results Table */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
          Quality Test History & Automated Outcomes
        </h3>
        {testResults.length === 0 ? (
          <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>No quality tests recorded yet.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th>Batch #</th>
                <th>Test</th>
                <th>Measured Value</th>
                <th>Specification Limits</th>
                <th>Outcome</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {testResults.map((tr) => (
                <tr key={tr.result_id}>
                  <td><strong>{tr.batch_number}</strong></td>
                  <td>{tr.test_name}</td>
                  <td>{tr.measured_value} {tr.unit}</td>
                  <td>{tr.min_limit} - {tr.max_limit} {tr.unit}</td>
                  <td><span style={getStatusBadge(tr.status)}>{tr.status}</span></td>
                  <td>{tr.test_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Section 4: Production Batches Table */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Production Batches</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th>Batch #</th>
              <th>Product</th>
              <th>Mfg Date</th>
              <th>Exp Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.batch_id}>
                <td><strong>{b.batch_number}</strong></td>
                <td>{b.product_name}</td>
                <td>{b.manufacture_date}</td>
                <td>{b.expiry_date}</td>
                <td><span style={getStatusBadge(b.status)}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Section 5: Available Products Table */}
      <section>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Available Products</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th>ID</th>
              <th>Name</th>
              <th>Form</th>
              <th>Strength</th>
              <th>Manufacturer</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.product_id}>
                <td>{p.product_id}</td>
                <td><strong>{p.name}</strong></td>
                <td>{p.dosage_form}</td>
                <td>{p.strength}</td>
                <td>{p.manufacturer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default Dashboard;