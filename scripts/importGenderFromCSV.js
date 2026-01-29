import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

/**
 * Import MEP gender data from a CSV file
 * 
 * Expected CSV format:
 * - Column with MEP ID (mep_id, id, or member_id)
 * - Column with gender (gender, sex, or gender_code)
 * 
 * You can download the official dataset from:
 * https://data.europarl.europa.eu/en/datasets/members-of-the-european-parliament-meps-parliamentary-term10/0032
 */
async function importGenderFromCSV(csvFilePath) {
  console.log('========================================');
  console.log('Importing MEP Gender Data from CSV');
  console.log('========================================\n');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found: ${csvFilePath}`);
    console.log('\nTo get the official dataset:');
    console.log('1. Visit: https://data.europarl.europa.eu/en/datasets/members-of-the-european-parliament-meps-parliamentary-term10/0032');
    console.log('2. Download the CSV export');
    console.log('3. Run: node scripts/importGenderFromCSV.js <path-to-csv-file>');
    process.exit(1);
  }
  
  try {
    // Ensure gender column exists
    await pool.query('ALTER TABLE meps ADD COLUMN IF NOT EXISTS gender VARCHAR(10)');
    console.log('✓ Gender column exists in database\n');
    
    // Read and parse CSV
    console.log(`Reading CSV file: ${csvFilePath}`);
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`Found ${records.length} records in CSV\n`);
    
    // Find the ID and gender columns
    const firstRecord = records[0];
    const idColumn = Object.keys(firstRecord).find(key => 
      /^(id|mep_id|member_id|ep_id)$/i.test(key)
    );
    const genderColumn = Object.keys(firstRecord).find(key => 
      /^(gender|sex|gender_code|sex_code)$/i.test(key)
    );
    
    if (!idColumn) {
      console.error('Error: Could not find ID column in CSV');
      console.log('Available columns:', Object.keys(firstRecord).join(', '));
      process.exit(1);
    }
    
    if (!genderColumn) {
      console.error('Error: Could not find gender column in CSV');
      console.log('Available columns:', Object.keys(firstRecord).join(', '));
      process.exit(1);
    }
    
    console.log(`Using columns: ${idColumn} (ID), ${genderColumn} (gender)\n`);
    
    // Build gender map
    const genderMap = new Map();
    for (const record of records) {
      const mepId = record[idColumn]?.toString().trim();
      const genderValue = record[genderColumn]?.toString().trim().toLowerCase();
      
      if (mepId && genderValue) {
        if (genderValue === 'f' || genderValue === 'female' || genderValue === 'woman' || genderValue === 'w' || genderValue === '2') {
          genderMap.set(mepId, 'female');
        } else if (genderValue === 'm' || genderValue === 'male' || genderValue === 'man' || genderValue === '1') {
          genderMap.set(mepId, 'male');
        }
      }
    }
    
    console.log(`Parsed gender data for ${genderMap.size} MEPs\n`);
    
    // Update database
    const mepsResult = await pool.query('SELECT mep_id FROM meps WHERE is_active = true');
    console.log(`Updating gender for ${mepsResult.rows.length} active MEPs in database...\n`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const mep of mepsResult.rows) {
      const gender = genderMap.get(mep.mep_id);
      if (gender) {
        await pool.query(
          'UPDATE meps SET gender = $1 WHERE mep_id = $2',
          [gender, mep.mep_id]
        );
        updated++;
      } else {
        notFound++;
      }
    }
    
    console.log(`✓ Updated gender for ${updated} MEPs`);
    if (notFound > 0) {
      console.log(`⚠ Could not find gender data for ${notFound} MEPs in CSV`);
    }
    
    // Show statistics
    const stats = await pool.query(`
      SELECT 
        gender,
        COUNT(*) as count,
        ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM meps WHERE is_active = true), 1) as percentage
      FROM meps
      WHERE is_active = true
      GROUP BY gender
      ORDER BY count DESC
    `);
    
    console.log('\n=== Gender Statistics ===');
    for (const stat of stats.rows) {
      const label = stat.gender || 'Unknown';
      console.log(`${label}: ${stat.count} (${stat.percentage}%)`);
    }
    
    // Compare with official statistics
    const total = stats.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    const femaleCount = stats.rows.find(r => r.gender === 'female')?.count || 0;
    const femalePercent = total > 0 ? ((femaleCount / total) * 100).toFixed(1) : 0;
    
    console.log(`\nOfficial statistics (from PDF): 38.5% female, 61.3% male`);
    console.log(`Current database: ${femalePercent}% female`);
    
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get CSV file path from command line argument
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.log('Usage: node scripts/importGenderFromCSV.js <path-to-csv-file>');
  console.log('\nTo get the official dataset:');
  console.log('1. Visit: https://data.europarl.europa.eu/en/datasets/members-of-the-european-parliament-meps-parliamentary-term10/0032');
  console.log('2. Download the CSV export');
  console.log('3. Run this script with the CSV file path');
  process.exit(1);
}

importGenderFromCSV(csvFilePath);
