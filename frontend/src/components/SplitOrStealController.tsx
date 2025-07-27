import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealControllerProps {
  sessionId: string;
  players: any[];
  gameState: any;
  socket: CustomSocket | null;
}

const SplitOrStealController: React.FC<SplitOrStealControllerProps> = ({
  sessionId,
  players,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "waiting");
  const [choice, setChoice] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [isTurn, setIsTurn] = useState<boolean>(false);

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: any) => {
      setPhase(state.phase);
      setTimer(state.timer || 0);
      setIsTurn(state.currentTurn === socket.id);
      if (state.phase === "reveal" && state.results) {
        const res = state.results;
        if (res.pair.some((p: any) => p.id === socket.id)) {
          setResult(res);
        }
      }
      if (state.phase !== "reveal") {
        setResult(null);
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

  const sendChoice = (c: string) => {
    if (socket && !choice && isTurn) {
      setChoice(c);
      socket.emit("split-steal-choice", sessionId, c);
      setIsTurn(false);
    }
  };

  return (
    <div className="split-steal controller">
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
      {phase === "decision" && isTurn && (
        <div className="choice-buttons">
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
      {phase === "decision" && !isTurn && (
        <div className="waiting">Venter på motspiller...</div>
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
