// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Element } from "react-scroll";
import './App.css';

import Navbar from "./components/Navbar";
import Home from "./components/Home";
import HowItWorks from "./components/HowItWorks";
import FAQ from "./components/FAQ";
import UploadPage from "./components/UploadPage";
import CarouselTips from "./components/CarouselTips";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={
          <>
            <Element name="home"><Home /></Element>
            <Element name="howitworks"><HowItWorks /></Element>
            <Element name="faq"><FAQ /></Element>
          </>
        } />
        <Route path="/carousel" element={<CarouselTips />} />
        <Route path="/upload" element={<UploadPage />} />
      </Routes>
    </Router>
  );
}

export default App;
