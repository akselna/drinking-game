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
  const [countdown, setCountdown] = useState<number>(20);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!socket) return;

    const handleCountdown = (data: any) => {
      setPhase("countdown");
      setCountdown(data.countdown);
      setChoice(null);
      setChatMessages([]);
      setResult(null);
    };

    const handleRoundStart = () => {
      setPhase("negotiation");
      setChoice(null);
      setResult(null);
      setCountdown(60);
      setChatMessages([]);
    };

    const handleDecision = () => {
      setPhase("decision");
    };

    const handleReveal = (data: any) => {
      setPhase("reveal");
      setResult(data.results.find((r: any) =>
        r.pair.some((p: any) => p.id === socket.id)
      ));
    };

    const handleChat = (data: any) => {
      setChatMessages((msgs) => [...msgs, data]);
    };

    socket.on("split-steal-countdown", handleCountdown);
    socket.on("split-steal-round-start", handleRoundStart);
    socket.on("split-steal-decision", handleDecision);
    socket.on("split-steal-reveal", handleReveal);
    socket.on("split-steal-chat", handleChat);
    return () => {
      socket.off("split-steal-countdown", handleCountdown);
      socket.off("split-steal-round-start", handleRoundStart);
      socket.off("split-steal-decision", handleDecision);
      socket.off("split-steal-reveal", handleReveal);
      socket.off("split-steal-chat", handleChat);
    };
  }, [socket]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if ((phase === "countdown" || phase === "negotiation") && countdown > 0) {
      t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const sendChat = () => {
    if (socket && chatInput.trim()) {
      socket.emit("split-steal-chat", sessionId, chatInput.trim());
      setChatInput("");
    }
  };

  const sendChoice = (c: string) => {
    if (socket && !choice) {
      setChoice(c);
      socket.emit("split-steal-choice", sessionId, c);
      setPhase("waiting");
    }
  };

  return (
    <div className="split-steal controller">
      {phase === "countdown" && (
        <div className="timer">{countdown}</div>
      )}
      {phase === "negotiation" && (
        <div>
          <div className="timer">{countdown}</div>
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
      {phase === "decision" && (
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
      {phase === "reveal" && result && (
        <div className="reveal">
          <h3>Resultat: {result.outcome}</h3>
        </div>
      )}
    </div>
  );
};

export default SplitOrStealController;
