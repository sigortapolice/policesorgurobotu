import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AdminPanel from './AdminPanel';

const Home: React.FC = () => {
  const title = localStorage.getItem('title') || 'Varsayılan Başlık';
  const color = localStorage.getItem('color') || '#007bff';
  const radius = localStorage.getItem('radius') || '8';
  const buttonUrl = localStorage.getItem('buttonUrl') || '/';

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>{title}</h1>
      <p>Bu alan yönetim panelinden düzenlenebilir.</p>

      <a href={buttonUrl}>
        <button style={{ backgroundColor: color, borderRadius: `${radius}px`, padding: '10px 20px', color: 'white', border: 'none' }}>
          Yönlendirme Butonu
        </button>
      </a>

      <footer style={{ marginTop: '2rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
        <Link to="/admin" style={{ textDecoration: 'none', color: 'white' }}>
          <button style={{ backgroundColor: color, borderRadius: `${radius}px`, padding: '10px 20px' }}>Yönetim Paneline Git</button>
        </Link>
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
};

export default App;
