// src/components/CarouselTips.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './CarouselTips.css';

const tips = [
  {
    text: "The smallest possible distance (2-4” or 5-10 cm) for a clear frame",
    img: "tip1.png"
  },
  {
    text: "Keep in focus and center only the skin mark.",
    img: "tip2.png"
  },
  {
    text: "Photo should be free of foreign objects (hair, jewelry, etc.)",
    img: "tip3.png"
  },
];

function CarouselTips() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();

  const next = () => {
    if (index === tips.length - 1) navigate("/upload");
    else setIndex(index + 1);
  };

  return (
    <div className="carousel">
      <img src={tips[index].img} alt="Tip" />
      <p>{tips[index].text}</p>
      <button onClick={next}>{index === tips.length - 1 ? "Got it" : "Next"}</button>
    </div>
  );
}

export default CarouselTips;
