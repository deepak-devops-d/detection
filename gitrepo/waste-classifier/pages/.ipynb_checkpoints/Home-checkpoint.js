import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classifyWaste } from '../utils/classifyWaste';

const Home = () => {
  const [result, setResult] = useState(null); // <-- Add this line
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Image = e.target.result;
        const prediction = classifyWaste(base64Image); // Dummy classifier
        setResult(prediction);
        navigate('/result', { state: { result: prediction, image: base64Image } });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>♻️ Waste Classifier</h1>
      <input type="file" accept="image/*" onChange={handleImageChange} />
    </div>
  );
};

export default Home;