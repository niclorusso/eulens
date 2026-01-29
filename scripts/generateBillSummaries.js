import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens'
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL = 'gemini-2.5-flash';
const BATCH_SIZE = 5; // Process 5 bills at a time
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

async function fetchBillFullText(bill) {
  // Try to fetch more context from HowTheyVote API
  try {
    const response = await fetch(`https://howtheyvote.eu/api/votes/${bill.eu_id}`);
    if (response.ok) {
      const data = await response.json();
      return {
        ...bill,
        fullDescription: data.description || bill.description,
        procedureTitle: data.procedure_title || bill.title,
        references: data.references || []
      };
    }
  } catch (e) {
    console.log(`  Could not fetch additional data for ${bill.eu_id}`);
  }
  return bill;
}

async function generateSummary(bill) {
  const enrichedBill = await fetchBillFullText(bill);
  
  const prompt = `You are analyzing a European Parliament vote. Based on the information below, generate a clear, neutral analysis that helps citizens understand what this vote was about.

VOTE INFORMATION:
- Title: ${enrichedBill.title}
- Category: ${enrichedBill.category || 'Unknown'}
- Description: ${enrichedBill.fullDescription || enrichedBill.description || 'No description available'}
- Status: ${enrichedBill.status}
- Date: ${enrichedBill.date_adopted}
${enrichedBill.procedureTitle ? `- Procedure: ${enrichedBill.procedureTitle}` : ''}

Please provide:

1. SUMMARY_SHORT: A 1-2 sentence plain language summary of what this vote is about. Write for someone with no political background.

2. SUMMARY_LONG: A 3-4 sentence detailed explanation of the vote, including context and implications.

3. REASONS_YES: Why would an MEP vote YES? List 2-3 key arguments in favor, written neutrally. Consider perspectives from different political viewpoints.

4. REASONS_NO: Why would an MEP vote NO? List 2-3 key arguments against, written neutrally. Consider perspectives from different political viewpoints.

5. KEY_POINTS: List 3-5 bullet points capturing the most important aspects.

6. VAA_QUESTION: Write a single, clear yes/no question that could be asked to voters to determine their stance on this issue. The question should be understandable without context.

7. POLITICAL_TAGS: List relevant tags from: environment, economy, trade, rights, democracy, security, immigration, health, digital, foreign_affairs, budget, agriculture, energy, transport, social

Respond in JSON format:
{
  "summary_short": "...",
  "summary_long": "...",
  "reasons_yes": "...",
  "reasons_no": "...",
  "key_points": ["point1", "point2", "point3"],
  "vaa_question": "...",
  "political_tags": ["tag1", "tag2"]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`  Error generating summary for bill ${bill.id}:`, error.message);
    return null;
  }
}

async function saveSummary(billId, summary) {
  try {
    await pool.query(`
      INSERT INTO bill_summaries (
        bill_id, summary_short, summary_long, reasons_yes, reasons_no,
        key_points, vaa_question, political_tags, model_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (bill_id) DO UPDATE SET
        summary_short = EXCLUDED.summary_short,
        summary_long = EXCLUDED.summary_long,
        reasons_yes = EXCLUDED.reasons_yes,
        reasons_no = EXCLUDED.reasons_no,
        key_points = EXCLUDED.key_points,
        vaa_question = EXCLUDED.vaa_question,
        political_tags = EXCLUDED.political_tags,
        model_version = EXCLUDED.model_version,
        generated_at = CURRENT_TIMESTAMP
    `, [
      billId,
      summary.summary_short,
      summary.summary_long,
      summary.reasons_yes,
      summary.reasons_no,
      summary.key_points,
      summary.vaa_question,
      summary.political_tags,
      MODEL
    ]);
    return true;
  } catch (error) {
    console.error(`  Error saving summary for bill ${billId}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 EULens Bill Summary Generator\n');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    console.log('Set it in your .env file or export it:');
    console.log('  export GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  // Get bills without summaries, ordered by vote variance (most divisive first = most important for PCA)
  const result = await pool.query(`
    WITH bill_stats AS (
      SELECT 
        bill_id,
        COUNT(*) as total_votes,
        COUNT(CASE WHEN vote = 'yes' THEN 1 END)::float / NULLIF(COUNT(*), 0) as yes_pct,
        COUNT(CASE WHEN vote = 'no' THEN 1 END)::float / NULLIF(COUNT(*), 0) as no_pct
      FROM votes
      WHERE vote IN ('yes', 'no', 'abstain')
      GROUP BY bill_id
      HAVING COUNT(*) >= 50
    ),
    bill_variance AS (
      SELECT 
        bill_id,
        total_votes,
        -- Variance: bills where yes/no are close to 50/50 are most divisive
        -- Maximum at 0.5, minimum at 0 or 1
        (yes_pct * (1 - yes_pct)) + (no_pct * (1 - no_pct)) as vote_variance
      FROM bill_stats
    )
    SELECT b.id, b.eu_id, b.title, b.description, b.category, b.status, b.date_adopted,
           COALESCE(bv.vote_variance, 0) as vote_variance,
           COALESCE(bv.total_votes, 0) as total_votes
    FROM bills b
    LEFT JOIN bill_summaries bs ON b.id = bs.bill_id
    LEFT JOIN bill_variance bv ON b.id = bv.bill_id
    WHERE bs.id IS NULL
    ORDER BY bv.vote_variance DESC NULLS LAST, bv.total_votes DESC NULLS LAST
  `);

  const bills = result.rows;
  console.log(`Found ${bills.length} bills without summaries\n`);

  if (bills.length === 0) {
    console.log('✅ All bills have summaries!');
    await pool.end();
    return;
  }

  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < bills.length; i += BATCH_SIZE) {
    const batch = bills.slice(i, i + BATCH_SIZE);
    
    console.log(`\n📝 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(bills.length / BATCH_SIZE)}`);
    
    for (const bill of batch) {
      processed++;
      console.log(`  [${processed}/${bills.length}] ${bill.title.substring(0, 60)}...`);
      
      const summary = await generateSummary(bill);
      
      if (summary) {
        const saved = await saveSummary(bill.id, summary);
        if (saved) {
          successful++;
          console.log(`    ✓ Summary generated`);
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    }
    
    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < bills.length) {
      console.log(`  Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
