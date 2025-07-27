import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealControllerProps {
  sessionId: string;
  gameState: any;
  socket: CustomSocket | null;
}

const SplitOrStealController: React.FC<SplitOrStealControllerProps> = ({
  sessionId,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "waiting");
  const [choice, setChoice] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>(gameState?.participants || []);
  const [showSettings, setShowSettings] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: any) => {
      setPhase(state.phase);
      setTimer(state.timer || 0);
      if (state.participants) setParticipants(state.participants);
      if (state.currentTurn) setCurrentPlayerId(state.currentTurn);
      if (state.phase === "reveal" && state.results) {
        setResult(state.results);
      }
      if (state.phase !== "reveal") {
        setResult(null);
        setChoice(null);
      }
    };

    const handleChat = (data: any) => {
      setChatMessages((msgs) => [...msgs, data]);
    };

    socket.on("split-steal-state", handleState);
    socket.on("split-steal-timer", (t: number) => setTimer(t));
    socket.on("split-steal-chat", handleChat);
    return () => {
      socket.off("split-steal-state", handleState);
      socket.off("split-steal-timer");
      socket.off("split-steal-chat", handleChat);
    };
  }, [socket]);

  const sendChat = () => {
    if (socket && chatInput.trim()) {
      socket.emit("split-steal-chat", sessionId, chatInput.trim());
      setChatInput("");
    }
  };

  const addPlayer = () => {
    if (socket && newName.trim()) {
      socket.emit("split-steal-add-player", sessionId, newName.trim());
      setNewName("");
    }
  };

  const removePlayer = (id: string) => {
    socket?.emit("split-steal-remove-player", sessionId, id);
  };

  const skipRound = () => {
    socket?.emit("split-steal-skip", sessionId);
  };

  const sendChoice = (c: string) => {
    if (socket && !choice && currentPlayerId) {
      setChoice(c);
      socket.emit("split-steal-choice", sessionId, currentPlayerId, c);
    }
  };

  const currentPlayer = participants.find((p) => p.id === currentPlayerId);

  return (
    <div className="split-steal controller">
      <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
      {showSettings && (
        <div className="settings-panel">
          <div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Navn"
            />
            <button onClick={addPlayer}>Legg til</button>
          </div>
          <ul className="player-list">
            {participants.map((p) => (
              <li key={p.id}>
                {p.name}
                <button onClick={() => removePlayer(p.id)}>x</button>
              </li>
            ))}
          </ul>
          <button onClick={skipRound}>Hopp til neste runde</button>
        </div>
      )}
      {phase === "negotiation" && (
        <div>
      <div className="timer">{timer}</div>
          <div className="chat-box">
            <div className="messages">
              {chatMessages.map((m, i) => (
                <div key={i} className="msg">
                  <strong>{m.playerName}:</strong> {m.message}
                </div>
              ))}
            </div>
            <div className="input-row">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Si noe..."
              />
              <button onClick={sendChat}>Send</button>
            </div>
          </div>
        </div>
      )}
      {phase === "decision" && currentPlayerId && (
        <div className="choice-buttons">
          <h3>{currentPlayer?.name}</h3>
          <button
            className="split-btn"
            disabled={!!choice}
            onClick={() => sendChoice("split")}
          >
            SPLIT
          </button>
          <button
            className="steal-btn"
            disabled={!!choice}
            onClick={() => sendChoice("steal")}
          >
            STEAL
          </button>
        </div>
      )}
      {phase === "decision" && !currentPlayerId && (
        <div className="waiting">Venter...</div>
      )}
      {phase === "reveal" && result && (
        <div className="reveal">
          <h3>Resultat: {result.outcome}</h3>
        </div>
      )}
    </div>
  );
};

export default SplitOrStealController;
