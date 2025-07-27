import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealDashboardProps {
  sessionId: string;
  gameState: any;
  socket: CustomSocket | null;
}

interface Pairing {
  idA: string;
  nameA: string;
  idB?: string;
  nameB?: string;
}

const SplitOrStealDashboard: React.FC<SplitOrStealDashboardProps> = ({
  sessionId,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "setup");
  const [currentPair, setCurrentPair] = useState<Pairing | null>(null);
  const [timer, setTimer] = useState<number>(0);
  const [results, setResults] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>({});
  const [participants, setParticipants] = useState<any[]>(gameState?.participants || []);
  const [showSettings, setShowSettings] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!socket) return;

    const handleState = (state: any) => {
      setPhase(state.phase);
      setTimer(state.timer || 0);
      if (state.participants) setParticipants(state.participants);
      if (state.currentPair) {
        setCurrentPair({
          idA: state.currentPair[0].id,
          nameA: state.currentPair[0].name,
          idB: state.currentPair[1]?.id,
          nameB: state.currentPair[1]?.name,
        });
      } else {
        setCurrentPair(null);
      }
      if (state.leaderboard) setLeaderboard(state.leaderboard);
      if (state.results) setResults(state.results);
    };

    socket.on("split-steal-state", handleState);
    socket.on("split-steal-timer", (t: number) => setTimer(t));
    return () => {
      socket.off("split-steal-state", handleState);
      socket.off("split-steal-timer");
    };
  }, [socket]);

  const startCountdown = () => {
    if (socket) {
      socket.emit("split-steal-start", sessionId);
    }
  };

  const addPlayer = () => {
    if (socket && newName.trim()) {
      socket.emit("split-steal-add-player", sessionId, newName.trim());
      setNewName("");
    }
  };

  const removePlayer = (id: string) => {
    if (socket) {
      socket.emit("split-steal-remove-player", sessionId, id);
    }
  };

  const skipRound = () => {
    if (socket) {
      socket.emit("split-steal-skip", sessionId);
    }
  };

  const renderPair = () => {
    if (!currentPair) return null;
    return (
      <div className="pair">
        <span>{currentPair.nameA}</span>
        <span>vs</span>
        <span>{currentPair.nameB || "Sitter over"}</span>
      </div>
    );
  };

  const renderResults = () => {
    if (!results) return null;
    const [a, b] = results.pair;
    return (
      <div className="results">
        <div className="result">
          <span>{a.name}</span>
          <span>{results.outcome}</span>
          <span>{b ? b.name : ""}</span>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => (
    <div className="leaderboard">
      {Object.entries(leaderboard).map(([id, stats]: any) => (
        <div key={id} className="leaderboard-row">
          <span>{stats.name}</span>
          <span>{stats.sips} slurks</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="split-steal dash">
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
            <button onClick={addPlayer}>Legg til</button>
          </div>
          {participants.map((p) => (
            <div key={p.id} className="player-row">
              {p.name}
              <button onClick={() => removePlayer(p.id)}>x</button>
            </div>
          ))}
          <button onClick={skipRound}>Hopp over runde</button>
        </div>
      )}
      {phase === "setup" && (
        <div className="center">
          <button onClick={startCountdown} className="btn-primary">
            Start
          </button>
        </div>
      )}
      {phase === "countdown" && (
        <div>
          <h3>Time until next duel</h3>
          <div
            className={`countdown-text ${timer <= 10 ? "flash" : ""}`}
          >
            {timer}
          </div>
        </div>
      )}
      {phase === "negotiation" && currentPair && (
        <div>
          <p>
            {currentPair.nameA} og {currentPair.nameB || "Sitter over"} har {timer}{" "}
            sekunder til å diskutere hva de skal velge
          </p>
          {renderPair()}
        </div>
      )}
      {phase === "decision" && currentPair && (
        <div>
          <p>
            {currentPair.nameA} og {currentPair.nameB || "Sitter over"} må ta en
            beslutning
          </p>
          {renderPair()}
        </div>
      )}
      {phase === "reveal" && (
        <div>
          <h2>Resultater om {timer}</h2>
          {timer === 0 && (
            <>
              {renderResults()}
              {renderLeaderboard()}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SplitOrStealDashboard;
