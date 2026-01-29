import React, { useMemo } from 'react';
import './PartyAgreementMatrix.css';

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
  // Direct match
  if (GROUP_SHORT_NAMES[name]) return GROUP_SHORT_NAMES[name];

  // Partial match
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

  // Fallback: return full name if short
  return name.length > 15 ? name.substring(0, 15) + '...' : name;
}

// Political group order (left to right)
const GROUP_ORDER = [
  'GUE/NGL',
  'Greens/EFA',
  'S&D',
  'Renew',
  'EPP',
  'ECR',
  'PfE',
  'ESN',
  'NI'
];

// Color scale for agreement percentage
function getColor(percentage) {
  if (percentage >= 80) return '#16a34a'; // Green
  if (percentage >= 60) return '#84cc16'; // Light green
  if (percentage >= 40) return '#fbbf24'; // Yellow
  if (percentage >= 20) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

export default function PartyAgreementMatrix({ data }) {
  // Build matrix from pairwise data
  const { matrix, groups } = useMemo(() => {
    if (!data || data.length === 0) return { matrix: {}, groups: [] };

    // Collect all unique groups, filtering out Identity and Democracy
    const groupSet = new Set();
    data.forEach(row => {
      const g1 = getShortName(row.group1);
      const g2 = getShortName(row.group2);
      // Filter out ID (Identity and Democracy) - doesn't exist in 10th legislature
      const lower1 = (row.group1 || '').toLowerCase();
      const lower2 = (row.group2 || '').toLowerCase();
      if (!lower1.includes('identity') || !lower1.includes('democracy')) {
        if (g1 !== 'ID' && !g1.toLowerCase().includes('identity')) {
          groupSet.add(g1);
        }
      }
      if (!lower2.includes('identity') || !lower2.includes('democracy')) {
        if (g2 !== 'ID' && !g2.toLowerCase().includes('identity')) {
          groupSet.add(g2);
        }
      }
    });

    // Sort groups by political spectrum order
    const sortedGroups = Array.from(groupSet).sort((a, b) => {
      const aIdx = GROUP_ORDER.indexOf(a);
      const bIdx = GROUP_ORDER.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    // Build matrix
    const mat = {};
    sortedGroups.forEach(g1 => {
      mat[g1] = {};
      sortedGroups.forEach(g2 => {
        mat[g1][g2] = g1 === g2 ? 100 : null;
      });
    });

    // Fill in values from data, excluding Identity and Democracy
    data.forEach(row => {
      const lower1 = (row.group1 || '').toLowerCase();
      const lower2 = (row.group2 || '').toLowerCase();
      
      // Skip if either group is Identity and Democracy
      if (lower1.includes('identity') && lower1.includes('democracy')) return;
      if (lower2.includes('identity') && lower2.includes('democracy')) return;
      
      const g1 = getShortName(row.group1);
      const g2 = getShortName(row.group2);
      
      // Double check the short names aren't ID
      if (g1 === 'ID' || g2 === 'ID') return;
      
      const pct = parseFloat(row.agreement_pct);

      if (mat[g1] && mat[g1][g2] === null) mat[g1][g2] = pct;
      if (mat[g2] && mat[g2][g1] === null) mat[g2][g1] = pct;
    });

    return { matrix: mat, groups: sortedGroups };
  }, [data]);

  if (groups.length === 0) {
    return <div className="matrix-empty">No agreement data available</div>;
  }

  return (
    <div className="agreement-matrix-container">
      <div className="matrix-wrapper">
        <table className="agreement-matrix">
          <thead>
            <tr>
              <th className="corner"></th>
              {groups.map(group => (
                <th key={group} className="group-header">
                  {group}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(rowGroup => (
              <tr key={rowGroup}>
                <th className="row-header">{rowGroup}</th>
                {groups.map(colGroup => {
                  const value = matrix[rowGroup]?.[colGroup];
                  const isDiagonal = rowGroup === colGroup;

                  return (
                    <td
                      key={colGroup}
                      className={`matrix-cell ${isDiagonal ? 'diagonal' : ''}`}
                      style={{
                        backgroundColor: isDiagonal
                          ? '#f1f5f9'
                          : value !== null
                            ? `${getColor(value)}20`
                            : '#f8fafc'
                      }}
                    >
                      {isDiagonal ? (
                        <span className="diagonal-marker">-</span>
                      ) : value !== null ? (
                        <span
                          className="cell-value"
                          style={{ color: getColor(value) }}
                        >
                          {value.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="no-data">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <span className="legend-label">Agreement:</span>
        <div className="legend-scale">
          <span className="legend-item" style={{ backgroundColor: '#ef4444' }}>0-20%</span>
          <span className="legend-item" style={{ backgroundColor: '#f97316' }}>20-40%</span>
          <span className="legend-item" style={{ backgroundColor: '#fbbf24' }}>40-60%</span>
          <span className="legend-item" style={{ backgroundColor: '#84cc16' }}>60-80%</span>
          <span className="legend-item" style={{ backgroundColor: '#16a34a' }}>80-100%</span>
        </div>
      </div>
    </div>
  );
}
