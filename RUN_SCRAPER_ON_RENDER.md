# How to Run Scraper on Render

Since your backend is already deployed on Render with the correct DATABASE_URL, you can run the scraper directly there.

## Option 1: Using Render Shell (Easiest)

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click on your service: `eulens-api`

2. **Open Shell**
   - Click on "Shell" tab (or "Logs" → "Shell" button)
   - This opens a terminal connected to your Render service

3. **Run the Scraper**
   ```bash
   npm run scrape
   ```
   
   This will:
   - Use the DATABASE_URL from Render's environment variables (already set correctly)
   - Fetch all data from HowTheyVote.eu
   - Populate your Supabase database
   - Take 10-30 minutes depending on data size

4. **Monitor Progress**
   - Watch the logs in real-time
   - The scraper will show progress for each step

## Option 2: Create a One-Time Script Endpoint

Alternatively, I can create an admin endpoint that triggers the scraper. This would let you run it via a URL.

## Option 3: Use Update Script (Faster, Incremental)

The `update-data` script is optimized and faster:
```bash
npm run update-data
```

This will:
- Only fetch new data
- Skip if database is already up to date
- Much faster than full scrape

---

**Recommended: Use Option 1 (Render Shell)** - It's the simplest and uses your existing production environment.
