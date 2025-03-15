import React, { useState, useEffect } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/Beat4Beat.css";

interface Beat4BeatProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const Beat4Beat: React.FC<Beat4BeatProps> = ({
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
  const [currentPhase, setCurrentPhase] = useState<string>("waiting");
  const [buzzOrder, setBuzzOrder] = useState<any[]>([]);
  const [hasBuzzed, setHasBuzzed] = useState<boolean>(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [buzzTime, setBuzzTime] = useState<number | null>(null);
  const [roundActive, setRoundActive] = useState<boolean>(false);
  const [waitingMessage, setWaitingMessage] = useState<string>("");
  const [roundWinner, setRoundWinner] = useState<string | null>(null);

  // Initialize from gameState
  useEffect(() => {
    if (gameState) {
      setCurrentPhase(gameState.phase || "waiting");
      setBuzzOrder(gameState.buzzOrder || []);
      setScores(gameState.scores || {});
      setRoundNumber(gameState.roundNumber || 1);
      setRoundActive(gameState.roundActive || false);

      // Check if this player has already buzzed in this round
      if (socket && gameState.buzzOrder) {
        const alreadyBuzzed = gameState.buzzOrder.some(
          (item: any) => item.playerId === socket.id
        );
        setHasBuzzed(alreadyBuzzed);
      }
    }
  }, [gameState, socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleRoundStart = (data: any) => {
      setCurrentPhase("buzzing");
      setRoundActive(true);
      setBuzzOrder([]);
      setHasBuzzed(false);
      setBuzzTime(null);
      setWaitingMessage("");
    };

    const handleBuzzUpdate = (data: any) => {
      setBuzzOrder(data.buzzOrder);

      // Update local state if the current user has buzzed
      if (
        socket.id &&
        data.buzzOrder.some((item: any) => item.playerId === socket.id)
      ) {
        setHasBuzzed(true);
      }
    };

    const handleRoundEnd = (data: any) => {
      setCurrentPhase("results");
      setRoundActive(false);
      setRoundWinner(data.winnerId || null);

      // In the results phase, we'll keep the order of players as is
      // and won't sort by score until next round
    };

    const handleScoreUpdate = (data: any) => {
      setScores(data.scores);
      // We don't reorder players here, just update their scores
    };

    const handleNextRound = (data: any) => {
      // When moving to the next round, we now sort the scores
      setRoundNumber(data.roundNumber);
      setCurrentPhase("waiting");
      setBuzzOrder([]);
      setHasBuzzed(false);
      setBuzzTime(null);
      setRoundWinner(null);
    };

    // Register event listeners
    socket.on("beat4beat-round-start", handleRoundStart);
    socket.on("beat4beat-buzz-update", handleBuzzUpdate);
    socket.on("beat4beat-round-end", handleRoundEnd);
    socket.on("beat4beat-score-update", handleScoreUpdate);
    socket.on("beat4beat-next-round", handleNextRound);

    // Cleanup on unmount
    return () => {
      socket.off("beat4beat-round-start", handleRoundStart);
      socket.off("beat4beat-buzz-update", handleBuzzUpdate);
      socket.off("beat4beat-round-end", handleRoundEnd);
      socket.off("beat4beat-score-update", handleScoreUpdate);
      socket.off("beat4beat-next-round", handleNextRound);
    };
  }, [socket]);

  // Handle buzzing
  const handleBuzz = () => {
    if (!socket || !roundActive) return;

    const timestamp = Date.now();
    setBuzzTime(timestamp);
    setHasBuzzed(true);
    setWaitingMessage("Buzz registered! Waiting for others...");

    socket.emit("beat4beat-buzz", sessionId, timestamp);
  };

  // Start a new round (host only)
  const startRound = () => {
    if (!socket || !isHost) return;
    socket.emit("beat4beat-start-round", sessionId);
  };

  // End the current round (host only)
  const endRound = () => {
    if (!socket || !isHost) return;
    socket.emit("beat4beat-end-round", sessionId);
  };

  // Award points to a player (host only)
  const awardPoints = (playerId: string, points: number) => {
    if (!socket || !isHost) return;
    socket.emit("beat4beat-award-points", sessionId, playerId, points);
  };

  // Adjust points (increment/decrement) for a player (host only)
  const adjustPoints = (playerId: string, adjustment: number) => {
    if (!socket || !isHost) return;
    const currentPoints = scores[playerId] || 0;
    const newPoints = Math.max(0, currentPoints + adjustment); // Prevent negative scores
    socket.emit(
      "beat4beat-award-points",
      sessionId,
      playerId,
      newPoints - currentPoints
    );
  };

  // Start next round (host only)
  const nextRound = () => {
    if (!socket || !isHost) return;
    socket.emit("beat4beat-next-round", sessionId);
  };

  // Reset game (host only)
  const resetGame = () => {
    if (!socket || !isHost) return;
    socket.emit("beat4beat-reset", sessionId);
  };

  // Render player list with buzz order
  const renderPlayerList = () => {
    // Find the host ID - either directly from socket.hostId or from players with isHost=true
    const hostId = socket?.hostId || players.find((p) => p.isHost)?.id;

    // Filter out the host from the player list
    const filteredPlayers = players.filter((player) => player.id !== hostId);

    return filteredPlayers.map((player) => {
      const buzzPosition = buzzOrder.findIndex(
        (item) => item.playerId === player.id
      );
      const hasPlayerBuzzed = buzzPosition !== -1;
      const playerScore = scores[player.id] || 0;

      return (
        <div
          key={player.id}
          className={`player-item ${hasPlayerBuzzed ? "buzzed" : ""} ${
            roundWinner === player.id ? "winner" : ""
          }`}
        >
          <div className="player-info">
            <span className="player-name">
              {player.name} {player.id === socket?.id ? " (You)" : ""}
            </span>
            {hasPlayerBuzzed && (
              <span className="buzz-position">#{buzzPosition + 1}</span>
            )}
          </div>

          <div className="score-controls">
            {isHost && (
              <div className="point-adjustment-controls">
                <button
                  onClick={() => adjustPoints(player.id, 1)}
                  className="adjust-point-button increment"
                  title="Increase points"
                >
                  +
                </button>
              </div>
            )}

            <span className="player-score">{playerScore} pts</span>

            {isHost && (
              <div className="point-adjustment-controls">
                <button
                  onClick={() => adjustPoints(player.id, -1)}
                  className="adjust-point-button decrement"
                  title="Decrease points"
                >
                  -
                </button>
              </div>
            )}
          </div>

          {/* Only show award buttons for the host during results phase */}
          {isHost && currentPhase === "results" && (
            <div className="award-buttons">
              <button
                onClick={() => awardPoints(player.id, 0)}
                className="award-button no-points"
              >
                0
              </button>
              <button
                onClick={() => awardPoints(player.id, 1)}
                className="award-button one-point"
              >
                +1
              </button>
              <button
                onClick={() => awardPoints(player.id, 2)}
                className="award-button two-points"
              >
                +2
              </button>
              <button
                onClick={() => awardPoints(player.id, 3)}
                className="award-button three-points"
              >
                +3
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  // Render the initial waiting screen
  if (currentPhase === "waiting") {
    return (
      <div className="beat4beat waiting-phase">
        <h2>Beat4Beat</h2>

        <div className="round-info">
          <span className="round-number">Round {roundNumber}</span>
        </div>

        <div className="instructions">
          <p>
            Get ready! The host will play a song, and you'll need to buzz in
            when you know the answer.
          </p>
          <p>The faster you buzz, the better your chance to answer first!</p>
        </div>

        <div className="scoreboard">
          <h3>Current Scores</h3>
          <div className="player-list">{renderPlayerList()}</div>
        </div>

        {isHost ? (
          <div className="host-controls">
            <button
              onClick={startRound}
              className="control-button start-button"
            >
              Start Round
            </button>
            <button onClick={resetGame} className="control-button reset-button">
              Reset Game
            </button>
          </div>
        ) : (
          <div className="player-message">
            <p>Waiting for the host to start the round...</p>
          </div>
        )}
      </div>
    );
  }

  // Render the buzzing screen
  if (currentPhase === "buzzing") {
    return (
      <div className="beat4beat buzzing-phase">
        <div className="round-info">
          <span className="round-number">Round {roundNumber}</span>
        </div>

        {!isHost ? (
          <div className="buzz-container">
            <button
              onClick={handleBuzz}
              className="buzz-button"
              disabled={!roundActive}
            >
              BUZZ!
            </button>
            {hasBuzzed && (
              <div className="buzz-confirmation">
                <div className="confirmation-icon">✓</div>
                <p>{waitingMessage}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="host-view">
            <h3>Waiting for players to buzz...</h3>
            <div className="buzz-order">
              {buzzOrder.length > 0 ? (
                <div className="buzzer-list">
                  {buzzOrder.map((item, index) => {
                    const player = players.find((p) => p.id === item.playerId);
                    return (
                      <div key={item.playerId} className="buzzer-item">
                        <span className="buzz-position">#{index + 1}</span>
                        <span className="buzzer-name">
                          {player ? player.name : "Unknown"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p>No one has buzzed yet</p>
              )}
            </div>
            <button
              onClick={endRound}
              className="control-button end-round-button"
            >
              End Round
            </button>
          </div>
        )}

        <div className="live-buzz-feed">
          <h3>Live Buzz Feed</h3>
          <div className="player-list">{renderPlayerList()}</div>
        </div>
      </div>
    );
  }

  // Render the results screen
  if (currentPhase === "results") {
    return (
      <div className="beat4beat results-phase">
        <h2>Round {roundNumber} Results</h2>

        <div className="round-results">
          <div className="buzz-order">
            <h3>Buzz Order</h3>
            {buzzOrder.length > 0 ? (
              <div className="buzzer-list">
                {buzzOrder.map((item, index) => {
                  const player = players.find((p) => p.id === item.playerId);
                  return (
                    <div
                      key={item.playerId}
                      className={`buzzer-item ${
                        roundWinner === item.playerId ? "winner" : ""
                      }`}
                    >
                      <span className="buzz-position">#{index + 1}</span>
                      <span className="buzzer-name">
                        {player ? player.name : "Unknown"}
                        {player && player.id === socket?.id ? " (You)" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>No one buzzed this round</p>
            )}
          </div>
        </div>

        <div className="scoreboard">
          <h3>Current Scores</h3>
          <div className="player-list score-list">
            {players
              // Find the host ID - either directly from socket.hostId or from players with isHost=true
              .filter((player) => {
                const hostId =
                  socket?.hostId || players.find((p) => p.isHost)?.id;
                return player.id !== hostId;
              })
              // Don't sort by score while adjusting - preserve original order
              .map((player) => (
                <div key={player.id} className="player-score-item">
                  <span className="player-name">
                    {player.name} {player.id === socket?.id ? " (You)" : ""}
                  </span>
                  <div className="score-controls">
                    {isHost && (
                      <button
                        onClick={() => adjustPoints(player.id, 1)}
                        className="adjust-point-button increment"
                        title="Increase points"
                      >
                        +
                      </button>
                    )}
                    <span className="player-score">
                      {scores[player.id] || 0} pts
                    </span>
                    {isHost && (
                      <button
                        onClick={() => adjustPoints(player.id, -1)}
                        className="adjust-point-button decrement"
                        title="Decrease points"
                      >
                        -
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {isHost && (
          <div className="host-controls">
            <button onClick={nextRound} className="control-button next-button">
              Next Round
            </button>
          </div>
        )}

        {!isHost && (
          <div className="player-message">
            <p>Waiting for the host to start the next round...</p>
          </div>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="beat4beat">
      <h2>Beat4Beat</h2>
      <p>Loading game...</p>
    </div>
  );
};

export default Beat4Beat;
