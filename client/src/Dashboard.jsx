import React, { useState, useEffect } from 'react';

function Dashboard() {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('http://127.0.0.1:5000/api/products').then((res) => {
        if (!res.ok) throw new Error('Failed to load products');
        return res.json();
      }),
      fetch('http://127.0.0.1:5000/api/batches').then((res) => {
        if (!res.ok) throw new Error('Failed to load batches');
        return res.json();
      })
    ])
      .then(([productsData, batchesData]) => {
        setProducts(productsData);
        setBatches(batchesData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setError('Failed to connect to PharmaLab API');
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: '24px' }}>Loading quality records...</div>;
  if (error) return <div style={{ padding: '24px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>PharmaLab Quality Management</h1>
      
      <section style={{ marginBottom: '32px' }}>
        <h2>Registered Products</h2>
        <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#f2f2f2', textAlign: 'left' }}>
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
                <td>{p.name}</td>
                <td>{p.dosage_form}</td>
                <td>{p.strength}</td>
                <td>{p.manufacturer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Production Batches</h2>
        {batches.length === 0 ? (
          <p>No batches registered yet.</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f2f2f2', textAlign: 'left' }}>
                <th>Batch #</th>
                <th>Product</th>
                <th>Manufacture Date</th>
                <th>Expiry Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch_id}>
                  <td>{b.batch_number}</td>
                  <td>{b.product_name}</td>
                  <td>{b.manufacture_date}</td>
                  <td>{b.expiry_date}</td>
                  <td>{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Dashboard;