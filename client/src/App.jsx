import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import IntroAnimation from './components/IntroAnimation';
import BillsList from './components/BillsList';
import BillDetail from './components/BillDetail';
import Parliament from './components/Parliament';
import MEPProfile from './components/MEPProfile';
import Stats from './components/Stats';
import PoliticalCompass from './components/PoliticalCompass';
import VAA from './components/VAA/VAA';
import ChatMEP from './components/ChatMEP';
import About from './components/About';
import './App.css';

export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    // Only show intro once per session
    return !sessionStorage.getItem('eulens-intro-seen');
  });

  const handleIntroComplete = () => {
    sessionStorage.setItem('eulens-intro-seen', 'true');
    setShowIntro(false);
  };

  return (
    <BrowserRouter>
      {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
      <div className={showIntro ? 'app app--under-intro' : 'app app--ready'}>
        <Header />
        <Routes>
          <Route path="/" element={<BillsList />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/bill/:id" element={<BillDetail />} />
          <Route path="/parliament" element={<Parliament />} />
          <Route path="/meps" element={<Parliament />} />
          <Route path="/meps/:mepId" element={<MEPProfile />} />
          <Route path="/groups" element={<Parliament />} />
          <Route path="/countries" element={<Parliament />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/compass" element={<PoliticalCompass />} />
          <Route path="/vaa" element={<VAA />} />
          <Route path="/chat" element={<ChatMEP />} />
          <Route path="/about" element={<About />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
