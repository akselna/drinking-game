import React, { useState } from "react";
import "../styles/Skjenkehjulet.css";

interface SkjenkehjuletProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: any;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const Skjenkehjulet: React.FC<SkjenkehjuletProps> = () => {
  const [spinning, setSpinning] = useState(false);

  const handleSpin = () => {
    setSpinning(true);
    setTimeout(() => setSpinning(false), 3000);
  };

  return (
    <div className="skjenkehjulet-container">
      <button className="spin-button" onClick={handleSpin}>
        Test Plinko Wheel
      </button>
      <div className={`wheel-wrapper ${spinning ? "spinning" : ""}`}>
        <svg className="plinko-wheel" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#ffe082" stroke="#5d4037" />
          <text x="50" y="55" fontSize="12" textAnchor="middle">
            Skjenkehjulet
          </text>
        </svg>
      </div>
    </div>
  );
};

export default Skjenkehjulet;
