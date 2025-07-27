import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";

interface SplitOrStealSetupProps {
  sessionId: string;
  players: any[];
  socket: CustomSocket | null;
}

const SplitOrStealSetup: React.FC<SplitOrStealSetupProps> = ({
  sessionId,
  players,
  socket,
}) => {
  const [countdown, setCountdown] = useState<number>(30);
  const [selected, setSelected] = useState<string[]>(players.map((p) => p.id));

  const togglePlayer = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit("split-steal-config", sessionId, {
      countdown,
      participants: selected,
    });
  };

  return (
    <div className="split-steal setup">
      <h2>Split or Steal - Oppsett</h2>
      <label>
        Nedtelling mellom runder (sekunder)
        <input
          type="number"
          min="10"
          max="300"
          value={countdown}
          onChange={(e) => setCountdown(parseInt(e.target.value) || 30)}
        />
      </label>
      <h3>Deltakere</h3>
      <div className="player-list">
        {players.map((p) => (
          <label key={p.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => togglePlayer(p.id)}
            />
            {p.name}
          </label>
        ))}
      </div>
      <button className="btn-primary" onClick={startGame}>
        Start spillet
      </button>
    </div>
  );
};

export default SplitOrStealSetup;
