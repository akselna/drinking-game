import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import GameLobby from "./GameLobby";
import NeverHaveIEver from "./NeverHaveIEver";
import MusicGuess from "./MusicGuess";
import ParticipantPanel from "./ParticipantPanel";
import "../styles/Game.css";
import DrinkOrJudge from "./DrinkOrJudge";

// Game type constants (must match server constants)
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
  DRINK_OR_JUDGE: "drinkOrJudge", // Add this new game type
};

const Game: React.FC = () => {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const [sessionData, setSessionData] = useState({
    sessionId: "",
    isHost: false,
    players: [] as any[],
    gameType: GAME_TYPES.NONE,
    gameState: null as any,
  });

  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Use a ref for the timeout to avoid re-renders
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track if we've successfully joined a session
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!socket) {
      console.log("No socket available, redirecting to home");
      navigate("/");
      return;
    }

    // Check if we have session data in localStorage
    const savedSession = localStorage.getItem("drinkingGameSession");
    if (!savedSession) {
      // No saved session, redirect to home
      console.log("No saved session, redirecting to home");
      navigate("/");
      return;
    }

    // Only set reconnecting if we haven't joined a session yet
    if (!hasJoinedRef.current) {
      setIsReconnecting(true);
    }

    // Parse saved session
    let sessionId, playerName;
    try {
      const parsed = JSON.parse(savedSession);
      sessionId = parsed.sessionId;
      playerName = parsed.playerName;
      if (!hasJoinedRef.current) {
        console.log(
          "Attempting to reconnect to session:",
          sessionId,
          "as",
          playerName
        );
      }
    } catch (e) {
      console.error("Error parsing saved session:", e);
      localStorage.removeItem("drinkingGameSession");
      navigate("/");
      return;
    }

    // Add a timeout to handle reconnection failures
    if (!hasJoinedRef.current && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.log("Reconnection timeout reached");
        setError("Failed to connect to the game session. Please try again.");
        setIsReconnecting(false);
        timeoutRef.current = null;
      }, 10000); // 10 second timeout
    }

    // Set up event listeners
    const handleSessionJoined = (data: any) => {
      console.log("Session data received:", data);
      // Clear the timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Mark that we've joined to prevent further connection attempts
      hasJoinedRef.current = true;

      setSessionData({
        sessionId: data.sessionId,
        isHost: data.isHost,
        players: data.players,
        gameType: data.gameType,
        gameState: data.gameState,
      });
      setIsReconnecting(false);
      setError(null);
    };

    const handleUpdatePlayers = (players: any[]) => {
      setSessionData((prev) => ({ ...prev, players }));
    };

    const handleGameSelected = (data: any) => {
      console.log("Game selected:", data);
      setSessionData((prev) => ({
        ...prev,
        gameType: data.gameType,
        gameState: data.gameState,
      }));
    };

    const handleReturnToLobby = (data: any) => {
      console.log("Returned to lobby:", data);
      setSessionData((prev) => ({
        ...prev,
        gameType: GAME_TYPES.NONE,
        gameState: null,
        players: data.players,
      }));
    };

    const handleHostChanged = (data: any) => {
      console.log("Host changed:", data);
      setSessionData((prev) => ({
        ...prev,
        isHost: socket.id === data.newHost,
        players: data.players,
      }));
    };

    const handleError = (data: any) => {
      console.error("Socket error:", data);
      setError(data.message);
      setIsReconnecting(false);

      // Clear the timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // ONLY clear localStorage when we get specifically "Session not found"
      if (data.message === "Session not found") {
        console.log("Session not found, clearing session data");
        localStorage.removeItem("drinkingGameSession");
      }
    };

    const handleGameRestarted = (data: any) => {
      console.log("Game restarted:", data);
      setSessionData((prev) => ({
        ...prev,
        gameType: data.gameType,
        gameState: data.gameState,
      }));
    };

    const handleDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      // Only set error if we're not already reconnecting
      if (!isReconnecting && hasJoinedRef.current) {
        setError(`Connection lost: ${reason}. Trying to reconnect...`);
      }
    };

    // Register event listeners
    socket.on("session-joined", handleSessionJoined);
    socket.on("update-players", handleUpdatePlayers);
    socket.on("game-selected", handleGameSelected);
    socket.on("return-to-lobby", handleReturnToLobby);
    socket.on("host-changed", handleHostChanged);
    socket.on("error", handleError);
    socket.on("game-restarted", handleGameRestarted);
    socket.on("disconnect", handleDisconnect);

    // Attempt to join the session only if we haven't already
    if (!hasJoinedRef.current) {
      socket.emit("join-session", sessionId, playerName);
    }

    // Clean up on unmount
    return () => {
      socket.off("session-joined", handleSessionJoined);
      socket.off("update-players", handleUpdatePlayers);
      socket.off("game-selected", handleGameSelected);
      socket.off("return-to-lobby", handleReturnToLobby);
      socket.off("host-changed", handleHostChanged);
      socket.off("error", handleError);
      socket.off("game-restarted", handleGameRestarted);
      socket.off("disconnect", handleDisconnect);

      // Clear the timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [socket, navigate, isReconnecting]); // Removed reconnectionTimeout from dependencies

  const leaveSession = () => {
    if (socket) {
      socket.emit("leave-session");
      localStorage.removeItem("drinkingGameSession");
      hasJoinedRef.current = false; // Reset the joined flag
      navigate("/");
    }
  };

  const selectGame = (gameType: string) => {
    if (socket && sessionData.isHost) {
      socket.emit("select-game", sessionData.sessionId, gameType);
    }
  };

  const restartGame = () => {
    if (socket && sessionData.isHost) {
      socket.emit("restart-game", sessionData.sessionId);
    }
  };

  const returnToLobby = () => {
    if (socket && sessionData.isHost) {
      socket.emit("restart-game", sessionData.sessionId, true);
    }
  };

  // Render the appropriate component based on game type
  const renderGame = () => {
    if (isReconnecting) {
      return (
        <div className="reconnecting-message">
          <p>Reconnecting to session...</p>
          <button
            onClick={leaveSession}
            className="btn-primary"
            style={{ marginTop: "20px" }}
          >
            Cancel and Return to Home
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <h2>Error</h2>
          <p className="error-message">{error}</p>
          <button onClick={leaveSession} className="btn-primary">
            Back to Home
          </button>
        </div>
      );
    }

    switch (sessionData.gameType) {
      case GAME_TYPES.NEVER_HAVE_I_EVER:
        return (
          <NeverHaveIEver
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            gameState={sessionData.gameState}
            socket={socket}
            restartGame={restartGame}
            leaveSession={leaveSession}
            returnToLobby={returnToLobby}
          />
        );
      case GAME_TYPES.MUSIC_GUESS:
        return (
          <MusicGuess
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            gameState={sessionData.gameState}
            socket={socket}
            restartGame={restartGame}
            leaveSession={leaveSession}
            returnToLobby={returnToLobby}
          />
        );

      case GAME_TYPES.DRINK_OR_JUDGE:
        return (
          <DrinkOrJudge
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            gameState={sessionData.gameState}
            socket={socket}
            restartGame={restartGame}
            leaveSession={leaveSession}
            returnToLobby={returnToLobby}
          />
        );
      case GAME_TYPES.NONE:
      default:
        return (
          <GameLobby
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            onSelectGame={selectGame}
            onLeaveSession={leaveSession}
          />
        );
    }
  };

  return (
    <div className="game-container">
      {/* Show the participant panel in all game views */}
      {!isReconnecting && !error && sessionData.sessionId && (
        <ParticipantPanel
          players={sessionData.players}
          isHost={sessionData.isHost}
          currentUserId={socket?.id || ""}
          socket={socket}
          sessionId={sessionData.sessionId}
        />
      )}

      {/* Render game content */}
      <div className="game-content">{renderGame()}</div>

      {/* Persistent Leave Session button */}
      <div className="mobile-leave-button-container">
        <button
          onClick={leaveSession}
          className="mobile-leave-button"
          aria-label="Leave Session"
        >
          Leave Session
        </button>
      </div>
    </div>
  );
};

export default Game;
