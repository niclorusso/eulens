import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Hemicycle.css';

// Political group order from left to right (as in actual EU Parliament)
const GROUP_ORDER = [
  'The Left in the European Parliament',
  'Greens/European Free Alliance',
  'Progressive Alliance of Socialists and Democrats',
  'Renew Europe',
  'European People\'s Party',
  'European Conservatives and Reformists',
  'Patriots for Europe',
  'Europe of Sovereign Nations',
  'Non-attached Members',
  'Unknown'
];

// Map full names to canonical names (handles various name formats from data sources)
const GROUP_CANONICAL = {
  // The Left / GUE-NGL
  'The Left group in the European Parliament - GUE/NGL': 'The Left in the European Parliament',
  'The Left in the European Parliament - GUE/NGL': 'The Left in the European Parliament',
  'The Left in the European Parliament': 'The Left in the European Parliament',
  'GUE/NGL': 'The Left in the European Parliament',
  'The Left': 'The Left in the European Parliament',

  // Greens/EFA
  'Group of the Greens/European Free Alliance': 'Greens/European Free Alliance',
  'Greens/European Free Alliance': 'Greens/European Free Alliance',
  'Greens/EFA': 'Greens/European Free Alliance',
  'Verts/ALE': 'Greens/European Free Alliance',

  // S&D (Socialists & Democrats)
  'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': 'Progressive Alliance of Socialists and Democrats',
  'Progressive Alliance of Socialists and Democrats in the European Parliament': 'Progressive Alliance of Socialists and Democrats',
  'Progressive Alliance of Socialists and Democrats': 'Progressive Alliance of Socialists and Democrats',
  'S&D': 'Progressive Alliance of Socialists and Democrats',

  // Renew Europe
  'Renew Europe Group': 'Renew Europe',
  'Renew Europe': 'Renew Europe',
  'Renew': 'Renew Europe',

  // EPP (European People's Party)
  'Group of the European People\'s Party (Christian Democrats)': 'European People\'s Party',
  'European People\'s Party (Christian Democrats)': 'European People\'s Party',
  'European People\'s Party': 'European People\'s Party',
  'EPP': 'European People\'s Party',

  // ECR (European Conservatives and Reformists)
  'European Conservatives and Reformists Group': 'European Conservatives and Reformists',
  'European Conservatives and Reformists': 'European Conservatives and Reformists',
  'ECR': 'European Conservatives and Reformists',

  // Patriots for Europe
  'Patriots for Europe Group': 'Patriots for Europe',
  'Patriots for Europe': 'Patriots for Europe',
  'PfE': 'Patriots for Europe',

  // Europe of Sovereign Nations
  'Europe of Sovereign Nations Group': 'Europe of Sovereign Nations',
  'Europe of Sovereign Nations': 'Europe of Sovereign Nations',
  'ESN': 'Europe of Sovereign Nations',

  // Non-attached
  'Non-attached Members': 'Non-attached Members',
  'Non-Inscrits': 'Non-attached Members',
  'NI': 'Non-attached Members',

  'Unknown': 'Unknown'
};

// Function to find canonical group name with fuzzy matching
function getCanonicalGroup(rawGroup) {
  if (!rawGroup) return 'Unknown';

  // Direct match
  if (GROUP_CANONICAL[rawGroup]) {
    return GROUP_CANONICAL[rawGroup];
  }

  // Try case-insensitive partial matching
  const lowerRaw = rawGroup.toLowerCase();

  if (lowerRaw.includes('left') || lowerRaw.includes('gue')) {
    return 'The Left in the European Parliament';
  }
  if (lowerRaw.includes('green') || lowerRaw.includes('verts') || lowerRaw.includes('efa') || lowerRaw.includes('free alliance')) {
    return 'Greens/European Free Alliance';
  }
  if (lowerRaw.includes('socialist') || lowerRaw.includes('s&d') || lowerRaw.includes('democrat') && lowerRaw.includes('progressive')) {
    return 'Progressive Alliance of Socialists and Democrats';
  }
  if (lowerRaw.includes('renew')) {
    return 'Renew Europe';
  }
  if (lowerRaw.includes('people') || lowerRaw.includes('epp') || lowerRaw.includes('christian democrat')) {
    return 'European People\'s Party';
  }
  if (lowerRaw.includes('conservative') || lowerRaw.includes('reformist') || lowerRaw.includes('ecr')) {
    return 'European Conservatives and Reformists';
  }
  if (lowerRaw.includes('patriot') || lowerRaw.includes('pfe')) {
    return 'Patriots for Europe';
  }
  if (lowerRaw.includes('sovereign') || lowerRaw.includes('esn')) {
    return 'Europe of Sovereign Nations';
  }
  if (lowerRaw.includes('non-attached') || lowerRaw.includes('non-inscrits') || lowerRaw === 'ni') {
    return 'Non-attached Members';
  }

  return 'Unknown';
}

