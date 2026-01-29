import axios from 'axios';
import { parse } from 'csv-parse/sync';
import zlib from 'zlib';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

// HowTheyVote.eu data source - weekly updated EU Parliament voting data
const DATA_BASE_URL = 'https://github.com/HowTheyVote/data/releases/latest/download';

// Number of recent votes to fetch (set to Infinity for all votes)
const MAX_VOTES_TO_FETCH = Infinity;

// 10th European Parliament legislature start date (July 16, 2024)
const LEGISLATURE_10_START = new Date('2024-07-16');

// Procedure type mapping - based on EU Parliament procedure codes
// RSP = Resolution (often foreign affairs, urgent debates)
// BUD/BUI = Budget procedures
// COD = Ordinary legislative procedure (codecision)
// INI = Own-initiative reports
// INL = Legislative initiative
// NLE = Non-legislative enactments
// CNS = Consultation procedure

/**
 * Determine category based on procedure type and title
 * Uses procedure_type as primary signal, with title keywords as secondary
 */
function categorizeVote(vote) {
  const title = (vote.display_title || vote.procedure_title || '').toLowerCase();
  const procedureType = vote.procedure_type || '';
  const procedureRef = vote.procedure_reference || '';

  // Budget procedures
  if (procedureType === 'BUD' || procedureType === 'BUI' ||
      title.includes('discharge') || title.includes('budget')) {
    return 'Budget';
  }

  // Foreign affairs - RSP (resolutions) with country/geopolitical indicators
  const foreignIndicators = [
    'iran', 'china', 'russia', 'ukraine', 'belarus', 'turkey', 'syria', 'afghanistan',
    'venezuela', 'cuba', 'hong kong', 'taiwan', 'israel', 'palestine', 'gaza', 'lebanon',
    'libya', 'egypt', 'saudi', 'yemen', 'iraq', 'pakistan', 'india', 'myanmar', 'burma',
    'north korea', 'sudan', 'ethiopia', 'somalia', 'nigeria', 'congo', 'mali', 'niger',
    'burkina', 'mozambique', 'zimbabwe', 'nicaragua', 'georgia', 'armenia', 'azerbaijan',
    'moldova', 'serbia', 'kosovo', 'bosnia', 'montenegro', 'albania', 'central african',
    'aggression', 'invasion', 'war crimes', 'genocide', 'political prisoner', 'repression',
    'persecution', 'authoritarian', 'regime', 'human rights in', 'situation in'
  ];

  if (foreignIndicators.some(term => title.includes(term))) {
    return 'Foreign Affairs';
  }

  // Defence/Security
  if (title.includes('defence') || title.includes('defense') || title.includes('military') ||
      title.includes('nato') || title.includes('armed forces') || title.includes('security strategy')) {
    return 'Defence';
  }

  // Democracy/Rights/Rule of Law (internal EU matters)
  if (title.includes('rule of law') || title.includes('fundamental rights') ||
      title.includes('democracy') || title.includes('electoral') || title.includes('european parliament')) {
    return 'Democracy';
  }

  // Citizens' initiatives and petitions
  if (title.includes('citizens\' initiative') || title.includes('citizen initiative') ||
      title.includes('petition')) {
    return 'Citizens';
  }

  // Environment/Climate
  if (title.includes('climate') || title.includes('environment') || title.includes('biodiversity') ||
      title.includes('emission') || title.includes('green deal') || title.includes('natura')) {
    return 'Environment';
  }

  // Digital/Technology
  if (title.includes('digital') || title.includes('cyber') || title.includes('artificial intelligence') ||
      title.includes('data act') || title.includes('platform') || title.includes('algorithm')) {
    return 'Digital';
  }

  // Trade
  if (title.includes('trade') || title.includes('tariff') || title.includes('customs') ||
      title.includes('wto') || title.includes('import') || title.includes('export')) {
    return 'Trade';
  }

  // Industry/Economy
  if (title.includes('industrial') || title.includes('competitiveness') || title.includes('sme') ||
      title.includes('single market') || title.includes('economic')) {
    return 'Industry';
  }

  // Social/Employment
  if (title.includes('worker') || title.includes('employment') || title.includes('labour') ||
      title.includes('social') || title.includes('pension') || title.includes('wage')) {
    return 'Social';
  }

  // Health
  if (title.includes('health') || title.includes('pharmaceutical') || title.includes('medical') ||
      title.includes('disease') || title.includes('pandemic') || title.includes('vaccine')) {
    return 'Health';
  }

  // Agriculture
  if (title.includes('agricultur') || title.includes('farming') || title.includes('farmer') ||
      title.includes('fisheries') || title.includes('food') || title.includes('cap ')) {
    return 'Agriculture';
  }

  // Transport
  if (title.includes('transport') || title.includes('aviation') || title.includes('rail') ||
      title.includes('maritime') || title.includes('mobility')) {
    return 'Transport';
  }

  // Energy
  if (title.includes('energy') || title.includes('electricity') || title.includes('gas ') ||
      title.includes('nuclear') || title.includes('hydrogen')) {
    return 'Energy';
  }

  // Research/Technology
  if (title.includes('research') || title.includes('innovation') || title.includes('horizon') ||
      title.includes('science') || title.includes('space') || title.includes('computing')) {
    return 'Research';
  }

  // Default based on procedure type
  if (procedureType === 'RSP') {
    return 'Resolution';
  }

  return 'Procedure'; // Generic procedural matters
}

