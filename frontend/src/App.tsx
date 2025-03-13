import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { io, Socket } from "socket.io-client";
import Home from "./components/Home";
import Game from "./components/Game";
import "./App.css";
import { SocketContext } from "./context/SocketContext";
import "./styles/global.css";

// Initialize socket connection with reconnection settings
const socket: Socket = io("http://localhost:3001", {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

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

    // Register event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("reconnect", onReconnect);

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
    };
  }, [reconnectAttempts]);

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <div className="app-container">
          {connectionError && (
            <div className="connection-error">
              Connection Error: {connectionError}
              <button
                onClick={() => {
                  socket.connect();
                  setConnectionError("Retrying connection...");
                }}
                className="retry-button"
                style={{ marginLeft: "10px", padding: "4px 8px" }}
              >
                Retry
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
            <Route path="/" element={<Home />} />
            <Route path="/game" element={<Game />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </SocketContext.Provider>
  );
}

export default App;
