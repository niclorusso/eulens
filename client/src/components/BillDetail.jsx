import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './BillDetail.css';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [votes, setVotes] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '', country: 'AT' });
  const [submitting, setSubmitting] = useState(false);

  const EU_COUNTRIES = {
    'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
    'CY': 'Cyprus', 'CZ': 'Czechia', 'DK': 'Denmark', 'EE': 'Estonia',
    'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
    'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
    'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
    'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
    'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden'
  };

  useEffect(() => {
    fetchBillDetail();
  }, [id]);

  async function fetchBillDetail() {
    try {
      setLoading(true);
      const [billRes, votesRes, discussionsRes] = await Promise.all([
        axios.get(`/api/bills/${id}`),
        axios.get(`/api/votes/${id}`),
        axios.get(`/api/bills/${id}/discussions`)
      ]);

      setBill(billRes.data.bill);
      setVotes(billRes.data.votes);
      setDiscussions(billRes.data.discussions);
    } catch (error) {
      console.error('Error fetching bill:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitDiscussion(e) {
    e.preventDefault();
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) return;

    try {
      setSubmitting(true);
      await axios.post('/api/discussions', {
        bill_id: id,
        country_code: newDiscussion.country,
        title: newDiscussion.title,
        content: newDiscussion.content,
        author_id: `user-${Date.now()}`
      });

      setNewDiscussion({ title: '', content: '', country: 'AT' });
      fetchBillDetail();
    } catch (error) {
      console.error('Error submitting discussion:', error);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading issue details...</p>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="container">
        <div className="text-center mt-4">
          <p>Issue not found</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-2">
            Back to Issues
          </button>
        </div>
      </main>
    );
  }

  const chartData = votes.map(v => ({
    country: v.country_code,
    yes: v.yes_votes || 0,
    no: v.no_votes || 0,
    abstain: v.abstain_votes || 0
  }));

  const totalVotes = {
    yes: votes.reduce((sum, v) => sum + (v.yes_votes || 0), 0),
    no: votes.reduce((sum, v) => sum + (v.no_votes || 0), 0),
    abstain: votes.reduce((sum, v) => sum + (v.abstain_votes || 0), 0)
  };

  const pieData = [
    { name: 'Yes', value: totalVotes.yes },
    { name: 'No', value: totalVotes.no },
    { name: 'Abstain', value: totalVotes.abstain }
  ];

  const COLORS = ['#4ade80', '#ef4444', '#f59e0b'];

  return (
    <main className="container">
      <button onClick={() => navigate('/')} className="back-btn">
        ← Back to Issues
      </button>

      <div className="bill-detail">
        <header className="detail-header">
          <div className="header-badges">
            <span className={`status-badge status-${bill.status}`}>{bill.status}</span>
            <span className="category-badge">{bill.category}</span>
          </div>
          <h1>{bill.title}</h1>
          <p className="bill-meta">
            {bill.eu_id} • Updated {new Date(bill.date_adopted).toLocaleDateString()}
          </p>
          <p className="bill-full-description">{bill.description}</p>
        </header>

        <div className="detail-grid">
          <section className="voting-section card">
            <h2>How Europe Voted</h2>
            <div className="voting-overview">
              <div className="vote-stats">
                <div className={`vote-stat yes`}>
                  <div className="vote-number">{totalVotes.yes}</div>
                  <div className="vote-label">Yes</div>
                </div>
                <div className={`vote-stat no`}>
                  <div className="vote-number">{totalVotes.no}</div>
                  <div className="vote-label">No</div>
                </div>
                <div className={`vote-stat abstain`}>
                  <div className="vote-number">{totalVotes.abstain}</div>
                  <div className="vote-label">Abstain</div>
                </div>
              </div>

              {pieData.some(d => d.value > 0) && (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {chartData.length > 0 && (
              <div className="chart-section mt-3">
                <h3>By Country</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="country" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="yes" fill="#4ade80" />
                    <Bar dataKey="no" fill="#ef4444" />
                    <Bar dataKey="abstain" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="discussions-section">
            <div className="card">
              <h2>European Discussion</h2>
              <form onSubmit={handleSubmitDiscussion} className="discussion-form">
                <input
                  type="text"
                  placeholder="What's your perspective?"
                  value={newDiscussion.title}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                  maxLength="200"
                />
                <textarea
                  placeholder="Share your thoughts with other Europeans..."
                  value={newDiscussion.content}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                  maxLength="1000"
                  rows="4"
                />
                <select
                  value={newDiscussion.country}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, country: e.target.value })}
                >
                  {Object.entries(EU_COUNTRIES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Posting...' : 'Share Perspective'}
                </button>
              </form>
            </div>

            {discussions.length > 0 && (
              <div className="discussions-list card mt-3">
                <h3>Recent Perspectives</h3>
                {discussions.map(discussion => (
                  <div key={discussion.id} className="discussion-item">
                    <div className="discussion-header">
                      <span className="country-tag">{discussion.country_code}</span>
                      <span className="discussion-date">{new Date(discussion.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4>{discussion.title}</h4>
                    <p>{discussion.content}</p>
                    <div className="discussion-footer">
                      <span className="upvotes">👍 {discussion.upvotes}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
