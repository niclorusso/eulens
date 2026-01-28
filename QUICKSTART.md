# Quick Start Guide - Agora EU

Get Agora EU running locally in 5 minutes.

## Prerequisites

Make sure you have installed:
- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 12+ ([download](https://www.postgresql.org/download/))
- **Git** ([download](https://git-scm.com/))

## 1. Database Setup

Open your terminal and run:

```bash
# Create the database
createdb agora_eu

# Connect and create tables
psql agora_eu < server/schema.sql
```

You should see:
```
CREATE TABLE
CREATE TABLE
... (and more CREATE TABLE messages)
```

## 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

## 3. Create Environment File

```bash
cp .env.example .env
```

Verify `.env` contains:
```
DATABASE_URL=postgres://localhost/agora_eu
NODE_ENV=development
PORT=5000
```

## 4. Seed Sample Data

```bash
npm run scrape
```

This creates sample EU legislative data with voting records from different countries.

## 5. Start Development Servers

```bash
npm run dev
```

This starts both the backend and frontend:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

Open http://localhost:3000 in your browser.

## What You'll See

### Home Page - Issue List
- Browse EU legislative issues by category
- Filter by Digital, Environment, Technology, etc.
- Click any issue to see details

### Issue Detail Page
- Voting breakdown by country
- Interactive charts showing how Europe voted
- Discussion thread where people share perspectives
- Add your own perspective on the issue

### Consensus Page
- See which issues have the strongest cross-border agreement
- View percentage of countries in agreement
- Identify where European interests truly align

## API Endpoints

Test the backend directly:

```bash
# Get all bills
curl http://localhost:5000/api/bills

# Get specific bill details
curl http://localhost:5000/api/bills/1

# Get consensus data
curl http://localhost:5000/api/consensus

# Create a discussion
curl -X POST http://localhost:5000/api/discussions \
  -H "Content-Type: application/json" \
  -d '{
    "bill_id": 1,
    "country_code": "DE",
    "title": "Important perspective",
    "content": "This issue matters because...",
    "author_id": "user-123"
  }'
```

## Next Steps

1. **Explore the codebase**:
   - Frontend components in `client/src/components/`
   - Backend API in `server/index.js`
   - Database schema in `server/schema.sql`

2. **Add more data**:
   - Edit `scripts/scrapeEUParliament.js` to fetch real EU Parliament data
   - Or manually add bills to the database

3. **Customize**:
   - Change colors in `client/src/index.css`
   - Add more pages in `client/src/components/`
   - Extend the API with more endpoints

4. **Deploy**:
   - See DEPLOYMENT.md for production setup

## Troubleshooting

**"Port already in use"**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**"Database connection failed"**
```bash
# Check if PostgreSQL is running
psql -l

# If not running, start it:
# macOS: brew services start postgresql
# Linux: sudo service postgresql start
# Windows: Start PostgreSQL from Services
```

**"npm ERR! Cannot find module"**
```bash
# Clear node_modules and reinstall
rm -rf node_modules client/node_modules
npm install && cd client && npm install && cd ..
```

**Port 3000 or 5000 already in use?**

Edit `client/vite.config.js` and `server/index.js` to use different ports:

```bash
PORT=5001 npm run server:dev
# And in vite.config.js, change port: 3001
```

## Questions?

- Check the README.md for more detailed documentation
- Look at the code comments for explanations
- Open an issue on GitHub to report bugs

Happy coding! 🚀
