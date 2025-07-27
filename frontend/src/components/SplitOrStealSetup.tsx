import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  players: any[];
  socket: CustomSocket | null;
}

const SplitOrStealSetup: React.FC<Props> = ({ sessionId, players, socket }) => {
  const [countdown, setCountdown] = useState(30);
  const [selected, setSelected] = useState<string[]>([]);

  const togglePlayer = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const startGame = () => {
    if (socket) {
      socket.emit("split-steal-config", sessionId, {
        countdownDuration: countdown,
        participants: selected,
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
        {players.map((p) => (
          <label key={p.id} className="player-select">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => togglePlayer(p.id)}
            />
            {p.name}
          </label>
        ))}
      </div>
      <button className="btn-primary" onClick={startGame} disabled={selected.length < 2}>
        Start
      </button>
    </div>
  );
};

export default SplitOrStealSetup;
