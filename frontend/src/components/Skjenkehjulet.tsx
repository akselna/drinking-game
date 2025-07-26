/*
 * NY FIL: frontend/src/components/Skjenkehjulet.tsx
 *
 * Dette er hovedkomponenten for Skjenkehjulet-spillet.
 * Lag denne filen i frontend/src/components/ mappen.
 */

import React, { useState, useEffect, useRef } from "react";
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

interface PunishmentResult {
  type: string;
  amount: number;
  color: string;
}

const Skjenkehjulet: React.FC<SkjenkehjuletProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  // Game state
  const [phase, setPhase] = useState<string>("setup");
  const [countdownTime, setCountdownTime] = useState<number>(10);
  const [gameMode, setGameMode] = useState<string>("medium");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [currentPunishment, setCurrentPunishment] =
    useState<PunishmentResult | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>("");
  const [wheelCategories, setWheelCategories] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [ballPosition, setBallPosition] = useState<{ x: number; y: number }>({
    x: 300,
    y: 0,
  });
  const [finalSlot, setFinalSlot] = useState<number>(-1);

  // Canvas refs
  const ballCanvasRef = useRef<HTMLCanvasElement>(null);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);

  // Punishment definitions
  const punishments = {
    mild: [
      { type: "1 slurk", amount: 1, probability: 0.4, color: "#4CAF50" },
      { type: "2 slurker", amount: 2, probability: 0.3, color: "#FFC107" },
      { type: "3 slurker", amount: 3, probability: 0.2, color: "#FF9800" },
      { type: "Bunnløs", amount: 999, probability: 0.1, color: "#F44336" },
    ],
    medium: [
      { type: "1 slurk", amount: 1, probability: 0.25, color: "#4CAF50" },
      { type: "2 slurker", amount: 2, probability: 0.3, color: "#FFC107" },
      { type: "3 slurker", amount: 3, probability: 0.25, color: "#FF9800" },
      { type: "5 slurker", amount: 5, probability: 0.15, color: "#E91E63" },
      { type: "Bunnløs", amount: 999, probability: 0.05, color: "#F44336" },
    ],
    blackout: [
      { type: "2 slurker", amount: 2, probability: 0.2, color: "#FFC107" },
      { type: "3 slurker", amount: 3, probability: 0.25, color: "#FF9800" },
      { type: "5 slurker", amount: 5, probability: 0.25, color: "#E91E63" },
      { type: "7 slurker", amount: 7, probability: 0.15, color: "#9C27B0" },
      { type: "Bunnløs", amount: 999, probability: 0.15, color: "#F44336" },
    ],
  };

  // Wheel categories
  const allCategories = [
    "Hvite sokker",
    "Briller",
    "Lengste hår",
    "Korteste hår",
    "Eldste",
    "Yngste",
    "Høyeste",
    "Laveste",
    "Blå øyne",
    "Brune øyne",
    "Piercing",
    "Tatovering",
    "Rødt plagg",
    "Blått plagg",
    "Hvitt plagg",
    "Svart plagg",
    "Caps",
    "Kjole/skjørt",
    "Sneakers",
    "Høye hæler",
    "Mannlig",
    "Kvinnelig",
    "Student",
    "Jobber",
    "Single",
    "I forhold",
    "Har kjæledyr",
    "Bor hjemme",
    "Har bil",
    "Har moped",
  ];

  // Initialize from gameState
  useEffect(() => {
    if (gameState) {
      setPhase(gameState.phase || "setup");
      setCountdownTime(gameState.countdownTime || 10);
      setGameMode(gameState.gameMode || "medium");
      setTimeRemaining(gameState.timeRemaining || 0);
      setCurrentPunishment(gameState.currentPunishment || null);
      setCurrentCategory(gameState.currentCategory || "");
      setWheelCategories(gameState.wheelCategories || []);
    }
  }, [gameState]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleGameStart = (data: any) => {
      setPhase("countdown");
      setTimeRemaining(data.countdownTime);
      setWheelCategories(data.wheelCategories);
    };

    const handleCountdownUpdate = (data: any) => {
      setTimeRemaining(data.timeRemaining);
    };

    const handlePunishmentAnimation = (data: any) => {
      setPhase("punishment-animation");
      setCurrentPunishment(data.punishment);
      startBallAnimation(data.punishment, data.targetSlot);
    };

    const handleWheelSpin = (data: any) => {
      setPhase("wheel-spin");
      setCurrentCategory(data.category);
      startWheelAnimation(data.categoryIndex);
    };

    const handleResult = (data: any) => {
      setPhase("result");
      setCurrentCategory(data.category);
      setCurrentPunishment(data.punishment);
    };

    const handleNextRound = (data: any) => {
      setPhase("countdown");
      setTimeRemaining(data.countdownTime);
      setWheelCategories(data.wheelCategories);
      setCurrentPunishment(null);
      setCurrentCategory("");
    };

    socket.on("skjenkehjulet-game-start", handleGameStart);
    socket.on("skjenkehjulet-countdown-update", handleCountdownUpdate);
    socket.on("skjenkehjulet-punishment-animation", handlePunishmentAnimation);
    socket.on("skjenkehjulet-wheel-spin", handleWheelSpin);
    socket.on("skjenkehjulet-result", handleResult);
    socket.on("skjenkehjulet-next-round", handleNextRound);

    return () => {
      socket.off("skjenkehjulet-game-start", handleGameStart);
      socket.off("skjenkehjulet-countdown-update", handleCountdownUpdate);
      socket.off(
        "skjenkehjulet-punishment-animation",
        handlePunishmentAnimation
      );
      socket.off("skjenkehjulet-wheel-spin", handleWheelSpin);
      socket.off("skjenkehjulet-result", handleResult);
      socket.off("skjenkehjulet-next-round", handleNextRound);
    };
  }, [socket]);

  // Start game (host only)
  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit("skjenkehjulet-start-game", sessionId, {
      countdownTime,
      gameMode,
    });
  };

  // Ball animation for punishment selection
  const startBallAnimation = (
    punishment: PunishmentResult,
    targetSlot: number
  ) => {
    const canvas = ballCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsAnimating(true);
    setFinalSlot(targetSlot);

    let ballX = canvas.width / 2;
    let ballY = 50;
    let velocityX = (Math.random() - 0.5) * 4;
    let velocityY = 0;
    const gravity = 0.3;
    const bounce = 0.7;
    const friction = 0.98;

    // Create obstacles (pins)
    const pins: { x: number; y: number }[] = [];
    for (let row = 0; row < 8; row++) {
      const pinsInRow = row + 3;
      const startX = (canvas.width - (pinsInRow - 1) * 60) / 2;
      for (let col = 0; col < pinsInRow; col++) {
        pins.push({
          x: startX + col * 60,
          y: 120 + row * 50,
        });
      }
    }

    // Punishment slots at bottom
    const slotWidth = canvas.width / 5;
    const slots = [
      {
        x: 0,
        width: slotWidth,
        punishment: punishments[gameMode as keyof typeof punishments][0],
      },
      {
        x: slotWidth,
        width: slotWidth,
        punishment: punishments[gameMode as keyof typeof punishments][1],
      },
      {
        x: slotWidth * 2,
        width: slotWidth,
        punishment: punishments[gameMode as keyof typeof punishments][2],
      },
      {
        x: slotWidth * 3,
        width: slotWidth,
        punishment: punishments[gameMode as keyof typeof punishments][3],
      },
      {
        x: slotWidth * 4,
        width: slotWidth,
        punishment:
          punishments[gameMode as keyof typeof punishments][4] ||
          punishments[gameMode as keyof typeof punishments][3],
      },
    ];

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pins
      pins.forEach((pin) => {
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Pin glow
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw slots
      slots.forEach((slot, index) => {
        ctx.fillStyle = slot.punishment.color;
        ctx.fillRect(slot.x, canvas.height - 80, slot.width - 2, 80);

        // Slot text
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          slot.punishment.type,
          slot.x + slot.width / 2,
          canvas.height - 40
        );

        // Highlight target slot
        if (index === targetSlot) {
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 3;
          ctx.strokeRect(slot.x, canvas.height - 80, slot.width - 2, 80);
        }
      });

      // Update ball physics
      velocityY += gravity;
      ballX += velocityX;
      ballY += velocityY;

      // Ball collision with pins
      pins.forEach((pin) => {
        const dx = ballX - pin.x;
        const dy = ballY - pin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 16) {
          const angle = Math.atan2(dy, dx);
          ballX = pin.x + Math.cos(angle) * 16;
          ballY = pin.y + Math.sin(angle) * 16;
          velocityX = Math.cos(angle) * 3 + (Math.random() - 0.5);
          velocityY = Math.sin(angle) * 2;
        }
      });

      // Wall collisions
      if (ballX < 10) {
        ballX = 10;
        velocityX *= -bounce;
      }
      if (ballX > canvas.width - 10) {
        ballX = canvas.width - 10;
        velocityX *= -bounce;
      }

      // Apply friction
      velocityX *= friction;

      // Draw ball
      ctx.fillStyle = "#FF6B6B";
      ctx.shadowColor = "#FF6B6B";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Check if ball reached bottom
      if (ballY > canvas.height - 100) {
        setIsAnimating(false);
        return;
      }

      setBallPosition({ x: ballX, y: ballY });
      requestAnimationFrame(animate);
    };

    animate();
  };

  // Wheel spin animation
  const startWheelAnimation = (targetIndex: number) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    let rotation = 0;
    const targetRotation =
      (targetIndex / wheelCategories.length) * 2 * Math.PI + Math.PI * 6; // Multiple spins
    const rotationSpeed = 0.2;
    let currentSpeed = rotationSpeed;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw wheel segments
      const segmentAngle = (2 * Math.PI) / wheelCategories.length;

      wheelCategories.forEach((category, index) => {
        const startAngle = rotation + index * segmentAngle;
        const endAngle = startAngle + segmentAngle;

        // Segment color
        const hue = (index * 360) / wheelCategories.length;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();

        // Segment border
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + segmentAngle / 2);
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(category, radius * 0.7, 5);
        ctx.restore();
      });

      // Draw center circle
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
      ctx.fill();

      // Draw pointer
      ctx.fillStyle = "#FF0000";
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - radius - 10);
      ctx.lineTo(centerX - 15, centerY - radius + 10);
      ctx.lineTo(centerX + 15, centerY - radius + 10);
      ctx.closePath();
      ctx.fill();

      // Update rotation
      rotation += currentSpeed;
      currentSpeed *= 0.995; // Slow down

      if (rotation < targetRotation) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  // Next round (host only)
  const nextRound = () => {
    if (!socket || !isHost) return;
    socket.emit("skjenkehjulet-next-round", sessionId);
  };

  // Render based on phase
  switch (phase) {
    case "setup":
      return (
        <div className="skjenkehjulet setup-phase">
          <h2>🎰 Skjenkehjulet 🎰</h2>

          {isHost ? (
            <div className="setup-container">
              <div className="settings-card">
                <h3>Spillinnstillinger</h3>

                <div className="setting-group">
                  <label>Countdown-tid (sekunder):</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={countdownTime}
                    onChange={(e) => setCountdownTime(parseInt(e.target.value))}
                    className="time-input"
                  />
                </div>

                <div className="setting-group">
                  <label>Spillmodus:</label>
                  <div className="mode-buttons">
                    {["mild", "medium", "blackout"].map((mode) => (
                      <button
                        key={mode}
                        className={`mode-button ${
                          gameMode === mode ? "selected" : ""
                        }`}
                        onClick={() => setGameMode(mode)}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="punishment-preview">
                  <h4>Straffeoversikt ({gameMode}):</h4>
                  <div className="punishment-list">
                    {punishments[gameMode as keyof typeof punishments].map(
                      (punishment, index) => (
                        <div
                          key={index}
                          className="punishment-item"
                          style={{
                            borderLeft: `4px solid ${punishment.color}`,
                          }}
                        >
                          <span className="punishment-type">
                            {punishment.type}
                          </span>
                          <span className="punishment-probability">
                            {(punishment.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <button onClick={startGame} className="start-button">
                Start Skjenkehjulet
              </button>
            </div>
          ) : (
            <div className="waiting-message">
              <p>Venter på at verten skal starte spillet...</p>
            </div>
          )}

          <button onClick={returnToLobby} className="back-button">
            ← Tilbake til lobby
          </button>
        </div>
      );

    case "countdown":
      return (
        <div className="skjenkehjulet countdown-phase">
          <h2>🎰 Skjenkehjulet 🎰</h2>

          <div
            className={`countdown-display ${
              timeRemaining <= 10 ? "warning" : ""
            }`}
          >
            <div className="countdown-number">{timeRemaining}</div>
            <div className="countdown-label">sekunder igjen</div>
          </div>

          <div className="wheel-preview">
            <h3>Kategorier på hjulet:</h3>
            <div className="categories-grid">
              {wheelCategories.map((category, index) => (
                <div key={index} className="category-item">
                  {category}
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <button onClick={returnToLobby} className="back-button">
              ← Tilbake til lobby
            </button>
          )}
        </div>
      );

    case "punishment-animation":
      return (
        <div className="skjenkehjulet animation-phase">
          <h2>🎰 Velger straff... 🎰</h2>

          <canvas
            ref={ballCanvasRef}
            width={600}
            height={500}
            className="ball-canvas"
          />

          {currentPunishment && (
            <div className="punishment-display">
              <h3>Straff: {currentPunishment.type}</h3>
            </div>
          )}
        </div>
      );

    case "wheel-spin":
      return (
        <div className="skjenkehjulet wheel-phase">
          <h2>🎰 Spinner hjulet... 🎰</h2>

          {currentPunishment && (
            <div className="current-punishment">
              <h3>Straff: {currentPunishment.type}</h3>
            </div>
          )}

          <canvas
            ref={wheelCanvasRef}
            width={400}
            height={400}
            className="wheel-canvas"
          />
        </div>
      );

    case "result":
      return (
        <div className="skjenkehjulet result-phase">
          <h2>🎰 Resultat! 🎰</h2>

          <div className="result-display">
            <div className="result-category">
              Alle med <strong>{currentCategory}</strong>
            </div>
            <div className="result-punishment">
              må drikke <strong>{currentPunishment?.type}</strong>!
            </div>
          </div>

          {isHost && (
            <div className="host-controls">
              <button onClick={nextRound} className="next-round-button">
                Neste runde
              </button>
              <button onClick={returnToLobby} className="back-button">
                ← Tilbake til lobby
              </button>
            </div>
          )}

          {!isHost && (
            <div className="waiting-message">
              <p>Venter på at verten skal starte neste runde...</p>
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="skjenkehjulet loading">
          <h2>🎰 Skjenkehjulet 🎰</h2>
          <p>Laster spill...</p>
        </div>
      );
  }
};

export default Skjenkehjulet;
