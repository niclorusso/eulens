# EULens - See European Democracy Clearly

A digital platform for EU representation and transparency. Track, analyze, and understand European Parliament voting patterns across all 27 member states.

## Vision

Agora EU transforms the EU's legislative process from opaque to transparent, empowering European citizens to:

- **See what's being decided** - Track real EU Parliament votes and legislation
- **Understand the impact** - See how decisions affect each country differently
- **Deliberate together** - Discuss issues across borders, in your language
- **Find common ground** - Visualize where Europe actually agrees
- **Hold leaders accountable** - Track how MEPs vote and what citizens think

## Features

### 1. Voting Transparency
- Real-time tracking of EU Parliament votes and legislation
- Categorized by policy area (Digital, Environment, Economy, etc.)
- Detailed bill summaries with AI-generated explanations
- Direct links to official EU sources

### 2. MEP Profiles & Analytics
- Individual MEP voting records and statistics
- Voting patterns by political group and country
- Similar MEP finder based on voting agreement
- PCA (Principal Component Analysis) visualization of voting patterns

### 3. Political Compass
- Interactive 2D and 3D PCA maps showing MEP voting positions
- Group-level visualizations with standard deviation
- Axis interpretation with top influencing bills
- Color-coded by political groups

### 4. Voting Advice Application (VAA)
- Answer questions based on real EU Parliament votes
- Find your MEP match based on voting alignment
- Filter matches by country
- Questions ordered by political significance (PCA loadings)

### 5. Chat with MEP
- AI-powered conversations with MEP personas
- Each political group represented by an average position
- Ask about voting decisions and political stances
- Interactive chat interface

### 6. Statistics & Analytics
- Legislative statistics by policy area
- Country-level voting breakdowns
- Group-level voting patterns
- Agreement matrices between parties

## Tech Stack

**Frontend:**
- React 18
- Vite
- Recharts (visualizations)
- React Router (navigation)

**Backend:**
- Node.js + Express
- PostgreSQL
- Google Gemini AI (for bill summaries and chat)

**Frontend:**
- React 18
- Vite
- Recharts (visualizations)
- React Router (navigation)
- Plotly.js (3D PCA visualizations)

**Data:**
- HowTheyVote.eu API
- Custom scraper for EU Parliament votes
- 10th legislature data (July 2024 onwards)

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
# Edit .env with your database connection string and API keys
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `GEMINI_API_KEY`: Google Gemini API key (for AI features)

4. **Install dependencies**
```bash
npm install
cd client && npm install && cd ..
```

5. **Seed initial data**
```bash
npm run scrape
```

6. **Generate bill summaries and VAA questions** (optional, for AI features)
```bash
npm run migrate:summaries
npm run summarize
npm run generate-vaa
npm run order-vaa
```

7. **Start development servers**
```bash
npm run dev
```

This starts:
- Backend API on http://localhost:5001
- Frontend on http://localhost:5173 (Vite default)

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

- **HowTheyVote.eu**: EU Parliament voting data API
- **EU Parliament**: Official legislative data
- **10th Legislature**: Data from July 2024 onwards

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
