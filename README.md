# Agora EU - European Democracy Platform

A digital platform for EU representation and unity. Track, analyze, and discuss current European legislative decisions across all 27 member states.

## Vision

Agora EU transforms the EU's legislative process from opaque to transparent, empowering European citizens to:

- **See what's being decided** - Track real EU Parliament votes and legislation
- **Understand the impact** - See how decisions affect each country differently
- **Deliberate together** - Discuss issues across borders, in your language
- **Find common ground** - Visualize where Europe actually agrees
- **Hold leaders accountable** - Track how MEPs vote and what citizens think

## Features

### 1. EU Issue Tracking
- Real-time tracking of EU Parliament votes and legislation
- Categorized by policy area (Digital, Environment, Economy, etc.)
- Voting status and adoption tracking
- Direct links to official EU sources

### 2. Cross-Border Deliberation
- Discuss issues with other Europeans
- Filter perspectives by country
- Anonymous, respectful discourse
- Built-in machine translation (planned)

### 3. Voting Analytics
- Visual breakdown of how each country voted
- Interactive charts and heatmaps
- "Where Europe Agrees" consensus finder
- Country-by-country voting patterns

### 4. MEP Accountability Dashboard (Coming Soon)
- Track individual MEP voting records
- Direct constituent feedback
- Performance metrics by country/political group

## Tech Stack

**Frontend:**
- React 18
- Vite
- Recharts (visualizations)
- React Router (navigation)

**Backend:**
- Node.js + Express
- PostgreSQL
- Axios (HTTP client)

**Data:**
- EU Parliament public API
- Custom scraper for vote data

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/nicolalorusso/agora-eu.git
cd agora-eu
```

2. **Set up database**
```bash
createdb agora_eu
psql agora_eu < server/schema.sql
```

3. **Create environment file**
```bash
cp .env.example .env
# Edit .env with your database connection string
```

4. **Install dependencies**
```bash
npm install
cd client && npm install && cd ..
```

5. **Seed initial data**
```bash
npm run scrape
```

6. **Start development servers**
```bash
npm run dev
```

This starts:
- Backend API on http://localhost:5000
- Frontend on http://localhost:3000

## Project Structure

```
agora-eu/
├── server/
│   ├── index.js           # Express API server
│   └── schema.sql         # PostgreSQL schema
├── client/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.jsx
│   │   └── index.css
│   └── vite.config.js
├── scripts/
│   └── scrapeEUParliament.js  # Data scraper
└── README.md
```

## API Endpoints

### Bills
- `GET /api/bills` - List all bills/issues
- `GET /api/bills/:id` - Get bill details with voting breakdown

### Discussions
- `POST /api/discussions` - Create new discussion
- `GET /api/bills/:id/discussions` - Get discussions for a bill

### Voting Analysis
- `GET /api/consensus` - Get issues with highest cross-border consensus
- `GET /api/votes/:billId` - Get detailed voting breakdown

## Data Sources

- **EU Parliament**: Official voting data (libre.europa.eu API)
- **EU Legislation**: Consolidated legislative data
- **Member States**: Country-specific voting patterns

## Contributing

We welcome contributions! Areas to work on:

- [ ] Machine translation for discussions
- [ ] MEP accountability dashboard
- [ ] Advanced filtering and search
- [ ] Mobile optimization
- [ ] Sentiment analysis on discussions
- [ ] Export/visualization tools
- [ ] Integration with official EU APIs

## Future Roadmap

**Phase 2 (MVP+):**
- User authentication with EU citizen verification
- Real MEP voting data integration
- Full discussion threading
- Email notifications
- Advanced search and filtering

**Phase 3:**
- Mobile app
- Sentiment analysis
- ML-based issue recommendations
- Integration with official EU platforms
- Media partnerships

**Phase 4:**
- Direct MEP feedback system
- Constituent case management
- Policy impact calculator
- European citizen surveys

## Philosophy

Agora EU is built on these principles:

1. **Transparency** - All data is public and sourced ethically
2. **Inclusivity** - Available in all EU languages
3. **Non-partisan** - No political bias in data presentation
4. **Open Source** - Code is transparent and community-driven
5. **Privacy-first** - No surveillance, minimal data collection

## License

MIT License - See LICENSE file

## Contact

Questions? Ideas? Want to contribute?

- 📧 Email: nicola@nicolalorusso.ch
- 🐦 Twitter: @nicolalorusso
- 💬 GitHub Issues: Report bugs and suggest features

---

**Building European democracy, one interface at a time.**
