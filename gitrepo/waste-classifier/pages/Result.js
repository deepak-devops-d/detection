import React from 'react';

const Result = ({ location }) => {
  const { result, image } = location.state || {};

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h2>🔍 Classification Result</h2>
      {image && <img src={image} alt="Uploaded" width="200" />}
      <p><strong>Type:</strong> {result?.type}</p>
      <p><strong>Category:</strong> {result?.category}</p>
    </div>
  );
};

export default Result;