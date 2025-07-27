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
  const [currentTurn, setCurrentTurn] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>(gameState?.participants || []);
  const [showSettings, setShowSettings] = useState(false);
  const [newPlayer, setNewPlayer] = useState("");

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: any) => {
      setPhase(state.phase);
      setTimer(state.timer || 0);
      setCurrentTurn(state.currentTurn);
      if (state.participants) setParticipants(state.participants);
      if (state.phase === "reveal" && state.results) {
        setResult(state.results);
      } else {
        setResult(null);
      }
      setChoice(null);
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

  const sendChoice = (c: string) => {
    if (socket && !choice && currentTurn) {
      setChoice(c);
      socket.emit("split-steal-choice", sessionId, currentTurn.id, c);
    }
  };

  return (
    <div className="split-steal controller">
      <button className="settings-btn" onClick={() => setShowSettings((s) => !s)}>
        ⚙️
      </button>
      {showSettings && (
        <div className="settings-panel">
          <div className="add-player-row">
            <input
              type="text"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder="Navn"
            />
            <button
              onClick={() => {
                if (socket && newPlayer.trim()) {
                  socket.emit("split-steal-add-player", sessionId, newPlayer.trim());
                  setNewPlayer("");
                }
              }}
            >
              Legg til
            </button>
          </div>
          {participants.map((p) => (
            <div key={p.id} className="participant-row">
              {p.name}
              <button onClick={() => socket?.emit("split-steal-remove-player", sessionId, p.id)}>
                X
              </button>
            </div>
          ))}
          <button onClick={() => socket?.emit("split-steal-skip", sessionId)}>Hopp over runde</button>
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
      {phase === "decision" && currentTurn && (
        <div className="choice-buttons">
          <h3>{currentTurn.name} velger</h3>
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
      {phase === "reveal" && result && (
        <div className="reveal">
          <h3>Resultat: {result.outcome}</h3>
        </div>
      )}
    </div>
  );
};

export default SplitOrStealController;
