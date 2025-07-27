import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/SplitOrSteal.css";

interface SplitOrStealDashboardProps {
  sessionId: string;
  players: any[];
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
  players,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>(gameState?.phase || "setup");
  const [countdownDuration, setCountdownDuration] = useState<number>(
    gameState?.countdownDuration || 30
  );
  const [participants, setParticipants] = useState<string[]>(
    gameState?.participants || players.map((p) => p.id)
  );
  const [pair, setPair] = useState<Pairing | null>(null);
  const [countdown, setCountdown] = useState<number>(countdownDuration);
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any>({});

  useEffect(() => {
    if (!socket) return;

    const handleSettings = (data: any) => {
      setCountdownDuration(data.countdownDuration);
      setParticipants(data.participants);
    };

    const handleCountdown = (data: any) => {
      setPhase("countdown");
      setCountdown(data.countdownDuration);
      setPair(null);
      setResults(null);
    };

    const handleRoundStart = (data: any) => {
      setPhase("negotiation");
      setPair({
        idA: data.pair[0].id,
        nameA: data.pair[0].name,
        idB: data.pair[1].id,
        nameB: data.pair[1].name,
      });
      setCountdown(60);
    };

    const handleDecision = (data: any) => {
      setPhase("decision");
      setCurrentTurn(data.currentTurn);
    };

    const handleReveal = (data: any) => {
      setPhase("revealCountdown");
      setResults(data.results);
      setLeaderboard(data.leaderboard);
      setCountdown(10);
    };

    socket.on("split-steal-settings-updated", handleSettings);
    socket.on("split-steal-countdown", handleCountdown);
    socket.on("split-steal-round-start", handleRoundStart);
    socket.on("split-steal-decision", handleDecision);
    socket.on("split-steal-reveal", handleReveal);
    return () => {
      socket.off("split-steal-settings-updated", handleSettings);
      socket.off("split-steal-countdown", handleCountdown);
      socket.off("split-steal-round-start", handleRoundStart);
      socket.off("split-steal-decision", handleDecision);
      socket.off("split-steal-reveal", handleReveal);
    };
  }, [socket]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      ["countdown", "negotiation", "revealCountdown"].includes(phase) &&
      countdown > 0
    ) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      if (phase === "countdown" && socket) {
        socket.emit("split-steal-begin-negotiation", sessionId);
      } else if (phase === "negotiation" && socket) {
        socket.emit("split-steal-begin-decision", sessionId);
      } else if (phase === "revealCountdown") {
        setPhase("reveal");
      }
    }
    return () => clearTimeout(timer);
  }, [phase, countdown, socket, sessionId]);

  const updateSettings = () => {
    if (socket) {
      socket.emit("split-steal-settings", sessionId, {
        countdown: countdownDuration,
        participants,
      });
    }
  };

  const startRound = () => {
    updateSettings();
    if (socket) {
      socket.emit("split-steal-start-round", sessionId);
    }
  };

  const renderPair = () =>
    pair && (
      <div className="pair">
        <span>{pair.nameA}</span>
        <span>vs</span>
        <span>{pair.nameB}</span>
      </div>
    );

  const renderResults = () => (
    <div className="results">
      {results.map((r, idx) => {
        const [a, b] = r.pair;
        return (
          <div key={idx} className="result">
            <span>{a.name}</span>
            <span>{r.outcome}</span>
            <span>{b ? b.name : ""}</span>
          </div>
        );
      })}
    </div>
  );

  const renderLeaderboard = () => (
    <div className="leaderboard">
      {Object.entries(leaderboard).map(([id, stats]: any) => {
        const player = players.find((p) => p.id === id);
        return (
          <div key={id} className="leaderboard-row">
            <span>{player?.name}</span>
            <span>{stats.sips} slurks</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="split-steal dash">
      {phase === "setup" && (
        <div className="setup-panel">
          <label>
            Countdown (sek):
            <input
              type="number"
              min={5}
              value={countdownDuration}
              onChange={(e) => setCountdownDuration(parseInt(e.target.value) || 5)}
            />
          </label>
          <div className="participants">
            {players.map((p) => (
              <label key={p.id} className="participant-row">
                <input
                  type="checkbox"
                  checked={participants.includes(p.id)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setParticipants((prev) =>
                      checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                    );
                  }}
                />
                {p.name}
              </label>
            ))}
          </div>
          <button onClick={startRound} className="btn-primary">
            Start
          </button>
        </div>
      )}
      {phase === "countdown" && (
        <div className="countdown-panel">
          <h2>Time until next duel</h2>
          <div className={countdown <= 10 ? "timer tension" : "timer"}>{countdown}</div>
        </div>
      )}
      {phase === "negotiation" && (
        <div>
          <h2>Forhandling - {countdown}</h2>
          {renderPair()}
        </div>
      )}
      {phase === "decision" && pair && (
        <div>
          <h2>Valg</h2>
          <p>Nå er det {currentTurn === 0 ? pair.nameA : pair.nameB} sin tur</p>
        </div>
      )}
      {phase === "revealCountdown" && (
        <div className="countdown-panel">
          <h2>Avslører om {countdown}...</h2>
        </div>
      )}
      {phase === "reveal" && results && (
        <div>
          <h2>Resultater</h2>
          {renderResults()}
          {renderLeaderboard()}
        </div>
      )}
    </div>
  );
};

export default SplitOrStealDashboard;
