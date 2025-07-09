// src/components/Home.js
import React from "react";
import { useNavigate } from "react-router-dom";
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/carousel");
  };

  return (
    <section className="home" id="home">
      <h1>Check your skin!</h1>
      <p>Upload a skin image and let our AI analyze it instantly.</p>
      <button onClick={handleClick}>Try Now!</button>
    </section>
  );
}

export default Home;
