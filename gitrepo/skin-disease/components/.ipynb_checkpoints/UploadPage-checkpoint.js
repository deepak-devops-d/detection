// src/components/UploadPage.js
import React, { useState } from "react";
import './UploadPage.css';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(URL.createObjectURL(e.target.files[0]));
    setMessage("The photo is suitable ✅");
  };

  const handleResult = () => {
    alert("Simulating AI scan... Redirect to result coming soon!");
  };

  return (
    <div className="upload-page">
      <h2>Upload Photo</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      {file && (
        <>
          <img src={file} alt="Uploaded" />
          <p>{message}</p>
          <button onClick={handleResult}>Get Result</button>
        </>
      )}
    </div>
  );
}

export default UploadPage;
