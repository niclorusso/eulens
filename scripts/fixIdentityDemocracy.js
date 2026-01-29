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
      await pool.end();
      return;
    }

    // Update votes table - map ID to PfE (Patriots for Europe)
    // This is the main replacement group for ID
    const updateVotes = await pool.query(`
      UPDATE votes
      SET mep_group = 'Patriots for Europe Group'
      WHERE LOWER(mep_group) LIKE '%identity%' 
        AND LOWER(mep_group) LIKE '%democracy%'
    `);

    console.log(`\n✅ Updated ${updateVotes.rowCount} votes from ID to Patriots for Europe`);

    // Update meps table
    const updateMeps = await pool.query(`
      UPDATE meps
      SET political_group = 'Patriots for Europe Group'
      WHERE LOWER(political_group) LIKE '%identity%' 
        AND LOWER(political_group) LIKE '%democracy%'
    `);

    console.log(`✅ Updated ${updateMeps.rowCount} MEPs from ID to Patriots for Europe`);

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
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixIdentityDemocracy();
