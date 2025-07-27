import React, { useState, useEffect } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealControllerProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const SplitOrStealController: React.FC<SplitOrStealControllerProps> = ({
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
  const [leaderboard, setLeaderboard] = useState<
    Array<{ id: string; name: string; points: number }>
  >([]);
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);
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
      setLeaderboard(gameState.leaderboard || []);
      setCurrentPlayer(gameState.currentPlayer || null);
      setParticipants(gameState.participants || []);


      // Reset choice when phase changes
      if (gameState.phase !== "decision") {
        setMyChoice(null);
      }
    }
  }, [gameState, socket?.id]);

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

      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }

      if (data.participants) {
        setParticipants(data.participants);
      }

      // Update current player
      if (data.currentPlayer !== undefined) {
        setCurrentPlayer(data.currentPlayer);
        setMyChoice(null);
      }

      // Reset choice when phase changes
      if (data.phase !== "decision") {
        setMyChoice(null);
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

  const handleChoice = (choice: "SPLIT" | "STEAL") => {
    if (!socket || !currentPlayer || myChoice) return;

    setMyChoice(choice);
    socket.emit("split-steal-choice", sessionId, {
      choice,
      playerId: currentPlayer,
    });
  };

  const handleAddParticipant = () => {
    if (!socket || !newParticipantName.trim()) return;

    socket.emit("split-steal-add-player", sessionId, newParticipantName.trim());
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (participantId: string) => {
    if (!socket) return;

    socket.emit("split-steal-remove-player", sessionId, participantId);
  };


  const getMyPointsFromLeaderboard = (): number => {
    if (!socket?.id) return 0;
    const myEntry = leaderboard.find((entry) => entry.id === socket.id);
    return myEntry ? myEntry.points : 0;
  };

  const renderCountdownPhase = () => (
    <div className="controller-container">
      <div className="phase-container">
        <div className="countdown-label">Next duel starting in</div>
        <div className={`countdown-display ${timeLeft <= 10 ? "warning" : ""}`}>
          {formatTime(timeLeft)}
        </div>
        <p style={{ fontSize: "1.1rem", opacity: 0.9, textAlign: "center" }}>
          Get ready for the next duel!
        </p>
      </div>
    </div>
  );

  const renderNegotiationPhase = () => (
    <div className="controller-container">
      <div className="phase-container">
        <h3>Negotiation Phase</h3>
        <div className="countdown-display">{formatTime(timeLeft)}</div>

        {currentPair && currentPair.player1 && currentPair.player2 && (
          <div className="player-pair">
            <span style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
              {currentPair.player1.name || "Player 1"}
            </span>
            <span className="player-vs">VS</span>
            <span style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
              {currentPair.player2.name || "Player 2"}
            </span>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <p style={{ fontSize: "1.1rem", opacity: 0.8 }}>
            Players are negotiating their choices.
          </p>
        </div>
      </div>
    </div>
  );

  const renderDecisionPhase = () => {
    if (!currentPair || !currentPlayer) {
      return (
        <div className="controller-container">
          <div className="wait-message">
            <h3>Decision in Progress</h3>
            <p>The current players are making their choices...</p>

            {currentPair && currentPair.player1 && currentPair.player2 && (
              <div className="player-pair">
                <span>{currentPair.player1.name || "Player 1"}</span>
                <span className="player-vs">VS</span>
                <span>{currentPair.player2.name || "Player 2"}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    const activePlayer =
      currentPair.player1.id === currentPlayer
        ? currentPair.player1
        : currentPair.player2;

    return (
      <div className="controller-container">
        <div className="current-player-indicator">
          <div className="your-turn">{activePlayer.name}'s Turn</div>
          <p>Choose your strategy: Split or Steal?</p>
        </div>

        <div className="choice-buttons">
          <button
            className="choice-button split-button"
            onClick={() => handleChoice("SPLIT")}
            disabled={!!myChoice}
          >
           {myChoice === "SPLIT" ? "✓ " : ""}Split
          </button>
          <button
            className="choice-button steal-button"
            onClick={() => handleChoice("STEAL")}
            disabled={!!myChoice}
          >
            {myChoice === "STEAL" ? "✓ " : ""}Steal
          </button>
        </div>

        {myChoice && (
          <div
            style={{ textAlign: "center", marginTop: "1rem", color: "#f1c40f" }}
          >
            <strong>You chose: {myChoice}</strong>
          </div>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: "2rem",
            padding: "1rem",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem 0" }}>Quick Reminder:</h4>
          <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.4 }}>
            <strong>Both Split:</strong> 2 points each
            <br />
            <strong>Split vs Steal:</strong> Stealer gets 4, Splitter drinks
            <br />
            <strong>Both Steal:</strong> 0 points each, both drink
          </p>
        </div>
      </div>
    );
  };

  const renderRevealPhase = () => (
    <div className="controller-container">
      <div className="reveal-results">
        <h3 style={{ marginTop: 0 }}>Results</h3>

        {results &&
          currentPair &&
          currentPair.player1 &&
          currentPair.player2 && (
            <>
              <div className="choice-display">
                <div className="choice-item">
                  <div className="choice-name">
                    {currentPair.player1.name || "Player 1"}
                  </div>
                  <div
                    className={`choice-value choice-${
                      results.choices && results.choices[currentPair.player1.id]
                        ? results.choices[currentPair.player1.id].toLowerCase()
                        : "unknown"
                    }`}
                  >
                    {(results.choices &&
                      results.choices[currentPair.player1.id]) ||
                      "Unknown"}
                  </div>
                </div>
                <div className="choice-item">
                  <div className="choice-name">
                    {currentPair.player2.name || "Player 2"}
                  </div>
                  <div
                    className={`choice-value choice-${
                      results.choices && results.choices[currentPair.player2.id]
                        ? results.choices[currentPair.player2.id].toLowerCase()
                        : "unknown"
                    }`}
                  >
                    {(results.choices &&
                      results.choices[currentPair.player2.id]) ||
                      "Unknown"}
                  </div>
                </div>
              </div>

              <div className="outcome-message">
                {results.outcomeMessage || "No outcome message"}
              </div>

              {results.drinkingPenalty &&
                results.drinkingPenalty.includes(socket?.id) && (
                  <div className="drinking-penalty">
                    <div className="penalty-title">🍺 You must drink!</div>
                  </div>
                )}
            </>
          )}
      </div>

      <div className="countdown-display">{formatTime(timeLeft)}</div>
      <p style={{ textAlign: "center" }}>
        Next round starting in {timeLeft} seconds...
      </p>
    </div>
  );

  const renderSettingsModal = () => {
    if (!showSettings) return null;

    return (
      <div className="settings-modal">
        <div className="settings-content">
          <h3>Participants</h3>

          <div className="participants-section">
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
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="split-or-steal">
      <h1>💰 Split or Steal</h1>

      <button
        className="settings-button"
        onClick={() => setShowSettings(true)}
        title="Settings"
      >
        ⚙️
      </button>

      {currentPhase === "countdown" && renderCountdownPhase()}
      {currentPhase === "negotiation" && renderNegotiationPhase()}
      {currentPhase === "decision" && renderDecisionPhase()}
      {currentPhase === "reveal" && renderRevealPhase()}

      {/* Always show personal score */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          background: "rgba(0,0,0,0.3)",
          padding: "10px 15px",
          borderRadius: "8px",
          backdropFilter: "blur(10px)",
        }}
      >
        <strong>Your Score: {getMyPointsFromLeaderboard()} pts</strong>
      </div>

      {renderSettingsModal()}
    </div>
  );
};

export default SplitOrStealController;
