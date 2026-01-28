import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

// EU Parliament countries mapping
const EU_COUNTRIES = {
  'AT': 'Austria',
  'BE': 'Belgium',
  'BG': 'Bulgaria',
  'HR': 'Croatia',
  'CY': 'Cyprus',
  'CZ': 'Czechia',
  'DK': 'Denmark',
  'EE': 'Estonia',
  'FI': 'Finland',
  'FR': 'France',
  'DE': 'Germany',
  'GR': 'Greece',
  'HU': 'Hungary',
  'IE': 'Ireland',
  'IT': 'Italy',
  'LV': 'Latvia',
  'LT': 'Lithuania',
  'LU': 'Luxembourg',
  'MT': 'Malta',
  'NL': 'Netherlands',
  'PL': 'Poland',
  'PT': 'Portugal',
  'RO': 'Romania',
  'SK': 'Slovakia',
  'SI': 'Slovenia',
  'ES': 'Spain',
  'SE': 'Sweden'
};

async function initializeCountries() {
  console.log('Initializing countries...');
  for (const [code, name] of Object.entries(EU_COUNTRIES)) {
    await pool.query(
      'INSERT INTO countries (code, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [code, name]
    );
  }
  console.log('Countries initialized');
}

async function fetchRecentVotes() {
  console.log('Fetching recent votes from EU Parliament API...');

  try {
    // EU Parliament provides a free API for voting data
    // This fetches recent plenary votes
    const response = await axios.get(
      'https://www.europarl.europa.eu/xml/ava/ep9/roll_call_votes.xml',
      {
        timeout: 30000
      }
    );

    const data = await parseStringPromise(response.data);
    const votes = data.VOTES.VOTE || [];

    console.log(`Found ${votes.length} votes to process`);

    for (const vote of votes.slice(0, 10)) { // Start with 10 recent votes
      try {
        await processVote(vote);
      } catch (error) {
        console.error('Error processing vote:', error.message);
      }
    }

    console.log('Vote fetching complete');
  } catch (error) {
    console.error('Error fetching votes:', error.message);
  }
}

async function processVote(voteData) {
  if (!voteData.DOCEO || !voteData.DOCEO[0]) return;

  const doceoId = voteData.DOCEO[0];
  const title = voteData.TITLE ? voteData.TITLE[0] : 'Untitled vote';
  const dateStr = voteData.DATE ? voteData.DATE[0] : new Date().toISOString();

  // Insert bill if not exists
  const billResult = await pool.query(
    `INSERT INTO bills (eu_id, title, status, date_adopted, category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (eu_id) DO UPDATE SET title = $2
     RETURNING id`,
    [doceoId, title, 'voting', dateStr, 'legislative']
  );

  const billId = billResult.rows[0].id;

  // Process MEP votes if available
  if (voteData.RESULT) {
    const result = voteData.RESULT[0];
    const votesFor = result.VOTES_FOR ? parseInt(result.VOTES_FOR[0]) : 0;
    const votesAgainst = result.VOTES_AGAINST ? parseInt(result.VOTES_AGAINST[0]) : 0;
    const votesAbstain = result.VOTES_ABSTAIN ? parseInt(result.VOTES_ABSTAIN[0]) : 0;

    console.log(`  Bill: ${title}`);
    console.log(`  For: ${votesFor}, Against: ${votesAgainst}, Abstain: ${votesAbstain}`);
  }
}

async function seedSampleData() {
  console.log('Seeding sample EU legislative data...');

  const sampleBills = [
    {
      eu_id: 'A9-0123/2024',
      title: 'Digital Services Act - Implementation',
      description: 'Regulation on digital services to ensure a safe online environment',
      category: 'Digital',
      status: 'adopted'
    },
    {
      eu_id: 'A9-0456/2024',
      title: 'Green Deal - Carbon Neutrality 2050',
      description: 'Establishing the EU framework for climate neutrality by 2050',
      category: 'Environment',
      status: 'voting'
    },
    {
      eu_id: 'A9-0789/2024',
      title: 'AI Act - Regulatory Framework',
      description: 'Harmonized rules on artificial intelligence across member states',
      category: 'Technology',
      status: 'voting'
    }
  ];

  for (const bill of sampleBills) {
    const result = await pool.query(
      `INSERT INTO bills (eu_id, title, description, category, status, date_adopted)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (eu_id) DO NOTHING
       RETURNING id`,
      [bill.eu_id, bill.title, bill.description, bill.category, bill.status]
    );

    if (result.rows.length > 0) {
      const billId = result.rows[0].id;

      // Add some sample votes from each country
      const countries = Object.entries(EU_COUNTRIES);
      for (const [code, name] of countries.slice(0, 5)) { // Sample 5 countries
        const countryResult = await pool.query(
          'SELECT id FROM countries WHERE code = $1',
          [code]
        );

        if (countryResult.rows.length > 0) {
          const countryId = countryResult.rows[0].id;
          const votes = ['yes', 'no', 'abstain'];
          const randomVote = votes[Math.floor(Math.random() * votes.length)];

          await pool.query(
            `INSERT INTO votes (bill_id, country_id, mep_name, mep_group, vote)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            [billId, countryId, `MEP from ${name}`, 'Sample Group', randomVote]
          );
        }
      }
    }
  }

  console.log('Sample data seeded');
}

async function main() {
  try {
    await initializeCountries();
    await seedSampleData();
    // Uncomment to fetch real data (requires API access)
    // await fetchRecentVotes();

    console.log('Scrape complete!');
    await pool.end();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
