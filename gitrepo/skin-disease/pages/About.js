import React from 'react';
import Navbar from '../components/Navbar';

function About() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: '50px', textAlign: 'center' }}>
        <h1>About Us</h1>
        <p>This application uses advanced machine learning techniques to detect skin diseases.</p>
        <p>Technology Stack: ReactJS, Python, Flask</p>
      </div>
    </div>
  );
}

export default About;