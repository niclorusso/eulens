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

function runUpdateScript() {
  if (isUpdateRunning) {
    console.log('[Scheduler] Update already in progress, skipping...');
    return;
  }

  console.log('[Scheduler] Starting data update...');
  isUpdateRunning = true;

  const updateProcess = spawn('node', ['scripts/updateData.js'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  updateProcess.on('close', (code) => {
    isUpdateRunning = false;
    if (code === 0) {
      console.log('[Scheduler] Data update completed successfully');
    } else {
      console.error(`[Scheduler] Data update failed with code ${code}`);
    }
  });

  updateProcess.on('error', (err) => {
    isUpdateRunning = false;
    console.error('[Scheduler] Failed to start update process:', err);
  });
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
  cron.schedule(schedule, () => {
    console.log(`[Scheduler] Triggered at ${new Date().toISOString()}`);
    runUpdateScript();
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
