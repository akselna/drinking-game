// src/components/SplitOrStealDashboard.tsx
import React, { useState, useEffect } from "react";
import BlueDotBackground from "./BlueDotBackground";
import { CustomSocket } from "../types/socket.types";

// Type Definitions
interface Participant {
  id: string;
  name: string;
}

interface Player extends Participant {
  intensity: string;
}

interface CurrentPair {
  player1: Player;
  player2: Player;
}

interface Results {
  choices: { [key: string]: string };
}

interface GameState {
  timeLeft?: number;
  phase?: string;
  currentPair?: CurrentPair | null;
  results?: Results | null;
  participants?: Participant[];
  intensity?: string;
}

interface SplitOrStealDashboardProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: GameState;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const SplitOrStealDashboard: React.FC<SplitOrStealDashboardProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("countdown");
  const [currentPair, setCurrentPair] = useState<CurrentPair | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>(
    gameState?.participants || []
  );
  const [newParticipantName, setNewParticipantName] = useState("");
  const [showPostReveal, setShowPostReveal] = useState(false);
  const [intensity, setIntensity] = useState<string>(gameState.intensity || "Chill");

  // Initialize state from gameState
  useEffect(() => {
    if (gameState) {
      setTimeLeft(gameState.timeLeft || 0);
      setCurrentPhase(gameState.phase || "countdown");
      setCurrentPair(gameState.currentPair || null);
      setResults(gameState.results || null);
      setParticipants(gameState.participants || []);
      if (gameState.intensity) setIntensity(gameState.intensity);
    }
  }, [gameState]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimerUpdate = (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    };

    const handleStateUpdate = (data: GameState) => {
      if (data.phase) {
        setCurrentPhase(data.phase);
      }
      setTimeLeft(data.timeLeft || 0);

      if (data.currentPair) {
        setCurrentPair(data.currentPair);
      }

      if (data.results) {
        setResults(data.results);
      }

      if (data.participants) {
        setParticipants(data.participants);
      }
      if (data.intensity) {
        setIntensity(data.intensity);
      }
    };

    socket.on("split-steal-timer", handleTimerUpdate);
    socket.on("split-steal-state", handleStateUpdate);

    return () => {
      socket.off("split-steal-timer", handleTimerUpdate);
      socket.off("split-steal-state", handleStateUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (currentPhase === "reveal") {
      setShowPostReveal(false);
      const t = setTimeout(() => setShowPostReveal(true), 5000);
      return () => clearTimeout(t);
    }
  }, [currentPhase]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const intensitySips = {
    Chill: { cheersCheers: 3, tearsCheers: 8, tearsTears: 6 },
    Medium: { cheersCheers: 4, tearsCheers: 10, tearsTears: 8 },
    Fyllehund: { cheersCheers: 6, tearsCheers: 15, tearsTears: 12 },
    "Grøfta": { cheersCheers: 9, tearsCheers: 23, tearsTears: 18 },
  } as const;

  const calculateSips = (
    playerChoice: string,
    opponentChoice: string,
    level: string
  ): number => {
    const map =
      intensitySips[level as keyof typeof intensitySips] ||
      intensitySips.Chill;

    if (playerChoice === "SPLIT" && opponentChoice === "SPLIT") {
      return map.cheersCheers;
    }
    if (playerChoice === "SPLIT" && opponentChoice === "STEAL") {
      return map.tearsCheers;
    }
    if (playerChoice === "STEAL" && opponentChoice === "STEAL") {
      return map.tearsTears;
    }
    return 0;
  };

  const handleAddParticipant = () => {
    if (!socket || !isHost || !newParticipantName.trim()) return;
    socket.emit("split-steal-add-player", sessionId, newParticipantName.trim());
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (!socket || !isHost) return;
    socket.emit("split-steal-remove-player", sessionId, participantId);
  };

  const handleSkipRound = () => {
    if (!socket || !isHost) return;
    socket.emit("split-steal-skip-round", sessionId);
    setShowSettings(false);
  };

  const renderCountdownPhase = () => (
    <div
      style={{
        textAlign: "center",
        animation: "fadeIn 0.8s ease-out",
      }}
    >
      <h2
        style={{
          fontSize: "2.5rem",
          fontWeight: "300",
          marginBottom: "1rem",
          color: "#4d9eff",
          textShadow: "0 0 20px rgba(77, 158, 255, 0.5)",
        }}
      >
        Time until next duel
      </h2>
      <div
        style={{
          fontSize: "6rem",
          fontWeight: "900",
          letterSpacing: "-2px",
          background:
            timeLeft <= 10
              ? "linear-gradient(135deg, #ff6b6b 0%, #dc143c 100%)"
              : "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          marginBottom: "2rem",
          animation: timeLeft <= 10 ? "pulse 1s ease-in-out infinite" : "none",
        }}
      >
        {formatTime(timeLeft)}
      </div>
      <p
        style={{
          fontSize: "1.5rem",
          opacity: 0.8,
          fontWeight: "300",
        }}
      >
        Players are preparing for the next duel...
      </p>
    </div>
  );

  const renderNegotiationPhase = () => (
    <div
      style={{
        textAlign: "center",
        animation: "fadeIn 0.8s ease-out",
      }}
    >
      <h2
        style={{
          fontSize: "3rem",
          fontWeight: "800",
          marginBottom: "2rem",
          background: "linear-gradient(135deg, #FFE066 0%, #FFA500 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 30px rgba(255, 165, 0, 0.3)",
        }}
      >
        Negotiation Phase
      </h2>

      <div
        style={{
          fontSize: "4rem",
          fontWeight: "700",
          color: "#fff",
          marginBottom: "3rem",
        }}
      >
        {formatTime(timeLeft)}
      </div>

      {currentPair && currentPair.player1 && currentPair.player2 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "3rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              padding: "2rem",
              background: "rgba(77, 158, 255, 0.1)",
              borderRadius: "15px",
              border: "2px solid rgba(77, 158, 255, 0.3)",
              animation: "slideInLeft 0.5s ease-out",
            }}
          >
            <h3
              style={{
                fontSize: "2rem",
                fontWeight: "700",
                color: "#4d9eff",
                marginBottom: "0.5rem",
              }}
            >
              {currentPair.player1.name || "Player 1"}
            </h3>
          </div>

          <span
            style={{
              fontSize: "2.5rem",
              fontWeight: "900",
              color: "#FFA500",
              textShadow: "0 0 20px rgba(255, 165, 0, 0.5)",
            }}
          >
            VS
          </span>

          <div
            style={{
              padding: "2rem",
              background: "rgba(255, 107, 107, 0.1)",
              borderRadius: "15px",
              border: "2px solid rgba(255, 107, 107, 0.3)",
              animation: "slideInRight 0.5s ease-out",
            }}
          >
            <h3
              style={{
                fontSize: "2rem",
                fontWeight: "700",
                color: "#ff6b6b",
                marginBottom: "0.5rem",
              }}
            >
              {currentPair.player2.name || "Player 2"}
            </h3>
          </div>
        </div>
      )}

      <p
        style={{
          fontSize: "1.3rem",
          opacity: 0.8,
          fontWeight: "300",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        Players have 60 seconds to negotiate before making their decision...
      </p>
    </div>
  );

  const renderDecisionPhase = () => (
    <div
      style={{
        textAlign: "center",
        animation: "fadeIn 0.8s ease-out",
      }}
    >
      <h2
        style={{
          fontSize: "3.5rem",
          fontWeight: "900",
          marginBottom: "3rem",
          background: "linear-gradient(135deg, #ff6b6b 0%, #dc143c 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          textShadow: "0 0 30px rgba(220, 20, 60, 0.3)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        Decision Time!
      </h2>

      {currentPair && currentPair.player1 && currentPair.player2 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4rem",
            marginBottom: "3rem",
          }}
        >
          <div
            style={{
              padding: "2.5rem",
              background: "rgba(20, 20, 20, 0.8)",
              borderRadius: "20px",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              animation: "scaleIn 0.5s ease-out",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h3
              style={{
                fontSize: "2.2rem",
                fontWeight: "800",
                background: "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {currentPair.player1.name || "Player 1"}
            </h3>
          </div>

          <span
            style={{
              fontSize: "3rem",
              fontWeight: "900",
              background: "linear-gradient(135deg, #FFE066 0%, #FF8C00 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 30px rgba(255, 140, 0, 0.5)",
            }}
          >
            VS
          </span>

          <div
            style={{
              padding: "2.5rem",
              background: "rgba(20, 20, 20, 0.8)",
              borderRadius: "20px",
              border: "2px solid rgba(255, 255, 255, 0.2)",
              animation: "scaleIn 0.5s ease-out 0.1s both",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h3
              style={{
                fontSize: "2.2rem",
                fontWeight: "800",
                background: "linear-gradient(135deg, #ff6b6b 0%, #dc143c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {currentPair.player2.name || "Player 2"}
            </h3>
          </div>
        </div>
      )}

      <p
        style={{
          fontSize: "1.5rem",
          opacity: 0.9,
          fontWeight: "400",
          color: "#FFE066",
          textShadow: "0 0 10px rgba(255, 224, 102, 0.3)",
        }}
      >
        Players are making their choices: Cheers Or Tears?
      </p>
    </div>
  );

  const renderRevealPhase = () => {
    // Get player choices (convert to uppercase to match button rendering)
    const player1Id = currentPair?.player1?.id;
    const player2Id = currentPair?.player2?.id;

    const player1Choice =
      player1Id !== undefined
        ? results?.choices[player1Id]?.toUpperCase()
        : undefined;
    const player2Choice =
      player2Id !== undefined
        ? results?.choices[player2Id]?.toUpperCase()
        : undefined;

    if (showPostReveal && currentPair && player1Choice && player2Choice) {
      const player1Sips = calculateSips(
        player1Choice,
        player2Choice,
        intensity
      );
      const player2Sips = calculateSips(
        player2Choice,
        player1Choice,
        intensity
      );

      return (
        <div className="reveal-phase">
          <div className="reveal-players-container">
            {/* Player 1 Card */}
            <div className="reveal-player-card">
              <div className="reveal-player-name">
                {currentPair.player1.name}
              </div>
              <div className="reveal-beer-emoji">🍺</div>
              <div className="reveal-sips-container">
                <div className="reveal-sips-number">{player1Sips}</div>
                <div className="reveal-sips-label">Slurker</div>
              </div>
            </div>

            {/* VS Divider */}
            <div className="reveal-vs-divider">VS</div>

            {/* Player 2 Card */}
            <div className="reveal-player-card">
              <div className="reveal-player-name">
                {currentPair.player2.name}
              </div>
              <div className="reveal-beer-emoji">🍺</div>
              <div className="reveal-sips-container">
                <div className="reveal-sips-number">{player2Sips}</div>
                <div className="reveal-sips-label">Slurker</div>
              </div>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="reveal-countdown-container">
            <div className="reveal-countdown-label">Neste runde starter om</div>
            <div className="reveal-countdown-timer">{formatTime(timeLeft)}</div>
          </div>
        </div>
      );
    }

    // Initial reveal animation phase with clean dashboard design
    return (
      <div className="reveal-animation-phase">
        {/* Title Section */}
        <div className="reveal-title-section">
          <h1 className="reveal-title">The Reveal</h1>
          <p className="reveal-subtitle">Did they cheers or cry?</p>
        </div>

        {results &&
          currentPair &&
          currentPair.player1 &&
          currentPair.player2 && (
            <>
              {/* Main Animation Container */}
              <div className="reveal-animation-container">
                {/* Red sliding bars */}
                <div className="reveal-red-bar reveal-red-bar-left"></div>
                <div className="reveal-red-bar reveal-red-bar-right"></div>

                {/* Player 1 button (left side) with name */}
                <div className="reveal-button-container reveal-button-left">
                  {/* Player 1 name - visible from start */}
                  <div className="reveal-player-name-label left">
                    <div className="reveal-player-name-text">
                      {currentPair.player1.name || "Player 1"}
                    </div>
                  </div>

                  <div className="reveal-button-wrapper">
                    {player1Choice === "SPLIT" ? (
                      // SPLIT button SVG
                      <svg
                        className="reveal-button-svg"
                        viewBox="0 0 200 200"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient id="yellowGradient1">
                            <stop offset="0%" stopColor="#FFE066" />
                            <stop offset="70%" stopColor="#FFA500" />
                            <stop offset="100%" stopColor="#FF8C00" />
                          </radialGradient>
                        </defs>
                        <g transform="translate(100, 100)">
                          <circle
                            r="75"
                            fill="none"
                            stroke="#C0C0C0"
                            strokeWidth="6"
                          />
                          <circle r="72" fill="white" />
                          <circle r="68" fill="url(#yellowGradient1)" />
                          <circle
                            r="63"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1"
                          />
                          <circle
                            r="58"
                            fill="none"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1"
                          />
                          <circle
                            r="53"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="#FFF"
                          >
                            CHEERS
                          </text>
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="none"
                            stroke="#FF8C00"
                            strokeWidth="3"
                          >
                            CHEERS
                          </text>
                        </g>
                      </svg>
                    ) : (
                      // STEAL button SVG
                      <svg
                        className="reveal-button-svg"
                        viewBox="0 0 200 200"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient id="redGradient1">
                            <stop offset="0%" stopColor="#FF6B6B" />
                            <stop offset="70%" stopColor="#DC143C" />
                            <stop offset="100%" stopColor="#8B0000" />
                          </radialGradient>
                        </defs>
                        <g transform="translate(100, 100)">
                          <circle
                            r="75"
                            fill="none"
                            stroke="#C0C0C0"
                            strokeWidth="6"
                          />
                          <circle r="72" fill="white" />
                          <circle r="68" fill="url(#redGradient1)" />
                          <circle
                            r="63"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1"
                          />
                          <circle
                            r="58"
                            fill="none"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1"
                          />
                          <circle
                            r="53"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="#FFF"
                          >
                            TEARS
                          </text>
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="none"
                            stroke="#8B0000"
                            strokeWidth="3"
                          >
                            TEARS
                          </text>
                        </g>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Player 2 button (right side) with name */}
                <div className="reveal-button-container reveal-button-right">
                  {/* Player 2 name - visible from start */}
                  <div className="reveal-player-name-label right">
                    <div className="reveal-player-name-text">
                      {currentPair.player2.name || "Player 2"}
                    </div>
                  </div>

                  <div className="reveal-button-wrapper">
                    {player2Choice === "SPLIT" ? (
                      // SPLIT button SVG
                      <svg
                        className="reveal-button-svg"
                        viewBox="0 0 200 200"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient id="yellowGradient2">
                            <stop offset="0%" stopColor="#FFE066" />
                            <stop offset="70%" stopColor="#FFA500" />
                            <stop offset="100%" stopColor="#FF8C00" />
                          </radialGradient>
                        </defs>
                        <g transform="translate(100, 100)">
                          <circle
                            r="75"
                            fill="none"
                            stroke="#C0C0C0"
                            strokeWidth="6"
                          />
                          <circle r="72" fill="white" />
                          <circle r="68" fill="url(#yellowGradient2)" />
                          <circle
                            r="63"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1"
                          />
                          <circle
                            r="58"
                            fill="none"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1"
                          />
                          <circle
                            r="53"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="#FFF"
                          >
                            CHEERS
                          </text>
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="none"
                            stroke="#FF8C00"
                            strokeWidth="3"
                          >
                            CHEERS
                          </text>
                        </g>
                      </svg>
                    ) : (
                      // STEAL button SVG
                      <svg
                        className="reveal-button-svg"
                        viewBox="0 0 200 200"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <defs>
                          <radialGradient id="redGradient2">
                            <stop offset="0%" stopColor="#FF6B6B" />
                            <stop offset="70%" stopColor="#DC143C" />
                            <stop offset="100%" stopColor="#8B0000" />
                          </radialGradient>
                        </defs>
                        <g transform="translate(100, 100)">
                          <circle
                            r="75"
                            fill="none"
                            stroke="#C0C0C0"
                            strokeWidth="6"
                          />
                          <circle r="72" fill="white" />
                          <circle r="68" fill="url(#redGradient2)" />
                          <circle
                            r="63"
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1"
                          />
                          <circle
                            r="58"
                            fill="none"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="1"
                          />
                          <circle
                            r="53"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="1"
                          />
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="#FFF"
                          >
                            TEARS
                          </text>
                          <text
                            y="10"
                            textAnchor="middle"
                            fontFamily="Arial Black"
                            fontSize="42"
                            fontWeight="900"
                            letterSpacing="-2"
                            fill="none"
                            stroke="#8B0000"
                            strokeWidth="3"
                          >
                            TEARS
                          </text>
                        </g>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Results overlay - only shows outcome message */}
              </div>

              {/* Countdown Section */}
              <div className="reveal-countdown-section">
                <div className="reveal-countdown-next">Next Round In</div>
                <div className="reveal-countdown-time">
                  {formatTime(timeLeft)}
                </div>
              </div>
            </>
          )}
      </div>
    );
  };

  const renderSettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <div
          style={{
            background: "rgba(20, 20, 20, 0.95)",
            borderRadius: "20px",
            padding: "3rem",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto",
            border: "2px solid rgba(255, 255, 255, 0.1)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            animation: "scaleIn 0.3s ease-out",
          }}
        >
          <h3
            style={{
              fontSize: "2rem",
              marginBottom: "2rem",
              background: "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Game Settings
          </h3>

          <div style={{ marginBottom: "2rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "1rem",
                fontSize: "1.2rem",
                fontWeight: "600",
                color: "#fff",
              }}
            >
              Participants ({participants.length})
            </label>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                padding: "1rem",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: "10px",
                marginBottom: "1rem",
              }}
            >
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.8rem",
                    marginBottom: "0.5rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  <span style={{ fontSize: "1.1rem", color: "#fff" }}>
                    {participant.name}
                  </span>
                  <button
                    onClick={() => handleRemoveParticipant(participant.id)}
                    style={{
                      padding: "0.5rem",
                      background: "rgba(255, 69, 69, 0.2)",
                      border: "1px solid rgba(255, 69, 69, 0.3)",
                      borderRadius: "6px",
                      color: "#ff4545",
                      fontSize: "1.2rem",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <input
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Enter participant name"
                maxLength={20}
                style={{
                  flex: 1,
                  padding: "0.8rem 1.2rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "2px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "1rem",
                }}
              />
              <button
                onClick={handleAddParticipant}
                disabled={!newParticipantName.trim()}
                style={{
                  padding: "0.8rem 2rem",
                  background: !newParticipantName.trim()
                    ? "rgba(100, 100, 100, 0.3)"
                    : "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
                  border: "none",
                  borderRadius: "10px",
                  color: "#fff",
                  fontSize: "1rem",
                  fontWeight: "600",
                  cursor: !newParticipantName.trim()
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => setShowSettings(false)}
              style={{
                padding: "1rem 2rem",
                background: "rgba(100, 100, 100, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              onClick={handleSkipRound}
              disabled={currentPhase === "countdown"}
              style={{
                padding: "1rem 2rem",
                background:
                  currentPhase === "countdown"
                    ? "rgba(100, 100, 100, 0.3)"
                    : "linear-gradient(135deg, #FFE066 0%, #FF8C00 100%)",
                border: "none",
                borderRadius: "10px",
                color: currentPhase === "countdown" ? "#666" : "#000",
                fontSize: "1rem",
                fontWeight: "600",
                cursor:
                  currentPhase === "countdown" ? "not-allowed" : "pointer",
              }}
            >
              Skip Round
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isHost) {
    return (
      <BlueDotBackground>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "4rem",
              fontWeight: "900",
              marginBottom: "2rem",
              background: "linear-gradient(135deg, #FFE066 0%, #FF8C00 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 30px rgba(255, 140, 0, 0.3)",
            }}
          >
            💰 Cheers Or Tears
          </h1>
          <div
            style={{
              background: "rgba(20, 20, 20, 0.9)",
              borderRadius: "20px",
              padding: "3rem",
              border: "2px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h3
              style={{
                fontSize: "2rem",
                marginBottom: "1rem",
                color: "#4d9eff",
              }}
            >
              Game in progress...
            </h3>
            <p style={{ fontSize: "1.3rem", opacity: 0.8 }}>
              The host is managing the game. Watch the main screen!
            </p>
          </div>
        </div>
      </BlueDotBackground>
    );
  }

  // Conditionally render the reveal phase
  if (currentPhase === "reveal") {
    return renderRevealPhase();
  }

  return (
    <BlueDotBackground>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          color: "#fff",
        }}
      >
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: "900",
            letterSpacing: "-2px",
            marginBottom: "3rem",
            background:
              "linear-gradient(135deg, #FFE066 0%, #FFA500 50%, #FF8C00 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 30px rgba(255, 165, 0, 0.5)",
          }}
        >
          💰 Cheers Or Tears
        </h1>

        <button
          onClick={() => setShowSettings(true)}
          style={{
            position: "absolute",
            top: "2rem",
            right: "2rem",
            padding: "1rem",
            background: "rgba(255, 255, 255, 0.1)",
            border: "2px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            color: "#fff",
            fontSize: "1.5rem",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
          }}
        >
          ⚙️
        </button>

        <div
          style={{
            background: "rgba(20, 20, 20, 0.9)",
            backdropFilter: "blur(10px)",
            borderRadius: "30px",
            padding: "4rem",
            minWidth: "800px",
            minHeight: "400px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            border: "2px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {currentPhase === "countdown" && renderCountdownPhase()}
          {currentPhase === "negotiation" && renderNegotiationPhase()}
          {currentPhase === "decision" && renderDecisionPhase()}
        </div>

        {renderSettingsModal()}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        
        input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </BlueDotBackground>
  );
};

export default SplitOrStealDashboard;
