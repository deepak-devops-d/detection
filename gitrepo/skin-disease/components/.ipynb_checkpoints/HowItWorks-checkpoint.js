// src/components/HowItWorks.js
import React from "react";
import { useNavigate } from "react-router-dom";
import './HowItWorks.css';

function HowItWorks() {
  const navigate = useNavigate();

  return (
    <section className="howitworks" id="howitworks">
      <h2>How to use DermaDetect?</h2>
      <div className="steps">
        <div>
          <img src="phone.png" alt="Step 1" />
          <p><strong>Take a photo*</strong><br />Keep zoomed, focused, and no other objects.</p>
        </div>
        <div>
          <img src="send.png" alt="Step 2" />
          <p><strong>Send it</strong><br />AI will scan and assess the problem.</p>
        </div>
        <div>
          <img src="result.png" alt="Step 3" />
          <p><strong>Get result</strong><br />You'll see a result with suggestions.</p>
        </div>
      </div>
      <button onClick={() => navigate("/carousel")}>Try Now!</button>
    </section>
  );
}

export default HowItWorks;
