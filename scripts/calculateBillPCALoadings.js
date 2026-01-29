import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens'
});

// Simple PCA computation for first component
function computePC1(data) {
  const n = data.length;
  if (n === 0) return null;
  
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
  
  // Power iteration for first principal component
  let pc = new Array(m).fill(1);
  let norm = Math.sqrt(pc.reduce((sum, v) => sum + v * v, 0));
  pc = pc.map(v => v / norm);
  
  for (let iter = 0; iter < 100; iter++) {
    const xpc = centered.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
    const newPc = new Array(m).fill(0);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        newPc[j] += centered[i][j] * xpc[i];
      }
    }
    
    norm = Math.sqrt(newPc.reduce((sum, v) => sum + v * v, 0));
    if (norm < 1e-10) break;
    pc = newPc.map(v => v / norm);
  }
  
  return pc;
}

async function calculateBillLoadings() {
  console.log('📊 Calculating PCA Loadings for Bills\n');
  
  try {
    // Get all bills that have VAA questions
    const billsResult = await pool.query(`
      SELECT DISTINCT b.id, b.eu_id
      FROM bills b
      JOIN vaa_questions q ON b.id = q.bill_id
      WHERE q.is_active = true
    `);
    
    const billIds = billsResult.rows.map(r => r.id);
    console.log(`Found ${billIds.length} bills with VAA questions\n`);
    
    if (billIds.length === 0) {
      console.log('No bills with VAA questions found.');
      await pool.end();
      return;
    }
    
    // Get MEP voting vectors for these bills
    const votesResult = await pool.query(`
      WITH bill_list AS (
        SELECT DISTINCT bill_id
        FROM votes
        WHERE bill_id = ANY($1) AND vote IN ('yes', 'no', 'abstain')
        GROUP BY bill_id
        HAVING COUNT(*) >= 20
      ),
      mep_vote_counts AS (
        SELECT mep_id, COUNT(*) as vote_count
        FROM votes v
        JOIN bill_list bl ON v.bill_id = bl.bill_id
        WHERE vote IN ('yes', 'no', 'abstain') AND mep_id IS NOT NULL
        GROUP BY mep_id
        HAVING COUNT(*) >= 10
      ),
      mep_votes_encoded AS (
        SELECT
          v.mep_id,
          v.bill_id,
          CASE
            WHEN v.vote = 'yes' THEN 1
            WHEN v.vote = 'no' THEN -1
            WHEN v.vote = 'abstain' THEN 0
            ELSE 0
          END as vote_value
        FROM votes v
        JOIN mep_vote_counts mvc ON v.mep_id = mvc.mep_id
        JOIN bill_list bl ON v.bill_id = bl.bill_id
        WHERE v.vote IN ('yes', 'no', 'abstain')
      )
      SELECT
        mve.bill_id,
        mve.mep_id,
        mve.vote_value
      FROM mep_votes_encoded mve
      ORDER BY mve.bill_id, mve.mep_id
    `, [billIds]);
    
    // Organize data: bills as columns, MEPs as rows
    const mepSet = new Set();
    const billSet = new Set();
    const voteMap = {}; // mep_id -> { bill_id -> vote_value }
    
    votesResult.rows.forEach(row => {
      mepSet.add(row.mep_id);
      billSet.add(row.bill_id);
      if (!voteMap[row.mep_id]) {
        voteMap[row.mep_id] = {};
      }
      voteMap[row.mep_id][row.bill_id] = row.vote_value;
    });
    
    const meps = Array.from(mepSet);
    const bills = Array.from(billSet);
    
    console.log(`Processing ${meps.length} MEPs and ${bills.length} bills\n`);
    
    // Build data matrix: each row is an MEP, each column is a bill
    const data = meps.map(mepId => {
      return bills.map(billId => {
        return voteMap[mepId][billId] || 0;
      });
    });
    
    // Compute PC1
    const pc1 = computePC1(data);
    
    if (!pc1) {
      console.log('Failed to compute PC1');
      await pool.end();
      return;
    }
    
    // Calculate means for centering
    const means = new Array(bills.length).fill(0);
    for (let j = 0; j < bills.length; j++) {
      for (let i = 0; i < meps.length; i++) {
        means[j] += data[i][j];
      }
      means[j] /= meps.length;
    }
    
    // Project all MEPs onto PC1
    const pc1Projection = data.map(row => 
      row.reduce((sum, v, j) => sum + (v - means[j]) * pc1[j], 0)
    );
    
    // Calculate loadings: correlation between each bill and PC1
    const loadings = bills.map((billId, idx) => {
      const billVotes = data.map(row => row[idx]);
      const mean = means[idx];
      const centered = billVotes.map(v => v - mean);
      
      // Correlation
      const billStd = Math.sqrt(centered.reduce((sum, v) => sum + v * v, 0) / centered.length);
      const pc1Std = Math.sqrt(pc1Projection.reduce((sum, v) => sum + v * v, 0) / pc1Projection.length);
      
      if (billStd === 0 || pc1Std === 0) return { billId, loading: 0 };
      
      const covariance = centered.reduce((sum, v, i) => sum + v * pc1Projection[i], 0) / centered.length;
      const correlation = covariance / (billStd * pc1Std);
      
      return { billId, loading: correlation || 0 };
    });
    
    // Update display_order in vaa_questions based on absolute loading
    loadings.sort((a, b) => Math.abs(b.loading) - Math.abs(a.loading));
    
    console.log('Updating question order based on PC1 loadings...\n');
    
    for (let i = 0; i < loadings.length; i++) {
      const { billId, loading } = loadings[i];
      
      await pool.query(`
        UPDATE vaa_questions
        SET display_order = $1
        WHERE bill_id = $2 AND is_active = true
      `, [i + 1, billId]);
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Updated ${i + 1} questions...`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Complete!`);
    console.log(`   Ordered ${loadings.length} questions by PC1 loading`);
    console.log(`   Top 5 questions by absolute loading:`);
    loadings.slice(0, 5).forEach((l, i) => {
      console.log(`     ${i + 1}. Bill ${l.billId}: ${l.loading.toFixed(4)}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

calculateBillLoadings();
