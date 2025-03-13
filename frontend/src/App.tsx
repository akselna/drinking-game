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

  useEffect(() => {
    // Set up socket event listeners for connection status
    const onConnect = () => {
      console.log("Socket connected!", socket.id);
      setIsConnected(true);
      setConnectionError(null);

      // Check if we have saved session data for reconnection
      const savedSession = localStorage.getItem("drinkingGameSession");
      if (savedSession) {
        const { sessionId, playerName } = JSON.parse(savedSession);
        console.log(
          "Attempting to reconnect to session:",
          sessionId,
          "as",
          playerName
        );
        socket.emit("join-session", sessionId, playerName);
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
    };

    // Debug reconnection
    const onReconnectAttempt = (attemptNumber: number) => {
      console.log("Reconnection attempt:", attemptNumber);
    };

    const onReconnect = (attemptNumber: number) => {
      console.log("Reconnected after", attemptNumber, "attempts");

      // Try to rejoin session after reconnect
      const savedSession = localStorage.getItem("drinkingGameSession");
      if (savedSession) {
        const { sessionId, playerName } = JSON.parse(savedSession);
        console.log("Rejoining session after reconnect");
        socket.emit("join-session", sessionId, playerName);
      }
    };

    // Register event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("error", onError);
    socket.on("connect_error", onConnectError);
    socket.on("reconnect_attempt", onReconnectAttempt);
    socket.on("reconnect", onReconnect);

    // Clean up event listeners on unmount
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("error", onError);
      socket.off("connect_error", onConnectError);
      socket.off("reconnect_attempt", onReconnectAttempt);
      socket.off("reconnect", onReconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <Router>
        <div className="app-container">
          {connectionError && (
            <div className="connection-error">
              Connection Error: {connectionError}
            </div>
          )}

          {!isConnected && !connectionError && (
            <div className="connecting-message">Connecting to server...</div>
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
