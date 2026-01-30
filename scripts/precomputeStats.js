#!/usr/bin/env node
/**
 * Pre-compute all heavy statistics and save to database
 * This runs weekly after data updates to make the frontend fast
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ============================================
// PCA COMPUTATION
// ============================================

function computePCA(data, numComponents = 3) {
  const n = data.length;
  if (n === 0) return { projections: [], variance: [], components: [] };
  
  const m = data[0].length;
  
  // Center the data
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
    // Power iteration with deterministic init
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
    
    // Sign convention for consistency
    const sum = pc.reduce((a, b) => a + b, 0);
    if (sum > 0) pc = pc.map(v => -v);
    
    components.push(pc);
    
    const projections = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
    const variance = projections.reduce((sum, v) => sum + v * v, 0) / n;
    variances.push(variance);
    
    // Deflate
    for (let i = 0; i < n; i++) {
      const proj = projections[i];
      for (let j = 0; j < m; j++) {
        currentData[i][j] -= proj * pc[j];
      }
    }
  }
  
  // Final projections
  const projections = centered.map(row => {
    return components.map(pc => row.reduce((sum, v, j) => sum + v * pc[j], 0));
  });
  
  return { projections, variance: variances, components, means };
}

// ============================================
// MAIN PRE-COMPUTATION
// ============================================

async function precomputeAll() {
  console.log('🚀 Starting pre-computation of all statistics...\n');
  const startTime = Date.now();
  
  try {
    // Ensure metadata table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS metadata (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('📋 Metadata table ready');
    
    // 1. Pre-compute MEP PCA coordinates
    await precomputeMEPPCA();
    
    // 2. Pre-compute party agreement matrix
    await precomputePartyAgreement();
    
    // 3. Pre-compute party cohesion
    await precomputePartyCohesion();
    
    // 4. Pre-compute bill PCA loadings
    await precomputeBillLoadings();
    
    // 5. Pre-compute group statistics
    await precomputeGroupStats();
    
    // 6. Update metadata
    await pool.query(`
      INSERT INTO metadata (key, value, updated_at)
      VALUES ('last_precompute', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
    `, [new Date().toISOString()]);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ All pre-computations complete in ${duration}s`);
    
  } catch (error) {
    console.error('❌ Pre-computation failed:', error);
    throw error;
  }
}

// ============================================
// 1. MEP PCA COORDINATES
// ============================================

async function precomputeMEPPCA() {
  console.log('📊 Computing MEP PCA coordinates...');
  
  // Ensure columns exist
  await pool.query(`
    ALTER TABLE meps ADD COLUMN IF NOT EXISTS pca_x FLOAT;
    ALTER TABLE meps ADD COLUMN IF NOT EXISTS pca_y FLOAT;
    ALTER TABLE meps ADD COLUMN IF NOT EXISTS pca_z FLOAT;
  `);
  
  // Get all MEPs with their votes
  const mepsResult = await pool.query(`
    SELECT DISTINCT m.mep_id, m.political_group
    FROM meps m
    JOIN votes v ON v.mep_id = m.mep_id
    WHERE m.is_active = true
  `);
  
  const billsResult = await pool.query(`
    SELECT DISTINCT b.id as bill_id
    FROM bills b
    JOIN votes v ON v.bill_id = b.id
    ORDER BY b.id
  `);
  
  const meps = mepsResult.rows;
  const billIds = billsResult.rows.map(r => r.bill_id);
  
  console.log(`  Found ${meps.length} MEPs and ${billIds.length} bills`);
  
  if (meps.length === 0 || billIds.length === 0) {
    console.log('  ⚠️ No data for PCA');
    return;
  }
  
  // Get all votes at once
  const votesResult = await pool.query(`
    SELECT mep_id, bill_id, vote FROM votes
  `);
  
  // Build vote lookup
  const voteMap = {};
  for (const v of votesResult.rows) {
    if (!voteMap[v.mep_id]) voteMap[v.mep_id] = {};
    voteMap[v.mep_id][v.bill_id] = v.vote === 'yes' ? 1 : v.vote === 'no' ? -1 : 0;
  }
  
  // Build matrix
  const billIdToIdx = {};
  billIds.forEach((id, idx) => billIdToIdx[id] = idx);
  
  const matrix = meps.map(mep => {
    const row = new Array(billIds.length).fill(0);
    const mepVotes = voteMap[mep.mep_id] || {};
    for (const [billId, vote] of Object.entries(mepVotes)) {
      const idx = billIdToIdx[parseInt(billId)];
      if (idx !== undefined) row[idx] = vote;
    }
    return row;
  });
  
  // Compute PCA
  const { projections, variance, components, means } = computePCA(matrix, 3);
  
  // Save coordinates
  const totalVariance = variance.reduce((a, b) => a + b, 0);
  console.log(`  Variance explained: ${variance.map(v => ((v/totalVariance)*100).toFixed(1) + '%').join(', ')}`);
  
  // Batch update
  for (let i = 0; i < meps.length; i++) {
    await pool.query(`
      UPDATE meps SET pca_x = $1, pca_y = $2, pca_z = $3 WHERE mep_id = $4
    `, [projections[i][0], projections[i][1], projections[i][2], meps[i].mep_id]);
  }
  
  // Save PCA metadata (variance, components for interpretation)
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('pca_variance', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(variance)]);
  
  // Save PCA components (eigenvectors) for projecting new data (e.g., VAA user)
  // Also save the means for centering
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('pca_components', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify({ components, means, billIds })]);
  
  // Save bill loadings for interpretation
  // We need to save enough bills so frontend can display 3 positive and 3 negative per axis
  const topBillsPerAxis = [];
  for (let axis = 0; axis < 3; axis++) {
    const loadings = components[axis].map((loading, idx) => ({
      billId: billIds[idx],
      loading
    }));
    
    // Get top 5 positive loadings (highest first)
    const positive = loadings
      .filter(l => l.loading > 0)
      .sort((a, b) => b.loading - a.loading)
      .slice(0, 5);
    
    // Get top 5 negative loadings (most negative first)
    const negative = loadings
      .filter(l => l.loading < 0)
      .sort((a, b) => a.loading - b.loading)
      .slice(0, 5);
    
    // Combine and keep the format expected by frontend (both positive and negative in one array)
    topBillsPerAxis.push([...positive, ...negative]);
  }
  
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('pca_top_bills', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(topBillsPerAxis)]);
  
  console.log(`  ✓ Updated ${meps.length} MEP PCA coordinates`);
}

// ============================================
// 2. PARTY AGREEMENT MATRIX
// ============================================

async function precomputePartyAgreement() {
  console.log('🤝 Computing party agreement matrix...');
  
  const result = await pool.query(`
    WITH party_votes AS (
      SELECT 
        bill_id,
        CASE 
          WHEN mep_group LIKE '%People''s Party%' THEN 'EPP'
          WHEN mep_group LIKE '%Socialist%' THEN 'S&D'
          WHEN mep_group LIKE '%Renew%' THEN 'Renew'
          WHEN mep_group LIKE '%Green%' THEN 'Greens/EFA'
          WHEN mep_group LIKE '%Conservative%' THEN 'ECR'
          WHEN mep_group LIKE '%Left%' THEN 'The Left'
          WHEN mep_group LIKE '%Patriot%' THEN 'PfE'
          WHEN mep_group LIKE '%Sovereign%' THEN 'ESN'
          ELSE 'NI'
        END as party,
        vote,
        COUNT(*) as vote_count
      FROM votes
      WHERE vote IN ('yes', 'no', 'abstain')
      GROUP BY bill_id, party, vote
    ),
    party_majority AS (
      SELECT DISTINCT ON (bill_id, party)
        bill_id, party, vote as majority_vote
      FROM party_votes
      ORDER BY bill_id, party, vote_count DESC
    )
    SELECT 
      p1.party as party1,
      p2.party as party2,
      COUNT(*) as total_bills,
      SUM(CASE WHEN p1.majority_vote = p2.majority_vote THEN 1 ELSE 0 END) as agreements
    FROM party_majority p1
    JOIN party_majority p2 ON p1.bill_id = p2.bill_id AND p1.party < p2.party
    GROUP BY p1.party, p2.party
  `);
  
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('party_agreement_matrix', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(result.rows)]);
  
  console.log(`  ✓ Computed ${result.rows.length} party pairs`);
}

// ============================================
// 3. PARTY COHESION
// ============================================

async function precomputePartyCohesion() {
  console.log('🎯 Computing party cohesion...');
  
  const result = await pool.query(`
    WITH vote_counts AS (
      SELECT 
        bill_id,
        CASE 
          WHEN mep_group LIKE '%People''s Party%' THEN 'EPP'
          WHEN mep_group LIKE '%Socialist%' THEN 'S&D'
          WHEN mep_group LIKE '%Renew%' THEN 'Renew'
          WHEN mep_group LIKE '%Green%' THEN 'Greens/EFA'
          WHEN mep_group LIKE '%Conservative%' THEN 'ECR'
          WHEN mep_group LIKE '%Left%' THEN 'The Left'
          WHEN mep_group LIKE '%Patriot%' THEN 'PfE'
          WHEN mep_group LIKE '%Sovereign%' THEN 'ESN'
          ELSE 'NI'
        END as party,
        SUM(CASE WHEN vote = 'yes' THEN 1 ELSE 0 END) as yes_votes,
        SUM(CASE WHEN vote = 'no' THEN 1 ELSE 0 END) as no_votes,
        SUM(CASE WHEN vote = 'abstain' THEN 1 ELSE 0 END) as abstain_votes,
        COUNT(*) as total
      FROM votes
      WHERE vote IN ('yes', 'no', 'abstain')
      GROUP BY bill_id, party
    ),
    cohesion_per_bill AS (
      SELECT 
        party,
        bill_id,
        GREATEST(yes_votes, no_votes, abstain_votes)::float / NULLIF(total, 0) as cohesion
      FROM vote_counts
      WHERE total >= 5
    )
    SELECT 
      party,
      ROUND((AVG(cohesion) * 100)::numeric, 1) as avg_cohesion,
      COUNT(DISTINCT bill_id) as bills_voted
    FROM cohesion_per_bill
    GROUP BY party
    ORDER BY avg_cohesion DESC
  `);
  
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('party_cohesion', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(result.rows)]);
  
  console.log(`  ✓ Computed cohesion for ${result.rows.length} parties`);
}

// ============================================
// 4. BILL LOADINGS (for PCA interpretation)
// ============================================

async function precomputeBillLoadings() {
  console.log('📋 Computing bill loadings for PCA interpretation...');
  
  // Get top bills from saved PCA data
  const metaResult = await pool.query(`
    SELECT value FROM metadata WHERE key = 'pca_top_bills'
  `);
  
  if (metaResult.rows.length === 0) {
    console.log('  ⚠️ No PCA data available');
    return;
  }
  
  const topBillsPerAxis = JSON.parse(metaResult.rows[0].value);
  
  // Get bill details
  const allBillIds = [...new Set(topBillsPerAxis.flat().map(b => b.billId))];
  
  if (allBillIds.length === 0) {
    console.log('  ⚠️ No bills to process');
    return;
  }
  
  const billsResult = await pool.query(`
    SELECT id, title, category FROM bills WHERE id = ANY($1)
  `, [allBillIds]);
  
  const billMap = {};
  for (const b of billsResult.rows) {
    billMap[b.id] = b;
  }
  
  // Enrich with bill details
  const enrichedLoadings = topBillsPerAxis.map(axis => 
    axis.map(item => ({
      ...item,
      title: billMap[item.billId]?.title || 'Unknown',
      category: billMap[item.billId]?.category || 'Unknown'
    }))
  );
  
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('pca_bill_loadings', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(enrichedLoadings)]);
  
  console.log(`  ✓ Computed loadings for ${allBillIds.length} influential bills`);
}

// ============================================
// 5. GROUP STATISTICS
// ============================================

async function precomputeGroupStats() {
  console.log('📈 Computing group statistics...');
  
  const result = await pool.query(`
    WITH group_votes AS (
      SELECT 
        CASE 
          WHEN mep_group LIKE '%People''s Party%' THEN 'EPP'
          WHEN mep_group LIKE '%Socialist%' THEN 'S&D'
          WHEN mep_group LIKE '%Renew%' THEN 'Renew'
          WHEN mep_group LIKE '%Green%' THEN 'Greens/EFA'
          WHEN mep_group LIKE '%Conservative%' THEN 'ECR'
          WHEN mep_group LIKE '%Left%' THEN 'The Left'
          WHEN mep_group LIKE '%Patriot%' THEN 'PfE'
          WHEN mep_group LIKE '%Sovereign%' THEN 'ESN'
          ELSE 'NI'
        END as party,
        vote,
        COUNT(*) as count
      FROM votes
      WHERE vote IN ('yes', 'no', 'abstain')
      GROUP BY party, vote
    ),
    group_totals AS (
      SELECT party, SUM(count) as total FROM group_votes GROUP BY party
    ),
    mep_counts AS (
      SELECT 
        CASE 
          WHEN political_group LIKE '%People''s Party%' THEN 'EPP'
          WHEN political_group LIKE '%Socialist%' THEN 'S&D'
          WHEN political_group LIKE '%Renew%' THEN 'Renew'
          WHEN political_group LIKE '%Green%' THEN 'Greens/EFA'
          WHEN political_group LIKE '%Conservative%' THEN 'ECR'
          WHEN political_group LIKE '%Left%' THEN 'The Left'
          WHEN political_group LIKE '%Patriot%' THEN 'PfE'
          WHEN political_group LIKE '%Sovereign%' THEN 'ESN'
          ELSE 'NI'
        END as party,
        COUNT(*) as mep_count
      FROM meps
      WHERE is_active = true
      GROUP BY party
    )
    SELECT 
      gt.party,
      mc.mep_count,
      gt.total as total_votes,
      COALESCE(SUM(CASE WHEN gv.vote = 'yes' THEN gv.count END), 0) as yes_votes,
      COALESCE(SUM(CASE WHEN gv.vote = 'no' THEN gv.count END), 0) as no_votes,
      COALESCE(SUM(CASE WHEN gv.vote = 'abstain' THEN gv.count END), 0) as abstain_votes
    FROM group_totals gt
    JOIN mep_counts mc ON gt.party = mc.party
    LEFT JOIN group_votes gv ON gt.party = gv.party
    GROUP BY gt.party, mc.mep_count, gt.total
  `);
  
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('group_stats', $1, NOW())
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
  `, [JSON.stringify(result.rows)]);
  
  console.log(`  ✓ Computed stats for ${result.rows.length} groups`);
}

// ============================================
// RUN
// ============================================

precomputeAll()
  .then(() => {
    console.log('\n🎉 Pre-computation finished successfully!');
    pool.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Pre-computation failed:', err.message);
    console.error('Stack:', err.stack);
    pool.end();
    process.exit(1);
  });
