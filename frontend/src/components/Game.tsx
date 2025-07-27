import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import GameLobby from "./GameLobby";
import NeverHaveIEver from "./NeverHaveIEver";
import MusicGuess from "./MusicGuess";
import ParticipantPanel from "./ParticipantPanel";
import "../styles/Game.css";
import DrinkOrJudge from "./DrinkOrJudge";
import Beat4Beat from "./Beat4Beat";
import LamboScreen from "./LamboScreen"; // Import the new LamboScreen component
import NotAllowedToLaugh from "./NotAllowedToLaugh";
import Skjenkehjulet, { SkjenkehjuletHandle } from "./Skjenkehjulet";
import SplitOrStealDashboard from "./SplitOrStealDashboard";
import SplitOrStealController from "./SplitOrStealController";
import SplitOrStealSetup from "./SplitOrStealSetup";

// Game type constants (must match server constants)
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
  DRINK_OR_JUDGE: "drinkOrJudge",
  BEAT4BEAT: "beat4Beat",
  NOT_ALLOWED_TO_LAUGH: "notAllowedToLaugh", // Added new game type
  SPLIT_OR_STEAL: "splitOrSteal",
  SKJENKEHJULET: "skjenkehjulet",
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
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  // Lambo feature states
  const [lamboVotes, setLamboVotes] = useState<string[]>([]);
  const [showLambo, setShowLambo] = useState<boolean>(false);
  const [lamboSelectedDrinker, setLamboSelectedDrinker] = useState<
    string | null
  >(null);

  // Use a ref for the timeout to avoid re-renders
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track if we've successfully joined a session
  const hasJoinedRef = useRef(false);
  const skjenkehjuletRef = useRef<SkjenkehjuletHandle>(null);

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

    const handleSplitStealState = (state: any) => {
      setSessionData((prev) => ({
        ...prev,
        gameState: state,
      }));
    };

    const handleDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      // Only set error if we're not already reconnecting
      if (!isReconnecting && hasJoinedRef.current) {
        setError(`Connection lost: ${reason}. Trying to reconnect...`);
      }
    };

    // Lambo event handlers
    const handleLamboVotesUpdate = (data: any) => {
      console.log("Lambo votes updated:", data);
      setLamboVotes(data.voters || []);
    };

    const handleLamboActivated = (data: any) => {
      console.log("Lambo activated:", data);
      setShowLambo(true);
      setLamboSelectedDrinker(data.selectedDrinker);
    };

    const handleLamboEnded = () => {
      console.log("Lambo ended");
      setShowLambo(false);
      setLamboVotes([]);
      setLamboSelectedDrinker(null);
    };

    // Register event listeners
    socket.on("session-joined", handleSessionJoined);
    socket.on("update-players", handleUpdatePlayers);
    socket.on("game-selected", handleGameSelected);
    socket.on("return-to-lobby", handleReturnToLobby);
    socket.on("host-changed", handleHostChanged);
    socket.on("error", handleError);
    socket.on("game-restarted", handleGameRestarted);
    socket.on("split-steal-state", handleSplitStealState);
    socket.on("disconnect", handleDisconnect);

    // Lambo event listeners
    socket.on("lambo-votes-update", handleLamboVotesUpdate);
    socket.on("lambo-activated", handleLamboActivated);
    socket.on("lambo-ended", handleLamboEnded);

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
      socket.off("split-steal-state", handleSplitStealState);
      socket.off("disconnect", handleDisconnect);

      // Lambo cleanup
      socket.off("lambo-votes-update", handleLamboVotesUpdate);
      socket.off("lambo-activated", handleLamboActivated);
      socket.off("lambo-ended", handleLamboEnded);

      // Clear the timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [socket, navigate, isReconnecting]);

  const confirmLeaveSession = () => {
    setShowLeaveConfirmation(true);
  };

  const cancelLeaveSession = () => {
    setShowLeaveConfirmation(false);
  };

  const leaveSession = () => {
    if (socket) {
      socket.emit("leave-session");
      localStorage.removeItem("drinkingGameSession");
      hasJoinedRef.current = false; // Reset the joined flag
      setShowLeaveConfirmation(false);
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

  // Handle Lambo vote
  const handleLamboVote = () => {
    if (!socket || !sessionData.sessionId) return;

    // Check if user already voted
    const hasVoted = lamboVotes.includes(socket.id || "");

    if (!hasVoted) {
      socket.emit("lambo-vote", sessionData.sessionId);
    }
  };

  // Render the appropriate component based on game type
  const renderGame = () => {
    if (isReconnecting) {
      return (
        <div className="reconnecting-message">
          <p>Reconnecting to session...</p>
          <button
            onClick={confirmLeaveSession}
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
          <button onClick={confirmLeaveSession} className="btn-primary">
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
            leaveSession={confirmLeaveSession}
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
            leaveSession={confirmLeaveSession}
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
            leaveSession={confirmLeaveSession}
            returnToLobby={returnToLobby}
          />
        );
      case GAME_TYPES.BEAT4BEAT:
        return (
          <Beat4Beat
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            gameState={sessionData.gameState}
            socket={socket}
            restartGame={restartGame}
            leaveSession={confirmLeaveSession}
            returnToLobby={returnToLobby}
          />
        );
      case GAME_TYPES.SPLIT_OR_STEAL:
        if (sessionData.isHost) {
          if (sessionData.gameState?.phase === "setup") {
            return (
              <SplitOrStealSetup
                sessionId={sessionData.sessionId}
                socket={socket}
              />
            );
          }
          return (
            <SplitOrStealDashboard
              sessionId={sessionData.sessionId}
              gameState={sessionData.gameState}
              socket={socket}
            />
          );
        }
        return (
          <SplitOrStealController
            sessionId={sessionData.sessionId}
            gameState={sessionData.gameState}
            socket={socket}
          />
        );
      case GAME_TYPES.SKJENKEHJULET:
        return <Skjenkehjulet ref={skjenkehjuletRef} />;
      case GAME_TYPES.NOT_ALLOWED_TO_LAUGH:
        return (
          <NotAllowedToLaugh
            sessionId={sessionData.sessionId}
            players={sessionData.players}
            isHost={sessionData.isHost}
            gameState={sessionData.gameState}
            socket={socket}
            restartGame={restartGame}
            leaveSession={confirmLeaveSession}
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
            onLeaveSession={confirmLeaveSession}
          />
        );
    }
  };

  // Render leave confirmation dialog
  const renderLeaveConfirmation = () => {
    if (!showLeaveConfirmation) return null;

    return (
      <div className="leave-confirmation-overlay">
        <div className="leave-confirmation-dialog">
          <h3>Leave Session</h3>
          <p>
            Are you sure you want to leave this session? You will not be able to
            return unless someone shares the code with you again.
          </p>
          <div className="confirmation-buttons">
            <button className="cancel-button" onClick={cancelLeaveSession}>
              Cancel
            </button>
            <button className="confirm-button" onClick={leaveSession}>
              Leave
            </button>
          </div>
        </div>
      </div>
    );
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
          lamboVotes={lamboVotes}
          hostBackHandler={
            sessionData.gameType === GAME_TYPES.SKJENKEHJULET
              ? () => skjenkehjuletRef.current?.backToConfig()
              : undefined
          }
        />
      )}

      {/* Render game content */}
      <div className="game-content">{renderGame()}</div>

      {/* Mobile buttons container for better layout */}

      {/* Mobile buttons container for better layout */}
      <div className="game-mobile-buttons">
        {/* Main Menu button for host */}
        {sessionData.isHost &&
          sessionData.gameType !== GAME_TYPES.NONE &&
          sessionData.gameType !== GAME_TYPES.SKJENKEHJULET && (
            <div className="host-menu-button-container">
              <button
                onClick={returnToLobby}
                className="host-menu-button"
                aria-label="Return to Main Menu"
              >
                Main Menu
              </button>
            </div>
          )}

        {/* Lambo button - now with a proper container */}
        {!isReconnecting &&
          !error &&
          sessionData.sessionId &&
          sessionData.gameType !== GAME_TYPES.SKJENKEHJULET && (
            <div className="lambo-button-container">
              <button
                onClick={handleLamboVote}
                className={`lambo-button ${
                  lamboVotes.includes(socket?.id || "") ? "voted" : ""
                }`}
                aria-label="Lambo"
              >
                🎉 Lambo 🎉
                {lamboVotes.length > 0 && (
                  <span className="lambo-vote-count">
                    {lamboVotes.length}/{sessionData.players.length}
                  </span>
                )}
              </button>
            </div>
          )}

        {/* Leave Session button */}
        {sessionData.gameType !== GAME_TYPES.SKJENKEHJULET && (
          <div className="mobile-leave-button-container">
            <button
              onClick={confirmLeaveSession}
              className="mobile-leave-button"
              aria-label="Leave Session"
            >
              Leave Session
            </button>
          </div>
        )}
      </div>

      {/* Leave confirmation dialog */}
      {renderLeaveConfirmation()}

      {/* Lambo screen overlay */}
      {showLambo && (
        <LamboScreen
          sessionId={sessionData.sessionId}
          socket={socket}
          isHost={sessionData.isHost}
          players={sessionData.players}
          selectedDrinker={lamboSelectedDrinker}
          onClose={() => setShowLambo(false)}
        />
      )}
    </div>
  );
};

export default Game;
