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
  procedure_type VARCHAR(50),
  texts_adopted_ref VARCHAR(255),
  ep_procedure_url VARCHAR(500),
  ep_text_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Countries in the EU
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  population INTEGER
);

-- All MEPs (Members of European Parliament)
CREATE TABLE meps (
  id SERIAL PRIMARY KEY,
  mep_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  country_code VARCHAR(10),
  political_group VARCHAR(255),
  date_of_birth DATE,
  email VARCHAR(255),
  facebook VARCHAR(500),
  twitter VARCHAR(500),
  photo_url VARCHAR(500),
  gender VARCHAR(10), -- 'male', 'female', or NULL
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  country_code VARCHAR(10),
  interests TEXT[], -- array of categories
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vote political axis tagging (for political compass)
CREATE TABLE vote_axes (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  axis VARCHAR(50) NOT NULL, -- 'economic', 'eu_integration', 'environment', 'social'
  direction INTEGER NOT NULL, -- +1 (yes = right/conservative), -1 (yes = left/progressive)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bill_id, axis)
);

-- Bill summaries (AI-generated easy-language explanations)
CREATE TABLE bill_summaries (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id) UNIQUE,
  summary_short TEXT,           -- 1-2 sentence plain language summary
  summary_long TEXT,            -- Detailed explanation
  reasons_yes TEXT,             -- Why someone might vote YES
  reasons_no TEXT,              -- Why someone might vote NO
  key_points TEXT[],            -- Array of bullet points
  vaa_question TEXT,            -- Suggested question for VAA
  political_tags TEXT[],        -- Tags like 'environment', 'trade', 'rights'
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  model_version VARCHAR(100)    -- Track which AI model generated this
);

-- VAA Questions (for voting advice application)
CREATE TABLE vaa_questions (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  question_text TEXT NOT NULL,
  category VARCHAR(100),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VAA User Responses
CREATE TABLE vaa_responses (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  question_id INTEGER REFERENCES vaa_questions(id),
  response VARCHAR(20), -- 'agree', 'disagree', 'neutral', 'skip'
  importance INTEGER DEFAULT 1, -- 1-3 weighting
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System metadata (for tracking updates, stats)
CREATE TABLE metadata (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_votes_bill ON votes(bill_id);
CREATE INDEX idx_votes_country ON votes(country_id);
CREATE INDEX idx_discussions_bill ON discussions(bill_id);
CREATE INDEX idx_discussions_country ON discussions(country_id);
CREATE INDEX idx_comments_discussion ON comments(discussion_id);
CREATE INDEX idx_meps_country ON meps(country_code);
CREATE INDEX idx_meps_group ON meps(political_group);
CREATE INDEX idx_meps_mep_id ON meps(mep_id);
CREATE INDEX idx_votes_mep ON votes(mep_id);
CREATE INDEX idx_vote_axes_bill ON vote_axes(bill_id);
CREATE INDEX idx_vote_axes_axis ON vote_axes(axis);
CREATE INDEX idx_vaa_questions_bill ON vaa_questions(bill_id);
CREATE INDEX idx_vaa_responses_session ON vaa_responses(session_id);
CREATE INDEX idx_bill_summaries_bill ON bill_summaries(bill_id);