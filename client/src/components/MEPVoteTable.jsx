import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import './MEPVoteTable.css';

export default function MEPVoteTable({ mepVotes }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [voteFilter, setVoteFilter] = useState('');
  const [sortBy, setSortBy] = useState('group');
  const [sortDir, setSortDir] = useState('asc');

  // Get unique groups and countries for filters
  const groups = useMemo(() => {
    const uniqueGroups = [...new Set(mepVotes.map(v => v.mep_group).filter(Boolean))];
    return uniqueGroups.sort();
  }, [mepVotes]);

  const countries = useMemo(() => {
    const uniqueCountries = [...new Set(mepVotes.map(v => v.country).filter(Boolean))];
    return uniqueCountries.sort();
  }, [mepVotes]);

  // Filter and sort MEPs
  const filteredMEPs = useMemo(() => {
    let result = mepVotes.filter(mep => {
      const matchesSearch = !searchTerm ||
        mep.mep_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesGroup = !groupFilter || mep.mep_group === groupFilter;
      const matchesCountry = !countryFilter || mep.country === countryFilter;
      const matchesVote = !voteFilter || mep.vote === voteFilter;

      return matchesSearch && matchesGroup && matchesCountry && matchesVote;
    });

    // Sort
    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = a.mep_name || '';
          bVal = b.mep_name || '';
          break;
        case 'country':
          aVal = a.country || '';
          bVal = b.country || '';
          break;
        case 'group':
          aVal = a.mep_group || '';
          bVal = b.mep_group || '';
          break;
        case 'vote':
          aVal = a.vote || '';
          bVal = b.vote || '';
          break;
        default:
          return 0;
      }
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [mepVotes, searchTerm, groupFilter, countryFilter, voteFilter, sortBy, sortDir]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Vote counts by filter
  const voteCounts = useMemo(() => {
    return {
      yes: filteredMEPs.filter(m => m.vote === 'yes').length,
      no: filteredMEPs.filter(m => m.vote === 'no').length,
      abstain: filteredMEPs.filter(m => m.vote === 'abstain').length
    };
  }, [filteredMEPs]);

  return (
    <div className="mep-vote-table">
      <div className="table-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search MEP by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filters">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={voteFilter} onChange={(e) => setVoteFilter(e.target.value)}>
            <option value="">All Votes</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="abstain">Abstain</option>
          </select>
        </div>
      </div>

      <div className="table-summary">
        <span className="count-badge yes">{voteCounts.yes} Yes</span>
        <span className="count-badge no">{voteCounts.no} No</span>
        <span className="count-badge abstain">{voteCounts.abstain} Abstain</span>
        <span className="total-count">({filteredMEPs.length} MEPs shown)</span>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('name')}>
                Name <SortIcon column="name" />
              </th>
              <th onClick={() => handleSort('country')}>
                Country <SortIcon column="country" />
              </th>
              <th onClick={() => handleSort('group')}>
                Political Group <SortIcon column="group" />
              </th>
              <th onClick={() => handleSort('vote')}>
                Vote <SortIcon column="vote" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMEPs.slice(0, 100).map((mep, idx) => (
              <tr key={`${mep.mep_id}-${idx}`}>
                <td className="mep-name">
                  <Link to={`/meps/${mep.mep_id}`} className="mep-link">
                    {mep.mep_name}
                  </Link>
                </td>
                <td>{mep.country}</td>
                <td className="mep-group">{mep.mep_group || 'Unknown'}</td>
                <td>
                  <span className={`vote-badge ${mep.vote}`}>
                    {mep.vote}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMEPs.length > 100 && (
          <div className="table-footer">
            Showing first 100 of {filteredMEPs.length} MEPs. Use filters to narrow results.
          </div>
        )}
      </div>
    </div>
  );
}
