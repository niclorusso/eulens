import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

/**
 * Add gender column to meps table if it doesn't exist
 * This is a migration script to update existing databases
 */
async function addGenderColumn() {
  console.log('Adding gender column to meps table...');
  
  try {
    // Check if column already exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'meps' AND column_name = 'gender'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✓ Gender column already exists');
    } else {
      await pool.query('ALTER TABLE meps ADD COLUMN gender VARCHAR(10)');
      console.log('✓ Gender column added successfully');
    }
    
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/fetchMEPGender.js');
    console.log('2. Or manually update gender data from EU Parliament official sources');
    console.log('3. Official statistics: 38.5% female, 61.3% male (2024-2029 term)');
    
  } catch (error) {
    console.error('Error adding gender column:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addGenderColumn();
