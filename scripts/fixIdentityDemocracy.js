/**
 * Fix Identity and Democracy group references in database
 * 
 * ID was dissolved in the 10th legislature. This script:
 * 1. Finds all references to Identity and Democracy
 * 2. Updates votes table to map ID to appropriate replacement groups
 * 3. Updates meps table if needed
 * 
 * Note: Most ID MEPs joined Patriots for Europe (PfE) or Europe of Sovereign Nations (ESN)
 * We'll map to PfE as the primary replacement, but you may want to manually review.
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens'
});

async function fixIdentityDemocracy() {
  console.log('🔧 Fixing Identity and Democracy references...\n');

  try {
    // First, check what we have
    const checkVotes = await pool.query(`
      SELECT DISTINCT mep_group, COUNT(*) as count
      FROM votes
      WHERE LOWER(mep_group) LIKE '%identity%' OR LOWER(mep_group) LIKE '%democracy%'
      GROUP BY mep_group
    `);

    const checkMeps = await pool.query(`
      SELECT DISTINCT political_group, COUNT(*) as count
      FROM meps
      WHERE LOWER(political_group) LIKE '%identity%' OR LOWER(political_group) LIKE '%democracy%'
      GROUP BY political_group
    `);

    console.log('Found in votes table:');
    checkVotes.rows.forEach(row => {
      console.log(`  - ${row.mep_group}: ${row.count} votes`);
    });

    console.log('\nFound in meps table:');
    checkMeps.rows.forEach(row => {
      console.log(`  - ${row.political_group}: ${row.count} MEPs`);
    });

    if (checkVotes.rows.length === 0 && checkMeps.rows.length === 0) {
      console.log('\n✅ No Identity and Democracy references found. Database is clean!');
      
      // Check if there are any "Patriots for Europe Group" that should be "Patriots for Europe"
      const checkWrongPfE = await pool.query(`
        SELECT DISTINCT mep_group, COUNT(*) as count
        FROM votes
        WHERE mep_group = 'Patriots for Europe Group'
        GROUP BY mep_group
      `);
      
      if (checkWrongPfE.rows.length > 0) {
        console.log('\n🔧 Fixing "Patriots for Europe Group" to "Patriots for Europe"...');
        const fixPfE = await pool.query(`
          UPDATE votes
          SET mep_group = 'Patriots for Europe'
          WHERE mep_group = 'Patriots for Europe Group'
        `);
        console.log(`✅ Updated ${fixPfE.rowCount} votes to correct name`);
      }
      
      await pool.end();
      return;
    }

    // Update votes table - map ID to PfE (Patriots for Europe)
    // Check what the actual name is in the database first
    const checkPfE = await pool.query(`
      SELECT DISTINCT mep_group 
      FROM votes 
      WHERE LOWER(mep_group) LIKE '%patriot%' 
      LIMIT 1
    `);
    
    const pfeName = checkPfE.rows.length > 0 ? checkPfE.rows[0].mep_group : 'Patriots for Europe';
    console.log(`\nUsing group name: "${pfeName}"`);

    // Update votes table
    const updateVotes = await pool.query(`
      UPDATE votes
      SET mep_group = $1
      WHERE LOWER(mep_group) LIKE '%identity%' 
        AND LOWER(mep_group) LIKE '%democracy%'
    `, [pfeName]);

    console.log(`✅ Updated ${updateVotes.rowCount} votes from ID to ${pfeName}`);

    // Update meps table
    const updateMeps = await pool.query(`
      UPDATE meps
      SET political_group = $1
      WHERE LOWER(political_group) LIKE '%identity%' 
        AND LOWER(political_group) LIKE '%democracy%'
    `, [pfeName]);

    console.log(`✅ Updated ${updateMeps.rowCount} MEPs from ID to ${pfeName}`);

    // Verify the fix
    const verifyVotes = await pool.query(`
      SELECT COUNT(*) as count
      FROM votes
      WHERE LOWER(mep_group) LIKE '%identity%' OR LOWER(mep_group) LIKE '%democracy%'
    `);

    const verifyMeps = await pool.query(`
      SELECT COUNT(*) as count
      FROM meps
      WHERE LOWER(political_group) LIKE '%identity%' OR LOWER(political_group) LIKE '%democracy%'
    `);

    if (verifyVotes.rows[0].count === '0' && verifyMeps.rows[0].count === '0') {
      console.log('\n✅ All Identity and Democracy references have been fixed!');
    } else {
      console.log(`\n⚠️  Warning: Still found ${verifyVotes.rows[0].count} votes and ${verifyMeps.rows[0].count} MEPs with ID references`);
    }

  } catch (error) {
    console.error('❌ Error fixing Identity and Democracy:', error);
    throw error;
  } finally {
    if (pool && !pool.ended) {
      await pool.end();
    }
  }
}

fixIdentityDemocracy();
