import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import { PENALTY_SYSTEMS, PenaltyMode } from "../data/penaltySystems";
import "../styles/SplitOrSteal.css";

interface SplitOrStealSetupProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const SplitOrStealSetup: React.FC<SplitOrStealSetupProps> = ({
  sessionId,
  players,
  isHost,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  const [countdownDuration, setCountdownDuration] = useState<number>(30);
  // The host chooses which players participate. Start with an empty list so
  // only manually added players are included in the game configuration.
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>("party");
  const [newParticipantName, setNewParticipantName] = useState<string>("");

  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;

    // Check if name already exists
    if (
      participants.some(
        (p) => p.name.toLowerCase() === newParticipantName.toLowerCase()
      )
    ) {
      alert("A participant with this name already exists!");
      return;
    }

    const newParticipant = {
      id: `custom_${Date.now()}`, // Generate a unique ID for custom participants
      name: newParticipantName.trim(),
    };

    setParticipants([...participants, newParticipant]);
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (participantId: string) => {
    setParticipants(participants.filter((p) => p.id !== participantId));
  };

  const handleStartGame = () => {
    if (!socket || !isHost) return;

    if (participants.length < 2) {
      alert("You need at least 2 participants to start the game!");
      return;
    }

    // Emit configuration to server
    socket.emit("split-steal-config", sessionId, {
      countdownDuration,
      participants,
      penaltyMode,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddParticipant();
    }
  };

  if (!isHost) {
    return (
      <div className="split-or-steal">
        <h1>💰 Split or Steal</h1>
        <div className="setup-container">
          <div className="wait-message">
            <h3>Waiting for host to configure the game...</h3>
            <p>The host is setting up the participants and countdown timer.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="split-or-steal">
      <h1>💰 Split or Steal</h1>

      <div className="setup-container">
        <h2>Game Setup</h2>

        <div className="setup-form">
          <div className="form-group">
            <label htmlFor="countdown">Countdown Duration (seconds)</label>
            <input
              id="countdown"
              type="number"
              min="10"
              max="300"
              value={countdownDuration}
              onChange={(e) =>
                setCountdownDuration(parseInt(e.target.value) || 30)
              }
              placeholder="Time between duels"
            />
            <small style={{ opacity: 0.8 }}>
              Time players have to prepare between each duel (10-300 seconds)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="penalties">Penalty System</label>
            <select
              id="penalties"
              value={penaltyMode}
              onChange={(e) => setPenaltyMode(e.target.value as PenaltyMode)}
            >
              <option value="party">Party Mode</option>
              <option value="casual">Casual Mode</option>
              <option value="blackout">Blackout Mode</option>
            </select>
          </div>

          <div className="participants-section">
            <label>Participants ({participants.length})</label>

            <div className="participants-list">
              {participants.length === 0 ? (
                <p
                  style={{ textAlign: "center", opacity: 0.7, padding: "2rem" }}
                >
                  No participants added yet. Add some below!
                </p>
              ) : (
                participants.map((participant) => (
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
                ))
              )}
            </div>

            <div className="add-participant-form">
              <input
                className="add-participant-input"
                type="text"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                onKeyPress={handleKeyPress}
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

          <button
            className="start-game-button"
            onClick={handleStartGame}
            disabled={participants.length < 2}
          >
            {participants.length < 2
              ? "Need at least 2 participants"
              : `Start Game with ${participants.length} participants`}
          </button>
        </div>

        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            background: "rgba(0,0,0,0.1)",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ margin: "0 0 1rem 0" }}>How to Play:</h4>
          <ul style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: 1.6 }}>
            <li>
              <strong>Split:</strong> Both players get 2 points each
            </li>
            <li>
              <strong>Steal:</strong> Stealer gets 4 points, victim gets 0 and
              drinks
            </li>
            <li>
              <strong>Both Steal:</strong> Nobody gets points, both drink
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SplitOrStealSetup;
