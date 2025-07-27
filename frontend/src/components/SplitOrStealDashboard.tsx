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
  const [phase, setPhase] = useState<string>(gameState?.phase || "countdown");
  const [pairs, setPairs] = useState<Pairing[]>([]);
  const [countdown, setCountdown] = useState<number>(20);
  const [results, setResults] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any>({});

  useEffect(() => {
    if (!socket) return;

    const handleCountdown = (data: any) => {
      setPhase("countdown");
      setCountdown(data.countdown);
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

    const handleDecision = () => {
      setPhase("decision");
    };

    const handleReveal = (data: any) => {
      setPhase("reveal");
      setResults(data.results);
      setLeaderboard(data.leaderboard);
    };

    socket.on("split-steal-countdown", handleCountdown);
    socket.on("split-steal-round-start", handleRoundStart);
    socket.on("split-steal-decision", handleDecision);
    socket.on("split-steal-reveal", handleReveal);
    return () => {
      socket.off("split-steal-countdown", handleCountdown);
      socket.off("split-steal-round-start", handleRoundStart);
      socket.off("split-steal-decision", handleDecision);
      socket.off("split-steal-reveal", handleReveal);
    };
  }, [socket]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((phase === "countdown" || phase === "negotiation") && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [phase, countdown]);

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
      {phase === "countdown" && (
        <div className="countdown">
          <h2>Time until next duel</h2>
          <div className={countdown <= 10 ? "timer danger" : "timer"}>{countdown}</div>
        </div>
      )}
      {phase === "negotiation" && (
        <div>
          <h2>Forhandling - {countdown}</h2>
          {renderPairs()}
        </div>
      )}
      {phase === "decision" && (
        <div>
          <h2>Venter på valg...</h2>
          {renderPairs()}
        </div>
      )}
      {phase === "reveal" && (
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
