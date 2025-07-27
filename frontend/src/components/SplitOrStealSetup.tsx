import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  socket: CustomSocket | null;
}

const SplitOrStealSetup: React.FC<Props> = ({ sessionId, socket }) => {
  const [countdown, setCountdown] = useState(30);
  const [participants, setParticipants] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const addPlayerLocal = () => {
    if (!newName.trim()) return;
    const id = Math.random().toString(36).slice(2, 8);
    setParticipants((prev) => [...prev, { id, name: newName.trim() }]);
    setNewName("");
  };

  const removeLocal = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
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
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Navn"
        />
        <button onClick={addPlayerLocal}>Legg til spiller</button>
      </div>
      <ul className="player-list">
        {participants.map((p) => (
          <li key={p.id}>
            {p.name}
            <button onClick={() => removeLocal(p.id)}>x</button>
          </li>
        ))}
      </ul>
      <button
        className="btn-primary"
        onClick={startGame}
        disabled={participants.length < 2}
      >
        Start
      </button>
    </div>
  );
};

export default SplitOrStealSetup;
