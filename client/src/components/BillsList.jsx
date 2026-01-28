import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './BillsList.css';

export default function BillsList() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchBills();
  }, []);

  async function fetchBills() {
    try {
      setLoading(true);
      const response = await axios.get('/api/bills');
      setBills(response.data);
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredBills = filter === 'all'
    ? bills
    : bills.filter(bill => bill.category === filter);

  const categories = ['all', ...new Set(bills.map(b => b.category))];

  return (
    <main className="container">
      <div className="bills-header">
        <h2>EU Legislative Issues</h2>
        <p className="subtitle">Track, analyze, and discuss current EU decisions</p>
      </div>

      <div className="filters">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading issues...</p>
        </div>
      ) : (
        <div className="bills-grid">
          {filteredBills.length === 0 ? (
            <div className="text-center" style={{ gridColumn: '1 / -1' }}>
              <p>No bills found</p>
            </div>
          ) : (
            filteredBills.map(bill => (
              <Link key={bill.id} to={`/bills/${bill.id}`} className="bill-card-link">
                <div className="bill-card card">
                  <div className="bill-header">
                    <span className={`status-badge status-${bill.status}`}>
                      {bill.status}
                    </span>
                    <span className="category-badge">{bill.category}</span>
                  </div>
                  <h3>{bill.title}</h3>
                  <p className="bill-description">{bill.description}</p>
                  <div className="bill-footer">
                    <span className="date">
                      {new Date(bill.date_adopted).toLocaleDateString()}
                    </span>
                    <span className="arrow">→</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </main>
  );
}
