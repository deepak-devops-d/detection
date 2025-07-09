import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import ImageUploader from '../components/ImageUploader';
import ResultDisplay from '../components/ResultDisplay';

function Home() {
  const [result, setResult] = useState(null);

  return (
    <div>
      <Navbar />
      <ImageUploader onResult={setResult} />
      <ResultDisplay result={result} />
    </div>
  );
}

export default Home;