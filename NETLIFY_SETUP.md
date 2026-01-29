# Netlify Deployment Guide for EULens

## Step-by-Step Setup

### 1. Prepare Your Repository
✅ Your code is already on GitHub at `niclorusso/eulens`

### 2. Deploy to Netlify

1. **Go to Netlify**
   - Visit https://app.netlify.com
   - Sign up/Login with GitHub

2. **Import Your Site**
   - Click "Add new site" → "Import an existing project"
   - Choose "Deploy with GitHub"
   - Authorize Netlify to access your GitHub
   - Select repository: `niclorusso/eulens`

3. **Configure Build Settings**
   - **Base directory**: `client`
   - **Build command**: `npm install && npm run build`
   - **Publish directory**: `client/dist`
   - Click "Deploy site"

4. **Wait for Build**
   - Netlify will install dependencies and build
   - First build takes ~2-3 minutes
   - You'll get a URL like: `https://random-name-123.netlify.app`

### 3. Add Custom Domain (eulens.eu)

1. **In Netlify Dashboard**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter: `eulens.eu`
   - Click "Verify"

2. **Configure DNS at Your Registrar**
   - Go to your domain registrar (where you bought eulens.eu)
   - Add DNS record:
     ```
     Type: CNAME
     Name: @ (or root/apex)
     Value: [your-site-name].netlify.app
     TTL: 3600
     ```
   - OR if CNAME not supported for root domain:
     ```
     Type: A
     Name: @
     Value: 75.2.60.5
     TTL: 3600
     ```
   - Also add www:
     ```
     Type: CNAME
     Name: www
     Value: [your-site-name].netlify.app
     TTL: 3600
     ```

3. **Wait for DNS Propagation**
   - Usually 5-30 minutes
   - Can take up to 48 hours
   - Netlify will automatically provision SSL (Let's Encrypt)

### 4. Set Environment Variables (if needed)

If you need to set `VITE_API_URL`:
- Go to Site settings → Environment variables
- Add: `VITE_API_URL` = `https://your-backend-url.onrender.com`
- Redeploy site

### 5. Update API Redirects (After Backend is Deployed)

Once your backend is deployed (Render/Railway), update `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.onrender.com/api/:splat"
  status = 200
  force = true
```

Then commit and push - Netlify will auto-deploy.

## Troubleshooting

**Build fails?**
- Check build logs in Netlify dashboard
- Make sure `client/package.json` has all dependencies
- Verify Node version (should be 18+)

**Domain not working?**
- Check DNS records are correct
- Wait longer for propagation
- Use https://dnschecker.org to check globally

**API calls failing?**
- Make sure backend is deployed first
- Update redirects in `netlify.toml`
- Check CORS settings on backend

## Next Steps

After frontend is deployed:
1. Deploy backend to Render/Railway
2. Set up database (Supabase/Neon)
3. Update API redirects in Netlify
4. Test everything!

---

**Your site will be live at:** `https://eulens.eu` 🎉