/**
 * Fetch and decompress a gzipped CSV file from HowTheyVote
 */
async function fetchCSV(filename) {
  console.log(`  Fetching ${filename}...`);
  try {
    const response = await axios.get(`${DATA_BASE_URL}/${filename}`, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    const decompressed = zlib.gunzipSync(response.data);
    const records = parse(decompressed, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true
    });
    console.log(`  → ${records.length} records loaded`);
    return records;
  } catch (error) {
    console.error(`  Error fetching ${filename}:`, error.message);
    throw error;
  }
}

/**
 * Map vote position from HowTheyVote format to our format
 */
function mapVotePosition(position) {
  switch (position) {
    case 'FOR': return 'yes';
    case 'AGAINST': return 'no';
    case 'ABSTENTION': return 'abstain';
    case 'DID_NOT_VOTE': return 'did_not_vote';
    default: return null;
  }
}

/**
 * Initialize countries from HowTheyVote data
 */
async function initializeCountries(countriesData) {
  console.log('Initializing countries...');

  // Build a mapping from 3-letter codes to country info
  const countryMap = new Map();
  for (const country of countriesData) {
    if (country.code && country.label) {
      // Store both 3-letter code and 2-letter ISO code
      countryMap.set(country.code, {
        code: country.code,
        iso2: country.iso_alpha_2,
        name: country.label
      });

      await pool.query(
        'INSERT INTO countries (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = $2',
        [country.code, country.label]
      );
    }
  }

  console.log(`  → ${countriesData.length} countries initialized`);
  return countryMap;
}

/**
 * Clear existing sample data
 */
