import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import VAAUserPCA from '../VAAUserPCA';
import './VAA.css';

const EU_COUNTRIES = {
  'AT': 'Austria', 'BE': 'Belgium', 'BG': 'Bulgaria', 'HR': 'Croatia',
  'CY': 'Cyprus', 'CZ': 'Czechia', 'DK': 'Denmark', 'EE': 'Estonia',
  'FI': 'Finland', 'FR': 'France', 'DE': 'Germany', 'GR': 'Greece',
  'HU': 'Hungary', 'IE': 'Ireland', 'IT': 'Italy', 'LV': 'Latvia',
  'LT': 'Lithuania', 'LU': 'Luxembourg', 'MT': 'Malta', 'NL': 'Netherlands',
  'PL': 'Poland', 'PT': 'Portugal', 'RO': 'Romania', 'SK': 'Slovakia',
  'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden'
};

// Short names for political groups
const GROUP_SHORT_NAMES = {
  'The Left group in the European Parliament - GUE/NGL': 'GUE/NGL',
  'Group of the Greens/European Free Alliance': 'Greens/EFA',
  'Group of the Progressive Alliance of Socialists and Democrats in the European Parliament': 'S&D',
  'Renew Europe Group': 'Renew',
  'Group of the European People\'s Party (Christian Democrats)': 'EPP',
  'European Conservatives and Reformists Group': 'ECR',
  'Patriots for Europe Group': 'PfE',
  'Europe of Sovereign Nations Group': 'ESN',
  'Identity and Democracy': 'ID',
  'Identity and Democracy Group': 'ID',
  'Non-attached Members': 'NI'
};

function getShortName(name) {
  if (!name) return 'NI';
  if (GROUP_SHORT_NAMES[name]) return GROUP_SHORT_NAMES[name];
  const lower = name.toLowerCase();
  if (lower.includes('left') || lower.includes('gue')) return 'GUE/NGL';
  if (lower.includes('green')) return 'Greens/EFA';
  if (lower.includes('socialist') || lower.includes('s&d')) return 'S&D';
  if (lower.includes('renew')) return 'Renew';
  if (lower.includes('people') || lower.includes('epp')) return 'EPP';
  if (lower.includes('conservative') || lower.includes('ecr')) return 'ECR';
  if (lower.includes('patriot')) return 'PfE';
  if (lower.includes('sovereign') || lower.includes('esn')) return 'ESN';
  if (lower.includes('identity') && lower.includes('democracy')) return 'ID';
  return 'NI';
}

