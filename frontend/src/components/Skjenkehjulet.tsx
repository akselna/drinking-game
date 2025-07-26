import React from "react";
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
  return (
    <div className="skjenkehjulet">
      <iframe
        title="Skjenkehjulet"
        src="/skjenkehjulet.html"
        className="skjenkehjulet-frame"
      />
    </div>
  );
};

export default Skjenkehjulet;
