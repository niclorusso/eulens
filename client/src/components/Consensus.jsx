import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Consensus.css';

export default function Consensus() {
  const [consensus, setConsensus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConsensus();
  }, []);

  async function fetchConsensus() {
    try {
      setLoading(true);
      const response = await axios.get('/api/consensus');
      setConsensus(response.data);
    } catch (error) {
      console.error('Error fetching consensus:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Finding where Europe agrees...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="consensus-header">
        <h2>Where Europe Agrees</h2>
        <p className="subtitle">Issues with the strongest cross-border consensus</p>
      </div>

      {consensus.length === 0 ? (
        <div className="card text-center">
          <p>No consensus data available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="consensus-grid">
          {consensus.map(item => {
            const agreementPercentage = item.voting_countries > 0
              ? Math.round((item.yes_countries / item.voting_countries) * 100)
              : 0;

            return (
              <Link
                key={item.id}
                to={`/bills/${item.id}`}
                className="consensus-card-link"
              >
                <div className="consensus-card card">
                  <h3>{item.title}</h3>
                  <div className="consensus-metrics">
                    <div className="metric">
                      <div className="metric-label">Countries in Agreement</div>
                      <div className="metric-value">{item.yes_countries}/{item.voting_countries}</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Agreement Level</div>
                      <div className="metric-value agreement">{agreementPercentage}%</div>
                    </div>
                  </div>
                  <div className="consensus-bar">
                    <div
                      className="consensus-fill"
                      style={{ width: `${agreementPercentage}%` }}
                    ></div>
                  </div>
                  <div className="consensus-details">
                    <span className="badge-success">{item.yes_countries} say yes</span>
                    <span className="badge-danger">{item.no_countries} say no</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
