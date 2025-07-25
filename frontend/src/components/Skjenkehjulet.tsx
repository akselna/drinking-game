import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/Skjenkehjulet.css";

interface SkjenkehjuletProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const Skjenkehjulet: React.FC<SkjenkehjuletProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "setup");
  const [mode, setMode] = useState<string>(gameState?.mode || "mild");
  const [countdown, setCountdown] = useState<number>(gameState?.countdown || 30);
  const [timeLeft, setTimeLeft] = useState<number>(gameState?.timeRemaining || countdown);
  const [penalty, setPenalty] = useState<number | null>(gameState?.penalty || null);
  const [category, setCategory] = useState<string | null>(gameState?.category || null);
  const [categories, setCategories] = useState<string[]>(gameState?.categories || []);

  useEffect(() => {
    if (!socket) return;

    const handleCountdown = (data: any) => {
      setTimeLeft(data.timeRemaining);
      setPhase("countdown");
    };

    const handleResult = (data: any) => {
      setPenalty(data.penalty);
      setCategory(data.category);
      if (data.categories) setCategories(data.categories);
      setPhase("result");
    };

    socket.on("skjenke-countdown", handleCountdown);
    socket.on("skjenke-result", handleResult);

    return () => {
      socket.off("skjenke-countdown", handleCountdown);
      socket.off("skjenke-result", handleResult);
    };
  }, [socket]);

  const startGame = () => {
    if (!socket) return;
    socket.emit("skjenke-set-countdown", sessionId, countdown);
    socket.emit("skjenke-set-mode", sessionId, mode);
    socket.emit("skjenke-start", sessionId);
  };

  const nextRound = () => {
    if (!socket) return;
    socket.emit("skjenke-start", sessionId);
  };

  const renderSetup = () => (
    <div className="skjenke-setup">
      {isHost ? (
        <div className="host-controls">
          <label>
            Nedtelling:
            <input
              type="number"
              value={countdown}
              onChange={(e) => setCountdown(Number(e.target.value))}
            />
          </label>
          <label>
            Modus:
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="blackout">Blackout</option>
            </select>
          </label>
          <button onClick={startGame}>Start</button>
        </div>
      ) : (
        <p>Venter på at verten starter…</p>
      )}
    </div>
  );

  const renderCountdown = () => (
    <div className="skjenke-countdown">
      <div className={timeLeft <= 10 ? "warning" : ""}>{timeLeft}</div>
    </div>
  );

  const renderResult = () => (
    <div className="skjenke-result">
      <h2>{category}</h2>
      {penalty !== null && <p>må drikke {penalty} slurker!</p>}
      {isHost && (
        <button onClick={nextRound} className="next-round">
          Neste runde
        </button>
      )}
    </div>
  );

  if (phase === "countdown") return renderCountdown();
  if (phase === "result") return renderResult();
  return renderSetup();
};

export default Skjenkehjulet;
