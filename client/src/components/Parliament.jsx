import React, { useState, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import MEPsList from './MEPsList';
import GroupsList from './GroupsList';
import CountriesList from './CountriesList';
import './Parliament.css';

export default function Parliament() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  
  // Detect tab from URL path or query param
  const getInitialTab = () => {
    if (location.pathname === '/meps') return 'meps';
    if (location.pathname === '/groups') return 'groups';
    if (location.pathname === '/countries') return 'countries';
    return searchParams.get('tab') || 'meps';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  
  // Update tab when location changes
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [location.pathname, searchParams]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <main className="parliament-page">
      <div className="container">
        <header className="parliament-header">
          <h1>The Parliament</h1>
          <p className="parliament-subtitle">
            Explore the Members, Political Groups, and Countries of the European Parliament
          </p>
        </header>

        <div className="parliament-tabs">
          <button
            className={`parliament-tab ${activeTab === 'meps' ? 'active' : ''}`}
            onClick={() => handleTabChange('meps')}
          >
            MEPs
          </button>
          <button
            className={`parliament-tab ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => handleTabChange('groups')}
          >
            Groups
          </button>
          <button
            className={`parliament-tab ${activeTab === 'countries' ? 'active' : ''}`}
            onClick={() => handleTabChange('countries')}
          >
            Countries
          </button>
        </div>

        <div className="parliament-content">
          {activeTab === 'meps' && <MEPsList embedded />}
          {activeTab === 'groups' && <GroupsList embedded />}
          {activeTab === 'countries' && <CountriesList embedded />}
        </div>
      </div>
    </main>
  );
}
