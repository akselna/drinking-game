import React, { useState, useEffect, useCallback } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/DrinkOrJudge.css";

interface DrinkOrJudgeProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const DrinkOrJudge: React.FC<DrinkOrJudgeProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  const [currentPhase, setCurrentPhase] = useState<string>("statement");
  const [currentStatement, setCurrentStatement] = useState<string>("");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [votesReceived, setVotesReceived] = useState<number>(0);
  const [totalVoters, setTotalVoters] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);

  // Colors for the game (similar to kahoot style)
  const gameColors = [
    "#e21b3c", // red
    "#1368ce", // blue
    "#26890c", // green
    "#ffa602", // yellow
    "#9c27b0", // purple
  ];

  // Set random background color
  const getBgColor = useCallback(() => {
    const colorIndex = Math.floor(Math.random() * gameColors.length);
    return gameColors[colorIndex];
  }, [gameColors]);

  const [bgColor, setBgColor] = useState(getBgColor());

  // Initialize game state from props
  useEffect(() => {
    if (gameState) {
      setCurrentPhase(gameState.phase || "statement");

      if (gameState.phase === "voting" && gameState.currentStatement) {
        setCurrentStatement(gameState.currentStatement);
      }

      if (gameState.phase === "results" && gameState.results) {
        setResults(gameState.results);
      }

      // Check if user has already voted
      if (gameState.votes && socket?.id && gameState.votes[socket.id]) {
        setHasVoted(true);
        setSelectedPlayer(gameState.votes[socket.id]);
      }
    }
  }, [gameState, socket?.id]);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    // Handle new statement
    const handleStatement = (data: any) => {
      setCurrentStatement(data.statement);
      setCurrentPhase(data.phase);
      setHasVoted(false);
      setSelectedPlayer(null);
      setVotesReceived(0);
      setBgColor(getBgColor());
    };

    // Handle vote updates
    const handleVoteUpdate = (data: any) => {
      setVotesReceived(data.votedCount);
      setTotalVoters(data.totalPlayers);
    };

    // Handle results
    const handleResults = (data: any) => {
      setResults(data.results);
      setCurrentPhase("results");
    };

    // Register event listeners
    socket.on("drink-or-judge-statement", handleStatement);
    socket.on("drink-or-judge-vote-update", handleVoteUpdate);
    socket.on("drink-or-judge-results", handleResults);

    // Clean up on unmount
    return () => {
      socket.off("drink-or-judge-statement", handleStatement);
      socket.off("drink-or-judge-vote-update", handleVoteUpdate);
      socket.off("drink-or-judge-results", handleResults);
    };
  }, [socket, getBgColor]);

  // Start the game (host only)
  const startGame = () => {
    if (!socket || !isHost) return;
    socket.emit("drink-or-judge-next-statement", sessionId);
  };

  // Submit vote
  const submitVote = () => {
    if (!socket || !selectedPlayer) return;
    socket.emit("drink-or-judge-vote", sessionId, selectedPlayer);
    setHasVoted(true);
  };

  // Move to next statement (host only)
  const nextStatement = () => {
    if (!socket || !isHost) return;
    socket.emit("drink-or-judge-next-statement", sessionId);
  };

  // Force show results (host only)
  const forceResults = () => {
    if (!socket || !isHost) return;
    socket.emit("drink-or-judge-force-results", sessionId);
  };

  // Render initial screen (waiting for host to start)
  if (currentPhase === "statement") {
    return (
      <div className="drink-or-judge statement-phase">
        <h2>Hvem i rommet?</h2>

        <div className="game-message">
          <p>
            I dette spillet vil dere stemme på hvem som passer best til
            forskjellige påstander.
          </p>
          <p>
            Den som får flest stemmer må drikke - antall slurker tilsvarer
            antall stemmer!
          </p>
        </div>

        {isHost ? (
          <div className="host-controls">
            <button onClick={startGame} className="start-button">
              Start spillet
            </button>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Venter på at verten skal starte spillet...</p>
          </div>
        )}
      </div>
    );
  }

  // Render voting phase
  if (currentPhase === "voting") {
    return (
      <div
        className="drink-or-judge voting-phase"
        style={{ backgroundColor: bgColor }}
      >
        <h2>Hvem i rommet?</h2>

        <div className="statement-container">
          <h3 className="statement-text">{currentStatement}</h3>
        </div>

        {!hasVoted ? (
          <div className="voting-container">
            <p className="vote-instruction">Stem på en person:</p>

            <div className="player-voting-list">
              {players.map((player) => {
                const isSelected = selectedPlayer === player.id;
                return (
                  <div key={player.id} className="player-vote-item">
                    <button
                      className={`player-vote-button ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() => setSelectedPlayer(player.id)}
                      disabled={player.id === socket?.id} // Can't vote for yourself
                    >
                      <span className="player-name">
                        {player.name} {player.id === socket?.id ? "(Deg)" : ""}
                      </span>

                      {isSelected && (
                        <span
                          className="confirm-vote"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the outer button
                            submitVote();
                          }}
                        >
                          Bekreft <span className="confirm-icon">✓</span>
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="vote-submitted">
            <p>Takk for din stemme!</p>
            <p>Venter på andre spillere...</p>
            <div className="vote-progress">
              <p>
                {votesReceived} av {totalVoters} har stemt
              </p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(votesReceived / totalVoters) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {isHost && (
          <div className="host-controls">
            <button onClick={forceResults} className="force-button">
              Vis resultater nå
            </button>
          </div>
        )}
      </div>
    );
  }

  if (currentPhase === "results") {
    // Get highest vote count to handle ties
    const highestVoteCount = results.length > 0 ? results[0].votes : 0;

    return (
      <div
        className="drink-or-judge results-phase"
        style={{ backgroundColor: bgColor }}
      >
        <h2>Resultater</h2>

        <div className="statement-container">
          <h3 className="statement-text">{currentStatement}</h3>
        </div>

        <div className="results-container">
          {results.map((result, index) => {
            // Check if this player is tied for first (has highest number of votes)
            const isWinner =
              result.votes > 0 && result.votes === highestVoteCount;

            return (
              <div
                key={result.id}
                className={`result-item ${isWinner ? "winner" : ""} ${
                  result.id === socket?.id ? "current-user" : ""
                }`}
              >
                <div className="result-name">
                  {result.name} {result.id === socket?.id ? "(Deg)" : ""}
                </div>
                <div className="result-votes">
                  <span className="vote-count">{result.votes}</span>
                  <span className="vote-text">stemmer</span>
                </div>

                {/* Show drinking instruction for players tied for highest vote count */}
                {isWinner && (
                  <div className="drinking-instruction winner-drink">
                    Drikk {result.votes} slurker!
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isHost && (
          <div className="host-controls">
            <button onClick={nextStatement} className="next-button">
              Neste påstand
            </button>
          </div>
        )}

        {!isHost && (
          <div className="waiting-message">
            <p>Venter på at verten skal fortsette...</p>
          </div>
        )}
      </div>
    );
  }

  return <div>Laster spill...</div>;
};

export default DrinkOrJudge;
