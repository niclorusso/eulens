import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

app.use(cors());
app.use(bodyParser.json());

// BILLS ENDPOINTS

// Get all bills
app.get('/api/bills', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, eu_id, title, description, category, status, date_adopted
       FROM bills
       ORDER BY date_adopted DESC
       LIMIT 50`
    );
    res.json(result.rows);
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
      `SELECT id, eu_id, title, description, category, status, date_adopted
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

    res.json({
      bill: bill.rows[0],
      votes: votes.rows,
      discussions: discussions.rows
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
app.get('/api/consensus', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.id, b.title,
              COUNT(DISTINCT CASE WHEN v.vote = 'yes' THEN v.country_id END) as yes_countries,
              COUNT(DISTINCT CASE WHEN v.vote = 'no' THEN v.country_id END) as no_countries,
              COUNT(DISTINCT v.country_id) as voting_countries
       FROM bills b
       LEFT JOIN votes v ON b.id = v.bill_id
       WHERE b.status IN ('voting', 'adopted')
       GROUP BY b.id, b.title
       HAVING COUNT(DISTINCT v.country_id) > 10
       ORDER BY (COUNT(DISTINCT CASE WHEN v.vote = 'yes' THEN v.country_id END) /
                 NULLIF(COUNT(DISTINCT v.country_id), 0)) DESC`
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

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Agora EU backend running on port ${PORT}`);
});
