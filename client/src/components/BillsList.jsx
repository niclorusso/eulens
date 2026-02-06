import React, { useState, useEffect, useRef } from 'react';
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
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const timerRef = useRef(null);
  const initialLoadDone = useRef(false);

  // Fetch categories and first page of bills in parallel on mount
  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [categoriesRes, billsRes] = await Promise.all([
          axios.get('/api/stats/overview'),
          axios.get('/api/bills', { params: { page: 1, limit: 20 } })
        ]);

        const cats = categoriesRes.data.byCategory?.map(c => c.category) || [];
        setCategories(['all', ...cats]);
        setBills(billsRes.data.bills || []);
        setPagination(billsRes.data.pagination || { totalPages: 1, totalBills: 0 });
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
    loadInitialData();
  }, []);

  // Fetch bills on page/filter change (skip the initial load)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    async function fetchBills() {
      setLoading(true);
      try {
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
    fetchBills();
  }, [page, filter]);

  // Track elapsed seconds while loading for user feedback
  useEffect(() => {
    if (loading) {
      setLoadingSeconds(0);
      timerRef.current = setInterval(() => {
        setLoadingSeconds(s => s + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setLoadingSeconds(0);
    }
    return () => clearInterval(timerRef.current);
  }, [loading]);

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
          {loadingSeconds < 5 && <p>Loading issues...</p>}
          {loadingSeconds >= 5 && loadingSeconds < 15 && (
            <p>Our server is waking up &mdash; this may take a moment on the first visit...</p>
          )}
          {loadingSeconds >= 15 && (
            <p>Almost there! Connecting to the EU Parliament database...</p>
          )}
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
