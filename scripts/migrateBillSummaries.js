import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens'
});

async function migrate() {
  try {
    console.log('Creating bill_summaries table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_summaries (
        id SERIAL PRIMARY KEY,
        bill_id INTEGER REFERENCES bills(id) UNIQUE,
        summary_short TEXT,
        summary_long TEXT,
        reasons_yes TEXT,
        reasons_no TEXT,
        key_points TEXT[],
        vaa_question TEXT,
        political_tags TEXT[],
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        model_version VARCHAR(100)
      )
    `);
    console.log('✓ Table created successfully');
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_bill_summaries_bill ON bill_summaries(bill_id)`);
    console.log('✓ Index created successfully');
    
    const result = await pool.query('SELECT COUNT(*) FROM bills');
    console.log(`\nReady to generate summaries for ${result.rows[0].count} bills.`);
    console.log('Run: npm run summarize');
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

migrate();
