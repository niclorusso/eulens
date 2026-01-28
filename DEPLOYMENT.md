# Deployment Guide - Agora EU

Deploy Agora EU to production on Vercel, Render, or your own server.

## Option 1: Deploy on Vercel + Render (Recommended)

### Frontend: Vercel

1. **Push to GitHub**
```bash
git remote add origin https://github.com/YOUR_USERNAME/agora-eu.git
git push -u origin main
```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Click "Import Project"
   - Select your GitHub repo
   - Set root directory to `client/`
   - Deploy

3. **Set environment variables in Vercel**
   - Add `VITE_API_URL=https://your-api-domain.com`

### Backend: Render

1. **Create GitHub repo for backend** (or use monorepo)

2. **On Render.com**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo
   - **Runtime**: Node
   - **Build**: `npm install`
   - **Start**: `node server/index.js`
   - **Environment Variables**:
     ```
     DATABASE_URL=postgres://[user]:[password]@[host]:5432/agora_eu
     NODE_ENV=production
     PORT=10000
     ```

3. **Database: Render Postgres**
   - Create a PostgreSQL database on Render
   - Connect to it from your backend
   - Run migrations:
     ```bash
     psql [DATABASE_URL] < server/schema.sql
     ```

## Option 2: Self-Hosted (Docker)

### Create Docker setup

**Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server/ ./server/
COPY client/ ./client/

WORKDIR /app/client
RUN npm install && npm run build

WORKDIR /app

EXPOSE 5000

CMD ["node", "server/index.js"]
```

**docker-compose.yml**
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: agora_eu
      POSTGRES_PASSWORD: your_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

  app:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:your_password_here@db:5432/agora_eu
      NODE_ENV: production
      PORT: 5000
    ports:
      - "5000:5000"
    depends_on:
      - db

volumes:
  postgres_data:
```

**Deploy:**
```bash
docker-compose up -d
```

## Option 3: Traditional Linux Server

### Prerequisites
- Ubuntu 20.04+ server
- SSH access
- Domain name (optional)

### Setup

1. **Install Node.js and PostgreSQL**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql postgresql-contrib
```

2. **Create database**
```bash
sudo -u postgres psql -c "CREATE DATABASE agora_eu;"
psql -U postgres -d agora_eu < server/schema.sql
```

3. **Clone and install**
```bash
git clone https://github.com/YOUR_USERNAME/agora-eu.git
cd agora-eu
npm install
cd client && npm install && cd ..
npm run build
```

4. **Setup with PM2 (process manager)**
```bash
npm install -g pm2
pm2 start server/index.js --name "agora-eu"
pm2 startup
pm2 save
```

5. **Reverse proxy with Nginx**
```bash
sudo apt-get install nginx

# /etc/nginx/sites-available/agora-eu
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /home/user/agora-eu/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

6. **SSL with Certbot**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Environment Variables for Production

```
DATABASE_URL=postgres://[user]:[password]@[host]/agora_eu
NODE_ENV=production
PORT=5000
VITE_API_URL=https://api.yourdomain.com
```

## Monitoring & Logs

### On Render/Vercel
- Built-in log viewing in dashboard

### On self-hosted
```bash
# View logs
pm2 logs agora-eu

# Monitor
pm2 monit

# Restart
pm2 restart agora-eu
```

## Database Backups

### Render
- Automatic daily backups included

### PostgreSQL manual backup
```bash
pg_dump agora_eu > backup.sql
# Restore:
psql agora_eu < backup.sql
```

## Performance Tips

1. **Enable database indexing** (already in schema.sql)
2. **Cache API responses** - Add Redis caching
3. **CDN for static assets** - Use Cloudflare
4. **Database connection pooling** - Use PgBouncer
5. **Monitor with DataDog or New Relic**

## CI/CD Pipeline

### GitHub Actions Example

**.github/workflows/deploy.yml**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install && npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Scaling Considerations

- **More traffic?** Add database read replicas
- **Real-time updates?** Add WebSockets with Socket.io
- **Need caching?** Integrate Redis
- **API rate limiting?** Use express-rate-limit middleware
- **Search performance?** Add Elasticsearch

---

Ready to deploy? Start with Vercel + Render - it's the fastest route to production!
