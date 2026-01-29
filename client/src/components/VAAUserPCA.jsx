import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import './VAAUserPCA.css';

const GROUP_COLORS = {
  'The Left group in the European Parliament - GUE/NGL': '#8B0000',
  'Group of the Greens/European Free Alliance': '#009E47',
  'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': '#E02027',
  'Renew Europe Group': '#FFD700',
  'Group of the European People\'s Party (Christian Democrats)': '#3399FF',
  'European Conservatives and Reformists Group': '#5BC0DE',
  'Patriots for Europe Group': '#002244',
  'Europe of Sovereign Nations Group': '#800080',
  'Non-attached Members': '#808080'
};

// Simple PCA implementation (same as MEPPCAPlot)
function computePCA(data, numComponents = 2) {
  const n = data.length;
  if (n === 0) return { projections: [], variance: [] };
  
  const m = data[0].length;
  
  const means = new Array(m).fill(0);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      means[j] += data[i][j];
    }
    means[j] /= n;
  }
  
  const centered = data.map(row => row.map((val, j) => val - means[j]));
  
  const components = [];
  const variances = [];
  let currentData = centered.map(row => [...row]);
  
  for (let comp = 0; comp < numComponents; comp++) {
    let pc = new Array(m).fill(1);
    let norm = Math.sqrt(pc.reduce((sum, v) => sum + v * v, 0));
    pc = pc.map(v => v / norm);
    
    for (let iter = 0; iter < 100; iter++) {
      const xpc = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
      const newPc = new Array(m).fill(0);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
          newPc[j] += currentData[i][j] * xpc[i];
        }
      }
      
      norm = Math.sqrt(newPc.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      pc = newPc.map(v => v / norm);
    }
    
    const sum = pc.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      pc = pc.map(v => -v);
    }
    
    components.push(pc);
    
    const projections = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
    const variance = projections.reduce((sum, v) => sum + v * v, 0) / n;
    variances.push(variance);
    
    for (let i = 0; i < n; i++) {
      const proj = projections[i];
      for (let j = 0; j < m; j++) {
        currentData[i][j] -= proj * pc[j];
      }
    }
  }
  
  const finalProjections = centered.map(row => 
    components.map(pc => row.reduce((sum, v, j) => sum + v * pc[j], 0))
  );
  
  return { projections: finalProjections, variance: variances, components };
}

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
      const res = await axios.get('/api/stats/mep-voting-vectors', {
        params: { minVotes: 20 }
      });
      setMepData(res.data);
    } catch (err) {
      console.error('Error fetching MEP voting data:', err);
    } finally {
      setLoading(false);
    }
  }

  const chartData = useMemo(() => {
    if (!mepData || !mepData.meps || !userPCA) return null;

    const { meps, billIds } = mepData;
    
    const billIdToIndex = {};
    billIds.forEach((id, idx) => { billIdToIndex[id] = idx; });
    
    const matrix = meps.map(mep => {
      const row = new Array(billIds.length).fill(0);
      mep.votes.forEach(v => {
        const idx = billIdToIndex[v.bill_id];
        if (idx !== undefined) {
          row[idx] = v.vote;
        }
      });
      return row;
    });
    
    const { projections } = computePCA(matrix, 2);
    
    const mepPoints = meps.map((mep, i) => ({
      x: projections[i][0],
      y: projections[i][1],
      type: 'mep',
      name: mep.mep_name,
      group: mep.mep_group,
      color: GROUP_COLORS[mep.mep_group] || '#808080'
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
            {/* User point - larger and red with custom shape */}
            <Scatter 
              name="You" 
              data={[userPoint]} 
              fill="#FF0000"
              shape={(props) => {
                const { cx, cy } = props;
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={8} fill="#FF0000" stroke="#FFFFFF" strokeWidth={2} />
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">YOU</text>
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
