import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './VAAUserPCA.css';

// Political group colors (using full names from database)
const GROUP_COLORS = {
  "European People's Party": '#0066CC',
  'Progressive Alliance of Socialists and Democrats': '#E02027',
  'Renew Europe': '#FFD700',
  'Greens/European Free Alliance': '#009E47',
  'European Conservatives and Reformists': '#0099CC',
  'The Left in the European Parliament': '#8B0000',
  'Patriots for Europe': '#1a3a5c',
  'Europe of Sovereign Nations': '#5c3d2e',
  'Non-attached Members': '#999999'
};

export default function VAAUserPCA({ userPCA }) {
  const [mepData, setMepData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userPCA) {
      fetchMEPData();
    }
  }, [userPCA]);

  async function fetchMEPData() {
    try {
      setLoading(true);
      // Use pre-computed PCA coordinates - much faster!
      const res = await axios.get('/api/stats/mep-pca-coords');
      setMepData(res.data);
    } catch (err) {
      console.error('Error fetching MEP PCA data:', err);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!mepData || !mepData.meps || !userPCA) return null;

    // Use pre-computed coordinates directly
    const mepPoints = mepData.meps.map(mep => ({
      x: mep.x,
      y: mep.y,
      type: 'mep',
      name: mep.name,
      group: mep.group,
      color: GROUP_COLORS[mep.group] || '#808080'
    }));

    // Add user point
    const userPoint = {
      x: userPCA.x,
      y: userPCA.y,
      type: 'user',
      name: 'You',
      color: '#FF0000'
    };

    // Calculate dynamic domain with padding
    const allX = [...mepPoints.map(p => p.x), userPoint.x];
    const allY = [...mepPoints.map(p => p.y), userPoint.y];
    const xMin = Math.floor(Math.min(...allX) * 1.1);
    const xMax = Math.ceil(Math.max(...allX) * 1.1);
    const yMin = Math.floor(Math.min(...allY) * 1.1);
    const yMax = Math.ceil(Math.max(...allY) * 1.1);

    // Generate even integer ticks
    const xTicks = [];
    for (let i = xMin; i <= xMax; i += 2) {
      if (i % 2 === 0) xTicks.push(i);
    }
    const yTicks = [];
    for (let i = yMin; i <= yMax; i += 2) {
      if (i % 2 === 0) yTicks.push(i);
    }

    return {
      mepPoints,
      userPoint,
      domain: { x: [xMin, xMax], y: [yMin, yMax] },
      ticks: { x: xTicks, y: yTicks }
    };
  }, [mepData, userPCA]);

  if (!userPCA) return null;

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
        <p>Unable to calculate your position on the political map.</p>
      </div>
    );
  }

  const { mepPoints, userPoint, domain, ticks } = chartData;

  return (
    <div className="vaa-pca-container">
      <h3>Your Position on the Political Map</h3>
      <p className="pca-description">
        This map shows where you stand compared to MEPs based on your voting preferences.
        Each dot represents an MEP, colored by their political group. Your position is marked with a red star.
      </p>
      
      <div className="pca-chart-wrapper">
        <ResponsiveContainer width="100%" height={500} aspect={1}>
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              domain={domain.x}
              ticks={ticks.x}
              tickFormatter={(value) => Math.round(value)}
              label={{ value: 'Principal Component 1', position: 'insideBottom', offset: -10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={domain.y}
              ticks={ticks.y}
              tickFormatter={(value) => Math.round(value)}
              label={{ value: 'Principal Component 2', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="pca-tooltip">
                      <p><strong>{data.name}</strong></p>
                      {data.group && <p>{data.group}</p>}
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* MEP points */}
            <Scatter name="MEPs" data={mepPoints} fill="#8884d8">
              {mepPoints.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Scatter>
            {/* User point - larger red circle */}
            <Scatter 
              name="You" 
              data={[userPoint]} 
              fill="#FF0000"
              shape={(props) => {
                const { cx, cy } = props;
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={10} fill="#FF0000" stroke="#FFFFFF" strokeWidth={3} opacity={0.9} />
                    <circle cx={cx} cy={cy} r={6} fill="#FFFFFF" />
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
