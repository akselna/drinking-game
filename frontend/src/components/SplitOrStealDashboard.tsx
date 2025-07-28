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
    if (!results || !currentPair) return null;

    const player1Points = results.player1Points ?? 0;
    const player2Points = results.player2Points ?? 0;

    return (
      <div className="phase-container" style={{ background: "#2a5298" }}>
        <div className="player-pair" style={{ marginBottom: "1rem" }}>
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player1.name}
          </span>
          <span className="player-vs">VS</span>
          <span style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            {currentPair.player2.name}
          </span>
        </div>

        <div className="reveal-sip-results">
          <div className="reveal-sip-player">{player1Points} sips</div>
          <div className="reveal-sip-player">{player2Points} sips</div>
        </div>

        <div className="countdown-display" style={{ marginTop: "20px" }}>
          {formatTime(timeLeft)}
        </div>
        <p>{timeLeft} seconds until next round</p>
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
