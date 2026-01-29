import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

export default function Header() {
  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1><span className="logo-lens">🔍</span> EULens</h1>
            <p className="tagline">See European Democracy Clearly</p>
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">Voting</Link>
            <Link to="/meps" className="nav-link">MEPs</Link>
            <Link to="/groups" className="nav-link">Groups</Link>
            <Link to="/countries" className="nav-link">Countries</Link>
            <Link to="/stats" className="nav-link">Statistics</Link>
            <Link to="/compass" className="nav-link">Compass</Link>
            <Link to="/vaa" className="nav-link nav-highlight">Find Your Match</Link>
            <Link to="/chat" className="nav-link">Chat with MEP</Link>
            <Link to="/about" className="nav-link">About</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
