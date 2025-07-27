import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  socket: CustomSocket | null;
}

const SplitOrStealSetup: React.FC<Props> = ({ sessionId, socket }) => {
  const [countdown, setCountdown] = useState(30);
  const [newPlayer, setNewPlayer] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);

  const addPlayer = () => {
    if (!newPlayer.trim()) return;
    setParticipants((prev) => [...prev, newPlayer.trim()]);
    setNewPlayer("");
  };

  const removePlayer = (name: string) => {
    setParticipants((prev) => prev.filter((p) => p !== name));
  };

  const startGame = () => {
    if (socket) {
      socket.emit("split-steal-config", sessionId, {
        countdownDuration: countdown,
        participants,
      });
    }
  };

  return (
    <div className="split-steal setup">
      <h2>Split or Steal - Oppsett</h2>
      <div className="config-row">
        <label>Countdown (sekunder): </label>
        <input
          type="number"
          value={countdown}
          min={10}
          max={300}
          onChange={(e) => setCountdown(parseInt(e.target.value, 10))}
        />
      </div>
      <div className="config-row">
        <h3>Deltakere</h3>
        <div className="add-player-row">
          <input
            type="text"
            value={newPlayer}
            onChange={(e) => setNewPlayer(e.target.value)}
            placeholder="Navn"
          />
          <button onClick={addPlayer}>Legg til</button>
        </div>
        {participants.map((p) => (
          <div key={p} className="participant-row">
            {p}
            <button onClick={() => removePlayer(p)}>X</button>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={startGame} disabled={participants.length < 2}>
        Start
      </button>
    </div>
  );
};

export default SplitOrStealSetup;
