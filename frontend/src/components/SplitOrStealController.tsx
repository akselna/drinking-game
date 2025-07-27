import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealControllerProps {
  sessionId: string;
  gameState: any;
  socket: CustomSocket | null;
}

const SplitOrStealController: React.FC<SplitOrStealControllerProps> = ({
  sessionId,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "waiting");
  const [choice, setChoice] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [result, setResult] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [newName, setNewName] = useState("");
  const [leaderboard, setLeaderboard] = useState<any>({});
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: any) => {
      setPhase(state.phase);
      setTimer(state.timer || 0);
      setCurrentPlayer(state.currentTurnName || "");
      if (state.leaderboard) setLeaderboard(state.leaderboard);
      if (state.participants) setParticipants(state.participants);
      setChoice(null);
      if (state.phase === "reveal" && state.results) {
        setResult(state.results);
      } else {
        setResult(null);
      }
    };

    socket.on("split-steal-state", handleState);
    socket.on("split-steal-timer", (t: number) => setTimer(t));
    return () => {
      socket.off("split-steal-state", handleState);
      socket.off("split-steal-timer");
    };
  }, [socket]);

  const sendChoice = (c: string) => {
    if (socket && !choice) {
      setChoice(c);
      socket.emit("split-steal-choice", sessionId, c);
    }
  };

  return (
    <div className="split-steal controller">
      <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>⚙️</button>
      {showSettings && (
        <div className="settings-panel">
          <h3>Innstillinger</h3>
          <div className="add-player-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Navn"
            />
            <button onClick={() => {socket?.emit('split-steal-add-player', sessionId, newName); setNewName('');}}>Legg til</button>
          </div>
          {participants.map((p) => (
            <div key={p.id} className="player-row">
              {p.name}
              <button onClick={() => socket?.emit('split-steal-remove-player', sessionId, p.id)}>x</button>
            </div>
          ))}
          <button onClick={() => socket?.emit('split-steal-skip', sessionId)}>Hopp over runde</button>
        </div>
      )}
      {phase === "negotiation" && <div className="timer">{timer}</div>}
      {phase === "decision" && (
        <div className="choice-buttons">
          <h3>{currentPlayer}</h3>
          <button className="split-btn" disabled={!!choice} onClick={() => sendChoice('split')}>
            SPLIT
          </button>
          <button className="steal-btn" disabled={!!choice} onClick={() => sendChoice('steal')}>
            STEAL
          </button>
        </div>
      )}
      {phase === "reveal" && result && (
        <div className="reveal">
          <h3>Resultat: {result.outcome}</h3>
        </div>
      )}
    </div>
  );
};

export default SplitOrStealController;
