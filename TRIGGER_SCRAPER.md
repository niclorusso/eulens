# How to Trigger Data Scraping on Render (No Shell Needed)

Since Render shell costs money, use the admin API endpoint instead.

## Step 1: Wait for Render to Redeploy

After the latest commit, Render will automatically redeploy. Wait 2-3 minutes for it to finish.

## Step 2: Trigger the Scraper

Once deployed, make a POST request to trigger the scraper:

### Option A: Using curl (Terminal)
```bash
curl -X POST https://eulens-api.onrender.com/api/admin/scrape
```

### Option B: Using Browser/Postman
- Method: POST
- URL: `https://eulens-api.onrender.com/api/admin/scrape`
- Headers: (none needed if ADMIN_TOKEN is not set)

### Option C: Using JavaScript (Browser Console)
```javascript
fetch('https://eulens-api.onrender.com/api/admin/scrape', {
  method: 'POST'
})
.then(r => r.json())
.then(data => console.log(data));
```

## Step 3: Monitor Progress

1. Go to Render Dashboard → Your service → Logs
2. Watch the logs in real-time
3. You'll see progress like:
   - "Fetching data from HowTheyVote.eu..."
   - "Inserting bills..."
   - "Inserting votes..."
   - etc.

## Step 4: Check When Done

The scraper will take 10-30 minutes. When done, you'll see:
- "✅ Scraper completed successfully" in logs
- Your website will show data!

## Alternative: Use Incremental Update (Faster)

If you just want to add new data (not full scrape):
```bash
curl -X POST https://eulens-api.onrender.com/api/admin/update
```

This is faster and only adds new votes/bills.

## Security Note

If you set `ADMIN_TOKEN` in Render's environment variables, you'll need to include it:
```bash
curl -X POST https://eulens-api.onrender.com/api/admin/scrape \
  -H "x-admin-token: YOUR_ADMIN_TOKEN"
```

---

**Recommended:** Use the `/api/admin/scrape` endpoint via curl or browser after Render redeploys.
