import { io } from "socket.io-client";

// Create the socket instance with reconnection options
const socket = io("http://localhost:3001", {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// Add debugging listeners
socket.on("connect", () => {
  console.log("Socket connected!", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected!", reason);
});

socket.on("reconnect_attempt", (attemptNumber) => {
  console.log("Trying to reconnect...", attemptNumber);
});

socket.on("reconnect", (attemptNumber) => {
  console.log("Reconnected after", attemptNumber, "attempts");

  // Try to rejoin session after reconnection
  const savedSession = localStorage.getItem("drinkingGameSession");
  if (savedSession) {
    const { sessionId, playerName } = JSON.parse(savedSession);
    console.log("Rejoining session after reconnect");
    socket.emit("join-session", sessionId, playerName);
  }
});

socket.on("error", (error) => {
  console.error("Socket error:", error.message);
});

export default socket;
