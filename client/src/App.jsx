import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import BillsList from './components/BillsList';
import BillDetail from './components/BillDetail';
import Consensus from './components/Consensus';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <Routes>
          <Route path="/" element={<BillsList />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/consensus" element={<Consensus />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
