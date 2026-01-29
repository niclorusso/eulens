import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './MEPsList.css';

const GROUP_COLORS = {
  'EPP': '#003399',
  'S&D': '#E30613',
  'Renew': '#FFD700',
  'Greens/EFA': '#009933',
  'ECR': '#0054A5',
  'ID': '#004A77',
  'The Left': '#8B0000',
  'NI': '#999999'
};

const EU_COUNTRIES = {
  'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
  'CY': 'Cyprus', 'CZ': 'Czechia', 'DK': 'Denmark', 'EE': 'Estonia',
  'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
  'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
  'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
  'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
  'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden'
};

export default function MEPsList({ embedded = false }) {
  const [meps, setMeps] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    fetchMEPs();
    fetchStats();
  }, []);

  async function fetchMEPs() {
    try {
      const res = await axios.get('/api/meps');
      setMeps(res.data);
    } catch (error) {
      console.error('Error fetching MEPs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const res = await axios.get('/api/meps/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching MEP stats:', error);
    }
  }

  const filteredMeps = meps
    .filter(mep => {
      const fullName = `${mep.first_name || ''} ${mep.last_name || mep.name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      const matchesGroup = !filterGroup || mep.political_group === filterGroup;
      const matchesCountry = !filterCountry || mep.country_code === filterCountry;
      return matchesSearch && matchesGroup && matchesCountry;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = `${a.last_name || a.name || ''}`.toLowerCase();
        const nameB = `${b.last_name || b.name || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (sortBy === 'country') {
        return (a.country_code || '').localeCompare(b.country_code || '');
      } else if (sortBy === 'group') {
        return (a.political_group || '').localeCompare(b.political_group || '');
      }
      return 0;
    });

  const uniqueGroups = [...new Set(meps.map(m => m.political_group).filter(Boolean))].sort();
  const uniqueCountries = [...new Set(meps.map(m => m.country_code).filter(Boolean))].sort();

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading MEPs...</p>
        </div>
      </main>
    );
  }

  const genderData = stats ? [
    { name: 'Male', value: stats.genderRatio.counts.male, color: '#3b82f6' },
    { name: 'Female', value: stats.genderRatio.counts.female, color: '#ec4899' }
  ] : [];

  return (
    <main className="container">
      <div className="meps-list-page">
        <header className="page-header">
          <h1>Members of European Parliament</h1>
          <p className="subtitle">{meps.length} MEPs in the current legislature</p>
        </header>

        {/* Stats Overview */}
        {stats && (
          <section className="meps-stats-overview card">
            <h2>MEP Overview</h2>
            <div className="stats-grid">
              {/* Gender Ratio */}
              <div className="stat-card">
                <h3>Gender Distribution</h3>
                <div className="stat-chart">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {genderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="stat-numbers">
                  <div className="stat-number">
                    <span className="stat-value">{stats.genderRatio.counts.male}</span>
                    <span className="stat-label">Male ({stats.genderRatio.male}%)</span>
                  </div>
                  <div className="stat-number">
                    <span className="stat-value">{stats.genderRatio.counts.female}</span>
                    <span className="stat-label">Female ({stats.genderRatio.female}%)</span>
                  </div>
                </div>
              </div>

              {/* Birth Decades */}
              <div className="stat-card">
                <h3>Birth Decades</h3>
                <div className="stat-chart">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.birthDecades}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="decade" 
                        tickFormatter={(value) => `${value}s`}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => value}
                        labelFormatter={(label) => `Born in ${label}s`}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="stat-info">
                  <p>Distribution of MEPs by birth decade</p>
                </div>
              </div>

              {/* Reelection Status */}
              {stats.reelection && (
                <div className="stat-card">
                  <h3>Reelection Status</h3>
                  <div className="stat-chart">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'New MEPs', value: stats.reelection.new, color: '#10b981' },
                            { name: 'Reelected', value: stats.reelection.reelected, color: '#3b82f6' }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'New MEPs', value: stats.reelection.new, color: '#10b981' },
                            { name: 'Reelected', value: stats.reelection.reelected, color: '#3b82f6' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="stat-numbers">
                    <div className="stat-number">
                      <span className="stat-value">{stats.reelection.new}</span>
                      <span className="stat-label">New MEPs</span>
                    </div>
                    <div className="stat-number">
                      <span className="stat-value">{stats.reelection.reelected}</span>
                      <span className="stat-label">Reelected</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <div className="filters-section card">
          <div className="filters-row">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-group">
              <label>Political Group</label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="">All Groups</option>
                {uniqueGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Country</label>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
              >
                <option value="">All Countries</option>
                {uniqueCountries.map(code => (
                  <option key={code} value={code}>{EU_COUNTRIES[code] || code}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="country">Country</option>
                <option value="group">Political Group</option>
              </select>
            </div>
          </div>

          <div className="results-count">
            Showing {filteredMeps.length} of {meps.length} MEPs
          </div>
        </div>

        <div className="meps-grid">
          {filteredMeps.map(mep => (
            <Link
              key={mep.mep_id}
              to={`/meps/${mep.mep_id}`}
              className="mep-card"
            >
              <div className="mep-photo-container">
                <img
                  src={`https://www.europarl.europa.eu/mepphoto/${mep.mep_id}.jpg`}
                  alt={`${mep.first_name || ''} ${mep.last_name || mep.name || ''}`}
                  className="mep-photo"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120" viewBox="0 0 100 120"><rect fill="%23e2e8f0" width="100" height="120"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="%2394a3b8">?</text></svg>';
                  }}
                />
              </div>
              <div className="mep-info">
                <h3 className="mep-name">
                  {mep.first_name} {mep.last_name || mep.name}
                </h3>
                <div className="mep-meta">
                  <span
                    className="group-badge"
                    style={{ backgroundColor: GROUP_COLORS[mep.political_group] || '#999' }}
                  >
                    {mep.political_group || 'NI'}
                  </span>
                  <span className="country-badge">
                    {EU_COUNTRIES[mep.country_code] || mep.country_code}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredMeps.length === 0 && (
          <div className="no-results card">
            <p>No MEPs found matching your filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterGroup('');
                setFilterCountry('');
              }}
              className="btn-primary"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
