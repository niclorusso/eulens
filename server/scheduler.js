/**
 * Optional Scheduler for Automatic Data Updates
 *
 * This module sets up a cron job to automatically update data weekly.
 * Import and call initScheduler() from the main server if you want automatic updates.
 *
 * Alternatively, use system cron or a process manager like PM2 to run:
 *   npm run update-data
 */

import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

let isUpdateRunning = false;

function runScript(scriptPath, scriptName) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [scriptPath], {
      cwd: projectRoot,
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`[Scheduler] ${scriptName} completed successfully`);
        resolve();
      } else {
        console.error(`[Scheduler] ${scriptName} failed with code ${code}`);
        reject(new Error(`${scriptName} failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      console.error(`[Scheduler] Failed to start ${scriptName}:`, err);
      reject(err);
    });
  });
}

async function runUpdateScript() {
  if (isUpdateRunning) {
    console.log('[Scheduler] Update already in progress, skipping...');
    return;
  }

  console.log('[Scheduler] Starting weekly data update...');
  console.log(`[Scheduler] Time: ${new Date().toISOString()}`);
  isUpdateRunning = true;

  try {
    // Step 1: Update data from API
    console.log('[Scheduler] Step 1: Fetching new votes and bills...');
    await runScript('scripts/updateData.js', 'Data Update');

    // Step 2: Generate summaries for new bills (if enabled and new bills were added)
    // Only run if GENERATE_SUMMARIES is explicitly enabled (default: skip to save API costs)
    if (process.env.GENERATE_SUMMARIES === 'true') {
      console.log('[Scheduler] Step 2: Generating bill summaries...');
      try {
        await runScript('scripts/generateBillSummaries.js', 'Bill Summaries');
      } catch (err) {
        console.warn('[Scheduler] Bill summaries generation failed, continuing...');
      }
    } else {
      console.log('[Scheduler] Step 2: Skipping bill summaries (set GENERATE_SUMMARIES=true to enable)');
    }

    // Step 3: Generate VAA questions (if enabled and new bills were added)
    if (process.env.GENERATE_VAA === 'true') {
      console.log('[Scheduler] Step 3: Generating VAA questions...');
      try {
        await runScript('scripts/generateVAAQuestions.js', 'VAA Questions');
      } catch (err) {
        console.warn('[Scheduler] VAA questions generation failed, continuing...');
      }
    } else {
      console.log('[Scheduler] Step 3: Skipping VAA questions (set GENERATE_VAA=true to enable)');
    }

    // Step 4: Update PCA loadings for VAA ordering (if enabled)
    if (process.env.UPDATE_PCA_LOADINGS === 'true') {
      console.log('[Scheduler] Step 4: Updating PCA loadings...');
      try {
        await runScript('scripts/calculateBillPCALoadings.js', 'PCA Loadings');
      } catch (err) {
        console.warn('[Scheduler] PCA loadings update failed, continuing...');
      }
    } else {
      console.log('[Scheduler] Step 4: Skipping PCA loadings (set UPDATE_PCA_LOADINGS=true to enable)');
    }

    console.log('[Scheduler] Weekly update completed successfully!');
  } catch (error) {
    console.error('[Scheduler] Update process failed:', error);
  } finally {
    isUpdateRunning = false;
  }
}

/**
 * Initialize the scheduler for automatic data updates
 *
 * @param {Object} options
 * @param {string} options.schedule - Cron expression (default: '0 3 * * 0' = Sundays at 3am)
 * @param {boolean} options.runOnStart - Whether to run an update immediately on startup
 */
export function initScheduler(options = {}) {
  const {
    schedule = '0 3 * * 0', // Default: Every Sunday at 3:00 AM
    runOnStart = false
  } = options;

  // Validate cron expression
  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Invalid cron expression: ${schedule}`);
    return;
  }

  console.log(`[Scheduler] Initialized with schedule: ${schedule}`);
  console.log('[Scheduler] Next update will run at the scheduled time');

  // Schedule the job
  cron.schedule(schedule, async () => {
    console.log(`[Scheduler] Triggered at ${new Date().toISOString()}`);
    await runUpdateScript();
  });

  // Optionally run on startup
  if (runOnStart) {
    console.log('[Scheduler] Running initial update on startup...');
    setTimeout(runUpdateScript, 5000); // Wait 5 seconds for server to be ready
  }
}

/**
 * Manually trigger a data update (useful for admin endpoints)
 */
export function triggerUpdate() {
  runUpdateScript();
  return { status: 'started', message: 'Data update started' };
}

/**
 * Check if an update is currently running
 */
export function isUpdating() {
  return isUpdateRunning;
}

export default { initScheduler, triggerUpdate, isUpdating };
