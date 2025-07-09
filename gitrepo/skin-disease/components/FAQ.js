// src/components/FAQ.js
import React from "react";
import './FAQ.css';

function FAQ() {
  return (
    <section className="faq" id="faq">
      <h2>Frequently Asked Questions</h2>
      <div className="question">
        <h4>Is this a real diagnosis?</h4>
        <p>No, It is  only a prediction. Always consult your doctor.</p>
      </div>
      <div className="question">
        <h4>Do I need to login?</h4>
        <p>No, just upload and get results instantly.</p>
      </div>
    </section>
  );
}

export default FAQ;
