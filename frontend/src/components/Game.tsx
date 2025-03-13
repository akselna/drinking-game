import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import GameLobby from "./GameLobby";
import NeverHaveIEver from "./NeverHaveIEver";
import MusicGuess from "./MusicGuess";
import ParticipantPanel from "./ParticipantPanel";
import "../styles/Game.css";

// Game type constants (must match server constants)
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
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

  useEffect(() => {
    if (!socket) {
      navigate("/");
      return;
    }

    // Check if we have session data in localStorage
    const savedSession = localStorage.getItem("drinkingGameSession");
    if (!savedSession) {
      // No saved session, redirect to home
      navigate("/");
      return;
    }

    setIsReconnecting(true);

    const { sessionId, playerName } = JSON.parse(savedSession);

    // Set up event listeners
    const handleSessionJoined = (data: any) => {
      console.log("Session data received:", data);
      setSessionData({
        sessionId: data.sessionId,
        isHost: data.isHost,
        players: data.players,
        gameType: data.gameType,
        gameState: data.gameState,
      });
      setIsReconnecting(false);
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

    // Find this function in Game.tsx
    const handleError = (data: any) => {
      console.error("Socket error:", data);
      setError(data.message);

      // Add this code to clear localStorage and redirect on session errors
      if (
        data.message === "Session not found" ||
        data.message.includes("session")
      ) {
        console.log("Clearing invalid session data");
        localStorage.removeItem("drinkingGameSession");

        // Short delay before redirecting to avoid potential race conditions
        setTimeout(() => {
          navigate("/");
        }, 100);
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

    // Register event listeners
    socket.on("session-joined", handleSessionJoined);
    socket.on("update-players", handleUpdatePlayers);
    socket.on("game-selected", handleGameSelected);
    socket.on("return-to-lobby", handleReturnToLobby);
    socket.on("host-changed", handleHostChanged);
    socket.on("error", handleError);
    socket.on("game-restarted", handleGameRestarted);

    // Clean up on unmount
    return () => {
      socket.off("session-joined", handleSessionJoined);
      socket.off("update-players", handleUpdatePlayers);
      socket.off("game-selected", handleGameSelected);
      socket.off("return-to-lobby", handleReturnToLobby);
      socket.off("host-changed", handleHostChanged);
      socket.off("error", handleError);
      socket.off("game-restarted", handleGameRestarted);
    };
  }, [socket, navigate]);

  const leaveSession = () => {
    if (socket) {
      socket.emit("leave-session");
      localStorage.removeItem("drinkingGameSession");
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
        <div className="reconnecting-message">Reconnecting to session...</div>
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
      <ParticipantPanel
        players={sessionData.players}
        isHost={sessionData.isHost}
        currentUserId={socket?.id || ""}
        socket={socket}
        sessionId={sessionData.sessionId}
      />

      {/* Render game content */}
      <div className="game-content">{renderGame()}</div>
    </div>
  );
};

export default Game;