export default function VAA() {
  const [stage, setStage] = useState('intro'); // intro, quiz, results
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [responses, setResponses] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(''); // Empty = all countries

  useEffect(() => {
    fetchQuestions();
  }, []);

  async function fetchQuestions() {
    try {
      const res = await axios.get('/api/vaa/questions');
      setQuestions(res.data);
    } catch (error) {
      console.error('Error fetching VAA questions:', error);
    }
  }

  function startQuiz() {
    if (questions.length === 0) {
      alert('No questions available. Please check back later.');
      return;
    }
    setStage('quiz');
    setCurrentQuestion(0);
    setResponses([]);
  }

  function handleAnswer(answer, importance = 1) {
    const question = questions[currentQuestion];
    const newResponses = [...responses, {
      questionId: question.id,
      billId: question.bill_id,
      answer,
      importance
    }];
    setResponses(newResponses);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitResponses(newResponses);
    }
  }

  async function submitResponses(finalResponses) {
    try {
      setLoading(true);
      const res = await axios.post('/api/vaa/submit', { 
        responses: finalResponses,
        countryCode: selectedCountry || null
      });
      setResults(res.data);
      setStage('results');
    } catch (error) {
      console.error('Error submitting VAA:', error);
      alert('Failed to calculate results. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStage('intro');
    setCurrentQuestion(0);
    setResponses([]);
    setResults(null);
    // Keep selectedCountry so user doesn't have to reselect
  }

  // Intro screen
  if (stage === 'intro') {
    return (
      <main className="container">
        <div className="vaa-intro card">
          <h1>Find Your Political Match</h1>
          <p className="intro-description">
            Answer questions about key EU Parliament votes and discover which MEPs
            and political groups align with your views.
          </p>

          <div className="intro-info">
            <div className="info-item">
              <span className="info-number">{questions.length}</span>
              <span className="info-label">Questions</span>
            </div>
            <div className="info-item">
              <span className="info-number">~5</span>
              <span className="info-label">Minutes</span>
            </div>
            <div className="info-item">
              <span className="info-number">720+</span>
              <span className="info-label">MEPs Compared</span>
            </div>
          </div>

          <div className="country-selector">
            <label htmlFor="country-select">Filter by country (optional):</label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="country-select"
            >
              <option value="">All EU Countries</option>
              {Object.entries(EU_COUNTRIES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            {selectedCountry && (
              <p className="country-hint">
                Results will show only MEPs from {EU_COUNTRIES[selectedCountry]}
              </p>
            )}
          </div>

          <button
            className="btn-primary btn-large"
            onClick={startQuiz}
            disabled={questions.length === 0}
          >
            {questions.length > 0 ? 'Start Quiz' : 'Loading Questions...'}
          </button>

          <div className="intro-note">
            <p>
              <strong>How it works:</strong> We'll show you simplified versions of real
              EU Parliament votes. Your answers are compared to how MEPs actually voted
              to calculate your match percentage.
            </p>
            <p>
              Your responses are anonymous and not stored with any personal information.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Quiz screen
  if (stage === 'quiz') {
    if (loading) {
      return (
        <main className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Calculating your matches...</p>
          </div>
        </main>
      );
    }

    const question = questions[currentQuestion];
    const progress = ((currentQuestion) / questions.length) * 100;

    return (
      <main className="container">
        <div className="vaa-quiz">
          {/* Progress bar */}
          <div className="quiz-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-text">
              Question {currentQuestion + 1} of {questions.length}
            </span>
          </div>

          {/* Question card */}
          <div className="question-card card">
            <span className="question-category">{question.category || 'General'}</span>
            <h2 className="question-text">{question.question_text}</h2>
            <p className="question-context">
              Based on: <em>{question.bill_title}</em>
            </p>

            {/* Answer buttons */}
            <div className="answer-buttons">
              <button
                className="answer-btn agree"
                onClick={() => handleAnswer('agree')}
              >
                Agree
              </button>
              <button
                className="answer-btn neutral"
                onClick={() => handleAnswer('neutral')}
              >
                Neutral
              </button>
              <button
                className="answer-btn disagree"
                onClick={() => handleAnswer('disagree')}
              >
                Disagree
              </button>
            </div>

            <button
              className="skip-btn"
              onClick={() => handleAnswer('skip')}
            >
              Skip this question
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Results screen
  if (stage === 'results' && results) {
    return (
      <main className="container">
        <div className="vaa-results">
          <header className="results-header">
            <h1>Your Results</h1>
            <p>
              Based on comparing your answers to {results.totalMepsCompared} MEPs
              {results.countryFilter && ` from ${EU_COUNTRIES[results.countryFilter] || results.countryFilter}`}
            </p>
          </header>

          {/* Party matches */}
          <section className="results-section card">
            <h2>Political Group Alignment</h2>
            <div className="party-matches">
              {results.partyMatches.slice(0, 8).map((party, idx) => (
                <div key={party.group} className="party-match-item">
                  <div className="party-info">
                    <span className="party-rank">#{idx + 1}</span>
                    <span className="party-name">{getShortName(party.group)}</span>
                  </div>
                  <div className="match-bar-container">
                    <div className="match-bar">
                      <div
                        className="match-fill"
                        style={{ width: `${party.match_percent}%` }}
                      ></div>
                    </div>
                    <span className="match-percent">{party.match_percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Top MEP matches */}
          <section className="results-section card">
            <h2>Top MEP Matches</h2>
            <div className="mep-matches">
              {results.topMatches.map((mep, idx) => (
                <Link
                  key={mep.mep_id}
                  to={`/meps/${mep.mep_id}`}
                  className="mep-match-item"
                >
                  <span className="mep-rank">#{idx + 1}</span>
                  <div className="mep-info">
                    <span className="mep-name">{mep.mep_name}</span>
                    <span className="mep-group">{getShortName(mep.mep_group)}</span>
                  </div>
                  <span className="mep-match">{mep.match_percent}%</span>
                </Link>
              ))}
            </div>
          </section>

          {/* User PCA Position */}
          {results.userPCA && (
            <section className="results-section card">
              <VAAUserPCA userPCA={results.userPCA} />
            </section>
          )}

          {/* Country Filter Info */}
          {results.countryFilter && (
            <div className="country-filter-info card">
              <p>
                <strong>Filtered:</strong> Showing only MEPs from{' '}
                <span className="country-badge">{EU_COUNTRIES[results.countryFilter] || results.countryFilter}</span>
              </p>
              <p className="filter-hint">
                To see matches from all countries, restart the quiz and select "All EU Countries"
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="results-actions">
            <button className="btn-secondary" onClick={restart}>
              Take Quiz Again
            </button>
            <Link to="/" className="btn-primary">
              Explore Issues
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
