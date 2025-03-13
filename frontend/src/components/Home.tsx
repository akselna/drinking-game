import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import "../styles/Home.css";

const Home: React.FC = () => {
  const [playerName, setPlayerName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  // Add this useEffect near the top of the Home component function in Home.tsx
  // In Home.tsx, replace the cleanup useEffect with this simpler version:
  // This should be placed near the beginning of the Home component function

  useEffect(() => {
    // Check if we're coming from an error redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("error") === "true") {
      setError(
        "Previous session expired or not found. Please create or join a new session."
      );
      // Only clear localStorage if we came from an error redirect
      localStorage.removeItem("drinkingGameSession");
    }

    // Clean up the URL if needed
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    // Only clear if we're not already in the loading state
    // This prevents cleaning up when we're in the middle of creating a session
    if (!isLoading) {
      localStorage.removeItem("drinkingGameSession");
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Handle session creation response
    const handleSessionCreated = (data: any) => {
      console.log("Session created:", data);
      setIsLoading(false);

      // Clear any previous session data first
      localStorage.removeItem("drinkingGameSession");

      // Then save the new session data
      localStorage.setItem(
        "drinkingGameSession",
        JSON.stringify({
          sessionId: data.sessionId,
          playerName: playerName,
        })
      );

      // Navigate to game screen
      navigate("/game");
    };

    // Handle session join response
    const handleSessionJoined = (data: any) => {
      console.log("Session joined:", data);
      setIsLoading(false);

      // Save session data for reconnection
      localStorage.setItem(
        "drinkingGameSession",
        JSON.stringify({
          sessionId: data.sessionId,
          playerName: playerName,
        })
      );

      // Navigate to game screen
      navigate("/game");
    };

    const handleError = (data: any) => {
      console.error("Socket error:", data);
      setError(data.message);

      // Only clear localStorage when we have a specific session not found error
      if (data.message === "Session not found") {
        console.log("Session not found, clearing session data");
        localStorage.removeItem("drinkingGameSession");
        // No need to navigate here - we'll let the existing code handle that
      }
    };

    // Register event listeners
    socket.on("session-created", handleSessionCreated);
    socket.on("session-joined", handleSessionJoined);
    socket.on("error", handleError);

    // Check if we have saved session data for auto-reconnection
    const savedSession = localStorage.getItem("drinkingGameSession");
    if (savedSession) {
      try {
        const { sessionId, playerName } = JSON.parse(savedSession);
        setSessionId(sessionId);
        setPlayerName(playerName);
      } catch (e) {
        console.error("Error parsing saved session data:", e);
      }
    }

    // Clean up on unmount
    return () => {
      socket.off("session-created", handleSessionCreated);
      socket.off("session-joined", handleSessionJoined);
      socket.off("error", handleError);
    };
  }, [socket, navigate, playerName]);

  const createSession = (event: React.FormEvent) => {
    event.preventDefault();

    if (!socket) {
      setError("Socket connection not available");
      return;
    }

    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsLoading(true);
    setError(null);
    socket.emit("create-session", playerName);
  };

  const joinSession = (event: React.FormEvent) => {
    event.preventDefault();

    if (!socket) {
      setError("Socket connection not available");
      return;
    }

    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    if (!sessionId.trim()) {
      setError("Please enter a session ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    socket.emit("join-session", sessionId, playerName);
  };

  return (
    <div className="home-container">
      <h1>Drinking Game App</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="form-container">
        <form onSubmit={createSession} className="session-form">
          <h2>Start a New Game</h2>

          <div className="form-group">
            <label htmlFor="createName">Your Name</label>
            <input
              type="text"
              id="createName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={isLoading}
              maxLength={20}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "Creating..." : "Create Game"}
          </button>
        </form>

        <div className="divider">OR</div>

        <form onSubmit={joinSession} className="session-form">
          <h2>Join Existing Game</h2>

          <div className="form-group">
            <label htmlFor="joinName">Your Name</label>
            <input
              type="text"
              id="joinName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              disabled={isLoading}
              maxLength={20}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sessionId">Session Code</label>
            <input
              type="text"
              id="sessionId"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="Enter session code"
              disabled={isLoading}
              maxLength={6}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary">
            {isLoading ? "Joining..." : "Join Game"}
          </button>
        </form>
      </div>

      {isLoading && <div className="loading-spinner">Loading...</div>}
    </div>
  );
};

export default Home;
