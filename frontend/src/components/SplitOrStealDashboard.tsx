import React, { useState, useEffect } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

const penaltySystems: Record<string, { splitSplit: string; splitSteal: string; stealSteal: string }> = {
  party: {
    splitSplit: "5 sips each",
    splitSteal: "Splitter = 10 sips, Stealer = none",
    stealSteal: "20 sips each (≈ half a 0.5 L bottle)",
  },
  casual: {
    splitSplit: "2 sips each",
    splitSteal: "Splitter = 5 sips, Stealer = none",
    stealSteal: "10 sips each (≈ quarter bottle)",
  },
  blackout: {
    splitSplit: "10 sips each",
    splitSteal: "Splitter = ½-chug (~12–15 sips), Stealer = none",
    stealSteal: "Full chug (~30–35 sips)",
  },
};

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
  const [penaltyMode, setPenaltyMode] = useState<string>(gameState?.penaltyMode || "party");

  // Initialize state from gameState
  useEffect(() => {
    if (gameState) {
      setTimeLeft(gameState.timeLeft || 0);
      setCurrentPhase(gameState.phase || "countdown");
      setCurrentPair(gameState.currentPair || null);
      setResults(gameState.results || null);
      setParticipants(gameState.participants || []);
      setPenaltyMode(gameState.penaltyMode || "party");
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

      if (data.penaltyMode) {
        setPenaltyMode(data.penaltyMode);
      }
    };

    socket.on("split-steal-timer", handleTimerUpdate);
    socket.on("split-steal-state", handleStateUpdate);

    return () => {
      socket.off("split-steal-timer", handleTimerUpdate);
      socket.off("split-steal-state", handleStateUpdate);
    };
  }, [socket]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
      <div className="penalty-summary">
        <div>Next up:</div>
        <ul>
          <li>Split / Split: {penaltySystems[penaltyMode].splitSplit}</li>
          <li>Split / Steal: {penaltySystems[penaltyMode].splitSteal}</li>
          <li>Steal / Steal: {penaltySystems[penaltyMode].stealSteal}</li>
        </ul>
      </div>
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

    return (
      <div className="phase-container">
        <style>{`
         .reveal-animation-container {
          position: relative;
          width: 100vw; /* Changed: Use viewport width */
          left: 50%;
          right: 50%;
          margin-left: -50vw;
          margin-right: -50vw;
          height: 400px;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
          background: radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1e 100%);
          /* border-radius and margin removed to be flush with edges */
        }
  
          .reveal-red-bar {
            position: absolute;
            height: 120px;
            background: linear-gradient(90deg, #DC143C 0%, #FF6B6B 50%, #DC143C 100%);
            box-shadow: 
              0 0 30px rgba(220, 20, 60, 0.8),
              0 0 60px rgba(220, 20, 60, 0.5),
              inset 0 2px 4px rgba(255, 255, 255, 0.3);
            z-index: 10;
          }
  
          .reveal-red-bar-left {
            left: -50%;
            width: 50%;
            animation: revealSlideInLeft 1.5s ease-out forwards;
          }
  
          .reveal-red-bar-right {
            right: -50%;
            width: 50%;
            animation: revealSlideInRight 1.5s ease-out forwards;
          }
  
          @keyframes revealSlideInLeft {
            to {
              left: 0;
              width: calc(20% + 75px);
            }
          }
  
          @keyframes revealSlideInRight {
            to {
              right: 0;
              width: calc(20% + 75px);
            }
          }
  
          .reveal-button-container {
            position: absolute;
            z-index: 20;
            opacity: 0;
            animation: revealFadeIn 0.5s ease-out 1.5s forwards;
          }
  
          .reveal-button-left {
            left: 20%;
          }
  
          .reveal-button-right {
            right: 20%;
          }
  
          @keyframes revealFadeIn {
            to {
              opacity: 1;
            }
          }
  
          .reveal-button-svg {
            width: 150px;
            height: 150px;
            filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.8));
          }
  
          .player-name-label {
            position: absolute;
            bottom: -40px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            width: 200px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          }
  
          .reveal-results-overlay {
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            color: white;
            z-index: 30;
            opacity: 0;
            animation: revealFadeIn 0.5s ease-out 2s forwards;
          }
  
          .reveal-outcome-message {
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          }
  
          .reveal-drinking-penalty {
            background: rgba(0, 0, 0, 0.5);
            padding: 15px;
            border-radius: 10px;
            margin-top: 20px;
          }
  
          .reveal-penalty-title {
            font-size: 20px;
            margin-bottom: 10px;
          }
        `}</style>

        <div className="reveal-results">
          <h3 style={{ marginTop: 0 }}>Results</h3>

          {results &&
            currentPair &&
            currentPair.player1 &&
            currentPair.player2 && (
              <div className="reveal-animation-container">
                {/* Red bars */}
                <div className="reveal-red-bar reveal-red-bar-left"></div>
                <div className="reveal-red-bar reveal-red-bar-right"></div>

                {/* Player 1 button (left side) */}
                <div className="reveal-button-container reveal-button-left">
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
                          r="70"
                          fill="none"
                          stroke="#C0C0C0"
                          strokeWidth="5"
                        />
                        <circle r="68" fill="white" />
                        <circle r="65" fill="url(#yellowGradient1)" />
                        <circle
                          r="60"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <circle
                          r="55"
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1"
                        />
                        <circle
                          r="50"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="1"
                        />
                        <circle
                          r="45"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                        <text
                          y="10"
                          textAnchor="middle"
                          fontFamily="Arial Black"
                          fontSize="40"
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
                          fontSize="40"
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
                          r="70"
                          fill="none"
                          stroke="#C0C0C0"
                          strokeWidth="5"
                        />
                        <circle r="68" fill="white" />
                        <circle r="65" fill="url(#redGradient1)" />
                        <circle
                          r="60"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <circle
                          r="55"
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1"
                        />
                        <circle
                          r="50"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="1"
                        />
                        <circle
                          r="45"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                        <text
                          y="10"
                          textAnchor="middle"
                          fontFamily="Arial Black"
                          fontSize="40"
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
                          fontSize="40"
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
                  <div className="player-name-label">
                    {currentPair.player1.name || "Player 1"}
                  </div>
                </div>

                {/* Player 2 button (right side) */}
                <div className="reveal-button-container reveal-button-right">
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
                          r="70"
                          fill="none"
                          stroke="#C0C0C0"
                          strokeWidth="5"
                        />
                        <circle r="68" fill="white" />
                        <circle r="65" fill="url(#yellowGradient2)" />
                        <circle
                          r="60"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <circle
                          r="55"
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1"
                        />
                        <circle
                          r="50"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="1"
                        />
                        <circle
                          r="45"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                        <text
                          y="10"
                          textAnchor="middle"
                          fontFamily="Arial Black"
                          fontSize="40"
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
                          fontSize="40"
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
                          r="70"
                          fill="none"
                          stroke="#C0C0C0"
                          strokeWidth="5"
                        />
                        <circle r="68" fill="white" />
                        <circle r="65" fill="url(#redGradient2)" />
                        <circle
                          r="60"
                          fill="none"
                          stroke="rgba(255,255,255,0.2)"
                          strokeWidth="1"
                        />
                        <circle
                          r="55"
                          fill="none"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="1"
                        />
                        <circle
                          r="50"
                          fill="none"
                          stroke="rgba(255,255,255,0.1)"
                          strokeWidth="1"
                        />
                        <circle
                          r="45"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                        <text
                          y="10"
                          textAnchor="middle"
                          fontFamily="Arial Black"
                          fontSize="40"
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
                          fontSize="40"
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
                  <div className="player-name-label">
                    {currentPair.player2.name || "Player 2"}
                  </div>
                </div>

                {/* Results overlay */}
                <div className="reveal-results-overlay">
                  <div className="reveal-outcome-message">
                    {results.outcomeMessage || "No outcome message"}
                  </div>

                  {results.drinkingPenalty &&
                    results.drinkingPenalty.length > 0 && (
                      <div className="reveal-drinking-penalty">
                        <div className="reveal-penalty-title">
                          🍺 Drinking Penalty:
                        </div>
                        {results.drinkingPenalty.map((playerId: string) => {
                          const player =
                            participants.find((p) => p.id === playerId) ||
                            (currentPair.player1.id === playerId
                              ? currentPair.player1
                              : currentPair.player2);
                          return (
                            <div key={playerId} style={{ marginTop: "0.5rem" }}>
                              <strong>
                                {player?.name || "Unknown Player"}
                              </strong>{" "}
                              must drink!
                            </div>
                          );
                        })}
                      </div>
                    )}
                </div>
              </div>
            )}

          <div className="countdown-display" style={{ marginTop: "20px" }}>
            {formatTime(timeLeft)}
          </div>
          <p>Next round starting in {timeLeft} seconds...</p>
        </div>
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
