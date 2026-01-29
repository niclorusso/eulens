import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CountriesList.css';

const EU_COUNTRIES = {
  'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
  'CY': 'Cyprus', 'CZ': 'Czechia', 'DK': 'Denmark', 'EE': 'Estonia',
  'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
  'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
  'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
  'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
  'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden'
};

export default function CountriesList({ embedded = false }) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    fetchCountries();
  }, []);

  async function fetchCountries() {
    try {
      const res = await axios.get('/api/countries');
      setCountries(res.data);
    } catch (error) {
      console.error('Error fetching countries:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCountries = countries
    .filter(country => {
      const name = (country.name || '').toLowerCase();
      const code = (country.code || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || code.includes(search);
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'mep_count') {
        return (b.mep_count || 0) - (a.mep_count || 0);
      } else if (sortBy === 'accession_year') {
        return (a.accession_year || 9999) - (b.accession_year || 9999);
      }
      return 0;
    });

  if (loading) {
    return (
      <main className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading countries...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="countries-list-page">
        <header className="page-header">
          <h1>EU Member States</h1>
          <p className="subtitle">{countries.length} countries in the European Union</p>
        </header>

        <div className="filters-section card">
          <div className="filters-row">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by name or code..."
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
                <option value="name">Name</option>
                <option value="mep_count">Number of MEPs</option>
                <option value="accession_year">EU Accession Year</option>
              </select>
            </div>
          </div>

          <div className="results-count">
            Showing {filteredCountries.length} of {countries.length} countries
          </div>
        </div>

        <div className="countries-grid">
          {filteredCountries.map(country => {
            const yesPercent = country.total_votes > 0 
              ? Math.round((country.yes_votes / country.total_votes) * 100) 
              : 0;
            const noPercent = country.total_votes > 0 
              ? Math.round((country.no_votes / country.total_votes) * 100) 
              : 0;
            const abstainPercent = country.total_votes > 0 
              ? Math.round((country.abstain_votes / country.total_votes) * 100) 
              : 0;

            return (
              <div key={country.code} className="country-card card">
                <div className="country-header">
                  <h3 className="country-name">{country.name}</h3>
                  <span className="country-code">{country.code}</span>
                </div>
                <div className="country-stats">
                  <div className="stat-item">
                    <span className="stat-value">{country.mep_count || 0}</span>
                    <span className="stat-label">MEPs</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{country.accession_year || 'N/A'}</span>
                    <span className="stat-label">Joined EU</span>
                  </div>
                </div>
                {country.total_votes > 0 && (
                  <div className="country-votes">
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
                )}
              </div>
            );
          })}
        </div>

        {filteredCountries.length === 0 && (
          <div className="no-results card">
            <p>No countries found matching your search.</p>
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