async function clearExistingData() {
  console.log('Clearing existing data...');
  await pool.query('DELETE FROM discussions');
  await pool.query('DELETE FROM votes');
  await pool.query('DELETE FROM bills');

  // Create/update meps table with all fields
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meps (
      id SERIAL PRIMARY KEY,
      mep_id VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      country_code VARCHAR(10),
      political_group VARCHAR(255),
      date_of_birth DATE,
      email VARCHAR(255),
      facebook VARCHAR(500),
      twitter VARCHAR(500),
      photo_url VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add columns if they don't exist (for existing databases)
  const newColumns = [
    { name: 'first_name', type: 'VARCHAR(255)' },
    { name: 'last_name', type: 'VARCHAR(255)' },
    { name: 'date_of_birth', type: 'DATE' },
    { name: 'email', type: 'VARCHAR(255)' },
    { name: 'facebook', type: 'VARCHAR(500)' },
    { name: 'twitter', type: 'VARCHAR(500)' },
    { name: 'photo_url', type: 'VARCHAR(500)' },
    { name: 'gender', type: 'VARCHAR(10)' }
  ];

  for (const col of newColumns) {
    try {
      await pool.query(`ALTER TABLE meps ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch (e) {
      // Column might already exist
    }
  }

  // Add bill table columns if they don't exist
  const billColumns = [
    { name: 'procedure_type', type: 'VARCHAR(50)' },
    { name: 'texts_adopted_ref', type: 'VARCHAR(255)' },
    { name: 'ep_procedure_url', type: 'VARCHAR(500)' },
    { name: 'ep_text_url', type: 'VARCHAR(500)' }
  ];

  for (const col of billColumns) {
    try {
      await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch (e) {
      // Column might already exist
    }
  }

  await pool.query('DELETE FROM meps');
  console.log('  → Existing data cleared');
}

/**
 * Insert bills from votes data
 */
async function insertBills(votesData) {
  console.log('Inserting bills...');

  // Sort by timestamp descending and take most recent
  // Use display_title as the title field, filter for main votes only (is_main === 'True')
  // Filter for 10th legislature (votes after July 16, 2024)
  const sortedVotes = votesData
    .filter(v => {
      if (!v.id || !v.display_title || v.is_main !== 'True') return false;
      const voteDate = v.timestamp ? new Date(v.timestamp) : null;
      return voteDate && voteDate >= LEGISLATURE_10_START;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, MAX_VOTES_TO_FETCH);
  
  console.log(`  Filtering for 10th legislature (after ${LEGISLATURE_10_START.toISOString().split('T')[0]})`);

  console.log(`  Found ${sortedVotes.length} main votes to insert...`);

  const billIds = new Map();

  for (const vote of sortedVotes) {
    // Use display_title for the title
    const title = vote.display_title || vote.procedure_title || 'Untitled Vote';
    const category = categorizeVote(vote);
    const status = vote.result === 'ADOPTED' ? 'adopted' : 'rejected';
    const dateAdopted = vote.timestamp ? new Date(vote.timestamp) : null;

    // Generate EP URLs
    const procedureRef = vote.procedure_reference || null;
    const textsAdoptedRef = vote.texts_adopted_reference || null;
    const procedureType = vote.procedure_type || null;

    // EP procedure URL (OEIL legislative observatory)
    const epProcedureUrl = procedureRef
      ? `https://oeil.europarl.europa.eu/oeil/mt/procedure-file?reference=${encodeURIComponent(procedureRef)}`
      : null;

    // EP adopted text URL
    const epTextUrl = textsAdoptedRef
      ? `https://www.europarl.europa.eu/doceo/document/${textsAdoptedRef.replace(/\(|\)/g, '-')}_EN.html`
      : null;

    try {
      const result = await pool.query(
        `INSERT INTO bills (eu_id, title, description, category, status, date_adopted, procedure_id, procedure_type, texts_adopted_ref, ep_procedure_url, ep_text_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (eu_id) DO UPDATE SET
           title = EXCLUDED.title,
           category = EXCLUDED.category,
           status = EXCLUDED.status,
           procedure_type = EXCLUDED.procedure_type,
           texts_adopted_ref = EXCLUDED.texts_adopted_ref,
           ep_procedure_url = EXCLUDED.ep_procedure_url,
           ep_text_url = EXCLUDED.ep_text_url
         RETURNING id`,
        [
          vote.id.toString(),
          title.substring(0, 500),
          vote.description || null,
          category,
          status,
          dateAdopted,
          procedureRef,
          procedureType,
          textsAdoptedRef,
          epProcedureUrl,
          epTextUrl
        ]
      );
      billIds.set(vote.id.toString(), result.rows[0].id);
    } catch (error) {
      console.error(`  Error inserting bill ${vote.id}:`, error.message);
    }
  }

  console.log(`  → ${billIds.size} bills inserted`);
  return billIds;
}

/**
 * Build MEP lookup map from members data and save all MEPs to database
 */
async function buildMEPLookupAndSave(membersData, groupsData, groupMembershipsData, countriesData) {
  console.log('Building MEP lookup and saving to database...');

  // Build group code to name lookup
  const groupNames = new Map();
  for (const group of groupsData) {
    if (group.code && group.label) {
      groupNames.set(group.code, group.label);
    }
  }

  // Build MEP to current group lookup
  // Only include MEPs in term 10 (current legislature) with no end_date
  const mepGroups = new Map();
  for (const membership of groupMembershipsData) {
    if (membership.member_id && membership.group_code) {
      // Only consider current legislature (term 10) memberships with no end date
      const isTerm10 = membership.term === '10';
      const isCurrentlyActive = !membership.end_date || membership.end_date === '';

      if (isTerm10 && isCurrentlyActive) {
        // Keep the most recent if multiple
        const existing = mepGroups.get(membership.member_id);
        if (!existing || (membership.start_date > (existing.start_date || ''))) {
          mepGroups.set(membership.member_id, {
            group_code: membership.group_code,
            start_date: membership.start_date,
            term: membership.term
          });
        }
      }
    }
  }

  console.log(`  → Found ${mepGroups.size} current MEPs in term 10`);

  // Build MEP lookup (for all MEPs, needed for historical votes)
  const mepLookup = new Map();
  let savedCount = 0;

  for (const mep of membersData) {
    if (mep.id) {
      const groupInfo = mepGroups.get(mep.id);
      const groupCode = groupInfo ? groupInfo.group_code : null;
      const groupName = groupCode ? (groupNames.get(groupCode) || groupCode) : null;
      const name = `${mep.first_name || ''} ${mep.last_name || ''}`.trim() || 'Unknown MEP';
      const countryCode = mep.country_code || null;

      // Add to lookup for vote processing (includes historical MEPs)
      // Use current group if available, otherwise try to get any group
      let lookupGroup = groupName;
      if (!lookupGroup) {
        // Find any group membership for this MEP (for historical votes)
        for (const membership of groupMembershipsData) {
          if (membership.member_id === mep.id && membership.group_code) {
            lookupGroup = groupNames.get(membership.group_code) || membership.group_code;
            break;
          }
        }
      }

      mepLookup.set(mep.id.toString(), {
        name,
        country: countryCode,
        group: lookupGroup
      });

      // Only save to database if they are current MEPs (term 10, active)
      if (groupInfo) {
        try {
          // Generate photo URL from MEP ID
          const photoUrl = `https://www.europarl.europa.eu/mepphoto/${mep.id}.jpg`;

          // Parse date of birth
          let dateOfBirth = null;
          if (mep.date_of_birth) {
            try {
              dateOfBirth = new Date(mep.date_of_birth);
              if (isNaN(dateOfBirth.getTime())) dateOfBirth = null;
            } catch (e) {
              dateOfBirth = null;
            }
          }

          // Extract gender from members data if available
          let gender = null;
          if (mep.gender) {
            const g = mep.gender.toLowerCase().trim();
            if (g === 'f' || g === 'female' || g === 'woman' || g === 'w') {
              gender = 'female';
            } else if (g === 'm' || g === 'male' || g === 'man') {
              gender = 'male';
            }
          }

          await pool.query(
            `INSERT INTO meps (mep_id, name, first_name, last_name, country_code, political_group, date_of_birth, email, facebook, twitter, photo_url, gender, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
             ON CONFLICT (mep_id) DO UPDATE SET
               name = EXCLUDED.name,
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               country_code = EXCLUDED.country_code,
               political_group = EXCLUDED.political_group,
               date_of_birth = EXCLUDED.date_of_birth,
               email = EXCLUDED.email,
               facebook = EXCLUDED.facebook,
               twitter = EXCLUDED.twitter,
               photo_url = EXCLUDED.photo_url,
               gender = EXCLUDED.gender,
               is_active = true`,
            [
              mep.id.toString(),
              name.substring(0, 255),
              mep.first_name ? mep.first_name.substring(0, 255) : null,
              mep.last_name ? mep.last_name.substring(0, 255) : null,
              countryCode,
              groupName ? groupName.substring(0, 255) : null,
              dateOfBirth,
              mep.email ? mep.email.substring(0, 255) : null,
              mep.facebook ? mep.facebook.substring(0, 500) : null,
              mep.twitter ? mep.twitter.substring(0, 500) : null,
              photoUrl,
              gender
            ]
          );
          savedCount++;
        } catch (error) {
          // Ignore individual insert errors
        }
      }
    }
  }

  console.log(`  → ${mepLookup.size} MEPs indexed, ${savedCount} current MEPs saved to database`);
  return mepLookup;
}

/**
 * Insert MEP votes
 */
async function insertVotes(memberVotesData, billIds, mepLookup) {
  console.log('Inserting MEP votes...');

  // Get country IDs from database
  const countryResult = await pool.query('SELECT id, code FROM countries');
  const countryIds = new Map();
  for (const row of countryResult.rows) {
    countryIds.set(row.code, row.id);
  }

  let insertedCount = 0;
  let skippedCount = 0;

  // Filter to only votes for bills we inserted
  const relevantVotes = memberVotesData.filter(mv => billIds.has(mv.vote_id.toString()));
  console.log(`  Processing ${relevantVotes.length} relevant vote records...`);

  // Batch insert for performance
  const batchSize = 100;
  for (let i = 0; i < relevantVotes.length; i += batchSize) {
    const batch = relevantVotes.slice(i, i + batchSize);

    for (const memberVote of batch) {
      const votePosition = mapVotePosition(memberVote.position);
      if (!votePosition) {
        skippedCount++;
        continue; // Skip DID_NOT_VOTE entries
      }

      const billId = billIds.get(memberVote.vote_id.toString());
      if (!billId) {
        skippedCount++;
        continue;
      }

      const mepInfo = mepLookup.get(memberVote.member_id.toString()) || { name: 'Unknown', country: null, group: null };
      const countryId = mepInfo.country ? countryIds.get(mepInfo.country) : null;

      if (!countryId) {
        skippedCount++;
        continue; // Skip if we can't determine the country
      }

      try {
        await pool.query(
          `INSERT INTO votes (bill_id, country_id, mep_id, mep_name, mep_group, vote)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            billId,
            countryId,
            memberVote.member_id,
            mepInfo.name.substring(0, 255),
            mepInfo.group ? mepInfo.group.substring(0, 100) : null,
            votePosition
          ]
        );
        insertedCount++;
      } catch (error) {
        skippedCount++;
      }
    }

    // Progress indicator
    if (i % 1000 === 0 && i > 0) {
      process.stdout.write(`  → ${i}/${relevantVotes.length} processed\r`);
    }
  }

  console.log(`\n  → ${insertedCount} votes inserted, ${skippedCount} skipped`);
}

/**
 * Print summary statistics
 */
async function printSummary() {
  console.log('\n=== Data Summary ===');

  const billCount = await pool.query('SELECT COUNT(*) as count FROM bills');
  const voteCount = await pool.query('SELECT COUNT(*) as count FROM votes');
  const countryCount = await pool.query('SELECT COUNT(*) as count FROM countries');

  console.log(`Bills: ${billCount.rows[0].count}`);
  console.log(`Votes: ${voteCount.rows[0].count}`);
  console.log(`Countries: ${countryCount.rows[0].count}`);

  // Category breakdown
  const categoryBreakdown = await pool.query(
    'SELECT category, COUNT(*) as count FROM bills GROUP BY category ORDER BY count DESC'
  );
  console.log('\nBills by category:');
  for (const row of categoryBreakdown.rows) {
    console.log(`  ${row.category}: ${row.count}`);
  }

  // Votes per country (top 5)
  const votesPerCountry = await pool.query(`
    SELECT c.name, COUNT(*) as count
    FROM votes v
    JOIN countries c ON v.country_id = c.id
    GROUP BY c.name
    ORDER BY count DESC
    LIMIT 5
  `);
  console.log('\nTop 5 countries by vote count:');
  for (const row of votesPerCountry.rows) {
    console.log(`  ${row.name}: ${row.count}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('========================================');
  console.log('Fetching Real EU Parliament Data');
  console.log('Source: HowTheyVote.eu');
  console.log('========================================\n');

  try {
    // Step 1: Fetch all required data files
    console.log('Step 1: Downloading data from HowTheyVote.eu...');
    const [countriesData, votesData, membersData, groupsData, groupMembershipsData, memberVotesData] = await Promise.all([
      fetchCSV('countries.csv.gz'),
      fetchCSV('votes.csv.gz'),
      fetchCSV('members.csv.gz'),
      fetchCSV('groups.csv.gz'),
      fetchCSV('group_memberships.csv.gz'),
      fetchCSV('member_votes.csv.gz')
    ]);

    // Step 2: Clear existing sample data
    console.log('\nStep 2: Preparing database...');
    await clearExistingData();

    // Step 3: Initialize countries
    console.log('\nStep 3: Setting up countries...');
    await initializeCountries(countriesData);

    // Step 4: Insert bills
    console.log('\nStep 4: Inserting bills...');
    const billIds = await insertBills(votesData);

    // Step 5: Build MEP lookup, save all MEPs, and insert votes
    console.log('\nStep 5: Processing MEPs and votes...');
    const mepLookup = await buildMEPLookupAndSave(membersData, groupsData, groupMembershipsData, countriesData);
    await insertVotes(memberVotesData, billIds, mepLookup);

    // Step 6: Print summary
    await printSummary();

    console.log('\n========================================');
    console.log('Data fetch complete!');
    console.log('Visit http://localhost:3000 to see real EU data');
    console.log('========================================');

  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
