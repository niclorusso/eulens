# Backend Deployment Guide - Render

Deploy your EULens backend API to Render (free tier).

## Prerequisites

✅ Frontend deployed on Netlify (eulens.eu)  
✅ GitHub repo: `niclorusso/eulens`

## Step 1: Create Database on Supabase (Free)

1. **Go to Supabase**
   - Visit https://supabase.com
   - Sign up/Login with GitHub
   - Click "New Project"

2. **Create Project**
   - **Name**: `eulens` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - Click "Create new project"
   - Wait ~2 minutes for setup

3. **Get Connection String**
   - Go to Project Settings → Database
   - Scroll to "Connection string"
   - Copy the "URI" connection string
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`
   - **Save this!** You'll need it for Render

4. **Run Database Schema**
   - Go to SQL Editor in Supabase
   - Click "New query"
   - Copy contents of `server/schema.sql`
   - Paste and click "Run"
   - Wait for all tables to be created ✅

## Step 2: Deploy Backend to Render

1. **Go to Render**
   - Visit https://render.com
   - Sign up/Login with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Click "Connect account" if needed
   - Select repository: `niclorusso/eulens`

3. **Configure Service**
   - **Name**: `eulens-api` (or any name)
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave blank (root of repo)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`

4. **Set Environment Variables**
   Click "Add Environment Variable" and add:

   ```
   DATABASE_URL = [paste-your-supabase-connection-string]
   NODE_ENV = production
   PORT = 10000
   GEMINI_API_KEY = [your-gemini-api-key]
   ```

   **To get GEMINI_API_KEY:**
   - Go to https://makersuite.google.com/app/apikey
   - Sign in with Google
   - Click "Create API Key"
   - Copy the key

5. **Create Service**
   - Click "Create Web Service"
   - Render will start building (takes ~3-5 minutes)
   - You'll get a URL like: `https://eulens-api.onrender.com`

## Step 3: Update Netlify API Redirects

1. **Get Your Backend URL**
   - From Render dashboard, copy your service URL
   - Example: `https://eulens-api.onrender.com`

2. **Update netlify.toml**
   - Edit `netlify.toml` in your repo
   - Uncomment and update the redirect:

   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://eulens-api.onrender.com/api/:splat"
     status = 200
     force = true
   ```

3. **Commit and Push**
   ```bash
   git add netlify.toml
   git commit -m "Update API redirects to Render backend"
   git push origin main
   ```

4. **Netlify Auto-Deploys**
   - Netlify will automatically redeploy
   - Your frontend will now connect to the backend!

## Step 4: Test Everything

1. **Test Frontend**: Visit https://eulens.eu
2. **Test API**: Visit https://eulens.eu/api/stats/overview
3. **Test Chat**: Try "Chat with MEP" feature
4. **Check Backend Logs**: Render dashboard → Logs

## Troubleshooting

**Backend won't start?**
- Check Render logs for errors
- Verify DATABASE_URL is correct
- Make sure schema.sql was run in Supabase

**API calls failing?**
- Check CORS settings (should be `*` for now)
- Verify backend URL in netlify.toml
- Check browser console for errors

**Database connection errors?**
- Verify Supabase connection string
- Check Supabase project is active
- Make sure schema.sql was executed

**Chat not working?**
- Verify GEMINI_API_KEY is set in Render
- Check Render logs for API errors
- Test API key at https://makersuite.google.com/app/apikey

## Free Tier Limitations

⚠️ **Render Free Tier:**
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Consider upgrading to $7/month for no spin-down

## Next Steps

After deployment:
1. ✅ Test all features
2. ✅ Monitor Render logs
3. ✅ Set up database backups (Supabase has automatic backups)
4. ✅ Consider upgrading Render if traffic grows

---

**Your backend will be live at:** `https://your-service-name.onrender.com` 🚀
