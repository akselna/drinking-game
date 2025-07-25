import React, { useState, useEffect, useRef } from "react";
import "../styles/NeverHaveIEver.css"; // This will use the updated CSS
import { CustomSocket } from "../types/socket.types";

interface NeverHaveIEverProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const NeverHaveIEver: React.FC<NeverHaveIEverProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  const [statement, setStatement] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerDuration, setTimerDuration] = useState(60);
  const [currentStatement, setCurrentStatement] = useState<any>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(
    gameState?.phase || "collecting"
  );
  const [statementIndex, setStatementIndex] = useState(0);
  const [statements, setStatements] = useState<any[]>([]);
  const [userStatements, setUserStatements] = useState<any[]>([]);
  const [totalStatements, setTotalStatements] = useState(0);
  const [addingNewStatement, setAddingNewStatement] = useState(false);
  const [timerActive, setTimerActive] = useState(false);

  // Interval ref for the timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Kahoot-like colors for different statements
  const kahootColors = [
    "#e21b3c", // red
    "#1368ce", // blue
    "#26890c", // green
    "#ffa602", // yellow
    "#9c27b0", // purple
    "#f06292", // pink
    "#00bcd4", // cyan
    "#ff9800", // orange
  ];

  // Get color based on current statement index
  const getCurrentColor = () => {
    return kahootColors[statementIndex % kahootColors.length];
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!socket) return;

    // Timer updates
    const handleTimerUpdate = (data: any) => {
      console.log("Timer update:", data);
      setTimeLeft(data.timeLeft);
      if (data.timerDuration) {
        setTimerDuration(data.timerDuration);
      }
      setTimerActive(true);
    };

    // Statement submission updates
    const handleStatementSubmitted = (data: any) => {
      console.log("Statement submitted:", data);
      setSubmittedCount(data.submittedCount);

      // Update with the full statements array if available
      if (data.statements) {
        const userSubmitted = data.statements.filter(
          (s: any) => s.authorId !== "system" && s.authorId === socket.id
        );
        setUserStatements(userSubmitted);
      }
    };

    // Phase changes
    const handlePhaseChanged = (data: any) => {
      console.log("Phase changed:", data);
      if (data.phase === "revealing") {
        setCurrentPhase("revealing");
        setCurrentStatement(data.statement);
        setStatementIndex(data.statementIndex || 0);
        setTotalStatements(data.totalStatements || 0);

        // Store all statements locally for easier navigation
        if (data.statements) {
          setStatements(data.statements);
        }
      }
    };

    // Next statement
    const handleNextStatement = (data: any) => {
      console.log("Next statement:", data);
      setCurrentStatement(data.statement);
      setStatementIndex(data.statementIndex || 0);
      setTotalStatements(data.totalStatements || 0);
    };

    // Game ended
    const handleGameEnded = (data: any) => {
      console.log("Game ended:", data);
      setGameEnded(true);
      setTimerActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    // Register event listeners
    socket.on("timer-update", handleTimerUpdate);
    socket.on("statement-submitted", handleStatementSubmitted);
    socket.on("phase-changed", handlePhaseChanged);
    socket.on("next-statement", handleNextStatement);
    socket.on("game-ended", handleGameEnded);

    // Clean up on unmount
    return () => {
      socket.off("timer-update", handleTimerUpdate);
      socket.off("statement-submitted", handleStatementSubmitted);
      socket.off("phase-changed", handlePhaseChanged);
      socket.off("next-statement", handleNextStatement);
      socket.off("game-ended", handleGameEnded);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [socket]);

  // Timer effect
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive, timeLeft]);

  // Set initial state based on gameState from props
  useEffect(() => {
    if (gameState) {
      console.log("gameState updated:", gameState);

      setCurrentPhase(gameState.phase || "collecting");

      // Sync local states with gameState
      if (gameState.phase === "revealing" && gameState.statements) {
        setStatements(gameState.statements);
        setTotalStatements(gameState.statements.length);
        setStatementIndex(gameState.currentStatementIndex || 0);

        if (
          gameState.currentStatementIndex >= 0 &&
          gameState.statements.length > 0
        ) {
          setCurrentStatement(
            gameState.statements[gameState.currentStatementIndex]
          );
        }
      }

      if (gameState.statements) {
        // The server now differentiates between total statements and player-submitted ones
        // We only care about player submissions for the collecting phase
        setSubmittedCount(
          gameState.statements.filter((s: any) => s.authorId !== "system")
            .length || 0
        );

        // Track user's own submitted statements
        if (socket) {
          const userSubmitted = gameState.statements.filter(
            (s: any) => s.authorId !== "system" && s.authorId === socket.id
          );
          setUserStatements(userSubmitted);
        }
      }

      // Get timer duration from gameState if available
      if (gameState.timerDuration) {
        setTimerDuration(gameState.timerDuration);
      }

      if (gameState.timeLeft) {
        setTimeLeft(gameState.timeLeft);
        if (gameState.timeLeft < gameState.timerDuration) {
          setTimerActive(true);
        }
      }

      // Check if game ended
      if (gameState.phase === "ended") {
        setGameEnded(true);
      }
    }
  }, [gameState, socket]);

  const handleSubmitStatement = () => {
    if (!socket) return;

    if (statement.trim()) {
      console.log("Submitting statement:", statement);
      socket.emit("submit-never-statement", sessionId, statement);
      setStatement("");

      // Hide the new statement form
      setAddingNewStatement(false);
    }
  };

  const handleStartTimer = () => {
    if (!socket || !isHost) return;
    console.log("Starting timer with duration:", timerDuration);
    socket.emit("start-never-timer", sessionId, timerDuration);
    setTimerActive(true);
  };

  // Handle timer duration change (host only)
  const handleTimerDurationChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTimerDuration(value);
      if (socket && isHost) {
        socket.emit("never-set-timer-duration", sessionId, value);
      }
    }
  };

  // Manually trigger revealing phase
  const handleForceReveal = () => {
    if (!socket) return;
    console.log("Forcing reveal phase");
    socket.emit("force-reveal-phase", sessionId);
  };

  // Local navigation functions
  const handleNextStatement = () => {
    if (!socket) return;

    if (statementIndex < totalStatements - 1) {
      socket.emit("next-statement", sessionId);
    } else {
      // We're on the last question
      socket.emit("end-game", sessionId);
    }
  };

  const handlePreviousStatement = () => {
    if (statementIndex > 0) {
      const prevIndex = statementIndex - 1;
      setStatementIndex(prevIndex);
      setCurrentStatement(statements[prevIndex]);
    }
  };

  // Add a new statement during the game
  const handleAddNewStatement = () => {
    setAddingNewStatement(true);
  };

  // Cancel adding a new statement
  const handleCancelAddStatement = () => {
    setAddingNewStatement(false);
    setStatement("");
  };

  // Render appropriate phase
  if (gameEnded) {
    return (
      <div className="never-have-i-ever game-ended">
        <h2>Spill ferdig!</h2>

        <div className="game-results">
          <h3>Takk for spillet!</h3>
          <p>Alle spørsmålene er lest opp.</p>
          <p>Hva vil dere gjøre nå?</p>
        </div>

        <div className="game-controls">
          {isHost && (
            <button className="restart-button" onClick={restartGame}>
              Spill samme spill igjen
            </button>
          )}
          {!isHost && <p>Venter på at verten skal velge neste aktivitet...</p>}
        </div>
      </div>
    );
  }

  if (currentPhase === "collecting") {
    return (
      <div className="never-have-i-ever collecting">
        <h2>Jeg har aldri...</h2>

        {/* Submission Counter */}
        <div className="submission-counter">
          <div className="counter-display">{submittedCount}</div>
          <div className="counter-label">Innsendte spørsmål</div>
        </div>

        <div className="card-container">
          {/* Timer section */}
          {timerActive && (
            <div className="timer-container">
              <div className="timer-progress">
                <div
                  className="timer-bar"
                  style={{
                    width: `${(timeLeft / timerDuration) * 100}%`,
                  }}
                ></div>
              </div>
              <div className="timer-display">{formatTime(timeLeft)}</div>
            </div>
          )}

          {isHost && !timerActive && (
            <div className="timer-setup">
              <h3>Innstillinger for nedtelling</h3>
              <div className="timer-input-container">
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={timerDuration}
                  onChange={handleTimerDurationChange}
                  className="timer-input"
                />
                <span className="timer-label">sekunder</span>
              </div>
              <button onClick={handleStartTimer} className="timer-button">
                Start nedtelling
              </button>
            </div>
          )}

          {/* Statement input form */}
          <div className="statement-input">
            <label htmlFor="never-statement">
              Fullfør setningen: "Jeg har aldri..."
            </label>
            <textarea
              id="never-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="...hoppet i fallskjerm"
              maxLength={150}
            />
            <button onClick={handleSubmitStatement} className="submit-button">
              Send inn
            </button>
          </div>

          {/* User's submitted statements */}
          {userStatements.length > 0 && (
            <div className="user-statements">
              <h3>Dine innsendte spørsmål:</h3>
              <ul className="statements-list">
                {userStatements.map((stmt, index) => (
                  <li key={index} className="statement-item">
                    {stmt.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Force start button (host only) */}
          {isHost && submittedCount > 0 && (
            <div className="host-controls">
              <button onClick={handleForceReveal} className="force-button">
                START SPILLET NÅ
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentPhase === "revealing") {
    const bgColor = getCurrentColor();

    return (
      <div
        className="never-have-i-ever revealing"
        style={{
          backgroundColor: bgColor,
          color: "white",
          minHeight: "100vh",
          transition: "background-color 0.5s ease",
        }}
      >
        <h2>Jeg har aldri...</h2>

        {currentStatement && (
          <div className="current-statement">
            <p className="statement-text">{currentStatement.text}</p>
            <p className="author">Skrevet av: {currentStatement.author}</p>
          </div>
        )}

        {isHost && (
          <div className="host-controls">
            <div className="navigation-buttons">
              <button
                onClick={handlePreviousStatement}
                disabled={statementIndex === 0}
                className="prev-button"
              >
                Forrige
              </button>

              <button onClick={handleNextStatement} className="next-button">
                Neste spørsmål
              </button>
            </div>

            <div className="statement-progress">
              Spørsmål {statementIndex + 1} av {totalStatements}
            </div>
          </div>
        )}

        {!isHost && (
          <div className="statement-progress">
            Spørsmål {statementIndex + 1} av {totalStatements}
          </div>
        )}

        {/* New section: Add new statement during gameplay */}
        {!addingNewStatement ? (
          <div className="add-statement-button-container">
            <button
              onClick={handleAddNewStatement}
              className="add-statement-button"
            >
              Legg til nytt spørsmål
            </button>
          </div>
        ) : (
          <div className="statement-input revealing-phase-input">
            <label htmlFor="new-statement">Legg til: "Jeg har aldri..."</label>
            <textarea
              id="new-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="...hoppet i fallskjerm"
              maxLength={150}
            />
            <div className="statement-input-buttons">
              <button onClick={handleSubmitStatement} className="submit-button">
                Legg til
              </button>
              <button
                onClick={handleCancelAddStatement}
                className="cancel-button"
              >
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div>Laster spill...</div>;
};

export default NeverHaveIEver;