// Short names for display
const GROUP_SHORT_NAMES = {
  'The Left in the European Parliament': 'GUE/NGL',
  'Greens/European Free Alliance': 'Greens/EFA',
  'Progressive Alliance of Socialists and Democrats': 'S&D',
  'Renew Europe': 'Renew',
  'European People\'s Party': 'EPP',
  'European Conservatives and Reformists': 'ECR',
  'Patriots for Europe': 'PfE',
  'Europe of Sovereign Nations': 'ESN',
  'Non-attached Members': 'NI',
  'Unknown': '?'
};

// Vote colors
const VOTE_COLORS = {
  yes: '#4ade80',
  no: '#ef4444',
  abstain: '#f59e0b',
  did_not_vote: '#d1d5db'
};

// Total MEP seats will be calculated from voters + non-voters

// Generate hemicycle seat positions in clean concentric arcs
function generateHemicycleSeats(totalSeats) {
  const seats = [];
  const centerX = 450;
  const centerY = 420;
  const minRadius = 80;
  const maxRadius = 380;

  // Calculate optimal number of rows and seats per row
  // EU Parliament has roughly 15 rows
  const numRows = 15;
  const seatRadius = 5; // radius of each seat circle
  const seatSpacing = 2.5; // minimum gap between seats

  // Calculate seats per row based on arc length
  // More seats in outer rows (larger circumference)
  const rowSeats = [];
  let totalCalculatedSeats = 0;

  for (let row = 0; row < numRows; row++) {
    const radius = minRadius + (maxRadius - minRadius) * (row / (numRows - 1));
    const arcLength = Math.PI * radius * 0.92; // 166 degrees arc
    const maxSeatsInRow = Math.floor(arcLength / (seatRadius * 2 + seatSpacing));
    rowSeats.push(maxSeatsInRow);
    totalCalculatedSeats += maxSeatsInRow;
  }

  // Scale to match total seats needed
  const scaleFactor = totalSeats / totalCalculatedSeats;
  let seatsRemaining = totalSeats;
  let seatIndex = 0;

  for (let row = 0; row < numRows; row++) {
    const radius = minRadius + (maxRadius - minRadius) * (row / (numRows - 1));
    let seatsInThisRow = Math.round(rowSeats[row] * scaleFactor);

    // Ensure we don't exceed remaining seats
    if (row === numRows - 1) {
      seatsInThisRow = seatsRemaining;
    } else {
      seatsInThisRow = Math.min(seatsInThisRow, seatsRemaining);
    }

    if (seatsInThisRow <= 0) continue;

    // Calculate angular positions for this row
    const totalArc = Math.PI * 0.92; // 166 degrees
    const startAngle = Math.PI * 0.96; // Start from left side

    for (let s = 0; s < seatsInThisRow; s++) {
      // Even distribution across the arc
      const t = seatsInThisRow > 1 ? s / (seatsInThisRow - 1) : 0.5;
      const angle = startAngle - t * totalArc;

      const x = centerX + radius * Math.cos(angle);
      const y = centerY - radius * Math.sin(angle);

      seats.push({
        index: seatIndex++,
        x,
        y,
        row,
        angle // Store angle for sorting by political position
      });
    }

    seatsRemaining -= seatsInThisRow;
  }

  // Sort all seats by angle (left to right) for political group assignment
  seats.sort((a, b) => b.angle - a.angle);

  // Re-index after sorting
  seats.forEach((seat, idx) => {
    seat.index = idx;
  });

  return seats;
}

