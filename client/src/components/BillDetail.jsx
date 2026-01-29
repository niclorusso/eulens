import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Hemicycle from './Hemicycle';
import MEPVoteTable from './MEPVoteTable';
import './BillDetail.css';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [votes, setVotes] = useState([]);
  const [mepVotes, setMepVotes] = useState([]);
  const [nonVoters, setNonVoters] = useState([]);
  const [discussions, setDiscussions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hemicycle');
  const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '', country: 'AT' });
  const [submitting, setSubmitting] = useState(false);
  const [showArguments, setShowArguments] = useState(false);

  const EU_COUNTRIES = {
    'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
    'CY': 'Cyprus', 'CZ': 'Czechia', 'DK': 'Denmark', 'EE': 'Estonia',
    'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
    'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
    'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
    'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
    'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden'
  };

  // Parse markdown bold (**text**) to React elements
  function parseMarkdownBold(text) {
    if (!text) return text;
    
    // Split by **text** pattern and create React elements
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    
    return parts.map((part, index) => {
      // Odd indices are the bold parts (captured groups)
      if (index % 2 === 1) {
        return <strong key={index}>{part}</strong>;
      }
      return part;
    });
  }

  // Parse reasons text which might be in various formats:
  // - PostgreSQL array format: {"reason1","reason2"}
  // - JSON array: ["reason1","reason2"]
  // - Plain text with newlines
  // - Single string
  function parseReasons(text) {
    if (!text) return [];
    
    // Check if it's PostgreSQL array format: {"item1","item2"}
    if (text.startsWith('{') && text.endsWith('}')) {
      // Remove outer braces and split by ","
      const inner = text.slice(1, -1);
      // Parse PostgreSQL array format - items are quoted with ""
      const items = [];
      let current = '';
      let inQuote = false;
      
      for (let i = 0; i < inner.length; i++) {
        const char = inner[i];
        if (char === '"' && inner[i-1] !== '\\') {
          inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
          if (current.trim()) {
            items.push(current.trim().replace(/^"|"$/g, ''));
          }
          current = '';
        } else {
          current += char;
        }
      }
      if (current.trim()) {
        items.push(current.trim().replace(/^"|"$/g, ''));
      }
      return items.filter(item => item.length > 0);
    }
    
    // Check if it's JSON array format
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && item.trim());
        }
      } catch (e) {
        // Not valid JSON, continue
      }
    }
    
    // Plain text - split by newlines or bullet points
    return text
      .split(/\n|•|·|-\s/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  useEffect(() => {
    fetchBillDetail();
  }, [id]);

  async function fetchBillDetail() {
    try {
      setLoading(true);
      const [billRes, votesRes, discussionsRes, mepVotesRes, nonVotersRes] = await Promise.all([
        axios.get(`/api/bills/${id}`),
        axios.get(`/api/votes/${id}`),
        axios.get(`/api/bills/${id}/discussions`),
        axios.get(`/api/bills/${id}/mep-votes`),
        axios.get(`/api/bills/${id}/non-voters`).catch(() => ({ data: [] }))
      ]);

      setBill(billRes.data.bill);
      setVotes(billRes.data.votes);
      setDiscussions(billRes.data.discussions);
      setSummary(billRes.data.summary);
      setMepVotes(mepVotesRes.data);
      setNonVoters(nonVotersRes.data);
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
    country: v.code || v.country_code,
    yes: parseInt(v.yes_votes, 10) || 0,
    no: parseInt(v.no_votes, 10) || 0,
    abstain: parseInt(v.abstain_votes, 10) || 0
  }));

  const totalVotes = {
    yes: votes.reduce((sum, v) => sum + (parseInt(v.yes_votes, 10) || 0), 0),
    no: votes.reduce((sum, v) => sum + (parseInt(v.no_votes, 10) || 0), 0),
    abstain: votes.reduce((sum, v) => sum + (parseInt(v.abstain_votes, 10) || 0), 0)
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
          {/* AI Summary Section */}
          {summary && (
            <div className="bill-summary-section">
              <p className="summary-short">{summary.summary_short}</p>
              
              <div className="summary-details">
                <p className="summary-long">{summary.summary_long}</p>
                
                {summary.key_points && summary.key_points.length > 0 && (
                  <div className="key-points">
                    <h4>Key Points</h4>
                    <ul>
                      {summary.key_points.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(summary.reasons_yes || summary.reasons_no) && (
                  <div className="arguments-section">
                    <button
                      className="arguments-toggle"
                      onClick={() => setShowArguments(!showArguments)}
                    >
                      {showArguments ? '▼' : '▶'} Arguments For & Against
                    </button>
                    {showArguments && (
                      <div className="reasons-grid">
                        {summary.reasons_yes && (
                          <div className="reasons-yes">
                            <h4>✓ Arguments For</h4>
                            <div className="reasons-content">
                              {parseReasons(summary.reasons_yes).map((reason, i) => (
                                <p key={i}>{parseMarkdownBold(reason)}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {summary.reasons_no && (
                          <div className="reasons-no">
                            <h4>✗ Arguments Against</h4>
                            <div className="reasons-content">
                              {parseReasons(summary.reasons_no).map((reason, i) => (
                                <p key={i}>{parseMarkdownBold(reason)}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {summary.political_tags && summary.political_tags.length > 0 && (
                  <div className="political-tags">
                    {summary.political_tags.map((tag, i) => (
                      <span key={i} className="political-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!summary && (
            <p className="bill-full-description">{bill.description}</p>
          )}

          {/* EP Links */}
          <div className="ep-links">
            {bill.ep_procedure_url && (
              <a
                href={bill.ep_procedure_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ep-link-btn"
              >
                View Procedure Details
              </a>
            )}
            {bill.procedure_id && (
              <span className="procedure-ref">
                {bill.procedure_type}: {bill.procedure_id}
              </span>
            )}
          </div>
        </header>

        {/* Vote Summary */}
        <section className="vote-summary-section card">
          <h2>Vote Result</h2>
          <div className="vote-summary-grid">
            <div className="vote-stats">
              <div className="vote-stat yes">
                <div className="vote-number">{totalVotes.yes}</div>
                <div className="vote-label">Yes</div>
              </div>
              <div className="vote-stat no">
                <div className="vote-number">{totalVotes.no}</div>
                <div className="vote-label">No</div>
              </div>
              <div className="vote-stat abstain">
                <div className="vote-number">{totalVotes.abstain}</div>
                <div className="vote-label">Abstain</div>
              </div>
            </div>

            {pieData.some(d => d.value > 0) && (
              <div className="pie-chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={(value, entry) => `${value}: ${entry.payload.value}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* Voting Analysis Tabs */}
        <section className="voting-analysis-section">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'hemicycle' ? 'active' : ''}`}
              onClick={() => setActiveTab('hemicycle')}
            >
              Parliament View
            </button>
            <button
              className={`tab ${activeTab === 'country' ? 'active' : ''}`}
              onClick={() => setActiveTab('country')}
            >
              By Country
            </button>
            <button
              className={`tab ${activeTab === 'meps' ? 'active' : ''}`}
              onClick={() => setActiveTab('meps')}
            >
              Individual MEPs
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'hemicycle' && (
              <Hemicycle mepVotes={mepVotes} nonVoters={nonVoters} />
            )}

            {activeTab === 'country' && chartData.length > 0 && (
              <div className="country-chart card">
                <h3>Votes by Country</h3>
                <ResponsiveContainer width="100%" height={Math.max(500, chartData.length * 25)}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="country"
                      type="category"
                      width={50}
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="yes" stackId="a" fill="#4ade80" name="Yes" />
                    <Bar dataKey="no" stackId="a" fill="#ef4444" name="No" />
                    <Bar dataKey="abstain" stackId="a" fill="#f59e0b" name="Abstain" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'meps' && (
              <MEPVoteTable mepVotes={mepVotes} />
            )}
          </div>
        </section>

        {/* Discussions */}
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
    </main>
  );
}
