import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens'
});

async function generateVAAQuestions() {
  console.log('📝 Generating VAA Questions from Bill Summaries\n');

  try {
    // Get all bills with summaries that have VAA questions
    const result = await pool.query(`
      SELECT bs.bill_id, bs.vaa_question, b.title, b.category
      FROM bill_summaries bs
      JOIN bills b ON bs.bill_id = b.id
      WHERE bs.vaa_question IS NOT NULL AND bs.vaa_question != ''
      ORDER BY b.date_adopted DESC
    `);

    console.log(`Found ${result.rows.length} bills with VAA questions\n`);

    let inserted = 0;
    let skipped = 0;

    for (const row of result.rows) {
      // Check if question already exists
      const existing = await pool.query(
        'SELECT id FROM vaa_questions WHERE bill_id = $1 AND question_text = $2',
        [row.bill_id, row.vaa_question]
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert VAA question
      await pool.query(`
        INSERT INTO vaa_questions (bill_id, question_text, category, display_order, is_active)
        VALUES ($1, $2, $3, $4, true)
      `, [
        row.bill_id,
        row.vaa_question,
        row.category || 'General',
        inserted + 1
      ]);

      inserted++;
      if (inserted % 10 === 0) {
        console.log(`  Processed ${inserted} questions...`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Complete!`);
    console.log(`   Inserted: ${inserted} new questions`);
    console.log(`   Skipped: ${skipped} (already exist)`);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

generateVAAQuestions();