export default function Hemicycle({ mepVotes, nonVoters = [] }) {
  const navigate = useNavigate();
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Total MEPs = voters + non-voters (from database of current MEPs)
  const totalMeps = mepVotes.length + nonVoters.length;

  // Create ordered list of all MEPs sorted by political group
  const orderedMeps = useMemo(() => {
    if (!mepVotes || mepVotes.length === 0) return [];

    // Group MEPs by canonical group
    const grouped = {};
    GROUP_ORDER.forEach(g => { grouped[g] = []; });

    // Add MEPs who voted
    mepVotes.forEach(mep => {
      const rawGroup = mep.mep_group || 'Unknown';
      const canonicalGroup = getCanonicalGroup(rawGroup);
      grouped[canonicalGroup].push({ ...mep, canonicalGroup });
    });

    // Add all non-voters with their actual names
    nonVoters.forEach(mep => {
      const rawGroup = mep.mep_group || 'Unknown';
      const canonicalGroup = getCanonicalGroup(rawGroup);
      grouped[canonicalGroup].push({
        ...mep,
        canonicalGroup,
        didNotVote: true,
        country: mep.country_code
      });
    });

    // Flatten into single ordered array (left to right politically)
    const result = [];
    GROUP_ORDER.forEach(g => {
      grouped[g].forEach(mep => result.push(mep));
    });

    return result;
  }, [mepVotes, nonVoters]);

  // Generate seat positions
  const seatPositions = useMemo(() => {
    return generateHemicycleSeats(orderedMeps.length || 1);
  }, [orderedMeps.length]);

  // Assign MEPs to seats (seats are already sorted left-to-right by angle)
  const seatsWithMeps = useMemo(() => {
    return seatPositions.map((seat, idx) => {
      const mep = orderedMeps[idx] || null;
      return {
        ...seat,
        mep: mep,
        group: mep?.canonicalGroup || 'Unknown'
      };
    });
  }, [seatPositions, orderedMeps]);

  // Group counts for the breakdown chart
  const groupCounts = useMemo(() => {
    if (!mepVotes) return {};
    const counts = {};

    // Initialize all groups
    GROUP_ORDER.forEach(g => {
      counts[g] = { total: 0, yes: 0, no: 0, abstain: 0, did_not_vote: 0 };
    });

    // Count actual votes
    mepVotes.forEach(mep => {
      const rawGroup = mep.mep_group || 'Unknown';
      const group = getCanonicalGroup(rawGroup);
      if (!counts[group]) {
        counts[group] = { total: 0, yes: 0, no: 0, abstain: 0, did_not_vote: 0 };
      }
      counts[group].total++;
      if (mep.vote) counts[group][mep.vote]++;
    });

    // Count actual non-voters
    nonVoters.forEach(mep => {
      const rawGroup = mep.mep_group || 'Unknown';
      const group = getCanonicalGroup(rawGroup);
      if (!counts[group]) {
        counts[group] = { total: 0, yes: 0, no: 0, abstain: 0, did_not_vote: 0 };
      }
      counts[group].total++;
      counts[group].did_not_vote++;
    });

    return counts;
  }, [mepVotes, nonVoters]);

  const handleMouseEnter = (seat, event) => {
    setHoveredSeat(seat);
    const rect = event.target.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + window.scrollX + rect.width / 2,
      y: rect.top + window.scrollY - 10
    });
  };

  const handleMouseLeave = () => {
    setHoveredSeat(null);
  };

  const handleSeatClick = (seat) => {
    if (seat.mep?.mep_id) {
      navigate(`/meps/${seat.mep.mep_id}`);
    }
  };

  if (!mepVotes || mepVotes.length === 0) {
    return <div className="hemicycle-empty">No voting data available</div>;
  }

  const totalYes = mepVotes.filter(m => m.vote === 'yes').length;
  const totalNo = mepVotes.filter(m => m.vote === 'no').length;
  const totalAbstain = mepVotes.filter(m => m.vote === 'abstain').length;
  const totalDidNotVote = nonVoters.length;

  return (
    <div className="hemicycle-container">
      <svg viewBox="0 0 900 480" className="hemicycle-svg" preserveAspectRatio="xMidYMid meet">
        {/* Seats */}
        {seatsWithMeps.map((seat, idx) => {
          const isNonVoter = seat.mep?.didNotVote;
          const voteColor = isNonVoter
            ? VOTE_COLORS.did_not_vote
            : (seat.mep ? (VOTE_COLORS[seat.mep.vote] || VOTE_COLORS.did_not_vote) : VOTE_COLORS.did_not_vote);

          return (
            <circle
              key={idx}
              cx={seat.x}
              cy={seat.y}
              r={4.5}
              fill={voteColor}
              stroke="#fff"
              strokeWidth="0.8"
              className={`seat ${seat.mep?.mep_id ? 'clickable' : ''}`}
              onMouseEnter={(e) => handleMouseEnter(seat, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleSeatClick(seat)}
            />
          );
        })}

        {/* Center label */}
        <text x="450" y="465" textAnchor="middle" className="hemicycle-label">
          {mepVotes.length} of {totalMeps} MEPs voted
        </text>
      </svg>

      {/* Vote legend */}
      <div className="hemicycle-legend vote-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: VOTE_COLORS.yes }}></span>
          <span>Yes ({totalYes})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: VOTE_COLORS.no }}></span>
          <span>No ({totalNo})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: VOTE_COLORS.abstain }}></span>
          <span>Abstain ({totalAbstain})</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: VOTE_COLORS.did_not_vote }}></span>
          <span>Did not vote ({totalDidNotVote})</span>
        </div>
      </div>

      {/* Group breakdown */}
      <div className="hemicycle-groups">
        <h4>By Political Group</h4>
        <div className="group-bars">
          {GROUP_ORDER.filter(g => groupCounts[g]).map(group => {
            const counts = groupCounts[group];
            if (!counts || counts.total === 0) return null;
            const yesPercent = (counts.yes / counts.total) * 100;
            const noPercent = (counts.no / counts.total) * 100;
            const abstainPercent = (counts.abstain / counts.total) * 100;
            const didNotVotePercent = ((counts.did_not_vote || 0) / counts.total) * 100;

            return (
              <div key={group} className="group-bar-row">
                <div className="group-name" title={group}>
                  {GROUP_SHORT_NAMES[group] || group.substring(0, 10)}
                </div>
                <div className="group-bar">
                  <div
                    className="bar-segment yes"
                    style={{ width: `${yesPercent}%` }}
                    title={`Yes: ${counts.yes}`}
                  />
                  <div
                    className="bar-segment no"
                    style={{ width: `${noPercent}%` }}
                    title={`No: ${counts.no}`}
                  />
                  <div
                    className="bar-segment abstain"
                    style={{ width: `${abstainPercent}%` }}
                    title={`Abstain: ${counts.abstain}`}
                  />
                  <div
                    className="bar-segment did-not-vote"
                    style={{ width: `${didNotVotePercent}%` }}
                    title={`Did not vote: ${counts.did_not_vote || 0}`}
                  />
                </div>
                <div className="group-count">{counts.total}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredSeat && (
        <div
          className="hemicycle-tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {hoveredSeat.mep ? (
            hoveredSeat.mep.didNotVote ? (
              <>
                <strong>{hoveredSeat.mep.mep_name || 'Unknown MEP'}</strong>
                {hoveredSeat.mep.country && <div>{hoveredSeat.mep.country}</div>}
                <div className="tooltip-group">
                  {GROUP_SHORT_NAMES[hoveredSeat.mep.canonicalGroup] || hoveredSeat.mep.mep_group}
                </div>
                <div className="tooltip-vote did-not-vote">
                  Did not vote
                </div>
              </>
            ) : (
              <>
                <strong>{hoveredSeat.mep.mep_name}</strong>
                <div>{hoveredSeat.mep.country}</div>
                <div className="tooltip-group">
                  {GROUP_SHORT_NAMES[hoveredSeat.mep.canonicalGroup] || hoveredSeat.mep.mep_group}
                </div>
                <div className={`tooltip-vote ${hoveredSeat.mep.vote}`}>
                  Voted: {hoveredSeat.mep.vote?.toUpperCase()}
                </div>
              </>
            )
          ) : (
            <>
              <div className="tooltip-empty-label">Empty seat</div>
              <div className="tooltip-group">
                {GROUP_SHORT_NAMES[hoveredSeat.group] || hoveredSeat.group}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
