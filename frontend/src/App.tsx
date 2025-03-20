import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { io } from "socket.io-client";
import Home from "./components/Home";
import Game from "./components/Game";
import "./App.css";
import { SocketContext } from "./context/SocketContext";
import "./styles/global.css";
import { CustomSocket } from "./types/socket.types";

// Determine the server URL dynamically
const SERVER_URL = process.env.REACT_APP_SERVER_URL || window.location.origin;

// Initialize socket connection with reconnection settings
// Use type assertion to tell TypeScript this is a CustomSocket
const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
}) as CustomSocket;

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    // Debug connection status at startup
    console.log(
      "Initial socket connection state:",
      socket.connected ? "Connected" : "Disconnected"
    );
    console.log("Socket ID:", socket.id);

    // Set up socket event listeners for connection status
    const onConnect = () => {
      console.log("Socket connected!", socket.id);
      setIsConnected(true);
      setConnectionError(null);
      setReconnectAttempts(0);

      // Check if we have saved session data for reconnection
      const savedSession = localStorage.getItem("drinkingGameSession");
      if (savedSession) {
        try {
          const { sessionId, playerName } = JSON.parse(savedSession);
          console.log(
            "Attempting to reconnect to session:",
            sessionId,
            "as",
            playerName
          );
          socket.emit("join-session", sessionId, playerName);
        } catch (e) {
          console.error("Error parsing saved session:", e);
          localStorage.removeItem("drinkingGameSession");
        }
      }
    };

    const onDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
    };

    const onError = (error: any) => {
      console.error("Socket error:", error);
      setConnectionError(
        error.message || "An error occurred with the connection"
      );

      // Clear localStorage when we get a "Session not found" error
      if (error.message === "Session not found") {
        console.log("Session not found, clearing session data in App");
        localStorage.removeItem("drinkingGameSession");
      }
    };

    const onConnectError = (error: Error) => {
      console.error("Connection error:", error);
      setConnectionError(error.message || "Unable to connect to the server");

      // If we've tried to reconnect multiple times and still failing,
      // we might want to clear the session data as the server might be down
      if (reconnectAttempts > 3) {
        console.log("Multiple reconnect attempts failed, clearing session");
        localStorage.removeItem("drinkingGameSession");
      }
    };

    // Debug reconnection
    const onReconnectAttempt = (attemptNumber: number) => {
      console.log("Reconnection attempt:", attemptNumber);
      setReconnectAttempts(attemptNumber);
    };

    const onReconnect = (attemptNumber: number) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      setReconnectAttempts(0);

      // Try to rejoin session after reconnect
      const savedSession = localStorage.getItem("drinkingGameSession");
      if (savedSession) {
        try {
          const { sessionId, playerName } = JSON.parse(savedSession);
          console.log("Rejoining session after reconnect");
          socket.emit("join-session", sessionId, playerName);
        } catch (e) {
          console.error("Error parsing saved session:", e);
          localStorage.removeItem("drinkingGameSession");
        }
      }
    };

    // Add handlers for successful session creation/joining
    const onSessionCreated = (data: any) => {
      console.log("Session created successfully", data);
      setConnectionError(null); // Clear any connection errors

      // Store host ID when creating a session (creator is the host)
      socket.hostId = socket.id;
    };

    const onSessionJoined = (data: any) => {
      console.log("Session joined successfully", data);
      setConnectionError(null); // Clear any connection errors

      // Store the host ID when joining a session
      if (data.isHost) {
        socket.hostId = socket.id;
      } else if (data.hostId) {
        // If the server provides the host ID directly
        socket.hostId = data.hostId;
      } else {
        // Find the host by checking if they're marked as host in players array
        // This is a fallback that might not work in all cases
        const hostPlayer = data.players.find((p: any) => p.isHost);
        if (hostPlayer) {
          socket.hostId = hostPlayer.id;
        }
      }
    };

    // Handle host changed event
    const onHostChanged = (data: any) => {
      console.log("Host changed:", data);
      // Update host ID when it changes
      socket.hostId = data.newHost;
    };

    // Register event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("reconnect", onReconnect);
    socket.on("session-created", onSessionCreated);
    socket.on("session-joined", onSessionJoined);
    socket.on("host-changed", onHostChanged);

    // If we're already connected, run the connect handler immediately
    if (socket.connected) {
      onConnect();
    } else {
      console.log("Socket not connected, waiting...");
      // Force a reconnection attempt if we're not connected
      socket.connect();
    }

    // Clean up event listeners on unmount
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error", onError);
      socket.off("connect_error", onConnectError);
      socket.off("reconnect_attempt", onReconnectAttempt);
      socket.off("reconnect", onReconnect);
      socket.off("session-created", onSessionCreated);
      socket.off("session-joined", onSessionJoined);
      socket.off("host-changed", onHostChanged);
    };
  }, [reconnectAttempts]);

  // Handler to clear connection error from anywhere in the app
  const clearConnectionError = () => {
    setConnectionError(null);
  };

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <div className="app-container">
          {connectionError && (
            <div className="connection-error">
              Connection Error: {connectionError}
              <button
                onClick={() => {
                  // If we're seeing a "Session not found" error, don't retry the same action
                  if (connectionError === "Session not found") {
                    localStorage.removeItem("drinkingGameSession");
                    clearConnectionError();
                  } else {
                    socket.connect();
                    setConnectionError("Retrying connection...");
                  }
                }}
                className="retry-button"
                style={{ marginLeft: "10px", padding: "4px 8px" }}
              >
                {connectionError === "Session not found" ? "Dismiss" : "Retry"}
              </button>
            </div>
          )}

          {!isConnected && !connectionError && (
            <div className="connecting-message">
              Connecting to server...{" "}
              {reconnectAttempts > 0 ? `(Attempt ${reconnectAttempts})` : ""}
            </div>
          )}

          <Routes>
            <Route
              path="/"
              element={<Home onNavigate={clearConnectionError} />}
            />
            <Route path="/game" element={<Game />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </SocketContext.Provider>
  );
}

export default App;
