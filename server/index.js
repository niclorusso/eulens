import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initScheduler, triggerUpdate, isUpdating } from './scheduler.js';

dotenv.config();

// Initialize Gemini client (optional - only if API key is set)
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/eulens',
  // Add connection timeout and retry options
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Simple PCA computation function (same algorithm as frontend)
function computePCComponents(data, numComponents = 2) {
  const n = data.length;
  if (n === 0) return { components: null, means: null };
  
  const m = data[0].length;
  
  // Center the data (subtract mean from each column)
  const means = new Array(m).fill(0);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      means[j] += data[i][j];
    }
    means[j] /= n;
  }
  
  const centered = data.map(row => row.map((val, j) => val - means[j]));
  
  const components = [];
  let currentData = centered.map(row => [...row]);
  
  for (let comp = 0; comp < numComponents; comp++) {
    // Power iteration
    let pc = new Array(m).fill(1);
    let norm = Math.sqrt(pc.reduce((sum, v) => sum + v * v, 0));
    pc = pc.map(v => v / norm);
    
    for (let iter = 0; iter < 100; iter++) {
      const xpc = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
      const newPc = new Array(m).fill(0);
      for (let j = 0; j < m; j++) {
        for (let i = 0; i < n; i++) {
          newPc[j] += currentData[i][j] * xpc[i];
        }
      }
      
      norm = Math.sqrt(newPc.reduce((sum, v) => sum + v * v, 0));
      if (norm < 1e-10) break;
      pc = newPc.map(v => v / norm);
    }
    
    // Enforce sign convention
    const sum = pc.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      pc = pc.map(v => -v);
    }
    
    components.push(pc);
    
    // Deflate
    const projections = currentData.map(row => row.reduce((sum, v, j) => sum + v * pc[j], 0));
    for (let i = 0; i < n; i++) {
      const proj = projections[i];
      for (let j = 0; j < m; j++) {
        currentData[i][j] -= proj * pc[j];
      }
    }
  }
  
  return { components, means };
}

app.use(cors());
app.use(bodyParser.json());

// BILLS ENDPOINTS

