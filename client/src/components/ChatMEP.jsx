import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatMEP.css';

// Fictional MEP personas representing each political group
const MEP_PERSONAS = [
  {
    id: 'epp',
    name: 'Klaus Weber',
    group: 'EPP',
    fullGroup: 'European People\'s Party',
    country: 'Germany',
    photo: '👨‍💼',
    color: '#0056A0',
    description: 'Christian Democrat focused on economic stability and traditional values',
    positions: {
      economy: 'center-right',
      eu_integration: 'pro-EU',
      environment: 'moderate',
      social: 'conservative'
    }
  },
  {
    id: 'sd',
    name: 'Maria Santos',
    group: 'S&D',
    fullGroup: 'Progressive Alliance of Socialists and Democrats',
    country: 'Portugal',
    photo: '👩‍💼',
    color: '#E02027',
    description: 'Social democrat championing workers\' rights and social justice',
    positions: {
      economy: 'left',
      eu_integration: 'pro-EU',
      environment: 'progressive',
      social: 'progressive'
    }
  },
  {
    id: 'renew',
    name: 'Antoine Dupont',
    group: 'Renew',
    fullGroup: 'Renew Europe',
    country: 'France',
    photo: '👨‍💼',
    color: '#FFD700',
    description: 'Liberal centrist promoting innovation and free markets',
    positions: {
      economy: 'center',
      eu_integration: 'strongly pro-EU',
      environment: 'moderate',
      social: 'liberal'
    }
  },
  {
    id: 'greens',
    name: 'Emma Lindgren',
    group: 'Greens/EFA',
    fullGroup: 'Greens/European Free Alliance',
    country: 'Sweden',
    photo: '👩‍💼',
    color: '#009E47',
    description: 'Environmental activist fighting for climate action and social equality',
    positions: {
      economy: 'left',
      eu_integration: 'pro-EU',
      environment: 'strongly progressive',
      social: 'progressive'
    }
  },
  {
    id: 'ecr',
    name: 'Tomasz Kowalski',
    group: 'ECR',
    fullGroup: 'European Conservatives and Reformists',
    country: 'Poland',
    photo: '👨‍💼',
    color: '#5BC0DE',
    description: 'Conservative reformist prioritizing national sovereignty',
    positions: {
      economy: 'right',
      eu_integration: 'eurosceptic',
      environment: 'moderate',
      social: 'conservative'
    }
  },
  {
    id: 'left',
    name: 'Sofia Papadopoulos',
    group: 'The Left',
    fullGroup: 'The Left in the European Parliament',
    country: 'Greece',
    photo: '👩‍💼',
    color: '#8B0000',
    description: 'Democratic socialist advocating for radical change and equality',
    positions: {
      economy: 'far-left',
      eu_integration: 'critical',
      environment: 'progressive',
      social: 'progressive'
    }
  },
  {
    id: 'pfe',
    name: 'Marco Bianchi',
    group: 'PfE',
    fullGroup: 'Patriots for Europe',
    country: 'Italy',
    photo: '👨‍💼',
    color: '#002244',
    description: 'Nationalist conservative defending traditional European values',
    positions: {
      economy: 'right',
      eu_integration: 'eurosceptic',
      environment: 'skeptical',
      social: 'conservative'
    }
  }
];

export default function ChatMEP() {
  const [selectedMEP, setSelectedMEP] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const selectMEP = (mep) => {
    setSelectedMEP(mep);
    setMessages([{
      role: 'assistant',
      content: `Hello! I'm ${mep.name}, a member of ${mep.fullGroup} from ${mep.country}. ${mep.description}. Feel free to ask me about European Parliament votes, my political positions, or any EU policy topic!`
    }]);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedMEP || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post('/api/chat/mep', {
        mepId: selectedMEP.id,
        message: userMessage,
        history: messages.slice(-10) // Last 10 messages for context
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I apologize, but I\'m having trouble responding right now. Please try again.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="container">
      <header className="chat-header">
        <h1>Chat with a MEP</h1>
        <p className="chat-subtitle">
          Talk to AI representatives of each political group. Ask them about votes, 
          policies, and their perspectives on European issues.
        </p>
      </header>

      <div className="chat-layout">
        {/* MEP Selection Sidebar */}
        <aside className="mep-selector">
          <h3>Select a Representative</h3>
          <div className="mep-list">
            {MEP_PERSONAS.map(mep => (
              <button
                key={mep.id}
                className={`mep-card ${selectedMEP?.id === mep.id ? 'selected' : ''}`}
                onClick={() => selectMEP(mep)}
                style={{ '--mep-color': mep.color }}
              >
                <div className="mep-avatar" style={{ backgroundColor: mep.color }}>
                  {mep.photo}
                </div>
                <div className="mep-info">
                  <span className="mep-name">{mep.name}</span>
                  <span className="mep-group">{mep.group}</span>
                  <span className="mep-country">{mep.country}</span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="chat-disclaimer">
            <p>
              <strong>Note:</strong> These are AI personas representing typical 
              positions of each political group. They are fictional and for 
              educational purposes only.
            </p>
          </div>
        </aside>

        {/* Chat Area */}
        <div className="chat-area">
          {!selectedMEP ? (
            <div className="chat-placeholder">
              <div className="placeholder-icon">💬</div>
              <h3>Select a MEP to start chatting</h3>
              <p>Choose a representative from the sidebar to begin a conversation about European politics.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="chat-mep-header" style={{ backgroundColor: selectedMEP.color }}>
                <div className="chat-mep-avatar">{selectedMEP.photo}</div>
                <div className="chat-mep-info">
                  <h3>{selectedMEP.name}</h3>
                  <span>{selectedMEP.fullGroup} • {selectedMEP.country}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`message ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="message-avatar" style={{ backgroundColor: selectedMEP.color }}>
                        {selectedMEP.photo}
                      </div>
                    )}
                    <div className="message-content">
                      {msg.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="message assistant">
                    <div className="message-avatar" style={{ backgroundColor: selectedMEP.color }}>
                      {selectedMEP.photo}
                    </div>
                    <div className="message-content typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input-area">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Ask ${selectedMEP.name} a question...`}
                  rows="2"
                  disabled={loading}
                />
                <button 
                  onClick={sendMessage} 
                  disabled={loading || !input.trim()}
                  className="send-btn"
                >
                  Send
                </button>
              </div>

              {/* Quick Questions */}
              <div className="quick-questions">
                <span>Try asking:</span>
                <button onClick={() => setInput('Why did your group vote for the Green Deal?')}>
                  Green Deal vote?
                </button>
                <button onClick={() => setInput('What is your position on immigration?')}>
                  Immigration stance?
                </button>
                <button onClick={() => setInput('How do you see the future of the EU?')}>
                  Future of EU?
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
