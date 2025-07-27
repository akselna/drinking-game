import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface Props {
  sessionId: string;
  gameState: any;
  socket: CustomSocket | null;
  onClose: () => void;
}

const SplitOrStealSettings: React.FC<Props> = ({ sessionId, gameState, socket, onClose }) => {
  const [nameInput, setNameInput] = useState("");

  const addPlayer = () => {
    if (socket && nameInput.trim()) {
      socket.emit("split-steal-add-player", sessionId, nameInput.trim());
      setNameInput("");
    }
  };

  const removePlayer = (id: string) => {
    if (socket) {
      socket.emit("split-steal-remove-player", sessionId, id);
    }
  };

  const skipRound = () => {
    if (socket) {
      socket.emit("split-steal-next", sessionId);
      onClose();
    }
  };

  return (
    <div className="ss-settings">
      <div className="settings-content">
        <h3>Innstillinger</h3>
        <div className="add-player-row">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Nytt navn"
          />
          <button onClick={addPlayer}>Legg til</button>
        </div>
        <ul className="players-list">
          {(gameState.participants || []).map((p: any) => (
            <li key={p.id}>
              {p.name}
              <button onClick={() => removePlayer(p.id)}>❌</button>
            </li>
          ))}
        </ul>
        <button onClick={skipRound}>Hopp over runde</button>
        <button onClick={onClose}>Lukk</button>
      </div>
    </div>
  );
};

export default SplitOrStealSettings;
