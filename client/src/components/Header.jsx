import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <h1>🏛️ Agora EU</h1>
            <p className="tagline">European Democracy Platform</p>
          </div>
          <nav className="nav">
            <Link to="/" className="nav-link">Issues</Link>
            <Link to="/consensus" className="nav-link">Where Europe Agrees</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