// Get all bills with pagination
app.get('/api/bills', async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM bills';
    let countParams = [];
    if (category && category !== 'all') {
      countQuery += ' WHERE category = $1';
      countParams = [category];
    }
    const countResult = await pool.query(countQuery, countParams);
    const totalBills = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalBills / parseInt(limit));
    
    // Get paginated bills
    let query = `SELECT id, eu_id, title, description, category, status, date_adopted
       FROM bills`;
    let params = [];
    
    if (category && category !== 'all') {
      query += ' WHERE category = $1';
      params = [category];
      query += ' ORDER BY date_adopted DESC LIMIT $2 OFFSET $3';
      params.push(parseInt(limit), offset);
    } else {
      query += ' ORDER BY date_adopted DESC LIMIT $1 OFFSET $2';
      params = [parseInt(limit), offset];
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      bills: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalBills,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// Get single bill with voting breakdown
app.get('/api/bills/:id', async (req, res) => {
  try {
    const billId = req.params.id;

    const bill = await pool.query(
      `SELECT id, eu_id, title, description, category, status, date_adopted,
              procedure_id, procedure_type, texts_adopted_ref, ep_procedure_url, ep_text_url
       FROM bills
       WHERE id = $1`,
      [billId]
    );

    if (bill.rows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Get voting breakdown by country
    const votes = await pool.query(
      `SELECT c.name, c.code,
              COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_votes,
              COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_votes,
              COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_votes,
              COUNT(*) as total_votes
       FROM votes v
       JOIN countries c ON v.country_id = c.id
       WHERE v.bill_id = $1
       GROUP BY c.name, c.code
       ORDER BY c.name`,
      [billId]
    );

    // Get discussions
    const discussions = await pool.query(
      `SELECT d.id, d.title, d.content, c.name as country, d.upvotes, d.created_at
       FROM discussions d
       JOIN countries c ON d.country_id = c.id
       WHERE d.bill_id = $1
       ORDER BY d.upvotes DESC
       LIMIT 10`,
      [billId]
    );

    // Get AI-generated summary if available
    const summary = await pool.query(
      `SELECT summary_short, summary_long, reasons_yes, reasons_no, 
              key_points, vaa_question, political_tags, generated_at
       FROM bill_summaries
       WHERE bill_id = $1`,
      [billId]
    );

    res.json({
      bill: bill.rows[0],
      votes: votes.rows,
      discussions: discussions.rows,
      summary: summary.rows[0] || null
    });
  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// DISCUSSION ENDPOINTS

// Create discussion
app.post('/api/discussions', async (req, res) => {
  try {
    const { bill_id, country_code, title, content, author_id } = req.body;

    const country = await pool.query(
      'SELECT id FROM countries WHERE code = $1',
      [country_code]
    );

    if (country.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid country code' });
    }

    const result = await pool.query(
      `INSERT INTO discussions (bill_id, country_id, title, content, author_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, content, created_at`,
      [bill_id, country.rows[0].id, title, content, author_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating discussion:', error);
    res.status(500).json({ error: 'Failed to create discussion' });
  }
});

// Get discussions for a bill
app.get('/api/bills/:id/discussions', async (req, res) => {
  try {
    const billId = req.params.id;

    const result = await pool.query(
      `SELECT d.id, d.title, d.content, c.name as country, c.code as country_code, d.upvotes, d.created_at
       FROM discussions d
       JOIN countries c ON d.country_id = c.id
       WHERE d.bill_id = $1
       ORDER BY d.upvotes DESC`,
      [billId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

// VOTING ANALYSIS ENDPOINTS

// Get where Europe agrees (cross-country consensus)
// Fixed: Now counts countries by their MAJORITY vote position, not any vote
app.get('/api/consensus', async (req, res) => {
  try {
    const result = await pool.query(
      `WITH country_votes AS (
        -- Count votes per country per bill
        SELECT
          v.bill_id,
          v.country_id,
          v.vote,
          COUNT(*) as vote_count
        FROM votes v
        GROUP BY v.bill_id, v.country_id, v.vote
      ),
      country_majorities AS (
        -- Get each country's majority position per bill
        SELECT
          bill_id,
          country_id,
          vote,
          vote_count,
          ROW_NUMBER() OVER (PARTITION BY bill_id, country_id ORDER BY vote_count DESC) as rn
        FROM country_votes
      ),
      bill_consensus AS (
        -- Count countries by their majority position
        SELECT
          bill_id,
          COUNT(CASE WHEN vote = 'yes' AND rn = 1 THEN 1 END) as yes_countries,
          COUNT(CASE WHEN vote = 'no' AND rn = 1 THEN 1 END) as no_countries,
          COUNT(CASE WHEN vote = 'abstain' AND rn = 1 THEN 1 END) as abstain_countries,
          COUNT(DISTINCT country_id) as voting_countries
        FROM country_majorities
        WHERE rn = 1
        GROUP BY bill_id
      )
      SELECT
        b.id,
        b.title,
        COALESCE(bc.yes_countries, 0) as yes_countries,
        COALESCE(bc.no_countries, 0) as no_countries,
        COALESCE(bc.abstain_countries, 0) as abstain_countries,
        COALESCE(bc.voting_countries, 0) as voting_countries
      FROM bills b
      LEFT JOIN bill_consensus bc ON b.id = bc.bill_id
      WHERE b.status IN ('voting', 'adopted')
        AND bc.voting_countries > 10
      ORDER BY (bc.yes_countries::float / NULLIF(bc.voting_countries, 0)) DESC
      LIMIT 20`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching consensus:', error);
    res.status(500).json({ error: 'Failed to fetch consensus' });
  }
});

// Get voting breakdown for visualization
app.get('/api/votes/:billId', async (req, res) => {
  try {
    const billId = req.params.billId;

    const result = await pool.query(
      `SELECT c.name, c.code, v.vote, COUNT(*) as count
       FROM votes v
       JOIN countries c ON v.country_id = c.id
       WHERE v.bill_id = $1
       GROUP BY c.name, c.code, v.vote
       ORDER BY c.name, v.vote`,
      [billId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({ error: 'Failed to fetch votes' });
  }
});

// Get voting breakdown by political group
app.get('/api/bills/:id/group-votes', async (req, res) => {
  try {
    const billId = req.params.id;

    const result = await pool.query(
      `SELECT
         COALESCE(v.mep_group, 'Unknown') as group_name,
         COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_count,
         COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_count,
         COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_count,
         COUNT(*) as total
       FROM votes v
       WHERE v.bill_id = $1
       GROUP BY v.mep_group
       ORDER BY COUNT(*) DESC`,
      [billId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching group votes:', error);
    res.status(500).json({ error: 'Failed to fetch group votes' });
  }
});

// Get individual MEP votes for a bill (excludes did_not_vote - use non-voters endpoint for those)
app.get('/api/bills/:id/mep-votes', async (req, res) => {
  try {
    const billId = req.params.id;

    const result = await pool.query(
      `SELECT
         v.mep_id,
         v.mep_name,
         v.mep_group,
         c.name as country,
         c.code as country_code,
         v.vote
       FROM votes v
       JOIN countries c ON v.country_id = c.id
       WHERE v.bill_id = $1 AND v.vote != 'did_not_vote'
       ORDER BY v.mep_group, v.mep_name`,
      [billId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MEP votes:', error);
    res.status(500).json({ error: 'Failed to fetch MEP votes' });
  }
});

// Get all MEPs (for reference)
app.get('/api/meps', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT mep_id, name, first_name, last_name, country_code, political_group, photo_url
       FROM meps
       WHERE is_active = true
       ORDER BY political_group, name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MEPs:', error);
    res.status(500).json({ error: 'Failed to fetch MEPs' });
  }
});

// Get MEP statistics overview
app.get('/api/meps/stats', async (req, res) => {
  try {
    // Get all active MEPs with gender and birth date information
    const mepsResult = await pool.query(
      `SELECT gender, date_of_birth
       FROM meps
       WHERE is_active = true`
    );

    let male = 0;
    let female = 0;
    let unknown = 0;
    const decades = {};

    mepsResult.rows.forEach(mep => {
      // Use actual gender data from database (from official sources)
      if (mep.gender === 'male') {
        male++;
      } else if (mep.gender === 'female') {
        female++;
      } else {
        unknown++;
      }

      // Calculate birth decade
      if (mep.date_of_birth) {
        const birthYear = new Date(mep.date_of_birth).getFullYear();
        const decade = Math.floor(birthYear / 10) * 10;
        decades[decade] = (decades[decade] || 0) + 1;
      }
    });

    // Convert decades to sorted array
    const decadeData = Object.entries(decades)
      .map(([decade, count]) => ({ decade: parseInt(decade), count }))
      .sort((a, b) => a.decade - b.decade);

    const total = male + female + unknown;
    const genderRatio = {
      male: total > 0 ? Math.round((male / total) * 100) : 0,
      female: total > 0 ? Math.round((female / total) * 100) : 0,
      unknown: total > 0 ? Math.round((unknown / total) * 100) : 0,
      counts: { male, female, unknown, total }
    };

    // Reelection statistics (from official EU Parliament data)
    // Source: https://www.europarl.europa.eu/RegData/etudes/ATAG/2024/762356/EPRS_ATA(2024)762356_EN.pdf
    const reelectionStats = {
      new: 362,           // New MEPs (never sat in EP)
      reelected: 357      // Reelected (336 from previous term + 21 from other legislatures)
    };

    res.json({
      genderRatio,
      birthDecades: decadeData,
      reelection: reelectionStats
    });
  } catch (error) {
    console.error('Error fetching MEP stats:', error);
    res.status(500).json({ error: 'Failed to fetch MEP statistics' });
  }
});

// Get all political groups with statistics
app.get('/api/groups', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        m.political_group as group_name,
        COUNT(DISTINCT m.mep_id) as mep_count,
        COUNT(DISTINCT m.country_code) as country_count,
        COUNT(DISTINCT v.bill_id) as bills_voted,
        COUNT(v.id) as total_votes,
        COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_votes,
        COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_votes,
        COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_votes
      FROM meps m
      LEFT JOIN votes v ON m.mep_id = v.mep_id AND v.vote IN ('yes', 'no', 'abstain')
      WHERE m.is_active = true AND m.political_group IS NOT NULL
      GROUP BY m.political_group
      ORDER BY mep_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get all countries with statistics
// Filter to avoid duplicates - prefer countries with actual data (MEPs and votes)
// EU accession years (using 3-letter ISO codes as stored in database)
// 1958 (founding): BEL, FRA, DEU, ITA, LUX, NLD
// 1973: DNK, IRL
// 1981: GRC
// 1986: ESP, PRT
// 1995: AUT, FIN, SWE
// 2004: CYP, CZE, EST, HUN, LVA, LTU, MLT, POL, SVK, SVN
// 2007: BGR, ROU
// 2013: HRV
const EU_ACCESSION_YEARS = {
  'AUT': 1995, // Austria
  'BEL': 1958, // Belgium (founding)
  'BGR': 2007, // Bulgaria
  'HRV': 2013, // Croatia
  'CYP': 2004, // Cyprus
  'CZE': 2004, // Czechia
  'DNK': 1973, // Denmark
  'EST': 2004, // Estonia
  'FIN': 1995, // Finland
  'FRA': 1958, // France (founding)
  'DEU': 1958, // Germany (founding)
  'GRC': 1981, // Greece
  'HUN': 2004, // Hungary
  'IRL': 1973, // Ireland
  'ITA': 1958, // Italy (founding)
  'LVA': 2004, // Latvia
  'LTU': 2004, // Lithuania
  'LUX': 1958, // Luxembourg (founding)
  'MLT': 2004, // Malta
  'NLD': 1958, // Netherlands (founding)
  'POL': 2004, // Poland
  'PRT': 1986, // Portugal
  'ROU': 2007, // Romania
  'SVK': 2004, // Slovakia
  'SVN': 2004, // Slovenia
  'ESP': 1986, // Spain
  'SWE': 1995  // Sweden
};

app.get('/api/countries', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH country_stats AS (
        SELECT 
          c.code,
          c.name,
          COUNT(DISTINCT m.mep_id) as mep_count,
          COUNT(v.id) as total_votes,
          COUNT(CASE WHEN v.vote = 'yes' THEN 1 END) as yes_votes,
          COUNT(CASE WHEN v.vote = 'no' THEN 1 END) as no_votes,
          COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_votes
        FROM countries c
        LEFT JOIN meps m ON c.code = m.country_code AND m.is_active = true
        LEFT JOIN votes v ON m.mep_id = v.mep_id AND v.vote IN ('yes', 'no', 'abstain')
        WHERE c.code != 'GB' AND c.code != 'UK'  -- Exclude UK
        GROUP BY c.code, c.name
      ),
      -- Prefer countries with data (MEPs), then prefer 2-letter codes
      unique_countries AS (
        SELECT DISTINCT ON (name)
          code,
          name,
          mep_count,
          total_votes,
          yes_votes,
          no_votes,
          abstain_votes
        FROM country_stats
        ORDER BY name, mep_count DESC, LENGTH(code) ASC
      )
      SELECT *
      FROM unique_countries
      ORDER BY name
    `);
    
    // Add accession year to each country
    const countriesWithAccession = result.rows.map(country => ({
      ...country,
      accession_year: EU_ACCESSION_YEARS[country.code] || null
    }));
    
    res.json(countriesWithAccession);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get single MEP profile
app.get('/api/meps/:mepId', async (req, res) => {
  try {
    const { mepId } = req.params;

    const result = await pool.query(
      `SELECT m.mep_id, m.name, m.first_name, m.last_name, m.country_code,
              m.political_group, m.date_of_birth, m.email, m.facebook, m.twitter,
              m.photo_url, m.is_active, c.name as country_name
       FROM meps m
       LEFT JOIN countries c ON m.country_code = c.code
       WHERE m.mep_id = $1`,
      [mepId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'MEP not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching MEP profile:', error);
    res.status(500).json({ error: 'Failed to fetch MEP profile' });
  }
});

// Get all votes by a specific MEP
app.get('/api/meps/:mepId/votes', async (req, res) => {
  try {
    const { mepId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT v.vote, v.created_at as vote_date,
              b.id as bill_id, b.eu_id, b.title, b.category, b.status, b.date_adopted
       FROM votes v
       JOIN bills b ON v.bill_id = b.id
       WHERE v.mep_id = $1
       ORDER BY b.date_adopted DESC
       LIMIT $2 OFFSET $3`,
      [mepId, parseInt(limit), parseInt(offset)]
    );

    // Also get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM votes WHERE mep_id = $1`,
      [mepId]
    );

    res.json({
      votes: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching MEP votes:', error);
    res.status(500).json({ error: 'Failed to fetch MEP votes' });
  }
});

// Get MEP voting statistics
app.get('/api/meps/:mepId/stats', async (req, res) => {
  try {
    const { mepId } = req.params;

    // Overall vote breakdown
    const overallStats = await pool.query(
      `SELECT vote, COUNT(*) as count
       FROM votes
       WHERE mep_id = $1
       GROUP BY vote`,
      [mepId]
    );

    // Votes by category
    const categoryStats = await pool.query(
      `SELECT b.category, v.vote, COUNT(*) as count
       FROM votes v
       JOIN bills b ON v.bill_id = b.id
       WHERE v.mep_id = $1
       GROUP BY b.category, v.vote
       ORDER BY b.category, v.vote`,
      [mepId]
    );

    // Participation rate (voted vs did_not_vote)
    const participationStats = await pool.query(
      `SELECT
         COUNT(CASE WHEN vote != 'did_not_vote' THEN 1 END) as voted,
         COUNT(CASE WHEN vote = 'did_not_vote' THEN 1 END) as did_not_vote,
         COUNT(*) as total
       FROM votes
       WHERE mep_id = $1`,
      [mepId]
    );

    res.json({
      overall: overallStats.rows,
      byCategory: categoryStats.rows,
      participation: participationStats.rows[0]
    });
  } catch (error) {
    console.error('Error fetching MEP stats:', error);
    res.status(500).json({ error: 'Failed to fetch MEP stats' });
  }
});

// Get agreement between a specific MEP and all other MEPs
app.get('/api/meps/:mepId/agreement', async (req, res) => {
  try {
    const { mepId } = req.params;
    const { limit = 50, minShared = 10 } = req.query;

    const result = await pool.query(`
      WITH mep_votes AS (
        SELECT bill_id, mep_id, mep_name, vote
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain') AND mep_id IS NOT NULL
      ),
      target_mep_votes AS (
        SELECT bill_id, vote
        FROM mep_votes
        WHERE mep_id = $1
      ),
      pairwise_agreement AS (
        SELECT
          v.mep_id as mep2_id,
          v.mep_name as mep2_name,
          COUNT(*) as total_bills,
          SUM(CASE WHEN v.vote = t.vote THEN 1 ELSE 0 END) as agreements
        FROM mep_votes v
        JOIN target_mep_votes t ON v.bill_id = t.bill_id
        WHERE v.mep_id != $1
        GROUP BY v.mep_id, v.mep_name
        HAVING COUNT(*) >= $2
      ),
      mep_metadata AS (
        SELECT
          pa.mep2_id,
          pa.mep2_name,
          pa.total_bills,
          pa.agreements,
          ROUND(pa.agreements::numeric / pa.total_bills * 100, 1) as agreement_pct,
          m.political_group,
          m.country_code,
          c.name as country_name,
          m.photo_url
        FROM pairwise_agreement pa
        LEFT JOIN meps m ON pa.mep2_id = m.mep_id
        LEFT JOIN countries c ON m.country_code = c.code
      )
      SELECT *
      FROM mep_metadata
      ORDER BY agreement_pct DESC, total_bills DESC
      LIMIT $3
    `, [mepId, parseInt(minShared), parseInt(limit)]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MEP agreement:', error);
    res.status(500).json({ error: 'Failed to fetch MEP agreement data' });
  }
});

// Get MEPs who did not vote for a specific bill (from actual vote records)
app.get('/api/bills/:id/non-voters', async (req, res) => {
  try {
    const billId = req.params.id;

    // Get MEPs who have vote = 'did_not_vote' for this bill
    const result = await pool.query(
      `SELECT
         v.mep_id,
         v.mep_name,
         c.name as country,
         c.code as country_code,
         v.mep_group
       FROM votes v
       JOIN countries c ON v.country_id = c.id
       WHERE v.bill_id = $1 AND v.vote = 'did_not_vote'
       ORDER BY v.mep_group, v.mep_name`,
      [billId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching non-voters:', error);
    res.status(500).json({ error: 'Failed to fetch non-voters' });
  }
});

// STATISTICS ENDPOINTS

// Get legislature overview statistics
app.get('/api/stats/overview', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM bills) as total_bills,
        (SELECT COUNT(*) FROM bills WHERE status = 'adopted') as adopted_bills,
        (SELECT COUNT(*) FROM bills WHERE status = 'rejected') as rejected_bills,
        (SELECT COUNT(*) FROM votes WHERE vote != 'did_not_vote') as total_votes_cast,
        (SELECT COUNT(DISTINCT mep_id) FROM votes) as meps_voted,
        (SELECT COUNT(*) FROM meps WHERE is_active = true) as active_meps
    `);

    const stats = result.rows[0];
    const adoptionRate = stats.total_bills > 0
      ? Math.round((stats.adopted_bills / stats.total_bills) * 100)
      : 0;

    // Get votes by category
    const categoryResult = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM bills
      GROUP BY category
      ORDER BY count DESC
    `);

    // Get average participation rate
    const participationResult = await pool.query(`
      SELECT
        AVG(participation_rate) as avg_participation
      FROM (
        SELECT
          bill_id,
          COUNT(CASE WHEN vote != 'did_not_vote' THEN 1 END)::float /
          NULLIF(COUNT(*), 0) * 100 as participation_rate
        FROM votes
        GROUP BY bill_id
      ) sub
    `);

    res.json({
      totalBills: parseInt(stats.total_bills),
      adoptedBills: parseInt(stats.adopted_bills),
      rejectedBills: parseInt(stats.rejected_bills),
      adoptionRate,
      totalVotesCast: parseInt(stats.total_votes_cast),
      mepsVoted: parseInt(stats.meps_voted),
      activeMeps: parseInt(stats.active_meps),
      avgParticipation: Math.round(parseFloat(participationResult.rows[0]?.avg_participation) || 0),
      byCategory: categoryResult.rows.map(row => ({
        category: row.category,
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get party agreement matrix
app.get('/api/stats/party-agreement', async (req, res) => {
  try {
    // Calculate agreement between political groups
    // Two groups "agree" on a bill if their majority position is the same
    const result = await pool.query(`
      WITH group_majorities AS (
        -- Get each group's majority position per bill
        SELECT
          bill_id,
          mep_group,
          vote,
          COUNT(*) as vote_count,
          ROW_NUMBER() OVER (PARTITION BY bill_id, mep_group ORDER BY COUNT(*) DESC) as rn
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain') AND mep_group IS NOT NULL
        GROUP BY bill_id, mep_group, vote
      ),
      group_positions AS (
        SELECT bill_id, mep_group, vote as majority_vote
        FROM group_majorities
        WHERE rn = 1
      ),
      pairwise_agreement AS (
        SELECT
          g1.mep_group as group1,
          g2.mep_group as group2,
          COUNT(*) as total_bills,
          SUM(CASE WHEN g1.majority_vote = g2.majority_vote THEN 1 ELSE 0 END) as agreements
        FROM group_positions g1
        JOIN group_positions g2 ON g1.bill_id = g2.bill_id AND g1.mep_group < g2.mep_group
        WHERE 
          LOWER(g1.mep_group) NOT LIKE '%identity%democracy%'
          AND LOWER(g2.mep_group) NOT LIKE '%identity%democracy%'
        GROUP BY g1.mep_group, g2.mep_group
        HAVING COUNT(*) >= 10
      )
      SELECT
        group1,
        group2,
        total_bills,
        agreements,
        ROUND(agreements::numeric / total_bills * 100, 1) as agreement_pct
      FROM pairwise_agreement
      ORDER BY group1, group2
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching party agreement:', error);
    res.status(500).json({ error: 'Failed to fetch party agreement data' });
  }
});

// Get MEP agreement matrix (pairwise agreement between individual MEPs)
// By default, shows only "unusual" pairs: MEPs from different parties who agree
// Optimized using bill-grouped approach for better performance
app.get('/api/stats/mep-agreement', async (req, res) => {
  try {
    const { limit = 100, minShared = 10, crossPartyOnly = 'true' } = req.query;
    const showCrossPartyOnly = crossPartyOnly === 'true';
    
    // Optimized approach: Group votes by bill first, then join only cross-party pairs
    // This reduces the join space significantly
    let query;
    if (showCrossPartyOnly) {
      query = `
        WITH bill_mep_votes AS (
          -- Get all votes with MEP info, grouped by bill for efficient joining
          SELECT 
            bill_id,
            mep_id,
            mep_name,
            mep_group,
            vote
          FROM votes
          WHERE vote IN ('yes', 'no', 'abstain') 
            AND mep_id IS NOT NULL 
            AND mep_group IS NOT NULL
        ),
        cross_party_votes AS (
          -- Pre-filter to only bills where we have votes from different parties
          SELECT DISTINCT bill_id
          FROM bill_mep_votes
          GROUP BY bill_id
          HAVING COUNT(DISTINCT mep_group) > 1
        ),
        pairwise_agreement AS (
          -- Join only on bills that have cross-party votes, and only cross-party pairs
          SELECT
            v1.mep_id as mep1_id,
            v1.mep_name as mep1_name,
            v1.mep_group as mep1_group,
            v2.mep_id as mep2_id,
            v2.mep_name as mep2_name,
            v2.mep_group as mep2_group,
            COUNT(*) as total_bills,
            SUM(CASE WHEN v1.vote = v2.vote THEN 1 ELSE 0 END) as agreements
          FROM bill_mep_votes v1
          INNER JOIN cross_party_votes cpv ON v1.bill_id = cpv.bill_id
          INNER JOIN bill_mep_votes v2 
            ON v1.bill_id = v2.bill_id 
            AND v1.mep_id < v2.mep_id
            AND v1.mep_group != v2.mep_group
          GROUP BY v1.mep_id, v1.mep_name, v1.mep_group, v2.mep_id, v2.mep_name, v2.mep_group
          HAVING COUNT(*) >= $1
        )
        SELECT
          mep1_id,
          mep1_name,
          mep1_group,
          mep2_id,
          mep2_name,
          mep2_group,
          total_bills,
          agreements,
          ROUND(agreements::numeric / total_bills * 100, 1) as agreement_pct
        FROM pairwise_agreement
        ORDER BY agreement_pct DESC, total_bills DESC
        LIMIT $2
      `;
    } else {
      // Fallback to original pairwise join for all pairs
      query = `
        WITH mep_votes AS (
          SELECT bill_id, mep_id, mep_name, mep_group, vote
          FROM votes
          WHERE vote IN ('yes', 'no', 'abstain') AND mep_id IS NOT NULL
        ),
        pairwise_agreement AS (
          SELECT
            v1.mep_id as mep1_id,
            v1.mep_name as mep1_name,
            v1.mep_group as mep1_group,
            v2.mep_id as mep2_id,
            v2.mep_name as mep2_name,
            v2.mep_group as mep2_group,
            COUNT(*) as total_bills,
            SUM(CASE WHEN v1.vote = v2.vote THEN 1 ELSE 0 END) as agreements
          FROM mep_votes v1
          JOIN mep_votes v2 ON v1.bill_id = v2.bill_id AND v1.mep_id < v2.mep_id
          GROUP BY v1.mep_id, v1.mep_name, v1.mep_group, v2.mep_id, v2.mep_name, v2.mep_group
          HAVING COUNT(*) >= $1
        )
        SELECT
          mep1_id,
          mep1_name,
          mep1_group,
          mep2_id,
          mep2_name,
          mep2_group,
          total_bills,
          agreements,
          ROUND(agreements::numeric / total_bills * 100, 1) as agreement_pct
        FROM pairwise_agreement
        ORDER BY agreement_pct DESC, total_bills DESC
        LIMIT $2
      `;
    }
    
    const result = await pool.query(query, [parseInt(minShared), parseInt(limit)]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching MEP agreement:', error);
    res.status(500).json({ error: 'Failed to fetch MEP agreement data' });
  }
});

// Get MEP voting vectors for PCA visualization
// Returns each MEP's voting pattern as a vector that can be used for dimensionality reduction
app.get('/api/stats/mep-voting-vectors', async (req, res) => {
  try {
    const { minVotes = 20 } = req.query;
    
    // Get all MEPs with their votes encoded as numbers
    // yes = 1, no = -1, abstain = 0
    const result = await pool.query(`
      WITH bill_list AS (
        -- Get bills that have enough votes to be meaningful
        SELECT DISTINCT bill_id
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain')
        GROUP BY bill_id
        HAVING COUNT(*) >= 50
      ),
      mep_vote_counts AS (
        -- Count votes per MEP to filter out inactive ones
        SELECT mep_id, COUNT(*) as vote_count
        FROM votes v
        JOIN bill_list bl ON v.bill_id = bl.bill_id
        WHERE vote IN ('yes', 'no', 'abstain') AND mep_id IS NOT NULL
        GROUP BY mep_id
        HAVING COUNT(*) >= $1
      ),
      mep_votes_encoded AS (
        SELECT 
          v.mep_id,
          v.mep_name,
          v.mep_group,
          v.bill_id,
          CASE 
            WHEN v.vote = 'yes' THEN 1
            WHEN v.vote = 'no' THEN -1
            WHEN v.vote = 'abstain' THEN 0
          END as vote_val
        FROM votes v
        JOIN bill_list bl ON v.bill_id = bl.bill_id
        JOIN mep_vote_counts mvc ON v.mep_id = mvc.mep_id
        WHERE v.vote IN ('yes', 'no', 'abstain') AND v.mep_id IS NOT NULL
      )
      SELECT 
        mep_id,
        mep_name,
        mep_group,
        json_agg(json_build_object('bill_id', bill_id, 'vote', vote_val) ORDER BY bill_id) as votes
      FROM mep_votes_encoded
      GROUP BY mep_id, mep_name, mep_group
      ORDER BY mep_name
    `, [parseInt(minVotes)]);

    // Also return the list of bill IDs for reference
    const billsResult = await pool.query(`
      SELECT DISTINCT bill_id
      FROM votes
      WHERE vote IN ('yes', 'no', 'abstain')
      GROUP BY bill_id
      HAVING COUNT(*) >= 50
      ORDER BY bill_id
    `);

    res.json({
      meps: result.rows,
      billIds: billsResult.rows.map(r => r.bill_id)
    });
  } catch (error) {
    console.error('Error fetching MEP voting vectors:', error);
    res.status(500).json({ error: 'Failed to fetch MEP voting vectors' });
  }
});

// Get party cohesion stats (how unified is each party in their votes)
app.get('/api/stats/party-cohesion', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH party_bill_votes AS (
        -- Count votes by party per bill
        SELECT
          bill_id,
          mep_group,
          vote,
          COUNT(*) as count
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain') 
          AND mep_group IS NOT NULL
          AND LOWER(mep_group) NOT LIKE '%identity%democracy%'
        GROUP BY bill_id, mep_group, vote
      ),
      party_bill_stats AS (
        -- Get majority and total for each party-bill combination
        SELECT
          bill_id,
          mep_group,
          MAX(count) as majority_count,
          SUM(count) as total_votes
        FROM party_bill_votes
        GROUP BY bill_id, mep_group
      )
      SELECT
        mep_group as political_group,
        COUNT(*) as bills_voted,
        ROUND(AVG(majority_count::numeric / NULLIF(total_votes, 0) * 100), 1) as avg_cohesion,
        SUM(total_votes) as total_mep_votes
      FROM party_bill_stats
      WHERE LOWER(mep_group) NOT LIKE '%identity%democracy%'
      GROUP BY mep_group
      HAVING COUNT(*) >= 10
      ORDER BY avg_cohesion DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching party cohesion:', error);
    res.status(500).json({ error: 'Failed to fetch party cohesion data' });
  }
});

// Get party absence/non-participation rates
app.get('/api/stats/party-absence', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH bill_count AS (
        SELECT COUNT(DISTINCT id) as total_bills FROM bills
      ),
      party_votes AS (
        -- Count actual votes (yes, no, abstain) per party
        SELECT
          mep_group,
          COUNT(*) as votes_cast,
          COUNT(DISTINCT mep_id) as meps_who_voted,
          COUNT(DISTINCT bill_id) as bills_participated
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain')
          AND mep_group IS NOT NULL
          AND LOWER(mep_group) NOT LIKE '%identity%democracy%'
        GROUP BY mep_group
      ),
      party_absences AS (
        -- Count did_not_vote per party
        SELECT
          mep_group,
          COUNT(*) as absent_votes
        FROM votes
        WHERE vote = 'did_not_vote'
          AND mep_group IS NOT NULL
          AND LOWER(mep_group) NOT LIKE '%identity%democracy%'
        GROUP BY mep_group
      ),
      party_meps AS (
        -- Count MEPs per party from the meps table
        SELECT
          political_group as mep_group,
          COUNT(*) as total_meps
        FROM meps
        WHERE political_group IS NOT NULL
          AND LOWER(political_group) NOT LIKE '%identity%democracy%'
        GROUP BY political_group
      )
      SELECT
        pv.mep_group as political_group,
        pm.total_meps,
        pv.meps_who_voted as active_meps,
        pv.bills_participated,
        (SELECT total_bills FROM bill_count) as total_bills,
        pv.votes_cast,
        COALESCE(pa.absent_votes, 0) as absent_votes,
        ROUND(
          COALESCE(pa.absent_votes, 0)::numeric / 
          NULLIF(pv.votes_cast + COALESCE(pa.absent_votes, 0), 0) * 100, 
          1
        ) as absence_rate,
        ROUND(
          pv.bills_participated::numeric / NULLIF((SELECT total_bills FROM bill_count), 0) * 100,
          1
        ) as participation_rate
      FROM party_votes pv
      LEFT JOIN party_absences pa ON pv.mep_group = pa.mep_group
      LEFT JOIN party_meps pm ON pv.mep_group = pm.mep_group
      WHERE LOWER(pv.mep_group) NOT LIKE '%identity%democracy%'
      ORDER BY absence_rate DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching party absence:', error);
    res.status(500).json({ error: 'Failed to fetch party absence data' });
  }
});

// Get most/least controversial bills (closest vote margins)
app.get('/api/stats/controversial', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.title,
        b.category,
        b.status,
        b.date_adopted,
        SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) as yes_votes,
        SUM(CASE WHEN v.vote = 'no' THEN 1 ELSE 0 END) as no_votes,
        SUM(CASE WHEN v.vote = 'abstain' THEN 1 ELSE 0 END) as abstain_votes,
        COUNT(*) as total_votes,
        ABS(SUM(CASE WHEN v.vote = 'yes' THEN 1 ELSE 0 END) -
            SUM(CASE WHEN v.vote = 'no' THEN 1 ELSE 0 END))::float /
            NULLIF(COUNT(*), 0) * 100 as margin
      FROM bills b
      JOIN votes v ON b.id = v.bill_id
      WHERE v.vote IN ('yes', 'no')
      GROUP BY b.id, b.title, b.category, b.status, b.date_adopted
      HAVING COUNT(*) >= 100
      ORDER BY margin ASC
      LIMIT 20
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching controversial bills:', error);
    res.status(500).json({ error: 'Failed to fetch controversial bills' });
  }
});

// POLITICAL COMPASS ENDPOINTS

// Get MEP's political compass scores
app.get('/api/meps/:mepId/compass', async (req, res) => {
  try {
    const { mepId } = req.params;

    const result = await pool.query(`
      WITH mep_votes_on_tagged AS (
        SELECT
          v.vote,
          va.axis,
          va.direction
        FROM votes v
        JOIN vote_axes va ON v.bill_id = va.bill_id
        WHERE v.mep_id = $1 AND v.vote IN ('yes', 'no')
      ),
      axis_scores AS (
        SELECT
          axis,
          SUM(
            CASE
              WHEN vote = 'yes' THEN direction
              WHEN vote = 'no' THEN -direction
              ELSE 0
            END
          )::float / NULLIF(COUNT(*), 0) as raw_score,
          COUNT(*) as vote_count
        FROM mep_votes_on_tagged
        GROUP BY axis
      )
      SELECT axis, raw_score, vote_count
      FROM axis_scores
    `, [mepId]);

    const scores = { economic: 0, eu_integration: 0, environment: 0, social: 0 };
    const voteCounts = { ...scores };

    result.rows.forEach(row => {
      if (scores.hasOwnProperty(row.axis)) {
        scores[row.axis] = parseFloat(row.raw_score) || 0;
        voteCounts[row.axis] = parseInt(row.vote_count) || 0;
      }
    });

    res.json({ scores, voteCounts });
  } catch (error) {
    console.error('Error fetching MEP compass:', error);
    res.status(500).json({ error: 'Failed to fetch MEP compass scores' });
  }
});

// Get all MEPs positioned for scatter plot
app.get('/api/compass/data', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH mep_votes_on_tagged AS (
        SELECT
          v.mep_id,
          v.mep_name,
          v.mep_group,
          v.vote,
          va.axis,
          va.direction
        FROM votes v
        JOIN vote_axes va ON v.bill_id = va.bill_id
        WHERE v.vote IN ('yes', 'no')
      ),
      mep_axis_scores AS (
        SELECT
          mep_id,
          mep_name,
          mep_group,
          axis,
          SUM(
            CASE
              WHEN vote = 'yes' THEN direction
              WHEN vote = 'no' THEN -direction
              ELSE 0
            END
          )::float / NULLIF(COUNT(*), 0) as score
        FROM mep_votes_on_tagged
        GROUP BY mep_id, mep_name, mep_group, axis
        HAVING COUNT(*) >= 3
      )
      SELECT
        mep_id,
        MAX(mep_name) as mep_name,
        MAX(mep_group) as mep_group,
        MAX(CASE WHEN axis = 'economic' THEN score END) as economic,
        MAX(CASE WHEN axis = 'social' THEN score END) as social,
        MAX(CASE WHEN axis = 'eu_integration' THEN score END) as eu_integration,
        MAX(CASE WHEN axis = 'environment' THEN score END) as environment
      FROM mep_axis_scores
      GROUP BY mep_id
      HAVING COUNT(DISTINCT axis) >= 2
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching compass data:', error);
    res.status(500).json({ error: 'Failed to fetch compass data' });
  }
});

// Get list of tagged votes
app.get('/api/compass/tagged-votes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        b.id as bill_id,
        b.title,
        b.category,
        va.axis,
        va.direction
      FROM vote_axes va
      JOIN bills b ON va.bill_id = b.id
      ORDER BY b.date_adopted DESC, va.axis
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tagged votes:', error);
    res.status(500).json({ error: 'Failed to fetch tagged votes' });
  }
});

// Admin endpoint to tag a vote with axis information
app.post('/api/admin/tag-vote', async (req, res) => {
  try {
    const { bill_id, axis, direction } = req.body;

    if (!['economic', 'eu_integration', 'environment', 'social'].includes(axis)) {
      return res.status(400).json({ error: 'Invalid axis' });
    }
    if (![1, -1].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be 1 or -1' });
    }

    await pool.query(`
      INSERT INTO vote_axes (bill_id, axis, direction)
      VALUES ($1, $2, $3)
      ON CONFLICT (bill_id, axis) DO UPDATE SET direction = $3
    `, [bill_id, axis, direction]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error tagging vote:', error);
    res.status(500).json({ error: 'Failed to tag vote' });
  }
});

// VAA (VOTING ADVICE APPLICATION) ENDPOINTS

// Get VAA questions
app.get('/api/vaa/questions', async (req, res) => {
  try {
    // Order by display_order (which should be set by PCA loading calculation)
    // If display_order is NULL or 0, order by id as fallback
    const result = await pool.query(`
      SELECT
        q.id,
        q.bill_id,
        q.question_text,
        q.category,
        q.display_order,
        b.title as bill_title,
        b.date_adopted
      FROM vaa_questions q
      JOIN bills b ON q.bill_id = b.id
      WHERE q.is_active = true
      ORDER BY 
        CASE WHEN q.display_order IS NULL OR q.display_order = 0 THEN 999999 ELSE q.display_order END,
        q.id
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching VAA questions:', error);
    res.status(500).json({ error: 'Failed to fetch VAA questions' });
  }
});

// Submit VAA responses and get matching MEPs
app.post('/api/vaa/submit', async (req, res) => {
  try {
    const { responses, sessionId, countryCode } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Invalid responses format' });
    }

    const session = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Save responses
    for (const response of responses) {
      await pool.query(`
        INSERT INTO vaa_responses (session_id, question_id, response, importance)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [session, response.questionId, response.answer, response.importance || 1]);
    }

    // Get bill IDs from questions (ensure they're integers)
    const billIds = responses.map(r => parseInt(r.billId)).filter(id => !isNaN(id) && id > 0);

    if (billIds.length === 0) {
      return res.status(400).json({ error: 'No valid bill IDs found in responses', sessionId: session });
    }

    // Build query with optional country filter
    let votesQuery = `
      SELECT v.mep_id, v.mep_name, v.mep_group, v.bill_id, v.vote, m.country_code
      FROM votes v
      JOIN meps m ON v.mep_id = m.mep_id
      WHERE v.bill_id = ANY($1::int[]) AND v.vote IN ('yes', 'no')
    `;
    const queryParams = [billIds];
    
    if (countryCode && countryCode.trim() !== '') {
      // Handle both 2-letter and 3-letter country codes
      votesQuery += ` AND (m.country_code = $2 OR m.country_code LIKE $3)`;
      queryParams.push(countryCode.toUpperCase(), `${countryCode.toUpperCase()}%`);
    }
    
    // Get MEP votes for these bills
    const votesResult = await pool.query(votesQuery, queryParams);

    // Group votes by MEP
    const mepVotes = {};
    votesResult.rows.forEach(row => {
      if (!mepVotes[row.mep_id]) {
        mepVotes[row.mep_id] = {
          mep_id: row.mep_id, mep_name: row.mep_name, mep_group: row.mep_group, votes: {}
        };
      }
      mepVotes[row.mep_id].votes[row.bill_id] = row.vote;
    });

    // Calculate match scores
    const matches = [];
    const responseMap = {};
    responses.forEach(r => { responseMap[r.billId] = { answer: r.answer, importance: r.importance || 1 }; });

    for (const mepId in mepVotes) {
      const mep = mepVotes[mepId];
      let totalWeight = 0, matchScore = 0;

      for (const billId in responseMap) {
        const userResponse = responseMap[billId];
        const mepVote = mep.votes[billId];
        if (!mepVote || userResponse.answer === 'skip') continue;

        const weight = userResponse.importance;
        totalWeight += weight;

        const userPosition = userResponse.answer === 'agree' ? 'yes' : (userResponse.answer === 'disagree' ? 'no' : null);
        if (userPosition && userPosition === mepVote) matchScore += weight;
        else if (userResponse.answer === 'neutral') matchScore += weight * 0.5;
      }

      if (totalWeight > 0) {
        matches.push({
          mep_id: mep.mep_id, mep_name: mep.mep_name, mep_group: mep.mep_group,
          match_percent: Math.round((matchScore / totalWeight) * 100),
          questions_answered: Object.keys(mep.votes).length
        });
      }
    }

    matches.sort((a, b) => b.match_percent - a.match_percent);
    const topMatches = matches.slice(0, 20);

    // Calculate party averages
    const partyScores = {};
    matches.forEach(m => {
      const group = m.mep_group || 'Unknown';
      if (!partyScores[group]) partyScores[group] = { total: 0, count: 0 };
      partyScores[group].total += m.match_percent;
      partyScores[group].count++;
    });

    const partyMatches = Object.entries(partyScores)
      .map(([group, data]) => ({ group, match_percent: Math.round(data.total / data.count), mep_count: data.count }))
      .sort((a, b) => b.match_percent - a.match_percent);

    // Calculate user's PCA position
    let userPCA = null;
    try {
      // Get the same bill set used for MEP PCA (bills with at least 50 votes)
      const billListRes = await pool.query(`
        SELECT DISTINCT bill_id
        FROM votes
        WHERE vote IN ('yes', 'no', 'abstain')
        GROUP BY bill_id
        HAVING COUNT(*) >= 50
        ORDER BY bill_id
      `);
      
      const allBillIds = billListRes.rows.map(r => parseInt(r.bill_id));
      
      if (allBillIds.length > 0) {
        // Get MEP vectors for PCA computation (same query as /api/stats/mep-voting-vectors)
        const mepVectorsRes = await pool.query(`
          WITH bill_list AS (
            SELECT DISTINCT bill_id
            FROM votes
            WHERE vote IN ('yes', 'no', 'abstain')
            GROUP BY bill_id
            HAVING COUNT(*) >= 50
          ),
          mep_vote_counts AS (
            SELECT mep_id, COUNT(*) as vote_count
            FROM votes v
            JOIN bill_list bl ON v.bill_id = bl.bill_id
            WHERE vote IN ('yes', 'no', 'abstain') AND mep_id IS NOT NULL
            GROUP BY mep_id
            HAVING COUNT(*) >= 20
          ),
          mep_votes_encoded AS (
            SELECT 
              v.mep_id,
              v.bill_id,
              CASE 
                WHEN v.vote = 'yes' THEN 1
                WHEN v.vote = 'no' THEN -1
                WHEN v.vote = 'abstain' THEN 0
              END as vote_val
            FROM votes v
            JOIN bill_list bl ON v.bill_id = bl.bill_id
            JOIN mep_vote_counts mvc ON v.mep_id = mvc.mep_id
            WHERE v.vote IN ('yes', 'no', 'abstain') AND v.mep_id IS NOT NULL
          )
          SELECT 
            mep_id,
            json_object_agg(bill_id, vote_val ORDER BY bill_id) as votes
          FROM mep_votes_encoded
          GROUP BY mep_id
          ORDER BY mep_id
          LIMIT 1000
        `);
        
        if (mepVectorsRes.rows.length >= 10) { // Need at least some MEPs for PCA
          // Build MEP matrix: each row is an MEP, each column is a bill
          const mepMatrix = mepVectorsRes.rows.map(row => {
            const votes = row.votes;
            return allBillIds.map(billId => {
              const val = votes[billId];
              return val !== undefined && val !== null ? val : 0;
            });
          });
          
          // Compute PCA components from MEP data
          const { components, means } = computePCComponents(mepMatrix, 2);
          
          if (components && components.length >= 2 && means) {
            // Build user's voting vector (same format: yes=1, no=-1, neutral/skip=0)
            const userVector = allBillIds.map(billId => {
              const response = responseMap[billId];
              if (!response || response.answer === 'skip' || response.answer === 'neutral') return 0;
              return response.answer === 'agree' ? 1 : -1;
            });
            
            // Center user vector using same means as MEPs
            const centeredUser = userVector.map((v, i) => v - means[i]);
            
            // Project onto first two principal components
            const x = centeredUser.reduce((sum, v, i) => sum + v * components[0][i], 0);
            const y = centeredUser.reduce((sum, v, i) => sum + v * components[1][i], 0);
            
            userPCA = { x, y };
          }
        }
      }
    } catch (pcaError) {
      console.error('Error calculating user PCA:', pcaError);
      // Don't fail the whole request if PCA fails
    }

    res.json({ 
      sessionId: session, 
      topMatches, 
      partyMatches, 
      totalMepsCompared: matches.length,
      countryFilter: countryCode || null,
      userPCA // Add user's PCA position
    });
  } catch (error) {
    console.error('Error processing VAA submission:', error);
    res.status(500).json({ 
      error: 'Failed to process VAA submission',
      details: error.message 
    });
  }
});

// Admin: Add VAA question
app.post('/api/admin/vaa-question', async (req, res) => {
  try {
    const { bill_id, question_text, category, display_order } = req.body;
    const result = await pool.query(`
      INSERT INTO vaa_questions (bill_id, question_text, category, display_order, is_active)
      VALUES ($1, $2, $3, $4, true) RETURNING id
    `, [bill_id, question_text, category, display_order || 0]);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('Error adding VAA question:', error);
    res.status(500).json({ error: 'Failed to add VAA question' });
  }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ADMIN ENDPOINTS

// Manually trigger data update (should be protected in production)
app.post('/api/admin/refresh-data', (req, res) => {
  if (isUpdating()) {
    return res.status(409).json({ error: 'Update already in progress' });
  }
  const result = triggerUpdate();
  res.json(result);
});

// Check update status
app.get('/api/admin/update-status', (req, res) => {
  res.json({ updating: isUpdating() });
});

// Get metadata/stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value, updated_at FROM metadata');
    const stats = {};
    result.rows.forEach(row => {
      stats[row.key] = {
        value: row.value,
        updated_at: row.updated_at
      };
    });
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ===== CHAT WITH MEP ENDPOINT =====

// MEP Personas with their political positions
const MEP_PERSONAS = {
  'epp': {
    name: 'Klaus Weber',
    group: 'European People\'s Party (EPP)',
    country: 'Germany',
    ideology: 'Christian democrat, center-right',
    positions: `
      - Economy: Supports free market with social responsibility, fiscal discipline, lower corporate taxes
      - EU Integration: Strongly pro-EU, supports deeper integration while respecting subsidiarity
      - Environment: Supports pragmatic climate action balanced with economic competitiveness
      - Immigration: Favors managed migration, strong border security, integration requirements
      - Social: Traditional values, family-focused policies, religious heritage of Europe
      - Defense: Strong support for NATO, increased European defense cooperation
    `
  },
  'sd': {
    name: 'Maria Santos',
    group: 'Progressive Alliance of Socialists and Democrats (S&D)',
    country: 'Portugal',
    ideology: 'Social democrat, center-left',
    positions: `
      - Economy: Progressive taxation, workers\' rights, strong social safety net, regulate corporations
      - EU Integration: Pro-EU, supports social Europe and common minimum standards
      - Environment: Strong supporter of Green Deal, just transition for workers
      - Immigration: Humanitarian approach, legal pathways, integration support
      - Social: LGBTQ+ rights, gender equality, secularism, anti-discrimination
      - Defense: Supports EU strategic autonomy, cautious on military spending
    `
  },
  'renew': {
    name: 'Antoine Dupont',
    group: 'Renew Europe',
    country: 'France',
    ideology: 'Liberal centrist, pro-business',
    positions: `
      - Economy: Free market, innovation, digital transformation, entrepreneurship
      - EU Integration: Strongly federalist, supports EU reforms and deeper integration
      - Environment: Market-based solutions, carbon pricing, green innovation
      - Immigration: Skills-based migration, European asylum system reform
      - Social: Individual rights, liberal values, secular society
      - Defense: Strong European defense, EU army supporter, transatlantic alliance
    `
  },
  'greens': {
    name: 'Emma Lindgren',
    group: 'Greens/European Free Alliance',
    country: 'Sweden',
    ideology: 'Green, progressive left',
    positions: `
      - Economy: Green economy, degrowth where necessary, circular economy, tax polluters
      - EU Integration: Pro-EU with focus on environmental and social standards
      - Environment: Climate emergency priority, end fossil fuels by 2035, biodiversity protection
      - Immigration: Open borders, refugee rights, climate refugee recognition
      - Social: Radical equality, minority rights, indigenous peoples\' rights
      - Defense: Pacifist tendency, reduce military spending, no nuclear weapons
    `
  },
  'ecr': {
    name: 'Tomasz Kowalski',
    group: 'European Conservatives and Reformists (ECR)',
    country: 'Poland',
    ideology: 'Conservative, Eurosceptic',
    positions: `
      - Economy: Free market, low taxes, deregulation, against EU fiscal rules
      - EU Integration: EU as cooperation not federation, national sovereignty, less Brussels
      - Environment: Climate realism, energy security first, nuclear power support
      - Immigration: Strict controls, protect borders, preserve national identity
      - Social: Traditional family values, Christian heritage, against "gender ideology"
      - Defense: Strong national defense, NATO priority over EU defense
    `
  },
  'left': {
    name: 'Sofia Papadopoulos',
    group: 'The Left in the European Parliament (GUE/NGL)',
    country: 'Greece',
    ideology: 'Democratic socialist, far-left',
    positions: `
      - Economy: Anti-austerity, public ownership, wealth redistribution, tax the rich
      - EU Integration: Critical of neoliberal EU, reform or leave debate, against EU fiscal rules
      - Environment: Green New Deal but skeptical of market solutions, social justice in transition
      - Immigration: Open borders, abolish Frontex, refugees welcome
      - Social: Radical equality, anti-capitalism, workers\' solidarity
      - Defense: Anti-NATO, anti-militarism, peace movement, no arms exports
    `
  },
  'pfe': {
    name: 'Marco Bianchi',
    group: 'Patriots for Europe (PfE)',
    country: 'Italy',
    ideology: 'National conservative, right-wing populist',
    positions: `
      - Economy: National interest first, protect domestic industry, critical of globalization
      - EU Integration: Eurosceptic, return powers to nations, against federalism
      - Environment: Skeptical of Green Deal costs, energy independence, practical solutions
      - Immigration: Zero illegal immigration, strong borders, deportations, cultural preservation
      - Social: Traditional values, national identity, against multiculturalism
      - Defense: National sovereignty, skeptical of EU defense, protect national interests
    `
  }
};

app.post('/api/chat/mep', async (req, res) => {
  try {
    const { mepId, message, history = [] } = req.body;

    if (!genAI) {
      return res.status(503).json({ 
        error: 'Chat service unavailable',
        response: 'I apologize, but the chat service is currently unavailable. Please set the GEMINI_API_KEY environment variable to enable AI chat.'
      });
    }

    const persona = MEP_PERSONAS[mepId];
    if (!persona) {
      return res.status(400).json({ error: 'Invalid MEP ID' });
    }

    // Fetch some recent votes for context
    const recentVotes = await pool.query(`
      SELECT b.title, b.category, b.status
      FROM bills b
      ORDER BY b.date_adopted DESC
      LIMIT 10
    `);

    const systemPrompt = `You are ${persona.name}, a fictional Member of the European Parliament (MEP) from ${persona.country}, representing the ${persona.group}.

Your political ideology: ${persona.ideology}

Your typical positions on key issues:
${persona.positions}

IMPORTANT GUIDELINES:
1. Stay in character as this MEP at all times
2. Respond based on your political positions and ideology
3. You can discuss real EU legislation and votes, explaining how your group typically votes and why
4. Be engaging and conversational, but maintain your political perspective
5. If asked about specific votes, explain how your group would likely vote based on your positions
6. You can disagree with policies from other groups, but remain respectful
7. Acknowledge you are a fictional representative, not a real person, if directly asked
8. Keep responses concise but informative (2-4 paragraphs typically)
9. Reference actual EU topics like the Green Deal, migration pacts, digital regulations when relevant

Recent topics in the European Parliament include: ${recentVotes.rows.map(v => v.title).slice(0, 5).join('; ')}`;

    // Build conversation history for Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    });
    
    // Build chat history for Gemini (it uses a different format)
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.json({ response: text });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Chat failed',
      response: 'I apologize, but I\'m having trouble responding right now. Please try again in a moment.'
    });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`EULens backend running on port ${PORT}`);

  // Initialize scheduler for automatic weekly data updates
  // Runs every Sunday at 3:00 AM by default
  // Set ENABLE_SCHEDULER=false in .env to disable automatic updates
  if (process.env.ENABLE_SCHEDULER !== 'false') {
    initScheduler({
      schedule: process.env.UPDATE_SCHEDULE || '0 3 * * 0', // Default: Sundays at 3am
      runOnStart: process.env.UPDATE_ON_START === 'true'
    });
  }
});

// Admin endpoint to trigger data scraping (for initial data load)
// WARNING: This should be protected in production!
app.post('/api/admin/scrape', async (req, res) => {
  try {
    // Simple protection - check for admin token (set ADMIN_TOKEN in env)
    const adminToken = req.headers['x-admin-token'];
    if (process.env.ADMIN_TOKEN && adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Import and run scraper
    const { spawn } = await import('child_process');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const scraperPath = join(__dirname, '..', 'scripts', 'scrapeEUParliament.js');

    console.log('[Admin] Starting scraper...');
    
    const scraper = spawn('node', [scraperPath], {
      cwd: join(__dirname, '..'),
      env: { ...process.env },
      stdio: 'pipe'
    });

    let output = '';
    scraper.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Scraper] ${data.toString()}`);
    });

    scraper.stderr.on('data', (data) => {
      output += data.toString();
      console.error(`[Scraper Error] ${data.toString()}`);
    });

    scraper.on('close', (code) => {
      if (code === 0) {
        console.log('[Admin] ✅ Scraper completed successfully');
        console.log('[Admin] Last 20 lines of output:');
        console.log(output.split('\n').slice(-20).join('\n'));
      } else {
        console.error(`[Admin] ❌ Scraper failed with code ${code}`);
        console.error('[Admin] Error output:');
        console.error(output.split('\n').slice(-20).join('\n'));
      }
    });

    // Return immediately - scraper runs in background
    res.json({ 
      success: true, 
      message: 'Scraper started in background',
      note: 'This may take 10-30 minutes. Check Render logs for progress.',
      tip: 'Monitor progress in Render dashboard → Logs'
    });

  } catch (error) {
    console.error('[Admin] Error starting scraper:', error);
    res.status(500).json({ error: 'Failed to start scraper', details: error.message });
  }
});

// Admin endpoint to trigger incremental update
app.post('/api/admin/update', async (req, res) => {
  try {
    const adminToken = req.headers['x-admin-token'];
    if (process.env.ADMIN_TOKEN && adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { spawn } = await import('child_process');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const updatePath = join(__dirname, '..', 'scripts', 'updateData.js');

    console.log('[Admin] Starting incremental update...');
    
    const update = spawn('node', [updatePath], {
      cwd: join(__dirname, '..'),
      env: { ...process.env },
      stdio: 'pipe'
    });

    let output = '';
    update.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Update] ${data.toString()}`);
    });

    update.stderr.on('data', (data) => {
      output += data.toString();
      console.error(`[Update Error] ${data.toString()}`);
    });

    update.on('close', (code) => {
      if (code === 0) {
        console.log('[Admin] Update completed successfully');
      } else {
        console.error(`[Admin] Update failed with code ${code}`);
      }
    });

    res.json({ 
      success: true, 
      message: 'Update started. Check logs for progress.',
      output: output.split('\n').slice(-20).join('\n')
    });

  } catch (error) {
    console.error('[Admin] Error starting update:', error);
    res.status(500).json({ error: 'Failed to start update', details: error.message });
  }
});
