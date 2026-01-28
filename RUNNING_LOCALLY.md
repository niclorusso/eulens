# Running Agora EU Locally

Everything is now set up and ready to run! Here's how to start the application.

## ✅ What's Already Done

- ✅ Project created at `/Users/nicolalorusso/Locale/agora-eu/`
- ✅ All dependencies installed (`npm install`)
- ✅ PostgreSQL database created and running in Docker
- ✅ Sample data seeded (3 EU legislative issues with voting data)
- ✅ Backend and frontend code ready
- ✅ Environment variables configured

## 🚀 Start the Application

### Option 1: Manual Start (Recommended for Development)

Open two terminal tabs:

**Terminal 1 - Backend Server:**
```bash
cd /Users/nicolalorusso/Locale/agora-eu
node server/index.js
```

You should see:
```
Agora EU backend running on port 5001
```

**Terminal 2 - Frontend Server:**
```bash
cd /Users/nicolalorusso/Locale/agora-eu/client
npm run dev
```

You should see:
```
VITE v5.4.21 ready in XXX ms

  ➜  Local:   http://localhost:3000/
```

### Option 2: Single Command

If you want both servers in one terminal:
```bash
cd /Users/nicolalorusso/Locale/agora-eu
npm run dev
```

This runs both servers simultaneously using `concurrently`.

## 🌐 Access the Application

Once both servers are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **Health Check**: http://localhost:5001/api/health

## 🧪 Test the Application

### 1. Visit the Home Page
```
http://localhost:3000
```

You should see:
- "Agora EU" header with navigation
- 3 EU legislative issues listed
- Filter buttons (Digital, Environment, Technology)
- Each issue card shows title, description, status

### 2. Click on an Issue
Click "Digital Services Act - Implementation"

You should see:
- Full issue details
- Status and category badges
- Voting breakdown:
  - Pie chart (Yes/No/Abstain)
  - Bar chart (by country)
- Discussion section
- Form to add your perspective

### 3. Add a Discussion
- Select your country from dropdown
- Write a title and content
- Click "Share Perspective"
- See your discussion appear below

### 4. Check Consensus Page
- Click "Where Europe Agrees" in header
- See issues ranked by cross-country consensus
- Visualize agreement percentages

### 5. Test the API
```bash
# Get all bills
curl http://localhost:5001/api/bills

# Get specific bill
curl http://localhost:5001/api/bills/1

# Get consensus data
curl http://localhost:5001/api/consensus

# Check health
curl http://localhost:5001/api/health
```

## 🗄️ Database Status

PostgreSQL is running in Docker:
```bash
# Check if container is running
docker-compose ps

# View logs
docker-compose logs postgres

# Connect to database (if psql is installed)
psql postgres://agora_user:agora_password@localhost:5432/agora_eu
```

## 📊 Sample Data Included

Three EU legislative issues with:
- ✅ Bill information (title, description, category)
- ✅ Voting records (Yes/No/Abstain from 5 countries)
- ✅ Sample discussions

Issues:
1. **Digital Services Act** - Category: Digital
2. **Green Deal Carbon Neutrality 2050** - Category: Environment
3. **AI Act Regulatory Framework** - Category: Technology

## 🛑 Stop the Application

### If running in separate terminals:
- Backend: Press `Ctrl+C` in terminal 1
- Frontend: Press `Ctrl+C` in terminal 2

### If running with `npm run dev`:
Press `Ctrl+C` to stop both

### Stop database:
```bash
docker-compose down
```

This keeps the data. To also remove data:
```bash
docker-compose down -v
```

## 🔄 Restart Everything

If you need to restart:

```bash
# Stop everything
pkill -f "node server" || true
pkill -f "vite" || true
docker-compose down

# Start again
docker-compose up -d
npm run dev
```

## 🐛 Troubleshooting

**Frontend won't load (http://localhost:3000 blank)**
- Check browser console (F12) for errors
- Make sure backend is running
- Try clearing browser cache (Ctrl+Shift+Delete)

**API returning 500 errors**
- Check backend logs (Terminal 1)
- Verify database is running: `docker-compose ps`
- Check DATABASE_URL in `.env` file

**Port 3000 or 5001 already in use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5001
lsof -ti:5001 | xargs kill -9
```

**Database won't start**
```bash
# Check Docker is running
docker ps

# Restart Docker container
docker-compose restart postgres
```

**Module not found errors**
```bash
# Reinstall dependencies
rm -rf node_modules client/node_modules
npm install && cd client && npm install && cd ..
```

## 📝 Next Steps

1. **Explore the code**:
   - Frontend: `client/src/components/`
   - Backend: `server/index.js`
   - Database: `server/schema.sql`

2. **Customize it**:
   - Change colors in `client/src/index.css`
   - Add more sample data
   - Modify API endpoints

3. **Deploy it**:
   - See DEPLOYMENT.md for production setup
   - Deploy frontend to Vercel
   - Deploy backend to Render or Railway

4. **Add real data**:
   - Integrate EU Parliament API
   - Fetch real voting records
   - Add live legislation tracking

## 🎉 You're All Set!

Agora EU is running locally. Everything works end-to-end:
- React frontend ✅
- Express backend ✅
- PostgreSQL database ✅
- Sample data ✅
- Interactive visualizations ✅

Happy coding! 🇪🇺
