import React, { useState, useEffect } from "react";
import "../styles/NeverHaveIEver.css";
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
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [currentStatement, setCurrentStatement] = useState<any>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(
    gameState?.phase || "collecting"
  );
  const [statementIndex, setStatementIndex] = useState(0);
  const [statements, setStatements] = useState<any[]>([]);
  const [totalStatements, setTotalStatements] = useState(0);
  const [ongoingStatement, setOngoingStatement] = useState("");
  const [ongoingSubmitted, setOngoingSubmitted] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showOngoingForm, setShowOngoingForm] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState("");

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

  const handleOngoingStatementSubmitted = (data: any) => {
    console.log("Ongoing statement submitted:", data);
    setPendingCount(data.pendingCount || 0);

    // Show a temporary message that a new statement was submitted
    setSubmissionFeedback(`${data.playerName} sendte inn et nytt spørsmål!`);
    setTimeout(() => {
      setSubmissionFeedback("");
    }, 3000);
  };

  const handleYourStatementSubmitted = (data: any) => {
    console.log("Your statement was submitted:", data);
    setOngoingStatement("");
    setOngoingSubmitted(true);

    // Reset the submission state after a delay
    setTimeout(() => {
      setOngoingSubmitted(false);
    }, 3000);
  };

  // Get color based on current statement index
  const getCurrentColor = () => {
    return kahootColors[statementIndex % kahootColors.length];
  };

  // Find host player
  const hostPlayer = players.find(
    (player) => player.id === players.find((p) => p.isHost)?.id
  );

  useEffect(() => {
    if (!socket) return;

    // Timer updates
    const handleTimerUpdate = (data: any) => {
      console.log("Timer update:", data);
      setTimeLeft(data.timeLeft);
    };

    // Statement submission updates
    const handleStatementSubmitted = (data: any) => {
      console.log("Statement submitted:", data);
      setSubmittedCount(data.submittedCount);
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
        if (gameState && gameState.statements) {
          setStatements(gameState.statements);
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
    };

    // Register event listeners
    socket.on("timer-update", handleTimerUpdate);
    socket.on("statement-submitted", handleStatementSubmitted);
    socket.on("phase-changed", handlePhaseChanged);
    socket.on("next-statement", handleNextStatement);
    socket.on("game-ended", handleGameEnded);
    socket.on("ongoing-statement-submitted", handleOngoingStatementSubmitted);
    socket.on("your-statement-submitted", handleYourStatementSubmitted);

    // Og husk å legge dem til i clean-up funksjonen (return):
    socket.off("ongoing-statement-submitted", handleOngoingStatementSubmitted);
    socket.off("your-statement-submitted", handleYourStatementSubmitted);

    // Clean up on unmount
    return () => {
      socket.off("timer-update", handleTimerUpdate);
      socket.off("statement-submitted", handleStatementSubmitted);
      socket.off("phase-changed", handlePhaseChanged);
      socket.off("next-statement", handleNextStatement);
      socket.off("game-ended", handleGameEnded);
    };
  }, [socket, gameState]);

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
        setSubmittedCount(gameState.statements.length || 0);
      }

      // Check if we already submitted a statement (on refresh or rejoin)
      if (
        gameState.statements &&
        gameState.statements.some((s: any) => s.authorId === socket?.id)
      ) {
        setSubmitted(true);
      }

      // Check if game ended
      if (gameState.phase === "ended") {
        setGameEnded(true);
      }
    }
  }, [gameState, socket?.id]);

  const handleSubmitStatement = () => {
    if (!socket) return;

    if (statement.trim()) {
      console.log("Submitting statement:", statement);
      socket.emit("submit-never-statement", sessionId, statement);
      setStatement("");
      setSubmitted(true);
    }
  };

  const handleSubmitOngoingStatement = () => {
    if (!socket) return;

    if (ongoingStatement.trim()) {
      console.log("Submitting ongoing statement:", ongoingStatement);
      socket.emit("submit-never-statement", sessionId, ongoingStatement);
      // Vi resetter ikke state her fordi vi gjør det når vi får bekreftelse fra serveren
    }
  };

  const handleStartTimer = () => {
    if (!socket) return;
    console.log("Starting timer");
    socket.emit("start-never-timer", sessionId);
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
            <>
              <button className="lobby-button" onClick={returnToLobby}>
                Tilbake til hovedmenyen
              </button>
              <button className="restart-button" onClick={restartGame}>
                Spill samme spill igjen
              </button>
            </>
          )}
          {!isHost && <p>Venter på at verten skal velge neste aktivitet...</p>}
          <button className="leave-button" onClick={leaveSession}>
            Forlat økt
          </button>
        </div>
      </div>
    );
  }

  if (currentPhase === "collecting") {
    return (
      <div className="never-have-i-ever collecting">
        <h2>Never Have I Ever</h2>

        <div className="game-status">
          <p>
            Samler inn setninger: {submittedCount}/{players.length}
          </p>
          {timeLeft < 60 && <p>Tid igjen: {timeLeft} sekunder</p>}
        </div>

        {!submitted ? (
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
        ) : (
          <div className="waiting">
            <p>Takk for bidraget ditt! Venter på andre...</p>
          </div>
        )}

        {isHost && (
          <div className="host-controls">
            {timeLeft === 60 && (
              <button onClick={handleStartTimer} className="timer-button">
                Start 60-sekunders nedtelling
              </button>
            )}

            {/* This button is always shown to host if at least one player has submitted a statement */}
            {submittedCount > 0 && (
              <button onClick={handleForceReveal} className="force-button">
                START SPILLET NÅ
              </button>
            )}
          </div>
        )}

        <div className="game-controls">
          <button className="leave-button" onClick={leaveSession}>
            Forlat økt
          </button>
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

            {submissionFeedback && (
              <div
                className="submission-feedback"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  padding: "10px",
                  borderRadius: "5px",
                  marginTop: "10px",
                  animation: "fadeInOut 3s",
                }}
              >
                {submissionFeedback}
              </div>
            )}

            {!showOngoingForm ? (
              <div
                className="add-statement-button"
                style={{ marginTop: "20px" }}
              >
                <button
                  onClick={() => setShowOngoingForm(true)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "5px",
                    padding: "10px 15px",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Legg til et nytt spørsmål
                </button>
              </div>
            ) : (
              <div
                className="ongoing-statement-input"
                style={{
                  marginTop: "20px",
                  background: "rgba(0,0,0,0.4)",
                  padding: "15px",
                  borderRadius: "8px",
                }}
              >
                {!ongoingSubmitted ? (
                  <>
                    <p
                      style={{
                        marginTop: 0,
                        marginBottom: "10px",
                        fontSize: "0.9rem",
                      }}
                    >
                      Fullfør setningen: "Jeg har aldri..."
                    </p>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <input
                        type="text"
                        value={ongoingStatement}
                        onChange={(e) => setOngoingStatement(e.target.value)}
                        placeholder="...hoppet i fallskjerm"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          backgroundColor: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.3)",
                          borderRadius: "4px",
                          color: "white",
                        }}
                      />
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button
                          onClick={handleSubmitOngoingStatement}
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "#26890c",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Send inn
                        </button>
                        <button
                          onClick={() => setShowOngoingForm(false)}
                          style={{
                            padding: "8px 15px",
                            backgroundColor: "rgba(255,255,255,0.2)",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Avbryt
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "10px" }}>
                    <p>
                      Takk for bidraget! Det vil bli brukt senere i spillet.
                    </p>
                  </div>
                )}
              </div>
            )}

            {pendingCount > 0 && (
              <div
                className="pending-count"
                style={{
                  fontSize: "0.9rem",
                  marginTop: "10px",
                  opacity: 0.8,
                }}
              >
                {pendingCount} spørsmål i kø
              </div>
            )}

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

        <div className="game-controls">
          <button className="leave-button" onClick={leaveSession}>
            Forlat økt
          </button>
        </div>
      </div>
    );
  }

  return <div>Laster spill...</div>;
};

export default NeverHaveIEver;
