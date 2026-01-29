import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import PartyAgreementMatrix from './PartyAgreementMatrix';
import './Stats.css';

// Political group colors
const GROUP_COLORS = {
  'EPP': '#0056A0',
  'S&D': '#E02027',
  'Renew': '#FFD700',
  'Greens/EFA': '#009E47',
  'ECR': '#5BC0DE',
  'The Left': '#8B0000',
  'PfE': '#002244',
  'ESN': '#4A4A4A',
  'NI': '#808080'
};

const CATEGORY_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#84cc16'
];

export default function Stats() {
  const [overview, setOverview] = useState(null);
  const [partyAgreement, setPartyAgreement] = useState([]);
  const [partyCohesion, setPartyCohesion] = useState([]);
  const [controversial, setControversial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const [overviewRes, agreementRes, cohesionRes, controversialRes] = await Promise.all([
        axios.get('/api/stats/overview'),
        axios.get('/api/stats/party-agreement'),
        axios.get('/api/stats/party-cohesion'),
        axios.get('/api/stats/controversial')
      ]);

      setOverview(overviewRes.data);
      setPartyAgreement(agreementRes.data);
      setPartyCohesion(cohesionRes.data);
      setControversial(controversialRes.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="stats-header">
        <h1>Legislature Statistics</h1>
        <p className="stats-subtitle">
          Analysis of voting patterns in the 10th European Parliament
        </p>
      </header>

      {/* Overview Cards */}
      {overview && (
        <section className="stats-overview">
          <div className="stat-card">
            <div className="stat-value">{overview.totalBills}</div>
            <div className="stat-label">Total Votes</div>
          </div>
          <div className="stat-card adopted">
            <div className="stat-value">{overview.adoptionRate}%</div>
            <div className="stat-label">Adoption Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.avgParticipation}%</div>
            <div className="stat-label">Avg Participation</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{overview.activeMeps}</div>
            <div className="stat-label">Active MEPs</div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="stats-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Categories
        </button>
        <button
          className={`tab ${activeTab === 'agreement' ? 'active' : ''}`}
          onClick={() => setActiveTab('agreement')}
        >
          Party Agreement
        </button>
        <button
          className={`tab ${activeTab === 'cohesion' ? 'active' : ''}`}
          onClick={() => setActiveTab('cohesion')}
        >
          Party Cohesion
        </button>
        <button
          className={`tab ${activeTab === 'controversial' ? 'active' : ''}`}
          onClick={() => setActiveTab('controversial')}
        >
          Close Votes
        </button>
      </div>

      {/* Tab Content */}
      <div className="stats-content">
        {activeTab === 'overview' && overview && (
          <section className="card category-section">
            <h2>Votes by Policy Area</h2>
            <div className="category-chart-container">
              <ResponsiveContainer width="100%" height={Math.max(450, overview.byCategory.length * 35)}>
                <BarChart 
                  data={overview.byCategory} 
                  layout="vertical" 
                  margin={{ top: 10, right: 60, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 'auto']} axisLine={false} tickLine={false} allowDataOverflow={false} />
                  <YAxis
                    dataKey="category"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12, fill: '#475569' }}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'white', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Bar dataKey="count" name="Bills" radius={[0, 6, 6, 0]} barSize={20}>
                    {overview.byCategory.map((entry, index) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="category-pie-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={overview.byCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) =>
                      percent > 0.05 ? `${category} ${(percent * 100).toFixed(0)}%` : ''
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="category"
                  >
                    {overview.byCategory.map((entry, index) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {activeTab === 'agreement' && (
          <section className="card">
            <h2>Party Agreement Matrix</h2>
            <p className="section-description">
              How often do political groups vote the same way? This matrix shows the percentage
              of bills where two groups had the same majority position.
            </p>
            <PartyAgreementMatrix data={partyAgreement} />
          </section>
        )}

        {activeTab === 'cohesion' && (
          <section className="card">
            <h2>Party Cohesion</h2>
            <p className="section-description">
              How unified is each political group? Cohesion measures the percentage of members
              who vote with their group's majority position.
            </p>
            <div className="cohesion-chart">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={partyCohesion} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis
                    dataKey="political_group"
                    type="category"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => `${value}%`}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="avg_cohesion" name="Cohesion">
                    {partyCohesion.map((entry, index) => {
                      // Match short names to colors
                      const shortName = Object.keys(GROUP_COLORS).find(k =>
                        entry.political_group?.includes(k)
                      );
                      return (
                        <Cell
                          key={entry.political_group}
                          fill={GROUP_COLORS[shortName] || CATEGORY_COLORS[index]}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="cohesion-table">
              <table>
                <thead>
                  <tr>
                    <th>Political Group</th>
                    <th>Cohesion</th>
                    <th>Bills Voted</th>
                    <th>Total MEP Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {partyCohesion.map(group => (
                    <tr key={group.political_group}>
                      <td>{group.political_group}</td>
                      <td className="cohesion-value">{group.avg_cohesion}%</td>
                      <td>{group.bills_voted}</td>
                      <td>{parseInt(group.total_mep_votes).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'controversial' && (
          <section className="card">
            <h2>Most Contested Votes</h2>
            <p className="section-description">
              Bills with the closest margins between Yes and No votes.
            </p>
            <div className="controversial-list">
              {controversial.map(bill => {
                const total = parseInt(bill.yes_votes) + parseInt(bill.no_votes);
                const yesPercent = (parseInt(bill.yes_votes) / total) * 100;
                const noPercent = (parseInt(bill.no_votes) / total) * 100;

                return (
                  <div key={bill.id} className="controversial-item">
                    <Link to={`/bills/${bill.id}`} className="bill-title">
                      {bill.title}
                    </Link>
                    <div className="bill-meta">
                      <span className="category-tag">{bill.category}</span>
                      <span className={`status-badge status-${bill.status}`}>{bill.status}</span>
                      <span className="date">
                        {bill.date_adopted && new Date(bill.date_adopted).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="vote-bar-container">
                      <div className="vote-bar">
                        <div
                          className="vote-segment yes"
                          style={{ width: `${yesPercent}%` }}
                          title={`Yes: ${bill.yes_votes}`}
                        />
                        <div
                          className="vote-segment no"
                          style={{ width: `${noPercent}%` }}
                          title={`No: ${bill.no_votes}`}
                        />
                      </div>
                      <div className="vote-labels">
                        <span className="yes">{bill.yes_votes} Yes ({yesPercent.toFixed(1)}%)</span>
                        <span className="no">{bill.no_votes} No ({noPercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
