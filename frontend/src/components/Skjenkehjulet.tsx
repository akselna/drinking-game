import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/Skjenkehjulet.css";

interface SkjenkehjuletProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const Skjenkehjulet: React.FC<SkjenkehjuletProps> = () => {
  const [rotation, setRotation] = useState(0);

  const spinWheel = () => {
    const extra = 360 * 3 + Math.floor(Math.random() * 360);
    setRotation((prev) => prev + extra);
  };

  return (
    <div className="skjenkehjulet">
      <h2>Skjenkehjulet</h2>
      <div className="wheel-container">
        <div className="wheel" style={{ transform: `rotate(${rotation}deg)` }} />
      </div>
      <button className="spin-button" onClick={spinWheel}>
        Test Plinko Wheel
      </button>
    </div>
  );
};

export default Skjenkehjulet;
