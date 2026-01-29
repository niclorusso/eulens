import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Customized } from 'recharts';
import axios from 'axios';
import './MEPPCAPlot.css';

// Lazy load Plotly for 3D view (it's a large library)
const Plot = lazy(() => import('react-plotly.js'));

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

export default function MEPPCAPlot() {
  const [pcaData, setPcaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [viewMode, setViewMode] = useState('meps'); // 'meps', 'groups', or '3d'
  const [showAxisInfo, setShowAxisInfo] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      // Try pre-computed coordinates first (much faster!)
      const res = await axios.get('/api/stats/mep-pca-coords');
      
      // Check if we have valid data
      if (res.data && res.data.meps && res.data.meps.length > 0) {
        setPcaData(res.data);
      } else {
        // Fallback: compute on the fly if no precomputed data
        console.log('No precomputed PCA data, falling back to live computation...');
        const fallbackRes = await axios.get('/api/stats/mep-voting-vectors', {
          params: { minVotes: 20 }
        });
        setPcaData({ fallback: true, ...fallbackRes.data });
      }
    } catch (err) {
      console.error('Error fetching MEP PCA data:', err);
      // Try fallback endpoint
      try {
        console.log('Trying fallback endpoint...');
        const fallbackRes = await axios.get('/api/stats/mep-voting-vectors', {
          params: { minVotes: 20 }
        });
        setPcaData({ fallback: true, ...fallbackRes.data });
      } catch (fallbackErr) {
        console.error('Fallback also failed:', fallbackErr);
        setError('Failed to load MEP PCA data');
      }
    } finally {
      setLoading(false);
    }
  }

  // Simple PCA implementation for fallback
  function computePCAFallback(data, numComponents = 3) {
    const n = data.length;
    if (n === 0) return { projections: [], variance: [] };
    const m = data[0].length;
    
    const means = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) means[j] += data[i][j];
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
          for (let i = 0; i < n; i++) newPc[j] += currentData[i][j] * xpc[i];
        }
        norm = Math.sqrt(newPc.reduce((sum, v) => sum + v * v, 0));
        if (norm < 1e-10) break;
        pc = newPc.map(v => v / norm);
      }
      
      const sum = pc.reduce((a, b) => a + b, 0);
      if (sum > 0) pc = pc.map(v => -v);
      
      components.push(pc);
      const projections = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
      variances.push(projections.reduce((sum, v) => sum + v * v, 0) / n);
      
      for (let i = 0; i < n; i++) {
        const proj = projections[i];
        for (let j = 0; j < m; j++) currentData[i][j] -= proj * pc[j];
      }
    }
    
    const finalProjections = centered.map(row => 
      components.map(pc => row.reduce((sum, v, j) => sum + v * pc[j], 0))
    );
    return { projections: finalProjections, variance: variances };
  }

  // Transform data into points for visualization
  const pcaPoints = useMemo(() => {
    if (!pcaData) return [];
    
    // Pre-computed data path
    if (!pcaData.fallback && pcaData.meps && pcaData.meps.length > 0) {
      return pcaData.meps.map(mep => ({
        mep_id: mep.mepId,
        name: mep.name,
        group: mep.group,
        x: mep.x,
        y: mep.y,
        z: mep.z || 0,
        color: GROUP_COLORS[mep.group] || '#808080'
      }));
    }
    
    // Fallback: compute PCA on the fly
    if (pcaData.fallback && pcaData.meps && pcaData.billIds) {
      const { meps, billIds } = pcaData;
      const billIdToIndex = {};
      billIds.forEach((id, idx) => { billIdToIndex[id] = idx; });
      
      const matrix = meps.map(mep => {
        const row = new Array(billIds.length).fill(0);
        mep.votes.forEach(v => {
          const idx = billIdToIndex[v.bill_id];
          if (idx !== undefined) row[idx] = v.vote;
        });
        return row;
      });
      
      const { projections } = computePCAFallback(matrix, 3);
      
      return meps.map((mep, i) => ({
        mep_id: mep.mep_id,
        name: mep.mep_name,
        group: mep.mep_group,
        x: projections[i][0],
        y: projections[i][1],
        z: projections[i][2] || 0,
        color: GROUP_COLORS[mep.mep_group] || '#808080'
      }));
    }
    
    return [];
  }, [pcaData]);

  // Get variance explained from pre-computed data
  const varianceExplained = useMemo(() => {
    if (!pcaData?.variance || pcaData.variance.length === 0) return [];
    const totalVariance = pcaData.variance.reduce((a, b) => a + b, 0);
    return pcaData.variance.map(v => ((v / totalVariance) * 100).toFixed(1));
  }, [pcaData]);
  // Get bill loadings from pre-computed data
  const topBillsPerComponent = useMemo(() => {
    if (!pcaData?.billLoadings || pcaData.billLoadings.length === 0) return [];
    
    // Transform to the expected format with positive/negative split
    return pcaData.billLoadings.map(axis => {
      const positive = axis.filter(b => b.loading > 0).slice(0, 3);
      const negative = axis.filter(b => b.loading < 0).slice(0, 3);
      return { positive, negative };
    });
  }, [pcaData]);

  // Get unique groups for legend
  const groups = useMemo(() => {
    if (!pcaPoints || pcaPoints.length === 0) return [];
    const uniqueGroups = [...new Set(pcaPoints.map(p => p.group))].filter(Boolean);
    return uniqueGroups.sort();
  }, [pcaPoints]);

  // Compute group centroids and standard deviations for Groups view
  const groupData = useMemo(() => {
    if (!pcaPoints || pcaPoints.length === 0) return [];
    
    // First pass: compute means
    const groupStats = {};
    pcaPoints.forEach(p => {
      if (!p.group) return;
      if (!groupStats[p.group]) {
        groupStats[p.group] = { sumX: 0, sumY: 0, sumZ: 0, count: 0, points: [] };
      }
      groupStats[p.group].sumX += p.x;
      groupStats[p.group].sumY += p.y;
      groupStats[p.group].sumZ += p.z || 0;
      groupStats[p.group].count += 1;
      groupStats[p.group].points.push({ x: p.x, y: p.y, z: p.z || 0 });
    });
    
    return Object.entries(groupStats).map(([group, stats]) => {
      const meanX = stats.sumX / stats.count;
      const meanY = stats.sumY / stats.count;
      const meanZ = stats.sumZ / stats.count;
      
      // Compute standard deviations
      let sumSqX = 0, sumSqY = 0, sumSqZ = 0;
      stats.points.forEach(p => {
        sumSqX += (p.x - meanX) ** 2;
        sumSqY += (p.y - meanY) ** 2;
        sumSqZ += (p.z - meanZ) ** 2;
      });
      const stdX = Math.sqrt(sumSqX / stats.count);
      const stdY = Math.sqrt(sumSqY / stats.count);
      const stdZ = Math.sqrt(sumSqZ / stats.count);
      
      return {
        group,
        shortName: GROUP_SHORT_NAMES[group] || group,
        x: meanX,
        y: meanY,
        z: meanZ,
        count: stats.count,
        stdX,
        stdY,
        stdZ,
        color: GROUP_COLORS[group] || '#808080'
      };
    });
  }, [pcaPoints]);

  // Filter data based on selected group
  const filteredData = useMemo(() => {
    if (!pcaPoints) return [];
    if (!selectedGroup) return pcaPoints;
    return pcaPoints.filter(p => p.group === selectedGroup);
  }, [pcaPoints, selectedGroup]);

  // Compute dynamic axis domains based on data (with nice round numbers and equal proportions)
  const axisDomains = useMemo(() => {
    const dataToUse = viewMode === 'groups' ? groupData : filteredData;
    if (!dataToUse || dataToUse.length === 0) {
      return { x: [-1, 1], y: [-1, 1] };
    }
    
    const xValues = dataToUse.map(d => d.x);
    const yValues = dataToUse.map(d => d.y);
    
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    
    // Calculate centers and ranges
    const xCenter = (xMin + xMax) / 2;
    const yCenter = (yMin + yMax) / 2;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    
    // Use the larger range for both axes to maintain proportions
    const maxRange = Math.max(xRange, yRange) * 1.3; // 30% padding for groups view
    const halfRange = maxRange / 2;
    
    // Round to nearest integer for cleaner axis labels
    return {
      x: [Math.floor(xCenter - halfRange), Math.ceil(xCenter + halfRange)],
      y: [Math.floor(yCenter - halfRange), Math.ceil(yCenter + halfRange)]
    };
  }, [filteredData, groupData, viewMode]);

  if (loading) {
    return (
      <div className="pca-loading">
        <div className="spinner"></div>
        <p>Computing MEP voting patterns...</p>
      </div>
    );
  }

  if (error) {
    return <div className="pca-error">{error}</div>;
  }

  if (!pcaPoints || pcaPoints.length === 0) {
    return <div className="pca-empty">No voting data available for analysis</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      if (viewMode === 'groups') {
        const avgStd = ((data.stdX + data.stdY) / 2).toFixed(1);
        return (
          <div className="pca-tooltip">
            <strong style={{ color: data.color }}>{data.shortName}</strong>
            <div className="pca-tooltip-detail">{data.count} MEPs</div>
            <div className="pca-tooltip-detail">Spread: ±{avgStd}</div>
          </div>
        );
      }
      const shortName = GROUP_SHORT_NAMES[data.group] || data.group || 'Non-attached';
      return (
        <div className="pca-tooltip">
          <strong style={{ color: '#1e293b' }}>{data.name}</strong>
          <div className="pca-tooltip-group" style={{ color: data.color }}>
            {shortName}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="pca-container">
      {/* View Mode Toggle */}
      <div className="pca-view-toggle">
        <button
          className={`pca-view-btn ${viewMode === 'meps' ? 'active' : ''}`}
          onClick={() => setViewMode('meps')}
        >
          MEPs (2D)
        </button>
        <button
          className={`pca-view-btn ${viewMode === 'groups' ? 'active' : ''}`}
          onClick={() => setViewMode('groups')}
        >
          Groups (2D)
        </button>
        <button
          className={`pca-view-btn ${viewMode === '3d' ? 'active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          3D View
        </button>
      </div>

      {/* Legend - only show for MEPs view */}
      {viewMode === 'meps' && (
        <div className="pca-legend">
          <button
            className={`pca-legend-item ${!selectedGroup ? 'active' : ''}`}
            onClick={() => setSelectedGroup(null)}
          >
            <span className="legend-dot" style={{ background: '#475569' }}></span>
            All ({pcaPoints.length})
          </button>
          {groups.map(group => {
            const count = pcaPoints.filter(p => p.group === group).length;
            const shortName = GROUP_SHORT_NAMES[group] || group;
            return (
              <button
                key={group}
                className={`pca-legend-item ${selectedGroup === group ? 'active' : ''}`}
                onClick={() => setSelectedGroup(selectedGroup === group ? null : group)}
                title={group}
              >
                <span className="legend-dot" style={{ background: GROUP_COLORS[group] || '#808080' }}></span>
                {shortName} ({count})
              </button>
            );
          })}
        </div>
      )}
      
      {/* 2D Charts */}
      {(viewMode === 'meps' || viewMode === 'groups') && (
        <>
          <div className="pca-chart-wrapper">
            <ResponsiveContainer width="100%" aspect={1}>
              <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="PC1" 
                  domain={axisDomains.x}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  ticks={Array.from({ length: 21 }, (_, i) => (i - 10) * 2).filter(v => v >= axisDomains.x[0] && v <= axisDomains.x[1])}
                  allowDataOverflow={false}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="PC2"
                  domain={axisDomains.y}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  ticks={Array.from({ length: 21 }, (_, i) => (i - 10) * 2).filter(v => v >= axisDomains.y[0] && v <= axisDomains.y[1])}
                  allowDataOverflow={false}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {viewMode === 'meps' ? (
                  <Scatter data={filteredData} fill="#8884d8">
                    {filteredData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        fillOpacity={selectedGroup ? 0.8 : 0.7}
                        stroke={selectedGroup === entry.group ? '#1e293b' : 'none'}
                        strokeWidth={selectedGroup === entry.group ? 1 : 0}
                      />
                    ))}
                  </Scatter>
                ) : (
                  <>
                    <ZAxis type="number" dataKey="count" range={[400, 4000]} />
                    {/* Standard deviation ellipses - rendered first so they appear behind bubbles */}
                    <Customized
                      component={({ xAxisMap, yAxisMap, width, height }) => {
                        const xAxis = xAxisMap && Object.values(xAxisMap)[0];
                        const yAxis = yAxisMap && Object.values(yAxisMap)[0];
                        if (!xAxis || !yAxis) return null;
                        
                        return (
                          <g style={{ clipPath: 'none', overflow: 'visible' }}>
                            {groupData.map((g, i) => {
                              const cx = xAxis.scale(g.x);
                              const cy = yAxis.scale(g.y);
                              // Scale std dev to pixels (1 std dev)
                              const rx = Math.abs(xAxis.scale(g.x + g.stdX) - cx);
                              const ry = Math.abs(yAxis.scale(g.y + g.stdY) - cy);
                              
                              // Skip if values are invalid
                              if (isNaN(cx) || isNaN(cy) || isNaN(rx) || isNaN(ry)) return null;
                              
                              return (
                                <ellipse
                                  key={`ellipse-${i}`}
                                  cx={cx}
                                  cy={cy}
                                  rx={Math.max(rx, 5)}
                                  ry={Math.max(ry, 5)}
                                  fill={g.color}
                                  fillOpacity={0.2}
                                  stroke={g.color}
                                  strokeWidth={2}
                                  strokeOpacity={0.5}
                                  strokeDasharray="6 3"
                                />
                              );
                            })}
                          </g>
                        );
                      }}
                    />
                    <Scatter data={groupData} fill="#8884d8">
                      {groupData.map((entry, index) => (
                        <Cell 
                          key={`group-${index}`} 
                          fill={entry.color}
                          fillOpacity={0.9}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Scatter>
                  </>
                )}
              </ScatterChart>
            </ResponsiveContainer>
            
            {/* Group labels for Groups view */}
            {viewMode === 'groups' && (
              <div className="pca-group-labels">
                {groupData.map(g => (
                  <span key={g.group} style={{ color: g.color }}>
                    {g.shortName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pca-info">
            <p>
              {viewMode === 'meps' ? (
                <>
                  <strong>How to read this:</strong> Each dot is an MEP. MEPs that vote similarly 
                  are placed close together. Clusters show voting blocs.
                </>
              ) : (
                <>
                  <strong>How to read this:</strong> Each bubble is a political group at its average position. 
                  Bubble size = number of MEPs. Dashed ellipses show the spread (1 standard deviation). 
                  Groups close together vote similarly.
                </>
              )}
            </p>
          </div>
        </>
      )}

      {/* 3D Chart */}
      {viewMode === '3d' && (
        <>
          <div className="pca-3d-wrapper">
            <Suspense fallback={<div className="pca-loading"><div className="spinner"></div><p>Loading 3D view...</p></div>}>
              <Plot
                data={[
                  // MEPs scatter
                  {
                    type: 'scatter3d',
                    mode: 'markers',
                    name: 'MEPs',
                    x: pcaPoints.map(p => p.x),
                    y: pcaPoints.map(p => p.y),
                    z: pcaPoints.map(p => p.z),
                    text: pcaPoints.map(p => `${p.name}<br>${GROUP_SHORT_NAMES[p.group] || p.group}`),
                    hoverinfo: 'text',
                    marker: {
                      size: 4,
                      color: pcaPoints.map(p => p.color),
                      opacity: 0.7,
                    },
                  },
                  // Group centroids
                  {
                    type: 'scatter3d',
                    mode: 'markers+text',
                    name: 'Groups',
                    x: groupData.map(g => g.x),
                    y: groupData.map(g => g.y),
                    z: groupData.map(g => g.z),
                    text: groupData.map(g => g.shortName),
                    textposition: 'top center',
                    textfont: { size: 12, color: groupData.map(g => g.color) },
                    hoverinfo: 'text',
                    hovertext: groupData.map(g => `${g.shortName}<br>${g.count} MEPs`),
                    marker: {
                      size: groupData.map(g => Math.sqrt(g.count) * 2),
                      color: groupData.map(g => g.color),
                      opacity: 0.9,
                      line: { color: 'white', width: 1 },
                    },
                  },
                ]}
                layout={{
                  autosize: true,
                  height: 600,
                  margin: { l: 0, r: 0, t: 30, b: 0 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  scene: {
                    xaxis: { title: `PC1 (${varianceExplained[0] || '?'}%)`, gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1' },
                    yaxis: { title: `PC2 (${varianceExplained[1] || '?'}%)`, gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1' },
                    zaxis: { title: `PC3 (${varianceExplained[2] || '?'}%)`, gridcolor: '#e2e8f0', zerolinecolor: '#cbd5e1' },
                    bgcolor: '#fafbfc',
                  },
                  showlegend: false,
                }}
                config={{
                  displayModeBar: true,
                  modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
                  displaylogo: false,
                }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
              />
            </Suspense>
          </div>

          <div className="pca-info">
            <p>
              <strong>How to read this:</strong> 3D view with three principal components. 
              Small dots are individual MEPs, large labeled bubbles are group averages. 
              Drag to rotate, scroll to zoom. Groups close together vote similarly.
            </p>
          </div>
        </>
      )}

      {/* Axis Interpretation */}
      {varianceExplained.length > 0 && (
        <div className="pca-axis-info">
          <button 
            className="pca-axis-toggle"
            onClick={() => setShowAxisInfo(!showAxisInfo)}
          >
            {showAxisInfo ? '▼' : '▶'} Understand the axes
          </button>
          
          {showAxisInfo && (
            <div className="pca-axis-details">
              <p className="pca-axis-intro">
                Each axis represents a pattern in how MEPs vote. The percentage shows how much 
                of the total voting variation that axis captures.
              </p>
              
              <div className="pca-axis-grid">
                {varianceExplained.slice(0, viewMode === '3d' ? 3 : 2).map((variance, idx) => (
                  <div key={idx} className="pca-axis-card">
                    <div className="pca-axis-header">
                      <span className="pca-axis-name">PC{idx + 1}</span>
                      <span className="pca-axis-variance">{variance}% of variance</span>
                    </div>
                    <div className="pca-axis-bar">
                      <div 
                        className="pca-axis-bar-fill" 
                        style={{ width: `${Math.min(parseFloat(variance), 100)}%` }}
                      />
                    </div>
                    {topBillsPerComponent[idx] && (
                      <div className="pca-axis-bills">
                        <div className="pca-axis-direction">
                          <span className="direction-label">→ High values (voted YES on):</span>
                          <div className="direction-bills">
                            {topBillsPerComponent[idx].positive.slice(0, 3).map((b, i) => (
                              <Link key={i} to={`/bills/${b.billId}`} className="bill-link">
                                Bill #{b.billId}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="pca-axis-direction">
                          <span className="direction-label">← Low values (voted YES on):</span>
                          <div className="direction-bills">
                            {topBillsPerComponent[idx].negative.slice(0, 3).map((b, i) => (
                              <Link key={i} to={`/bills/${b.billId}`} className="bill-link">
                                Bill #{b.billId}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
