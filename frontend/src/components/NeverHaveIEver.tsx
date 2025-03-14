// Modify the NeverHaveIEver.tsx component to allow adding new statements during gameplay

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
  // New state variable to track if a player wants to add a new statement
  const [addingNewStatement, setAddingNewStatement] = useState(false);

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
        // The server now differentiates between total statements and player-submitted ones
        // We only care about player submissions for the collecting phase
        setSubmittedCount(
          gameState.statements.filter((s: any) => s.authorId !== "system")
            .length || 0
        );
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

      // Only set submitted to true if we're in the collecting phase
      // This allows adding new statements during the revealing phase
      if (currentPhase === "collecting") {
        setSubmitted(true);
      }

      // Hide the new statement form
      setAddingNewStatement(false);
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
