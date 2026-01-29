import axios from 'axios';
import pg from 'pg';
import dotenv from 'dotenv';
import { parse } from 'csv-parse/sync';
import zlib from 'zlib';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://localhost/agora_eu'
});

/**
 * Fetch MEP gender data from official EU Parliament source
 * Uses the official EU Parliament MEP directory as referenced in:
 * https://www.europarl.europa.eu/RegData/etudes/ATAG/2024/762356/EPRS_ATA(2024)762356_EN.pdf
 * 
 * The PDF references data from the Members' Administration Unit (extracted July 18, 2024)
 */
async function fetchMEPGenderFromOfficialSource() {
  console.log('Fetching MEP gender data from official EU Parliament source...');
  console.log('Source: EU Parliament Members Administration Unit data');
  console.log('Reference: https://www.europarl.europa.eu/RegData/etudes/ATAG/2024/762356/EPRS_ATA(2024)762356_EN.pdf\n');
  
  // First, try to fetch from EU Parliament Open Data Portal API
  console.log('Trying EU Parliament Open Data Portal...');
  try {
    // The Open Data Portal has MEP datasets
    // Try to fetch the official dataset
    const dataPortalUrl = 'https://data.europarl.europa.eu/api/v2/catalog/datasets/members-of-the-european-parliament-meps-parliamentary-term10/exports/json';
    const response = await axios.get(dataPortalUrl, {
      timeout: 30000,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.data && Array.isArray(response.data)) {
      const genderMap = new Map();
      for (const record of response.data) {
        if (record.id || record.mep_id || record.member_id) {
          const mepId = (record.id || record.mep_id || record.member_id).toString();
          const gender = record.gender || record.sex;
          if (gender) {
            const g = gender.toLowerCase().trim();
            if (g === 'f' || g === 'female' || g === 'woman' || g === 'w') {
              genderMap.set(mepId, 'female');
            } else if (g === 'm' || g === 'male' || g === 'man') {
              genderMap.set(mepId, 'male');
            }
          }
        }
      }
      
      if (genderMap.size > 0) {
        console.log(`  → Found gender data for ${genderMap.size} MEPs from Open Data Portal`);
        return genderMap;
      }
    }
  } catch (error) {
    console.log(`  → Open Data Portal API not available: ${error.message}`);
  }
  
  // Fallback: Try to fetch from official MEP list page
  console.log('\nTrying official EU Parliament MEP directory...');
  
  // Get all MEPs from our database
  const mepsResult = await pool.query('SELECT mep_id, name FROM meps WHERE is_active = true');
  console.log(`Found ${mepsResult.rows.length} active MEPs in database`);
  console.log('Fetching gender from individual MEP profile pages...');
  console.log('This may take several minutes. Please be patient...\n');
  
  const genderMap = new Map();
  let fetched = 0;
  let errors = 0;
  
  // Fetch gender from official EU Parliament MEP profile pages
  for (let i = 0; i < mepsResult.rows.length; i++) {
    const mep = mepsResult.rows[i];
    try {
      const mepId = mep.mep_id;
      
      // Try EU Parliament MEP profile page
      const url = `https://www.europarl.europa.eu/meps/en/${mepId}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AgoraEU/1.0; +https://github.com/agora-eu)'
        }
      });
      
      const html = response.data;
      
      // Look for gender indicators in the HTML/JSON data
      // The page may contain JSON-LD or structured data with gender
      let gender = null;
      
      // Try to extract from JSON-LD or embedded JSON
      const jsonMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.gender) {
            gender = jsonData.gender.toLowerCase();
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
      
      // Try to find in page data/state
      if (!gender) {
        const dataMatch = html.match(/"gender"\s*:\s*["']([^"']+)["']/i);
        if (dataMatch) {
          gender = dataMatch[1].toLowerCase();
        }
      }
      
      // Try to find honorifics (Ms., Mr., Mme, M., etc.)
      if (!gender) {
        if (html.match(/<span[^>]*>Ms\./i) || html.match(/<span[^>]*>Mme/i) || 
            html.match(/title[^>]*>Ms\./i) || html.match(/title[^>]*>Mme/i) ||
            html.match(/class[^>]*>Ms\./i)) {
          gender = 'female';
        } else if (html.match(/<span[^>]*>Mr\./i) || html.match(/<span[^>]*>M\./i) ||
                   html.match(/title[^>]*>Mr\./i) || html.match(/title[^>]*>M\./i) ||
                   html.match(/class[^>]*>Mr\./i)) {
          gender = 'male';
        }
      }
      
      if (gender) {
        if (gender === 'f' || gender === 'female' || gender === 'woman' || gender === 'w') {
          genderMap.set(mepId, 'female');
          fetched++;
        } else if (gender === 'm' || gender === 'male' || gender === 'man') {
          genderMap.set(mepId, 'male');
          fetched++;
        }
      } else {
        errors++;
      }
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  → Processed ${i + 1}/${mepsResult.rows.length} MEPs (${fetched} with gender, ${errors} unknown)...\r`);
      }
      
      // Rate limiting - be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      errors++;
      if (errors % 20 === 0) {
        console.error(`\n  Warning: ${errors} errors so far (${error.message})...`);
      }
    }
  }
  
  console.log(`\n\n✓ Successfully fetched gender for ${fetched} MEPs`);
  if (errors > 0) {
    console.log(`⚠ Could not determine gender for ${errors} MEPs`);
  }
  
  if (genderMap.size === 0) {
    console.log('\n⚠ Could not fetch gender data from EU Parliament website.');
    console.log('\nAlternative options:');
    console.log('1. EU Parliament Open Data Portal:');
    console.log('   https://data.europarl.europa.eu/en/datasets/members-of-the-european-parliament-meps-parliamentary-term10/0032');
    console.log('2. Download the official dataset and import manually');
    console.log('3. Use the official statistics: 38.5% female, 61.3% male');
    return null;
  }
  
  return genderMap;
}

/**
 * Update MEP gender in database from official source
 */
async function updateMEPGender() {
  console.log('========================================');
  console.log('Updating MEP Gender Data');
  console.log('========================================\n');
  
  try {
    // First, ensure gender column exists
    try {
      await pool.query('ALTER TABLE meps ADD COLUMN IF NOT EXISTS gender VARCHAR(10)');
      console.log('✓ Gender column exists in database');
    } catch (error) {
      console.error('Error adding gender column:', error.message);
    }
    
    // Fetch gender data from official source
    const genderMap = await fetchMEPGenderFromOfficialSource();
    
    if (!genderMap || genderMap.size === 0) {
      console.log('\n⚠ Could not fetch gender data from official sources.');
      console.log('You may need to manually update the gender field or use the EU Parliament Open Data Portal.');
      console.log('Official data shows: 38.5% female, 61.3% male (2024-2029 term)');
      return;
    }
    
    // Get all MEPs from database
    const mepsResult = await pool.query('SELECT mep_id FROM meps WHERE is_active = true');
    console.log(`\nUpdating gender for ${mepsResult.rows.length} active MEPs...`);
    
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
    
    console.log(`\n✓ Updated gender for ${updated} MEPs`);
    if (notFound > 0) {
      console.log(`⚠ Could not find gender data for ${notFound} MEPs`);
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
    
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateMEPGender();
