import React from 'react';
import { Link } from 'react-router-dom';
import './MEPAgreementList.css';

// Color scale for agreement percentage (matching PartyAgreementMatrix)
function getColor(percentage) {
  if (percentage >= 80) return '#16a34a'; // Green
  if (percentage >= 60) return '#84cc16'; // Light green
  if (percentage >= 40) return '#fbbf24'; // Yellow
  if (percentage >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

// Political group colors
const GROUP_COLORS = {
  'EPP': '#0056A0',
  'S&D': '#E02027',
  'Renew': '#FFD700',
  'Greens/EFA': '#009E47',
  'ECR': '#5BC0DE',
  'ID': '#002244',
  'The Left': '#8B0000',
  'GUE/NGL': '#8B0000',
  'NI': '#808080',
  'Unknown': '#CCCCCC'
};

export default function MEPAgreementList({ data, showPairwise = false }) {
  if (!data || data.length === 0) {
    return <div className="mep-agreement-empty">No agreement data available</div>;
  }

  // If showing pairwise data (from stats page)
  if (showPairwise) {
    return (
      <div className="mep-agreement-container">
        <div className="mep-agreement-table-wrapper">
          <table className="mep-agreement-table">
            <thead>
              <tr>
                <th>MEP 1</th>
                <th>Party</th>
                <th>MEP 2</th>
                <th>Party</th>
                <th>Agreement</th>
                <th>Shared Votes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                const agreementPct = parseFloat(row.agreement_pct);
                const color = getColor(agreementPct);
                const group1Color = GROUP_COLORS[row.mep1_group] || GROUP_COLORS['Unknown'];
                const group2Color = GROUP_COLORS[row.mep2_group] || GROUP_COLORS['Unknown'];
                
                return (
                  <tr key={idx}>
                    <td>
                      <Link to={`/meps/${row.mep1_id}`} className="mep-link">
                        {row.mep1_name}
                      </Link>
                    </td>
                    <td>
                      {row.mep1_group && (
                        <span
                          className="party-badge-small"
                          style={{ backgroundColor: group1Color }}
                        >
                          {row.mep1_group}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link to={`/meps/${row.mep2_id}`} className="mep-link">
                        {row.mep2_name}
                      </Link>
                    </td>
                    <td>
                      {row.mep2_group && (
                        <span
                          className="party-badge-small"
                          style={{ backgroundColor: group2Color }}
                        >
                          {row.mep2_group}
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className="agreement-badge"
                        style={{ color, backgroundColor: `${color}20` }}
                      >
                        {agreementPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="shared-votes">{row.total_bills}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // If showing single MEP's agreements (from MEP profile)
  return (
    <div className="mep-agreement-container">
      <div className="mep-agreement-grid">
        {data.map((mep, idx) => {
          const agreementPct = parseFloat(mep.agreement_pct);
          const color = getColor(agreementPct);
          const groupColor = GROUP_COLORS[mep.political_group] || GROUP_COLORS['Unknown'];
          
          return (
            <Link
              key={mep.mep2_id || idx}
              to={`/meps/${mep.mep2_id}`}
              className="mep-agreement-card"
            >
              <div className="mep-card-photo">
                <img
                  src={mep.photo_url || 'https://www.europarl.europa.eu/mepphoto/default.jpg'}
                  alt={mep.mep2_name}
                  onError={(e) => {
                    e.target.src = 'https://www.europarl.europa.eu/mepphoto/default.jpg';
                  }}
                />
              </div>
              <div className="mep-card-info">
                <h3 className="mep-card-name">{mep.mep2_name}</h3>
                <div className="mep-card-badges">
                  {mep.political_group && (
                    <span
                      className="mep-card-group"
                      style={{ backgroundColor: groupColor }}
                    >
                      {mep.political_group}
                    </span>
                  )}
                  {mep.country_code && (
                    <span className="mep-card-country">
                      {mep.country_name || mep.country_code}
                    </span>
                  )}
                </div>
                <div className="mep-card-agreement">
                  <span
                    className="agreement-badge large"
                    style={{ color, backgroundColor: `${color}20` }}
                  >
                    {agreementPct.toFixed(1)}% agreement
                  </span>
                  <span className="shared-votes-text">
                    {mep.total_bills} shared votes
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
