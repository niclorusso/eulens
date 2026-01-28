# Agora EU - Architecture & Design

Overview of the system architecture, data flow, and key design decisions.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     AGORA EU PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐          ┌──────────────────────┐     │
│  │   React App      │          │   Express API        │     │
│  │  (Vite)          │◄────────►│   (Node.js)          │     │
│  │  :3000           │ HTTP     │   :5000              │     │
│  └──────────────────┘          └──────────────────────┘     │
│         ▲                                 ▲                   │
│         │                                 │                   │
│      Users                        ┌───────▼─────────┐       │
│                                   │  PostgreSQL DB  │       │
│                                   │  (bills, votes, │       │
│                                   │   discussions)  │       │
│                                   └─────────────────┘       │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │          EU Parliament Data Sources                │    │
│  │  - Official APIs (libre.europa.eu)                │    │
│  │  - Scraper for vote records                        │    │
│  │  - Legislative databases                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Data Ingestion
```
EU Parliament APIs
        │
        ▼
Scraper (Node.js)
        │
        ▼
Transform & Validate
        │
        ▼
PostgreSQL Database
```

### 2. User Interaction
```
User Action (Click bill)
        │
        ▼
React Component
        │
        ▼
API Request (Axios)
        │
        ▼
Express Route Handler
        │
        ▼
Database Query
        │
        ▼
JSON Response
        │
        ▼
Component Re-render
        │
        ▼
Updated UI
```

### 3. Discussion Flow
```
User writes discussion
        │
        ▼
Form submission
        │
        ▼
POST /api/discussions
        │
        ▼
Validate input
        │
        ▼
Insert to DB
        │
        ▼
Return new discussion
        │
        ▼
Add to UI optimistically
        │
        ▼
Fetch fresh data
```

## Database Schema

### Core Tables

**bills**
```sql
id (PK)
eu_id (unique EU identifier)
title
description
category (Digital, Environment, etc.)
status (voting, adopted, pending)
date_adopted
procedure_id (link to official EU procedure)
created_at
```

**countries**
```sql
id (PK)
code (2-letter ISO, e.g., 'DE')
name
population
```

**votes**
```sql
id (PK)
bill_id (FK → bills)
country_id (FK → countries)
mep_id (EU Parliament member ID)
mep_name
mep_group (EPP, S&D, GREENS, etc.)
vote (yes/no/abstain)
created_at
```

**discussions**
```sql
id (PK)
bill_id (FK → bills)
country_id (FK → countries)
title
content
author_id (anonymous user ID)
upvotes
created_at
updated_at
```

**comments** (future)
```sql
id (PK)
discussion_id (FK → discussions)
country_id (FK → countries)
author_id
content
upvotes
created_at
```

**user_preferences**
```sql
id (PK)
user_id (unique, privacy-first)
country_code
interests (array of categories)
created_at
```

## API Architecture

### RESTful Endpoints

```
GET  /api/bills                    # List all bills
GET  /api/bills/:id                # Single bill + voting breakdown
POST /api/bills                    # Create bill (admin only)

GET  /api/discussions              # List discussions
POST /api/discussions              # Create discussion
GET  /api/bills/:id/discussions    # Discussions for bill

GET  /api/votes/:billId            # Voting breakdown
GET  /api/consensus                # Where Europe agrees
GET  /api/countries                # All EU countries
GET  /api/meps/:mepId              # MEP details (future)

GET  /api/health                   # Health check
```

### Response Format

```json
{
  "success": true,
  "data": {...},
  "timestamp": "2024-01-28T12:00:00Z"
}
```

Error format:
```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE"
}
```

## Frontend Architecture

### Component Hierarchy

```
App
├── Header
│   ├── Logo
│   └── Navigation
├── Routes
│   ├── BillsList
│   │   └── BillCard (x many)
│   ├── BillDetail
│   │   ├── VotingBreakdown
│   │   ├── Charts
│   │   │   ├── PieChart
│   │   │   └── BarChart
│   │   └── DiscussionSection
│   │       ├── DiscussionForm
│   │       └── DiscussionList
│   │           └── DiscussionItem
│   └── Consensus
│       └── ConsensusCard (x many)
└── Footer (future)
```

### State Management

Currently using React hooks (useState, useEffect).

Future: Consider Context API or Redux for:
- User preferences
- Auth state
- UI theme
- Notifications

### Styling Approach

- CSS Modules (future migration)
- Currently: Global CSS + component-scoped classes
- Design tokens in `client/src/index.css`
- Responsive with media queries

## Key Design Decisions

### 1. Privacy-First
- No tracking or analytics
- Anonymous discussions with country-level identification
- No personal data collection
- No cookies for user identification

### 2. Transparency
- All data sourced from public EU APIs
- Code is open source
- No hidden algorithms or ranking systems
- Show data sources and timestamps

### 3. Inclusivity
- Multi-language support (future)
- Accessible design (WCAG 2.1 AA target)
- Works on desktop and mobile
- No paywalls or premium features

### 4. Simplicity
- Minimal feature set for MVP
- Clear, intuitive navigation
- Focus on core problem: EU representation
- Avoid over-engineering

## Performance Optimization

### Current
- Lazy loading of routes
- Image optimization
- CSS minification
- Database indexes on foreign keys

### Future
- Redis caching for frequently accessed data
- CDN for static assets
- Database query optimization
- React.memo for expensive components
- Code splitting by route

## Scalability Path

### Phase 1 (Current)
- Single app server
- Single database instance
- ~100K daily active users capacity

### Phase 2
- Load-balanced servers
- Database read replicas
- Caching layer (Redis)
- ~1M daily active users capacity

### Phase 3
- Microservices (discussions, voting, search)
- Search indexing (Elasticsearch)
- Real-time updates (WebSockets)
- ~10M daily active users capacity

## Security

### Current
- CORS enabled for development
- SQL injection prevention (parameterized queries)
- XSS protection (React escaping)
- Basic rate limiting (future)

### Future
- User authentication & authorization
- API key management
- Data encryption at rest
- HTTPS enforcement
- Security audits

## Monitoring & Observability

### Needed
- Application logs (Winston/Pino)
- Error tracking (Sentry)
- Performance monitoring (New Relic/DataDog)
- Uptime monitoring
- Database query performance

### Implemented
- Console logs in development
- Git logs for audit trail

## Deployment Architecture

```
Development
    │
    ├─► Local: npm run dev
    │
Git Push
    │
    ├─► CI/CD (GitHub Actions)
    │
    ├─► Tests (future)
    │   └─► Lint, unit, integration
    │
    ├─► Build
    │   ├─► React build (Vite)
    │   └─► Node artifact
    │
    └─► Deploy
        ├─► Frontend (Vercel)
        └─► Backend (Render/Railway)
```

## Future Enhancements

### Real-time Features
- WebSocket updates for new discussions
- Live vote counting
- Notifications

### Advanced Analytics
- ML-based issue recommendations
- Sentiment analysis on discussions
- Prediction models for voting outcomes

### Integration
- OAuth for sign-up
- MEP contact integration
- Email subscriptions
- Social media sharing

### Content
- Video explanations
- Bill impact reports
- Timeline visualizations
- Comparison tools

---

This architecture is designed to be simple, maintainable, and scalable. As usage grows, each layer can be optimized independently.
