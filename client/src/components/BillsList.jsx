import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './BillsList.css';

export default function BillsList() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, totalBills: 0 });
  const [categories, setCategories] = useState(['all']);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchBills();
  }, [page, filter]);

  async function fetchCategories() {
    try {
      const response = await axios.get('/api/stats/overview');
      const cats = response.data.byCategory?.map(c => c.category) || [];
      setCategories(['all', ...cats]);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function fetchBills() {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filter !== 'all') params.category = filter;
      
      const response = await axios.get('/api/bills', { params });
      setBills(response.data.bills || []);
      setPagination(response.data.pagination || { totalPages: 1, totalBills: 0 });
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterChange(cat) {
    setFilter(cat);
    setPage(1); // Reset to first page when filter changes
  }

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
            onClick={() => handleFilterChange(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="bills-info">
        Showing {bills.length} of {pagination.totalBills} bills
        {filter !== 'all' && ` in ${filter}`}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading issues...</p>
        </div>
      ) : (
        <>
          <div className="bills-grid">
            {bills.length === 0 ? (
              <div className="text-center" style={{ gridColumn: '1 / -1' }}>
                <p>No bills found</p>
              </div>
            ) : (
              bills.map(bill => (
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                ««
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹ Prev
              </button>
              
              <div className="pagination-pages">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="pagination-ellipsis">...</span>}
                      <button
                        className={`pagination-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                className="pagination-btn"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Next ›
              </button>
              <button
                className="pagination-btn"
                onClick={() => setPage(pagination.totalPages)}
                disabled={page === pagination.totalPages}
              >
                »»
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
