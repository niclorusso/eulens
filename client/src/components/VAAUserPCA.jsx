import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './VAAUserPCA.css';

// Political group colors - matching the names returned by the API
const GROUP_COLORS = {
  // Full names (as stored in database)
  "European People's Party": '#0066CC',
  'Progressive Alliance of Socialists and Democrats': '#E02027',
  'Renew Europe': '#FFD700',
  'Greens/European Free Alliance': '#009E47',
  'European Conservatives and Reformists': '#0099CC',
  'The Left in the European Parliament': '#8B0000',
  'Patriots for Europe': '#1a3a5c',
  'Europe of Sovereign Nations': '#5c3d2e',
  'Non-attached Members': '#808080',
  // Alternative/legacy names
  'The Left group in the European Parliament - GUE/NGL': '#8B0000',
  'Group of the Greens/European Free Alliance': '#009E47',
  'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': '#E02027',
  'Renew Europe Group': '#FFD700',
  "Group of the European People's Party (Christian Democrats)": '#0066CC',
  'European Conservatives and Reformists Group': '#0099CC',
  'Patriots for Europe Group': '#1a3a5c',
  'Europe of Sovereign Nations Group': '#5c3d2e'
};

// Short names for display
const GROUP_SHORT_NAMES = {
  "European People's Party": 'EPP',
  'Progressive Alliance of Socialists and Democrats': 'S&D',
  'Renew Europe': 'Renew',
  'Greens/European Free Alliance': 'Greens/EFA',
  'European Conservatives and Reformists': 'ECR',
  'The Left in the European Parliament': 'The Left',
  'Patriots for Europe': 'PfE',
  'Europe of Sovereign Nations': 'ESN',
  'Non-attached Members': 'NI'
};

export default function VAAUserPCA({ topMatches = [] }) {
  const [mepData, setMepData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMEPData();
  }, []);

  async function fetchMEPData() {
    try {
      setLoading(true);
      const res = await axios.get('/api/stats/mep-pca-coords');
      setMepData(res.data);
    } catch (err) {
      console.error('Error fetching MEP PCA data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Create a set of top match MEP IDs for quick lookup
  const topMatchIds = useMemo(() => {
    return new Set(topMatches.slice(0, 10).map(m => m.mep_id));
  }, [topMatches]);

  // Create a map of MEP ID to match info
  const matchInfoMap = useMemo(() => {
    const map = {};
    topMatches.slice(0, 10).forEach((m, idx) => {
      map[m.mep_id] = { rank: idx + 1, percent: m.match_percent };
    });
    return map;
  }, [topMatches]);

  const chartData = useMemo(() => {
    if (!mepData || !mepData.meps) return null;

    const { meps } = mepData;

    // Separate MEPs into regular and highlighted (top matches)
    const regularMeps = [];
    const highlightedMeps = [];

    meps.forEach(mep => {
      const point = {
        x: mep.x,
        y: mep.y,
        mepId: mep.mepId,
        name: mep.name,
        group: mep.group,
        color: GROUP_COLORS[mep.group] || '#808080'
      };

      if (topMatchIds.has(mep.mepId)) {
        const matchInfo = matchInfoMap[mep.mepId];
        highlightedMeps.push({
          ...point,
          isMatch: true,
          rank: matchInfo?.rank || 0,
          matchPercent: matchInfo?.percent || 0
        });
      } else {
        regularMeps.push(point);
      }
    });

    // Sort highlighted by rank so #1 is rendered last (on top)
    highlightedMeps.sort((a, b) => b.rank - a.rank);

    // Calculate dynamic domain with padding
    const allX = meps.map(p => p.x);
    const allY = meps.map(p => p.y);
    const xMin = Math.floor(Math.min(...allX) - 2);
    const xMax = Math.ceil(Math.max(...allX) + 2);
    const yMin = Math.floor(Math.min(...allY) - 2);
    const yMax = Math.ceil(Math.max(...allY) + 2);

    return {
      regularMeps,
      highlightedMeps,
      domain: { x: [xMin, xMax], y: [yMin, yMax] }
    };
  }, [mepData, topMatchIds, matchInfoMap]);

  if (loading) {
    return (
      <div className="vaa-pca-loading">
        <div className="spinner"></div>
        <p>Loading political map...</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="vaa-pca-error">
        <p>Unable to load the political map.</p>
      </div>
    );
  }

  const { regularMeps, highlightedMeps, domain } = chartData;

  return (
    <div className="vaa-pca-container">
      <h3>Your Top Matches on the Political Map</h3>
      <p className="pca-description">
        Each dot is an MEP, colored by political group. 
        Your <strong>top 10 matches</strong> are highlighted with ★ stars.
      </p>

      <div className="pca-chart-wrapper">
        <ResponsiveContainer width="100%" height={450}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              dataKey="x"
              domain={domain.x}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={domain.y}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  const shortGroup = GROUP_SHORT_NAMES[data.group] || data.group || 'NI';
                  return (
                    <div className="pca-tooltip">
                      <p className="tooltip-name">
                        {data.isMatch && <span className="tooltip-star">★ #{data.rank}</span>}
                        <strong>{data.name}</strong>
                      </p>
                      <p className="tooltip-group" style={{ color: data.color }}>{shortGroup}</p>
                      {data.isMatch && (
                        <p className="tooltip-match">{data.matchPercent}% match</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            
            {/* Regular MEPs - small dots */}
            <Scatter name="MEPs" data={regularMeps}>
              {regularMeps.map((entry, index) => (
                <Cell 
                  key={`regular-${index}`} 
                  fill={entry.color} 
                  fillOpacity={0.4}
                  r={3}
                />
              ))}
            </Scatter>
            
            {/* Highlighted MEPs (top matches) - stars */}
            <Scatter
              name="Your Matches"
              data={highlightedMeps}
              shape={(props) => {
                const { cx, cy, payload } = props;
                if (!cx || !cy) return null;
                
                // Star size based on rank (bigger = better match)
                const size = 14 - payload.rank * 0.8;
                
                return (
                  <g>
                    {/* Glow effect */}
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={size + 4} 
                      fill={payload.color} 
                      fillOpacity={0.3}
                    />
                    {/* Star shape */}
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={size + 6}
                      fill={payload.color}
                      stroke="#fff"
                      strokeWidth={0.5}
                      style={{ fontWeight: 'bold' }}
                    >
                      ★
                    </text>
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Legend showing top matches */}
      <div className="pca-matches-legend">
        {highlightedMeps.sort((a, b) => a.rank - b.rank).slice(0, 5).map((mep) => (
          <Link 
            key={mep.mepId} 
            to={`/meps/${mep.mepId}`}
            className="legend-item"
            style={{ borderLeftColor: mep.color }}
          >
            <span className="legend-rank">#{mep.rank}</span>
            <span className="legend-name">{mep.name}</span>
            <span className="legend-percent">{mep.matchPercent}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
