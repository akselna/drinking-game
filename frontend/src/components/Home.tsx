import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SocketContext } from "../context/SocketContext";
import "../styles/Home.css";

interface HomeProps {
  onNavigate?: () => void; // Optional callback to notify parent component about navigation
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const [playerName, setPlayerName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [createSessionTimeout, setCreateSessionTimeout] =
    useState<NodeJS.Timeout | null>(null);
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  // Check for errors in the URL or saved sessions
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

    // Call onNavigate to clear any connection errors in the parent component
    if (onNavigate) {
      onNavigate();
    }
  }, [onNavigate]);

  // Check for existing saved session
  useEffect(() => {
    // Check if we have saved session data for auto-reconnection
    const savedSession = localStorage.getItem("drinkingGameSession");
    if (savedSession) {
      try {
        const { sessionId, playerName } = JSON.parse(savedSession);
        setSessionId(sessionId);
        setPlayerName(playerName);
      } catch (e) {
        console.error("Error parsing saved session data:", e);
        localStorage.removeItem("drinkingGameSession");
      }
    }
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle session creation response
    const handleSessionCreated = (data: any) => {
      console.log("Session created:", data);
      setIsLoading(false);

      // Clear any existing timeout
      if (createSessionTimeout) {
        clearTimeout(createSessionTimeout);
        setCreateSessionTimeout(null);
      }

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

      // Clear any existing timeout
      if (createSessionTimeout) {
        clearTimeout(createSessionTimeout);
        setCreateSessionTimeout(null);
      }

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
      setIsLoading(false);

      // Clear any existing timeout
      if (createSessionTimeout) {
        clearTimeout(createSessionTimeout);
        setCreateSessionTimeout(null);
      }

      // Clear localStorage when we get a "Session not found" error
      if (data.message === "Session not found") {
        console.log("Session not found, clearing session data in Home");
        localStorage.removeItem("drinkingGameSession");
      }
    };

    // Register event listeners
    socket.on("session-created", handleSessionCreated);
    socket.on("session-joined", handleSessionJoined);
    socket.on("error", handleError);

    // Clean up on unmount
    return () => {
      socket.off("session-created", handleSessionCreated);
      socket.off("session-joined", handleSessionJoined);
      socket.off("error", handleError);

      // Clear any existing timeout
      if (createSessionTimeout) {
        clearTimeout(createSessionTimeout);
      }
    };
  }, [socket, navigate, playerName, createSessionTimeout, onNavigate]);

  const createSession = (event: React.FormEvent) => {
    event.preventDefault();

    if (!socket) {
      setError("Socket connection not available");
      return;
    }

    if (!socket.connected) {
      setError(
        "Waiting for connection to server. Please try again in a moment."
      );
      return;
    }

    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    // Call onNavigate to clear any connection errors in the parent component
    if (onNavigate) {
      onNavigate();
    }

    setIsLoading(true);
    setError(null);
    console.log("Creating session as:", playerName);
    socket.emit("create-session", playerName);

    // Set a timeout to handle if the server doesn't respond
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setError(
        "Server didn't respond in time. Please check if the server is running and try again."
      );
    }, 10000); // 10 second timeout

    setCreateSessionTimeout(timeout);
  };

  const joinSession = (event: React.FormEvent) => {
    event.preventDefault();

    if (!socket) {
      setError("Socket connection not available");
      return;
    }

    if (!socket.connected) {
      setError(
        "Waiting for connection to server. Please try again in a moment."
      );
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

    // Call onNavigate to clear any connection errors in the parent component
    if (onNavigate) {
      onNavigate();
    }

    setIsLoading(true);
    setError(null);
    console.log("Joining session:", sessionId, "as", playerName);
    socket.emit("join-session", sessionId, playerName);

    // Set a timeout to handle if the server doesn't respond
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setError(
        "Server didn't respond in time. Please check if the server is running and try again."
      );
    }, 10000); // 10 second timeout

    setCreateSessionTimeout(timeout);
  };

  return (
    <div className="home-container">
      <h1>Mine herrer lambo</h1>

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
              disabled={isLoading || !socket?.connected}
              maxLength={20}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !socket?.connected}
            className="btn-primary"
          >
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
              disabled={isLoading || !socket?.connected}
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
              disabled={isLoading || !socket?.connected}
              maxLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !socket?.connected}
            className="btn-primary"
          >
            {isLoading ? "Joining..." : "Join Game"}
          </button>
        </form>
      </div>

      {isLoading && (
        <div className="loading-spinner">
          <p>Connecting to server... Please wait.</p>
          <button
            onClick={() => {
              setIsLoading(false);
              if (createSessionTimeout) {
                clearTimeout(createSessionTimeout);
                setCreateSessionTimeout(null);
              }
            }}
            className="cancel-button"
          >
            Cancel
          </button>
        </div>
      )}

      {!socket?.connected && (
        <div className="connection-status">
          <p>
            Not connected to server. Make sure the server is running at
            http://localhost:3001
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
