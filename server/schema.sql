-- EU Parliament Votes and Discussions Database

-- Bills/Proposals
CREATE TABLE bills (
  id SERIAL PRIMARY KEY,
  eu_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(50),
  date_adopted DATE,
  procedure_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Countries in the EU
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  population INTEGER
);

-- Country voting records
CREATE TABLE votes (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  country_id INTEGER REFERENCES countries(id),
  mep_id VARCHAR(255),
  mep_name VARCHAR(255),
  mep_group VARCHAR(100),
  vote VARCHAR(20), -- 'yes', 'no', 'abstain'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bill_id, mep_id)
);

-- Discussion threads
CREATE TABLE discussions (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  country_id INTEGER REFERENCES countries(id),
  title VARCHAR(300),
  content TEXT,
  author_id VARCHAR(255),
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments on discussions
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  discussion_id INTEGER REFERENCES discussions(id),
  country_id INTEGER REFERENCES countries(id),
  author_id VARCHAR(255),
  content TEXT,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences (minimal for privacy)
CREATE TABLE user_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  country_code VARCHAR(2),
  interests TEXT[], -- array of categories
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_votes_bill ON votes(bill_id);
CREATE INDEX idx_votes_country ON votes(country_id);
CREATE INDEX idx_discussions_bill ON discussions(bill_id);
CREATE INDEX idx_discussions_country ON discussions(country_id);
CREATE INDEX idx_comments_discussion ON comments(discussion_id);
