import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import MEPAgreementList from './MEPAgreementList';
import './MEPProfile.css';

// Political group colors (matching Hemicycle)
const GROUP_COLORS = {
  'EPP': '#0056A0',
  'S&D': '#E02027',
  'Renew': '#FFD700',
  'Greens/EFA': '#009E47',
  'ECR': '#5BC0DE',
  'ID': '#002244',
  'The Left': '#8B0000',
  'NI': '#808080',
  'Unknown': '#CCCCCC'
};

const VOTE_COLORS = {
  yes: '#4ade80',
  no: '#ef4444',
  abstain: '#f59e0b',
  did_not_vote: '#94a3b8'
};

export default function MEPProfile() {
  const { mepId } = useParams();
  const navigate = useNavigate();
  const [mep, setMep] = useState(null);
  const [votes, setVotes] = useState([]);
  const [stats, setStats] = useState(null);
  const [similarMeps, setSimilarMeps] = useState([]);
  const [loadingSimilarMeps, setLoadingSimilarMeps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [votesPage, setVotesPage] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);

  const VOTES_PER_PAGE = 20;

  useEffect(() => {
    fetchMEPData();
  }, [mepId]);

  useEffect(() => {
    if (activeTab === 'votes') {
      fetchVotes();
    } else if (activeTab === 'similar') {
      fetchSimilarMeps();
    }
  }, [activeTab, votesPage]);

  async function fetchMEPData() {
    try {
      setLoading(true);
      const [mepRes, statsRes] = await Promise.all([
        axios.get(`/api/meps/${mepId}`),
        axios.get(`/api/meps/${mepId}/stats`)
      ]);
      setMep(mepRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching MEP data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchVotes() {
    try {
      const res = await axios.get(`/api/meps/${mepId}/votes`, {
        params: { limit: VOTES_PER_PAGE, offset: votesPage * VOTES_PER_PAGE }
      });
      setVotes(res.data.votes);
      setTotalVotes(res.data.total);
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  }

  async function fetchSimilarMeps() {
    if (similarMeps.length > 0) return; // Already loaded
    
    try {
      setLoadingSimilarMeps(true);
      const res = await axios.get(`/api/meps/${mepId}/agreement`, {
        params: { limit: 20, minShared: 10 }
      });
      setSimilarMeps(res.data);
    } catch (error) {
      console.error('Error fetching similar MEPs:', error);
    } finally {
      setLoadingSimilarMeps(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading MEP profile...</p>
        </div>
      </main>
    );
  }

  if (!mep) {
    return (
      <main className="container">
        <div className="text-center mt-4">
          <p>MEP not found</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-2">
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Prepare pie chart data with correct colors, ordered: Yes, Abstain, No
  const voteOrder = { yes: 0, abstain: 1, no: 2 };
  const pieData = stats?.overall?.filter(s => s.vote !== 'did_not_vote')
    .map(s => ({
      name: s.vote.charAt(0).toUpperCase() + s.vote.slice(1),
      value: parseInt(s.count, 10),
      vote: s.vote, // Keep original vote type for color mapping
      color: VOTE_COLORS[s.vote] || '#94a3b8',
      order: voteOrder[s.vote] ?? 99
    }))
    .sort((a, b) => a.order - b.order) || [];

  // Prepare category data
  const categoryData = [];
  if (stats?.byCategory) {
    const categories = {};
    stats.byCategory.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = { category: item.category || 'Uncategorized', yes: 0, no: 0, abstain: 0 };
      }
      if (item.vote !== 'did_not_vote') {
        categories[item.category][item.vote] = parseInt(item.count, 10);
      }
    });
    Object.values(categories).forEach(cat => categoryData.push(cat));
  }

  const participation = stats?.participation;
  const participationRate = participation
    ? Math.round((participation.voted / participation.total) * 100)
    : 0;

  const groupColor = GROUP_COLORS[mep.political_group] || GROUP_COLORS['Unknown'];

  return (
    <main className="container">
      <button onClick={() => navigate(-1)} className="back-btn">
        ← Back
      </button>

      <div className="mep-profile">
        {/* Header Section */}
        <header className="profile-header card">
          <div className="profile-photo-section">
            <img
              src={mep.photo_url}
              alt={mep.name}
              className="profile-photo"
              onError={(e) => {
                e.target.src = 'https://www.europarl.europa.eu/mepphoto/default.jpg';
              }}
            />
          </div>
          <div className="profile-info">
            <h1>{mep.name}</h1>
            <div className="profile-badges">
              <span
                className="group-badge"
                style={{ backgroundColor: groupColor }}
              >
                {mep.political_group || 'Non-Inscrits'}
              </span>
              <span className="country-badge">
                {mep.country_name || mep.country_code}
              </span>
            </div>
            {mep.date_of_birth && (
              <p className="profile-meta">
                Born: {new Date(mep.date_of_birth).toLocaleDateString('en-GB', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
            <div className="social-links">
              {mep.email && (
                <a href={`mailto:${mep.email}`} className="social-link email" title="Email">
                  ✉️ Email
                </a>
              )}
              {mep.twitter && (
                <a href={mep.twitter} target="_blank" rel="noopener noreferrer" className="social-link twitter" title="Twitter/X">
                  𝕏 Twitter
                </a>
              )}
              {mep.facebook && (
                <a href={mep.facebook} target="_blank" rel="noopener noreferrer" className="social-link facebook" title="Facebook">
                  📘 Facebook
                </a>
              )}
              <a
                href={`https://www.europarl.europa.eu/meps/en/${mep.mep_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link ep-link"
              >
                🇪🇺 EP Profile
              </a>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <section className="stats-overview card">
          <div className="stats-content">
            <h2>Voting Summary</h2>
            <div className="stats-grid">
              <div className="stat-box participation">
                <div className="stat-number">{participationRate}%</div>
                <div className="stat-label">Participation</div>
                <div className="stat-detail">
                  {participation?.voted} of {participation?.total}
                </div>
              </div>
              {pieData.map((item) => (
                <div key={item.name} className={`stat-box ${item.name.toLowerCase()}`}>
                  <div className="stat-number" style={{ color: item.color }}>
                    {item.value}
                  </div>
                  <div className="stat-label">{item.name}</div>
                </div>
              ))}
            </div>
            {pieData.length > 0 && (
              <div className="pie-chart-section">
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
                      {pieData.map((entry) => (
                        <Cell key={`cell-${entry.vote}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} votes`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            By Category
          </button>
          <button
            className={`tab ${activeTab === 'votes' ? 'active' : ''}`}
            onClick={() => setActiveTab('votes')}
          >
            Voting History
          </button>
          <button
            className={`tab ${activeTab === 'similar' ? 'active' : ''}`}
            onClick={() => setActiveTab('similar')}
          >
            Similar MEPs
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && categoryData.length > 0 && (
            <section className="category-breakdown card">
              <h3>Votes by Policy Area</h3>
              <ResponsiveContainer width="100%" height={Math.max(400, categoryData.length * 40)}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="category"
                    type="category"
                    width={130}
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="yes" stackId="a" fill={VOTE_COLORS.yes} name="Yes" />
                  <Bar dataKey="no" stackId="a" fill={VOTE_COLORS.no} name="No" />
                  <Bar dataKey="abstain" stackId="a" fill={VOTE_COLORS.abstain} name="Abstain" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {activeTab === 'votes' && (
            <section className="voting-history card">
              <h3>Voting History ({totalVotes} total votes)</h3>
              <div className="votes-table-container">
                <table className="votes-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Bill</th>
                      <th>Category</th>
                      <th>Vote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {votes.map((vote, idx) => (
                      <tr key={idx}>
                        <td className="date-cell">
                          {vote.date_adopted
                            ? new Date(vote.date_adopted).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="bill-cell">
                          <Link to={`/bill/${vote.bill_id}`} className="bill-link">
                            {vote.title}
                          </Link>
                        </td>
                        <td className="category-cell">
                          <span className="category-tag">{vote.category || 'General'}</span>
                        </td>
                        <td className="vote-cell">
                          <span className={`vote-badge ${vote.vote}`}>
                            {vote.vote === 'did_not_vote' ? 'Did not vote' : vote.vote.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalVotes > VOTES_PER_PAGE && (
                <div className="pagination">
                  <button
                    onClick={() => setVotesPage(p => Math.max(0, p - 1))}
                    disabled={votesPage === 0}
                    className="pagination-btn"
                  >
                    ← Previous
                  </button>
                  <span className="pagination-info">
                    Page {votesPage + 1} of {Math.ceil(totalVotes / VOTES_PER_PAGE)}
                  </span>
                  <button
                    onClick={() => setVotesPage(p => p + 1)}
                    disabled={(votesPage + 1) * VOTES_PER_PAGE >= totalVotes}
                    className="pagination-btn"
                  >
                    Next →
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === 'similar' && (
            <section className="similar-meps card">
              <h3>Most Similar MEPs</h3>
              <p className="section-description">
                MEPs with the highest voting agreement. Based on bills where both MEPs voted.
              </p>
              {loadingSimilarMeps ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <p>Loading similar MEPs...</p>
                </div>
              ) : (
                <MEPAgreementList data={similarMeps} />
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
