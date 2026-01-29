import React, { useState, useEffect } from 'react';
import './IntroAnimation.css';

export default function IntroAnimation({ onComplete }) {
  const [phase, setPhase] = useState('lens'); // 'lens' -> 'zoom' -> 'done'

  useEffect(() => {
    // Start zoom after lens appears
    const zoomTimer = setTimeout(() => {
      setPhase('zoom');
    }, 800);

    // Complete animation
    const completeTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 2200);

    return () => {
      clearTimeout(zoomTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div className={`intro-animation ${phase}`}>
      <div className="intro-content">
        {/* Lens SVG */}
        <svg 
          className="lens-svg" 
          viewBox="0 0 200 200" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer lens ring */}
          <circle 
            cx="85" 
            cy="85" 
            r="70" 
            fill="none" 
            stroke="url(#lensGradient)" 
            strokeWidth="8"
            className="lens-ring"
          />
          
          {/* Glass reflection */}
          <ellipse 
            cx="65" 
            cy="65" 
            rx="25" 
            ry="15" 
            fill="rgba(255,255,255,0.3)"
            transform="rotate(-30 65 65)"
            className="lens-reflection"
          />
          
          {/* Inner glass */}
          <circle 
            cx="85" 
            cy="85" 
            r="62" 
            fill="url(#glassGradient)"
            className="lens-glass"
          />
          
          {/* Handle */}
          <rect 
            x="140" 
            y="140" 
            width="50" 
            height="16" 
            rx="8"
            fill="url(#handleGradient)"
            transform="rotate(45 140 140)"
            className="lens-handle"
          />
          
          {/* Gradients */}
          <defs>
            <linearGradient id="lensGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <radialGradient id="glassGradient" cx="40%" cy="40%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="50%" stopColor="rgba(200,210,255,0.2)" />
              <stop offset="100%" stopColor="rgba(99,102,241,0.1)" />
            </radialGradient>
            <linearGradient id="handleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Brand text */}
        <div className="intro-brand">
          <span className="intro-title">EULens</span>
          <span className="intro-tagline">See European Democracy Clearly</span>
        </div>
      </div>
      
      {/* Zoom circle overlay */}
      <div className="zoom-circle"></div>
    </div>
  );
}
