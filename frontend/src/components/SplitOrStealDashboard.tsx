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
  const [phase, setPhase] = useState<string>(gameState?.phase || "config");
  const [pairs, setPairs] = useState<Pairing[]>([]);
  const [countdown, setCountdown] = useState<number>(30);
  const [duelDelay, setDuelDelay] = useState<number>(30);
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any>({});

  useEffect(() => {
    if (!socket) return;

    const handlePhase = (data: any) => {
      setPhase(data.phase);
      if (data.phase === "countdown") {
        setCountdown(data.countdown);
      }
    };

    const handleRoundStart = (data: any) => {
      setPhase("negotiation");
      setPairs(
        data.pairs.map((p: any) => ({
          idA: p[0].id,
          nameA: p[0].name,
          idB: p[1]?.id,
          nameB: p[1]?.name,
        }))
      );
      setResults([]);
      setCountdown(60);
    };

    const handleReveal = (data: any) => {
      setPhase("reveal");
      setResults(data.results);
      setLeaderboard(data.leaderboard);
      setCountdown(10);
    };

    socket.on("split-steal-phase", handlePhase);
    socket.on("split-steal-round-start", handleRoundStart);
    socket.on("split-steal-reveal", handleReveal);
    return () => {
      socket.off("split-steal-phase", handlePhase);
      socket.off("split-steal-round-start", handleRoundStart);
      socket.off("split-steal-reveal", handleReveal);
    };
  }, [socket]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0 && (phase === "countdown" || phase === "negotiation" || phase === "reveal")) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const startGame = () => {
    if (socket) {
      socket.emit("split-steal-set-config", sessionId, {
        countdown: duelDelay,
        participants: selected,
      });
    }
  };

  const renderPairs = () => (
    <div className="pairs">
      {pairs.map((p, idx) => (
        <div key={idx} className="pair">
          <span>{p.nameA}</span>
          <span>vs</span>
          <span>{p.nameB || "Sitter over"}</span>
        </div>
      ))}
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
      {phase === "config" && (
        <div className="config-form">
          <h2>Split or Steal</h2>
          <label>
            Delay between duels (s):
            <input
              type="number"
              value={duelDelay}
              onChange={(e) => setDuelDelay(parseInt(e.target.value) || 30)}
            />
          </label>
          <div className="participants">
            {players.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(p.id)
                        ? prev.filter((id) => id !== p.id)
                        : [...prev, p.id]
                    )
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={startGame} disabled={selected.length < 2}>
            Start Game
          </button>
        </div>
      )}
      {phase === "countdown" && (
        <div className="countdown-wrapper">
          <div className={`countdown ${countdown <= 10 ? "tension" : ""}`}>{countdown}</div>
          <div className="subtitle">Time until next duel</div>
        </div>
      )}
      {phase === "negotiation" && (
        <div>
          <h2>Negotiation - {countdown}</h2>
          {renderPairs()}
        </div>
      )}
      {phase === "reveal" && (
        <div>
          <h2>Results</h2>
          {renderResults()}
          {renderLeaderboard()}
        </div>
      )}
    </div>
  );
};

export default SplitOrStealDashboard;
