import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GroupsList.css';

// More subtle, muted colors
const GROUP_COLORS = {
  'EPP': '#4A6FA5',        // Muted blue
  'S&D': '#C85A5A',        // Muted red
  'Renew': '#D4AF37',      // Muted gold
  'Greens/EFA': '#5A9F7A', // Muted green
  'ECR': '#7BA8C4',        // Muted light blue
  'ID': '#3A4A5A',         // Muted dark blue
  'The Left': '#8B5A5A',   // Muted dark red
  'GUE/NGL': '#8B5A5A',    // Muted dark red
  'PfE': '#3A4A5A',        // Muted dark blue
  'ESN': '#6A6A6A',        // Muted gray
  'NI': '#9A9A9A',         // Light gray
  'Unknown': '#B0B0B0'     // Very light gray
};

// Short names for political groups
const GROUP_SHORT_NAMES = {
  'The Left group in the European Parliament - GUE/NGL': 'GUE/NGL',
  'The Left in the European Parliament - GUE/NGL': 'GUE/NGL',
  'Group of the Greens/European Free Alliance': 'Greens/EFA',
  'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': 'S&D',
  'Renew Europe Group': 'Renew',
  'Group of the European People\'s Party (Christian Democrats)': 'EPP',
  'European Conservatives and Reformists Group': 'ECR',
  'Patriots for Europe Group': 'PfE',
  'Europe of Sovereign Nations Group': 'ESN',
  'Non-attached Members': 'NI'
};

function getShortName(name) {
  if (GROUP_SHORT_NAMES[name]) return GROUP_SHORT_NAMES[name];
  const lower = name.toLowerCase();
  if (lower.includes('left') || lower.includes('gue')) return 'GUE/NGL';
  if (lower.includes('green')) return 'Greens/EFA';
  if (lower.includes('socialist') || lower.includes('s&d')) return 'S&D';
  if (lower.includes('renew')) return 'Renew';
  if (lower.includes('people') || lower.includes('epp')) return 'EPP';
  if (lower.includes('conservative') || lower.includes('ecr')) return 'ECR';
  if (lower.includes('patriot')) return 'PfE';
  if (lower.includes('sovereign') || lower.includes('esn')) return 'ESN';
  if (lower.includes('non-attached') || lower.includes('ni')) return 'NI';
  return name.substring(0, 30);
}

export default function GroupsList({ embedded = false }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('mep_count');

  useEffect(() => {
    fetchGroups();
  }, []);

  async function fetchGroups() {
    try {
      const res = await axios.get('/api/groups');
      setGroups(res.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredGroups = groups
    .filter(group => {
      const name = (group.group_name || '').toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === 'mep_count') {
        return (b.mep_count || 0) - (a.mep_count || 0);
      } else if (sortBy === 'name') {
        return (a.group_name || '').localeCompare(b.group_name || '');
      } else if (sortBy === 'bills_voted') {
        return (b.bills_voted || 0) - (a.bills_voted || 0);
      }
      return 0;
    });

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading political groups...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="groups-list-page">
        <header className="page-header">
          <h1>Political Groups</h1>
          <p className="subtitle">{groups.length} political groups in the European Parliament</p>
        </header>

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
              <label>Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="mep_count">Number of MEPs</option>
                <option value="name">Name</option>
                <option value="bills_voted">Bills Voted</option>
              </select>
            </div>
          </div>

          <div className="results-count">
            Showing {filteredGroups.length} of {groups.length} groups
          </div>
        </div>

        <div className="groups-grid">
          {filteredGroups.map(group => {
            const shortName = getShortName(group.group_name);
            const groupColor = GROUP_COLORS[shortName] || GROUP_COLORS['Unknown'];
            const yesPercent = group.total_votes > 0 
              ? Math.round((group.yes_votes / group.total_votes) * 100) 
              : 0;
            const noPercent = group.total_votes > 0 
              ? Math.round((group.no_votes / group.total_votes) * 100) 
              : 0;
            const abstainPercent = group.total_votes > 0 
              ? Math.round((group.abstain_votes / group.total_votes) * 100) 
              : 0;

            return (
              <div key={group.group_name} className="group-card card">
                <div 
                  className="group-header"
                  style={{ 
                    backgroundColor: groupColor,
                    backgroundImage: `linear-gradient(135deg, ${groupColor} 0%, ${groupColor}dd 100%)`
                  }}
                >
                  <h3 className="group-name">{shortName}</h3>
                  <p className="group-full-name" title={group.group_name}>
                    {group.group_name}
                  </p>
                </div>
                <div className="group-stats">
                  <div className="stat-item">
                    <span className="stat-value">{group.mep_count || 0}</span>
                    <span className="stat-label">MEPs</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{group.country_count || 0}</span>
                    <span className="stat-label">Countries</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{group.bills_voted || 0}</span>
                    <span className="stat-label">Bills Voted</span>
                  </div>
                </div>
                <div className="group-votes">
                  <div className="vote-breakdown">
                    <div className="vote-bar">
                      <div 
                        className="vote-segment yes" 
                        style={{ width: `${yesPercent}%` }}
                        title={`Yes: ${yesPercent}%`}
                      />
                      <div 
                        className="vote-segment no" 
                        style={{ width: `${noPercent}%` }}
                        title={`No: ${noPercent}%`}
                      />
                      <div 
                        className="vote-segment abstain" 
                        style={{ width: `${abstainPercent}%` }}
                        title={`Abstain: ${abstainPercent}%`}
                      />
                    </div>
                    <div className="vote-labels">
                      <span className="yes">{yesPercent}% Yes</span>
                      <span className="no">{noPercent}% No</span>
                      <span className="abstain">{abstainPercent}% Abstain</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredGroups.length === 0 && (
          <div className="no-results card">
            <p>No groups found matching your search.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="btn-primary"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
