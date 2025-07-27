import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  socket: CustomSocket | null;
}

interface LocalPlayer {
  id: string;
  name: string;
}

const SplitOrStealSetup: React.FC<Props> = ({ sessionId, socket }) => {
  const [countdown, setCountdown] = useState(30);
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [nameInput, setNameInput] = useState("");

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    setPlayers((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), name },
    ]);
    setNameInput("");
  };

  const removePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const startGame = () => {
    if (socket) {
      socket.emit("split-steal-config", sessionId, {
        countdownDuration: countdown,
        participants: players.map((p) => p.name),
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
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Nytt navn"
          />
          <button onClick={addPlayer}>Legg til</button>
        </div>
        <ul className="players-list">
          {players.map((p) => (
            <li key={p.id}>
              {p.name}
              <button onClick={() => removePlayer(p.id)}>❌</button>
            </li>
          ))}
        </ul>
      </div>
      <button className="btn-primary" onClick={startGame} disabled={players.length < 2}>
        Start
      </button>
    </div>
  );
};

export default SplitOrStealSetup;
