# Fix Database Connection Issue (IPv6 Error)

The error `ENETUNREACH 2a05:d014:1c06:5f04:37c:2627:4058:de08:5432` means the backend is trying to connect via IPv6, which isn't working.

## Solution: Use Connection Pooler in Render

The issue is that your `DATABASE_URL` in Render is using the direct connection. Switch to the connection pooler:

### Step 1: Get Connection Pooler String from Supabase

1. Go to Supabase Dashboard → Your Project → Settings → Database
2. Scroll to "Connection string"
3. Select "Connection pooling" tab (not "Direct connection")
4. Choose "Session mode" (port 5432) or "Transaction mode" (port 6543)
5. Copy the connection string

It should look like:
```
postgresql://postgres.liwnrxyhwoftqbwrrfct:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

### Step 2: Update DATABASE_URL in Render

1. Go to Render Dashboard → Your service (`eulens-api`)
2. Go to "Environment" tab
3. Find `DATABASE_URL`
4. Click "Edit"
5. Replace with the connection pooler string from Step 1
6. Click "Save Changes"
7. Render will automatically redeploy

### Step 3: Verify

After redeploy, check the logs. The connection should work now.

## Why This Works

- Connection pooler uses IPv4 (more reliable)
- Better for serverless/container environments
- Handles connections more efficiently
- Recommended by Supabase for production

---

**Important:** Make sure to use the "Connection pooling" string, not "Direct connection"!
