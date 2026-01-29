/**
 * Incremental Data Update Script
 *
 * This script fetches only new votes from HowTheyVote since the last update.
 * It's designed to be run weekly via cron or manually.
 *
 * Usage:
 *   npm run update-data
 *
 * For scheduled updates, add to crontab:
 *   0 3 * * 0 cd /path/to/agora-eu && npm run update-data >> logs/update.log 2>&1
 */

import pg from 'pg';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://agora_user:agora_password@localhost/agora_eu'
});

const HOWTHEYVOTE_BASE = 'https://data.howtheyvote.eu';

// Get last update timestamp from metadata
async function getLastUpdateTimestamp() {
  try {
    const result = await pool.query(
      "SELECT value FROM metadata WHERE key = 'last_update_timestamp'"
    );
    if (result.rows.length > 0) {
      return new Date(result.rows[0].value);
    }
  } catch (error) {
    // Table might not exist yet
    console.log('No previous update timestamp found, will do full sync');
  }
  return null;
}

// Update the last update timestamp
async function setLastUpdateTimestamp(timestamp) {
  await pool.query(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES ('last_update_timestamp', $1, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP
  `, [timestamp.toISOString()]);
}

// Fetch CSV data from HowTheyVote
async function fetchCSV(filename) {
  const url = `${HOWTHEYVOTE_BASE}/latest/${filename}`;
  console.log(`Fetching ${url}...`);

  const response = await axios.get(url, { responseType: 'text' });
  return parse(response.data, { columns: true, skip_empty_lines: true });
}

// Get existing vote IDs to avoid duplicates
async function getExistingVoteEuIds() {
  const result = await pool.query('SELECT eu_id FROM bills');
  return new Set(result.rows.map(r => r.eu_id));
}

// Get existing MEP IDs
async function getExistingMepIds() {
  const result = await pool.query('SELECT mep_id FROM meps');
  return new Set(result.rows.map(r => r.mep_id));
}

// Get country ID by code
async function getCountryId(code) {
  const result = await pool.query('SELECT id FROM countries WHERE code = $1', [code]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// Categorize vote based on procedure type and title
function categorizeVote(vote) {
  const title = (vote.display_title || vote.reference || '').toLowerCase();
  const procedureType = (vote.procedure_reference || '').toLowerCase();

  // Foreign policy / specific countries
  const foreignCountries = ['russia', 'china', 'ukraine', 'iran', 'syria', 'turkey', 'belarus',
    'venezuela', 'hong kong', 'taiwan', 'israel', 'palestine', 'gaza', 'afghanistan',
    'myanmar', 'burma', 'north korea', 'cuba', 'saudi', 'yemen', 'libya', 'sudan',
    'ethiopia', 'eritrea', 'somalia', 'mali', 'niger', 'burkina', 'chad', 'cameroon',
    'nigeria', 'congo', 'zimbabwe', 'mozambique', 'georgia', 'armenia', 'azerbaijan',
    'moldova', 'serbia', 'kosovo', 'albania', 'bosnia', 'montenegro', 'macedonia',
    'lithuania', 'latvia', 'estonia', 'poland', 'hungary'];

  for (const country of foreignCountries) {
    if (title.includes(country)) return 'Foreign Affairs';
  }

  // Check procedure type
  if (procedureType.includes('bud')) return 'Budget';

  // Keywords
  if (title.includes('budget') || title.includes('financial framework')) return 'Budget';
  if (title.includes('climate') || title.includes('environment') || title.includes('emission') ||
      title.includes('biodiversity') || title.includes('green deal') || title.includes('renewable')) return 'Environment';
  if (title.includes('digital') || title.includes('artificial intelligence') || title.includes('ai act') ||
      title.includes('cyber') || title.includes('data') || title.includes('technology')) return 'Digital';
  if (title.includes('migration') || title.includes('asylum') || title.includes('border') ||
      title.includes('refugee') || title.includes('schengen')) return 'Migration';
  if (title.includes('trade') || title.includes('tariff') || title.includes('customs') ||
      title.includes('export') || title.includes('import')) return 'Trade';
  if (title.includes('health') || title.includes('medical') || title.includes('pharmaceutical') ||
      title.includes('vaccine') || title.includes('covid') || title.includes('pandemic')) return 'Health';
  if (title.includes('human rights') || title.includes('fundamental rights') || title.includes('democracy') ||
      title.includes('rule of law') || title.includes('freedom')) return 'Rights & Democracy';
  if (title.includes('transport') || title.includes('railway') || title.includes('aviation') ||
      title.includes('maritime') || title.includes('road')) return 'Transport';
  if (title.includes('energy') || title.includes('electricity') || title.includes('gas') ||
      title.includes('nuclear') || title.includes('hydrogen')) return 'Energy';
  if (title.includes('agriculture') || title.includes('farm') || title.includes('food') ||
      title.includes('fisheries') || title.includes('rural')) return 'Agriculture';
  if (title.includes('employment') || title.includes('labour') || title.includes('worker') ||
      title.includes('social') || title.includes('pension')) return 'Employment & Social';
  if (title.includes('security') || title.includes('defence') || title.includes('military') ||
      title.includes('nato') || title.includes('terrorism')) return 'Security & Defence';
  if (title.includes('economic') || title.includes('monetary') || title.includes('euro') ||
      title.includes('banking') || title.includes('financial') || title.includes('tax')) return 'Economy';

  return 'General';
}

async function updateData() {
  console.log('='.repeat(60));
  console.log('Agora EU - Data Update Script');
  console.log('Started at:', new Date().toISOString());
  console.log('='.repeat(60));

  const startTime = Date.now();
  const lastUpdate = await getLastUpdateTimestamp();

  if (lastUpdate) {
    console.log(`Last update: ${lastUpdate.toISOString()}`);
  } else {
    console.log('No previous update found - this will be a full data refresh');
  }

  try {
    // Fetch latest data from HowTheyVote
    const [votesData, membersData, memberVotesData] = await Promise.all([
      fetchCSV('votes.csv'),
      fetchCSV('members.csv'),
      fetchCSV('member_votes.csv')
    ]);

    console.log(`Fetched ${votesData.length} votes, ${membersData.length} members, ${memberVotesData.length} member votes`);

    // Filter to Term 10 (current legislature)
    const term10Votes = votesData.filter(v => v.group_key?.startsWith('10.'));
    console.log(`Term 10 votes: ${term10Votes.length}`);

    // Get existing data
    const existingVoteIds = await getExistingVoteEuIds();
    const existingMepIds = await getExistingMepIds();

    // Find new votes (not in database)
    const newVotes = term10Votes.filter(v => !existingVoteIds.has(v.id));
    console.log(`New votes to add: ${newVotes.length}`);

    // Find new MEPs
    const newMembers = membersData.filter(m => !existingMepIds.has(m.id));
    console.log(`New MEPs to add: ${newMembers.length}`);

    // Insert new MEPs
    let mepsAdded = 0;
    for (const mep of newMembers) {
      try {
        const photoUrl = `https://www.europarl.europa.eu/mepphoto/${mep.id}.jpg`;
        await pool.query(`
          INSERT INTO meps (mep_id, name, first_name, last_name, country_code, political_group,
                           date_of_birth, email, facebook, twitter, photo_url, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          ON CONFLICT (mep_id) DO UPDATE SET
            name = EXCLUDED.name,
            political_group = EXCLUDED.political_group,
            is_active = true
        `, [
          mep.id,
          `${mep.first_name} ${mep.last_name}`.trim(),
          mep.first_name,
          mep.last_name,
          mep.country_code,
          mep.group_code,
          mep.date_of_birth || null,
          mep.email || null,
          mep.facebook || null,
          mep.twitter || null,
          photoUrl
        ]);
        mepsAdded++;
      } catch (err) {
        console.error(`Error adding MEP ${mep.id}:`, err.message);
      }
    }
    console.log(`MEPs added/updated: ${mepsAdded}`);

    // Build member lookup for vote processing
    const memberLookup = new Map();
    membersData.forEach(m => memberLookup.set(m.id, m));

    // Build vote lookup from member_votes.csv
    const votesByVoteId = new Map();
    memberVotesData.forEach(mv => {
      if (!votesByVoteId.has(mv.vote_id)) {
        votesByVoteId.set(mv.vote_id, []);
      }
      votesByVoteId.get(mv.vote_id).push(mv);
    });

    // Insert new bills and votes
    let billsAdded = 0;
    let votesAdded = 0;

    for (const vote of newVotes) {
      try {
        const category = categorizeVote(vote);
        const status = vote.result === 'ADOPTED' ? 'adopted' : 'rejected';
        const procedureRef = vote.procedure_reference || null;
        const textsAdoptedRef = vote.texts_adopted_reference || null;

        const epProcedureUrl = procedureRef
          ? `https://oeil.europarl.europa.eu/oeil/mt/procedure-file?reference=${encodeURIComponent(procedureRef)}`
          : null;
        const epTextUrl = textsAdoptedRef
          ? `https://www.europarl.europa.eu/doceo/document/${textsAdoptedRef.replace(/\(|\)/g, '-')}_EN.html`
          : null;

        // Insert bill
        const billResult = await pool.query(`
          INSERT INTO bills (eu_id, title, description, category, status, date_adopted,
                           procedure_id, procedure_type, texts_adopted_ref, ep_procedure_url, ep_text_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (eu_id) DO UPDATE SET
            title = EXCLUDED.title,
            status = EXCLUDED.status
          RETURNING id
        `, [
          vote.id,
          vote.display_title || vote.reference,
          vote.description || '',
          category,
          status,
          vote.timestamp ? vote.timestamp.split('T')[0] : null,
          procedureRef,
          procedureRef ? procedureRef.match(/\(([^)]+)\)$/)?.[1] : null,
          textsAdoptedRef,
          epProcedureUrl,
          epTextUrl
        ]);

        const billId = billResult.rows[0].id;
        billsAdded++;

        // Insert individual MEP votes
        const memberVotes = votesByVoteId.get(vote.id) || [];
        for (const mv of memberVotes) {
          const member = memberLookup.get(mv.member_id);
          if (!member) continue;

          const countryId = await getCountryId(member.country_code);
          if (!countryId) continue;

          const voteValue = mv.position?.toLowerCase() || 'did_not_vote';

          try {
            await pool.query(`
              INSERT INTO votes (bill_id, country_id, mep_id, mep_name, mep_group, vote)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (bill_id, mep_id) DO NOTHING
            `, [
              billId,
              countryId,
              mv.member_id,
              `${member.first_name} ${member.last_name}`.trim(),
              member.group_code,
              voteValue
            ]);
            votesAdded++;
          } catch (err) {
            // Ignore duplicate errors
          }
        }
      } catch (err) {
        console.error(`Error processing vote ${vote.id}:`, err.message);
      }
    }

    console.log(`Bills added: ${billsAdded}`);
    console.log(`Individual votes added: ${votesAdded}`);

    // Update timestamp
    await setLastUpdateTimestamp(new Date());

    // Update stats in metadata
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM bills) as total_bills,
        (SELECT COUNT(*) FROM votes) as total_votes,
        (SELECT COUNT(*) FROM meps WHERE is_active = true) as active_meps
    `);

    const stats = statsResult.rows[0];
    await pool.query(`
      INSERT INTO metadata (key, value, updated_at)
      VALUES ('total_bills', $1, CURRENT_TIMESTAMP),
             ('total_votes', $2, CURRENT_TIMESTAMP),
             ('active_meps', $3, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [stats.total_bills.toString(), stats.total_votes.toString(), stats.active_meps.toString()]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('='.repeat(60));
    console.log('Update completed successfully!');
    console.log(`Duration: ${duration}s`);
    console.log(`Database now contains: ${stats.total_bills} bills, ${stats.total_votes} votes, ${stats.active_meps} active MEPs`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the update
updateData();
