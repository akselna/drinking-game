import React, { useState, useEffect } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealDashboardProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
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
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentPhase, setCurrentPhase] = useState<string>("countdown");
  const [currentPair, setCurrentPair] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string }>
  >(gameState?.participants || []);
  const [newParticipantName, setNewParticipantName] = useState<string>("");
  const [showPostReveal, setShowPostReveal] = useState<boolean>(false);

  // Initialize state from gameState
  useEffect(() => {
    if (gameState) {
      setTimeLeft(gameState.timeLeft || 0);
      setCurrentPhase(gameState.phase || "countdown");
      setCurrentPair(gameState.currentPair || null);
      setResults(gameState.results || null);
      setParticipants(gameState.participants || []);
    }
  }, [gameState]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTimerUpdate = (data: any) => {
      setTimeLeft(data.timeLeft);
    };

    const handleStateUpdate = (data: any) => {
      setCurrentPhase(data.phase);
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const calculateSips = (intensity?: string): number => {
    switch (intensity) {
      case "Mild":
        return 1;
      case "Medium":
        return 2;
      case "Fyllehund":
        return 3;
      case "Gr\u00f8fta":
        return 4;
      default:
        return 2;
    }
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
    <div className="phase-container">
      <div className="countdown-label">Time until next duel</div>
      <div className={`countdown-display ${timeLeft <= 10 ? "warning" : ""}`}>
        {formatTime(timeLeft)}
      </div>
      <p style={{ fontSize: "1.2rem", opacity: 0.9 }}>
        Players are preparing for the next duel...
      </p>
    </div>
  );

  const renderNegotiationPhase = () => (
    <div className="phase-container">
      <div className="negotiation-info">Negotiation Phase</div>
      <div className="countdown-display">{formatTime(timeLeft)}</div>

      {currentPair && currentPair.player1 && currentPair.player2 && (
        <div className="player-pair">
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player1.name || "Player 1"}
          </span>
          <span className="player-vs">VS</span>
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player2.name || "Player 2"}
          </span>
        </div>
      )}

      <p style={{ fontSize: "1.2rem", opacity: 0.9 }}>
        Players have 60 seconds to negotiate before making their decision...
      </p>
    </div>
  );

  const renderDecisionPhase = () => (
    <div className="phase-container">
      <div className="decision-info">Decision Time!</div>

      {currentPair && currentPair.player1 && currentPair.player2 && (
        <div className="player-pair">
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player1.name || "Player 1"}
          </span>
          <span className="player-vs">VS</span>
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player2.name || "Player 2"}
          </span>
        </div>
      )}

      <p style={{ fontSize: "1.2rem", opacity: 0.9 }}>
        Players are making their choices: Split or Steal?
      </p>
    </div>
  );

  const renderRevealPhase = () => {
    // Get player choices (convert to uppercase to match button rendering)
    const player1Choice =
      results?.choices?.[currentPair?.player1?.id]?.toUpperCase();
    const player2Choice =
      results?.choices?.[currentPair?.player2?.id]?.toUpperCase();

    if (showPostReveal && currentPair) {
      const player1Sips = calculateSips(currentPair.player1.intensity);
      const player2Sips = calculateSips(currentPair.player2.intensity);

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
          <p className="reveal-subtitle">Did they split or steal?</p>
        </div>

        {results &&
          currentPair &&
          currentPair.player1 &&
          currentPair.player2 && (
            <>
              {/* Main Animation Container */}
              <div className="reveal-animation-container">
                {/* Player Names Header */}
                <div className="reveal-players-header">
                  <div className="reveal-player-label">
                    <div className="reveal-player-label-name">
                      {currentPair.player1.name || "Player 1"}
                    </div>
                  </div>
                  <div className="reveal-player-label">
                    <div className="reveal-player-label-name">
                      {currentPair.player2.name || "Player 2"}
                    </div>
                  </div>
                </div>

                {/* Red sliding bars */}
                <div className="reveal-red-bar reveal-red-bar-left"></div>
                <div className="reveal-red-bar reveal-red-bar-right"></div>

                {/* Player 1 button (left side) */}
                <div className="reveal-button-container reveal-button-left">
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
                            SPLIT
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
                            SPLIT
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
                            STEAL
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
                            STEAL
                          </text>
                        </g>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Player 2 button (right side) */}
                <div className="reveal-button-container reveal-button-right">
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
                            SPLIT
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
                            SPLIT
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
                            STEAL
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
                            STEAL
                          </text>
                        </g>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Results overlay */}
                <div className="reveal-results-overlay">
                  {results.outcomeMessage && (
                    <div className="reveal-outcome-message">
                      {results.outcomeMessage}
                    </div>
                  )}

                  {results.drinkingPenalty &&
                    results.drinkingPenalty.length > 0 && (
                      <div className="reveal-drinking-penalty">
                        <div className="reveal-penalty-title">
                          <span>🍺</span>
                          <span>Drinking Penalty</span>
                          <span>🍺</span>
                        </div>
                        <div className="reveal-penalty-players">
                          {results.drinkingPenalty.map((playerId: string) => {
                            const player =
                              participants.find((p) => p.id === playerId) ||
                              (currentPair.player1.id === playerId
                                ? currentPair.player1
                                : currentPair.player2);
                            return (
                              <div
                                key={playerId}
                                className="reveal-penalty-player"
                              >
                                <strong>
                                  {player?.name || "Unknown Player"}
                                </strong>{" "}
                                must drink!
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
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
      <div className="settings-modal">
        <div className="settings-content">
          <h3>Game Settings</h3>

          <div className="participants-section">
            <label>Participants ({participants.length})</label>

            <div className="participants-list">
              {participants.map((participant) => (
                <div key={participant.id} className="participant-item">
                  <span className="participant-name">{participant.name}</span>
                  <button
                    className="remove-participant"
                    onClick={() => handleRemoveParticipant(participant.id)}
                    title="Remove participant"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="add-participant-form">
              <input
                className="add-participant-input"
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                placeholder="Enter participant name"
                maxLength={20}
              />
              <button
                className="add-participant-button"
                onClick={handleAddParticipant}
                disabled={!newParticipantName.trim()}
              >
                Add
              </button>
            </div>
          </div>

          <div className="settings-actions">
            <button
              className="close-settings"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
            <button
              className="skip-round"
              onClick={handleSkipRound}
              disabled={currentPhase === "countdown"}
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
      <div className="split-or-steal">
        <h1>💰 Split or Steal</h1>
        <div className="wait-message">
          <h3>Game in progress...</h3>
          <p>The host is managing the game. Watch the main screen!</p>
        </div>
      </div>
    );
  }

  // Conditionally render the reveal phase *outside* the main dashboard if it's active
  if (currentPhase === "reveal") {
    return renderRevealPhase();
  }

  return (
    <div className="split-or-steal">
      <h1>💰 Split or Steal</h1>

      <button
        className="settings-button"
        onClick={() => setShowSettings(true)}
        title="Game Settings"
      >
        ⚙️
      </button>

      <div className="dashboard-container">
        {currentPhase === "countdown" && renderCountdownPhase()}
        {currentPhase === "negotiation" && renderNegotiationPhase()}
        {currentPhase === "decision" && renderDecisionPhase()}
        {/* Reveal phase is now handled above to allow for a full-screen takeover */}
      </div>

      {renderSettingsModal()}
    </div>
  );
};

export default SplitOrStealDashboard;
