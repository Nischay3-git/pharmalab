import React, { useState, useEffect } from 'react';

function Dashboard() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('pharmalab_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('pharmalab_token') || null);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // App Data State
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tests, setTests] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [loading, setLoading] = useState(false);
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

  // CAPA Form State
  const [activeDevId, setActiveDevId] = useState(null);
  const [capaDesc, setCapaDesc] = useState('');
  const [capaDate, setCapaDate] = useState('');

  // Admin New Product Form State
  const [prodName, setProdName] = useState('');
  const [prodForm, setProdForm] = useState('Tablet');
  const [prodStrength, setProdStrength] = useState('');
  const [prodMessage, setProdMessage] = useState(null);

  // Helper for Authenticated Fetch
  const authFetch = (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };
    return fetch(url, { ...options, headers });
  };

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [productsRes, batchesRes, testsRes, resultsRes, deviationsRes] = await Promise.all([
        authFetch('http://127.0.0.1:5000/api/products').then((r) => r.json()),
        authFetch('http://127.0.0.1:5000/api/batches').then((r) => r.json()),
        authFetch('http://127.0.0.1:5000/api/tests').then((r) => r.json()),
        authFetch('http://127.0.0.1:5000/api/test-results').then((r) => r.json()),
        authFetch('http://127.0.0.1:5000/api/deviations').then((r) => r.json())
      ]);

      setProducts(productsRes || []);
      setBatches(batchesRes || []);
      setTests(testsRes || []);
      setTestResults(resultsRes || []);
      setDeviations(deviationsRes || []);

      if (productsRes?.length > 0 && !selectedProductId) setSelectedProductId(productsRes[0].product_id);
      if (batchesRes?.length > 0 && !selectedBatchId) setSelectedBatchId(batchesRes[0].batch_id);
      if (testsRes?.length > 0 && !selectedTestId) setSelectedTestId(testsRes[0].test_id);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch data from PharmaLab server');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('pharmalab_token', data.token);
      localStorage.setItem('pharmalab_user', JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pharmalab_token');
    localStorage.removeItem('pharmalab_user');
    setToken(null);
    setCurrentUser(null);
  };

  // Permissions helpers
  const role = currentUser?.role_name || '';
  const isAdmin = role === 'Administrator';
  const canRegisterBatch = isAdmin || role === 'Laboratory Technician';
  const canLogTest = isAdmin || role === 'Laboratory Technician' || role === 'QC Officer';
  const canManageDeviations = isAdmin || role === 'QA Officer';
  const isManager = role === 'Manager';

  // Handle Product Addition (Admin only)
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch('http://127.0.0.1:5000/api/products', {
        method: 'POST',
        body: JSON.stringify({ name: prodName, dosage_form: prodForm, strength: prodStrength, manufacturer_id: 1 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProdMessage({ type: 'success', text: data.message });
      setProdName('');
      setProdStrength('');
      fetchData();
    } catch (err) {
      setProdMessage({ type: 'error', text: err.message });
    }
  };

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
      const res = await authFetch('http://127.0.0.1:5000/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          batch_number: batchNumber,
          product_id: parseInt(selectedProductId, 10),
          manufacture_date: manufactureDate,
          expiry_date: expiryDate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBatchMessage({ type: 'success', text: data.message });
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
      const res = await authFetch('http://127.0.0.1:5000/api/test-results', {
        method: 'POST',
        body: JSON.stringify({
          batch_id: parseInt(selectedBatchId, 10),
          test_id: parseInt(selectedTestId, 10),
          measured_value: parseFloat(measuredValue)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const isPass = data.evaluation.status === 'Pass';
      setTestMessage({
        type: isPass ? 'success' : 'error',
        text: `Result: ${data.evaluation.status.toUpperCase()} (${data.evaluation.measured_value} vs spec ${data.evaluation.specification})${!isPass ? ' — Deviation automatically raised!' : ''}`
      });
      setMeasuredValue('');
      fetchData();
    } catch (err) {
      setTestMessage({ type: 'error', text: err.message });
    } finally {
      setTestSubmitting(false);
    }
  };

  // Handle CAPA Task Creation
  const handleAddCapa = async (e, devId) => {
    e.preventDefault();
    try {
      const res = await authFetch('http://127.0.0.1:5000/api/corrective-actions', {
        method: 'POST',
        body: JSON.stringify({ deviation_id: devId, description: capaDesc, target_date: capaDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCapaDesc('');
      setCapaDate('');
      setActiveDevId(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCompleteCapa = async (actionId) => {
    try {
      const res = await authFetch(`http://127.0.0.1:5000/api/corrective-actions/${actionId}/complete`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to complete action');
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCloseDeviation = async (devId) => {
    try {
      const res = await authFetch(`http://127.0.0.1:5000/api/deviations/${devId}/close`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const isPass = status === 'Pass' || status === 'Approved' || status === 'Completed' || status === 'Closed';
    const isFail = status === 'Fail' || status === 'Quarantined' || status === 'High' || status === 'Critical' || status === 'Rejected';
    return {
      backgroundColor: isPass ? '#d4edda' : isFail ? '#f8d7da' : '#fff3cd',
      color: isPass ? '#155724' : isFail ? '#721c24' : '#856404',
      padding: '3px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
      display: 'inline-block'
    };
  };

  const currentTestSpec = tests.find((t) => t.test_id === parseInt(selectedTestId, 10));

  // ---------------- Render Login Screen if not authenticated ----------------
  if (!token || !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', fontFamily: 'Segoe UI, sans-serif' }}>
        <div style={{ width: '380px', padding: '32px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: '0 0 6px', color: '#1a365d', textAlign: 'center' }}>PharmaLab Login</h2>
          <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>Quality Management System</p>

          {loginError && (
            <div style={{ padding: '10px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', fontSize: '13px', marginBottom: '16px', border: '1px solid #f5c6cb' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Username:</label>
              <input
                type="text"
                placeholder="Enter username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Password:</label>
              <input
                type="password"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                background: '#2563eb', color: '#ffffff', padding: '10px', border: 'none', borderRadius: '4px',
                fontWeight: 'bold', cursor: loginLoading ? 'not-allowed' : 'pointer', marginTop: '6px'
              }}
            >
              {loginLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---------------- Main Authenticated Dashboard ----------------
  return (
    <div style={{ fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', padding: '24px', maxWidth: '1050px', margin: '0 auto', color: '#2c3e50' }}>
      
      {/* Top Navigation & User Bar */}
      <header style={{ borderBottom: '2px solid #3498db', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 4px 0', color: '#1a365d', fontSize: '26px' }}>PharmaLab Quality Management</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Pharmaceutical Batch Tracking, Quality Testing & CAPA Investigation System</p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '13px', marginBottom: '4px' }}>
            Logged in as: <strong>{currentUser.username}</strong>
          </div>
          <div>
            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', marginRight: '10px' }}>
              {currentUser.role_name}
            </span>
            <button
              onClick={handleLogout}
              style={{ background: '#ef4444', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Admin Panel: Add Master Product (Admin Only) */}
      {isAdmin && (
        <section style={{ background: '#fef3c7', padding: '16px 20px', borderRadius: '8px', border: '1px solid #fcd34d', marginBottom: '24px' }}>
          <h3 style={{ marginTop: 0, color: '#92400e', fontSize: '16px' }}>👑 Administrator Master Control: Add Approved Product</h3>
          {prodMessage && <div style={{ fontSize: '13px', marginBottom: '8px', color: prodMessage.type === 'success' ? '#155724' : '#721c24' }}>{prodMessage.text}</div>}
          <form onSubmit={handleAddProduct} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px' }}>
            <input type="text" placeholder="Product Name (e.g. Ciprofloxacin)" value={prodName} onChange={(e) => setProdName(e.target.value)} required style={{ padding: '6px' }} />
            <select value={prodForm} onChange={(e) => setProdForm(e.target.value)} style={{ padding: '6px' }}>
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="Solution">Solution</option>
              <option value="Suspension">Suspension</option>
            </select>
            <input type="text" placeholder="Strength (e.g. 500 mg)" value={prodStrength} onChange={(e) => setProdStrength(e.target.value)} required style={{ padding: '6px' }} />
            <button type="submit" style={{ background: '#d97706', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>+ Add Product</button>
          </form>
        </section>
      )}

      {/* Manager Read-Only Notice */}
      {isManager && (
        <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '6px', marginBottom: '24px', borderLeft: '4px solid #64748b', fontSize: '13px' }}>
          ℹ️ <strong>Manager View Active:</strong> You have read-only access to quality metrics, batch records, deviations, and laboratory audit trails.
        </div>
      )}

      {/* Action Forms Grid (Hidden for Manager) */}
      {(canRegisterBatch || canLogTest) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          
          {/* Section 1: Batch Registration Form */}
          {canRegisterBatch && (
            <section style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, color: '#2980b9' }}>1. Register New Batch</h3>
              {batchMessage && <div style={{ padding: '8px', marginBottom: '10px', fontSize: '13px', background: batchMessage.type === 'success' ? '#d4edda' : '#f8d7da' }}>{batchMessage.text}</div>}
              <form onSubmit={handleRegisterBatch} style={{ display: 'grid', gap: '10px' }}>
                <input type="text" placeholder="Batch #" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required style={{ padding: '6px' }} />
                <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} style={{ padding: '6px' }}>
                  {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.strength})</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="date" value={manufactureDate} onChange={(e) => setManufactureDate(e.target.value)} required style={{ padding: '6px' }} />
                  <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required style={{ padding: '6px' }} />
                </div>
                <button type="submit" disabled={batchSubmitting} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Register Batch</button>
              </form>
            </section>
          )}

          {/* Section 2: Quality Testing Form */}
          {canLogTest && (
            <section style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ marginTop: 0, color: '#8e44ad' }}>2. Record QC Test Result</h3>
              {testMessage && <div style={{ padding: '8px', marginBottom: '10px', fontSize: '13px', background: testMessage.type === 'success' ? '#d4edda' : '#f8d7da' }}>{testMessage.text}</div>}
              <form onSubmit={handleLogTest} style={{ display: 'grid', gap: '10px' }}>
                <select value={selectedBatchId} onChange={(e) => setSelectedBatchId(e.target.value)} style={{ padding: '6px' }}>
                  {batches.map((b) => <option key={b.batch_id} value={b.batch_id}>{b.batch_number} - {b.product_name} ({b.status})</option>)}
                </select>
                <select value={selectedTestId} onChange={(e) => setSelectedTestId(e.target.value)} style={{ padding: '6px' }}>
                  {tests.map((t) => <option key={t.test_id} value={t.test_id}>{t.test_name} ({t.min_limit}-{t.max_limit} {t.unit})</option>)}
                </select>
                <input type="number" step="0.01" placeholder={currentTestSpec ? `Spec: ${currentTestSpec.min_limit} - ${currentTestSpec.max_limit}` : 'Measured value'} value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} required style={{ padding: '6px' }} />
                <button type="submit" disabled={testSubmitting} style={{ background: '#8e44ad', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Submit & Evaluate</button>
              </form>
            </section>
          )}
        </div>
      )}

      {/* Section 3: QA Investigation & CAPA Board */}
      <section style={{ background: '#ffffff', padding: '20px', borderRadius: '8px', border: '2px solid #e74c3c', marginBottom: '32px' }}>
        <h3 style={{ marginTop: 0, color: '#c0392b' }}>3. Quality Deviations & CAPA Investigations</h3>
        {deviations.length === 0 ? (
          <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>No active deviations. All tests passing!</p>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {deviations.map((dev) => (
              <div key={dev.deviation_id} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '14px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Deviation #{dev.deviation_id} — Batch: {dev.batch_number}</strong>
                  <div>
                    <span style={getStatusBadge(dev.severity)}>{dev.severity}</span>{' '}
                    <span style={getStatusBadge(dev.status)}>{dev.status}</span>
                  </div>
                </div>
                <p style={{ margin: '4px 0 10px', fontSize: '14px' }}>{dev.description}</p>
                
                {/* CAPA Action List */}
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: '13px' }}>Corrective & Preventive Actions (CAPA):</h4>
                  {dev.actions.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>No corrective actions assigned yet.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px' }}>
                      {dev.actions.map((act) => (
                        <li key={act.action_id} style={{ marginBottom: '4px' }}>
                          <span>{act.description} (Owner: {act.owner}, Due: {act.target_date}) — </span>
                          <span style={getStatusBadge(act.status)}>{act.status}</span>{' '}
                          {!isManager && act.status === 'Pending' && (
                            <button onClick={() => handleCompleteCapa(act.action_id)} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer' }}>Mark Done</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Deviation Controls (QA & Admin only) */}
                {canManageDeviations && dev.status !== 'Closed' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setActiveDevId(activeDevId === dev.deviation_id ? null : dev.deviation_id)} style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
                      {activeDevId === dev.deviation_id ? 'Cancel' : '+ Assign CAPA Task'}
                    </button>
                    <button onClick={() => handleCloseDeviation(dev.deviation_id)} style={{ padding: '6px 12px', fontSize: '12px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                      ✓ Close Deviation
                    </button>
                  </div>
                )}

                {activeDevId === dev.deviation_id && (
                  <form onSubmit={(e) => handleAddCapa(e, dev.deviation_id)} style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Corrective Action description" value={capaDesc} onChange={(e) => setCapaDesc(e.target.value)} required style={{ flex: 2, padding: '4px 8px' }} />
                    <input type="date" value={capaDate} onChange={(e) => setCapaDate(e.target.value)} required style={{ flex: 1, padding: '4px' }} />
                    <button type="submit" style={{ background: '#3498db', color: 'white', border: 'none', padding: '4px 10px', cursor: 'pointer' }}>Save Action</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 4: QC Test Results Table */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Quality Test History & Automated Outcomes</h3>
        {testResults.length === 0 ? (
          <p style={{ color: '#7f8c8d', fontStyle: 'italic' }}>No quality tests recorded yet.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th>Batch #</th><th>Test</th><th>Measured Value</th><th>Specification Limits</th><th>Outcome</th><th>Date</th>
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

      {/* Section 5: Production Batches Table */}
      <section style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Production Batches</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th>Batch #</th><th>Product</th><th>Mfg Date</th><th>Exp Date</th><th>Status</th>
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

      {/* Section 6: Available Products Table */}
      <section>
        <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>Available Products</h3>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%', borderColor: '#e2e8f0' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th>ID</th><th>Name</th><th>Form</th><th>Strength</th><th>Manufacturer</th>
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