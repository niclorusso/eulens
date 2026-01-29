import React from 'react';
import MEPPCAPlot from './MEPPCAPlot';
import './PoliticalCompass.css';

export default function PoliticalCompass() {
  return (
    <main className="container">
      <header className="compass-header">
        <h1>Compass</h1>
        <p className="compass-subtitle">
          A PCA visualization of voting patterns. MEPs close together vote similarly. 
          Switch between individual MEPs, political groups, or explore in 3D.
        </p>
      </header>

      <div className="compass-content">
        <MEPPCAPlot />
      </div>
    </main>
  );
}
