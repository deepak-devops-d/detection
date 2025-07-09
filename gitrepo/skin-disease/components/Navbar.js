// src/components/Navbar.js
import React from "react";
import { Link } from "react-scroll";
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="logo">DermaDetect</div>
      <ul className="nav-links">
        <li><Link to="home" smooth={true} duration={500}>Home</Link></li>
        <li><Link to="howitworks" smooth={true} duration={500}>How it Works</Link></li>
        <li><Link to="faq" smooth={true} duration={500}>FAQ</Link></li>
      </ul>
    </nav>
  );
}

export default Navbar;
