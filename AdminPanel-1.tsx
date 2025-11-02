import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const AdminPanel: React.FC = () => {
  const [title, setTitle] = useState(localStorage.getItem('title') || 'Varsayılan Başlık');
  const [color, setColor] = useState(localStorage.getItem('color') || '#007bff');
  const [radius, setRadius] = useState(localStorage.getItem('radius') || '8');
  const [buttonUrl, setButtonUrl] = useState(localStorage.getItem('buttonUrl') || '/');

  useEffect(() => {
    localStorage.setItem('title', title);
    localStorage.setItem('color', color);
    localStorage.setItem('radius', radius);
    localStorage.setItem('buttonUrl', buttonUrl);
  }, [title, color, radius, buttonUrl]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>Yönetim Paneli</h1>

      <div style={{ marginBottom: '1rem' }}>
        <label>Başlık Metni:</label><br/>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Renk:</label><br/>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Kutu Border Radius (px):</label><br/>
        <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Buton Yönlendirme Linki:</label><br/>
        <input type="text" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
      </div>

      <footer style={{ marginTop: '2rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
          <button style={{ backgroundColor: color, borderRadius: `${radius}px`, padding: '10px 20px' }}>Ana Sayfaya Dön</button>
        </Link>
      </footer>
    </div>
  );
};

export default AdminPanel;
