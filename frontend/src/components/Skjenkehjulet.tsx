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
  const [wheelRotation, setWheelRotation] = useState<number>(0);

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
      setPhase("plinko");
    };

    socket.on("skjenke-countdown", handleCountdown);
    socket.on("skjenke-result", handleResult);

    return () => {
      socket.off("skjenke-countdown", handleCountdown);
      socket.off("skjenke-result", handleResult);
    };
  }, [socket]);

  // Transition from plinko to wheel and from wheel to result
  useEffect(() => {
    if (phase === "plinko") {
      const timer = setTimeout(() => setPhase("wheel"), 3000);
      return () => clearTimeout(timer);
    }
    if (phase === "wheel") {
      const index = categories.indexOf(category || "");
      const degPerSegment = 360 / categories.length;
      const rotation = 1080 - index * degPerSegment; // 3 spins
      setWheelRotation(rotation);
      const timer = setTimeout(() => setPhase("result"), 4000);
      return () => clearTimeout(timer);
    }
  }, [phase, categories, category]);

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

  const backToSetup = () => {
    setPhase("setup");
    setPenalty(null);
    setCategory(null);
    setTimeLeft(countdown);
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
      {isHost && (
        <button className="back-button" onClick={backToSetup}>
          Back
        </button>
      )}
    </div>
  );

  const renderPlinko = () => (
    <div className="skjenke-plinko">
      <div className="plinko-board">
        <div
          className="plinko-ball"
          style={{
            "--target-x": `${(penalty ? penalty - 1 : 0) * 40}px`,
          } as React.CSSProperties}
        />
        <div className="slots">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="slot">
              {n}
            </div>
          ))}
        </div>
      </div>
      {isHost && (
        <button className="back-button" onClick={backToSetup}>
          Back
        </button>
      )}
    </div>
  );

  const renderWheel = () => (
    <div className="skjenke-wheel-container">
      <div
        className="wheel"
        style={{ transform: `rotate(${wheelRotation}deg)` }}
      >
        {categories.map((cat, idx) => (
          <div
            key={cat}
            className="segment"
            style={{ transform: `rotate(${idx * (360 / categories.length)}deg)` }}
          >
            <span>{cat}</span>
          </div>
        ))}
      </div>
      <div className="pointer" />
      {isHost && (
        <button className="back-button" onClick={backToSetup}>
          Back
        </button>
      )}
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
      {isHost && (
        <button className="back-button" onClick={backToSetup}>
          Back
        </button>
      )}
    </div>
  );

  if (phase === "countdown") return renderCountdown();
  if (phase === "plinko") return renderPlinko();
  if (phase === "wheel") return renderWheel();
  if (phase === "result") return renderResult();
  return renderSetup();
};

export default Skjenkehjulet;
