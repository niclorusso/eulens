import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <span className="footer-logo">🔍 EULens</span>
            <p className="footer-tagline">
              See European Democracy Clearly
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-section">
              <h4>Explore</h4>
              <Link to="/">Votes</Link>
              <Link to="/meps">MEPs</Link>
              <Link to="/groups">Groups</Link>
              <Link to="/countries">Countries</Link>
            </div>

            <div className="footer-section">
              <h4>Analysis</h4>
              <Link to="/stats">Statistics</Link>
              <Link to="/compass">Compass</Link>
              <Link to="/vaa">Find Your Match</Link>
              <Link to="/chat">Chat with MEP</Link>
            </div>

            <div className="footer-section">
              <h4>About</h4>
              <Link to="/about">About Us</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} EULens. Open source project for democratic transparency.
          </p>
          <p className="footer-data">
            Data source: <a href="https://howtheyvote.eu" target="_blank" rel="noopener noreferrer">HowTheyVote.eu</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
