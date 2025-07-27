import React from "react";
import { CustomSocket } from "../types/socket.types";
import SplitOrStealSetup from "./SplitOrStealSetup";
import SplitOrStealDashboard from "./SplitOrStealDashboard";
import SplitOrStealController from "./SplitOrStealController";
import "../styles/SplitOrSteal.css";

interface SplitOrStealProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const SplitOrSteal: React.FC<SplitOrStealProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  // Determine which component to render based on host status and game phase
  if (!gameState || gameState.phase === "setup") {
    // Setup phase - show setup component
    return (
      <SplitOrStealSetup
        sessionId={sessionId}
        players={players}
        isHost={isHost}
        socket={socket}
        restartGame={restartGame}
        leaveSession={leaveSession}
        returnToLobby={returnToLobby}
      />
    );
  } else if (isHost) {
    // Host view - show dashboard during game
    return (
      <SplitOrStealDashboard
        sessionId={sessionId}
        players={players}
        isHost={isHost}
        gameState={gameState}
        socket={socket}
        restartGame={restartGame}
        leaveSession={leaveSession}
        returnToLobby={returnToLobby}
      />
    );
  } else {
    // Player view - show controller
    return (
      <SplitOrStealController
        sessionId={sessionId}
        players={players}
        isHost={isHost}
        gameState={gameState}
        socket={socket}
        restartGame={restartGame}
        leaveSession={leaveSession}
        returnToLobby={returnToLobby}
      />
    );
  }
};

export default SplitOrSteal;
