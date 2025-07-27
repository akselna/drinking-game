import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  socket: CustomSocket | null;
}

interface Participant {
  id: string;
  name: string;
}

const SplitOrStealSetup: React.FC<Props> = ({ sessionId, socket }) => {
  const [countdown, setCountdown] = useState(30);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newName, setNewName] = useState("");

  const addParticipant = () => {
    if (!newName.trim()) return;
    setParticipants((prev) => [
      ...prev,
      { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: newName.trim() },
    ]);
    setNewName("");
  };

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const startGame = () => {
    if (socket && participants.length >= 2) {
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
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Navn"
          />
          <button onClick={addParticipant}>Legg til</button>
        </div>
        {participants.map((p) => (
          <div key={p.id} className="player-row">
            {p.name}
            <button onClick={() => removeParticipant(p.id)}>x</button>
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
