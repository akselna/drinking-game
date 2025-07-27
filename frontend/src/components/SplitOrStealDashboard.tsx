import React, { useEffect, useState } from "react";
import { CustomSocket } from "../types/socket.types";
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

interface PairResult {
  a: string;
  b: string;
  choiceA: string;
  choiceB: string;
  aSips: number;
  bSips: number;
}

const SplitOrStealDashboard: React.FC<SplitOrStealProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
}) => {
  const [pairs, setPairs] = useState<string[][]>([]);
  const [results, setResults] = useState<PairResult[]>([]);
  const [leaderboard, setLeaderboard] = useState<any>({});
  const [phase, setPhase] = useState<string>("setup");

  useEffect(() => {
    if (!socket) return;

    const handleRoundStart = (data: any) => {
      setPhase("negotiation");
      setPairs(data.pairs);
      setResults([]);
    };

    const handleResults = (data: any) => {
      setPhase("reveal");
      setResults(data.results);
      setLeaderboard(data.leaderboard);
    };

    socket.on("split-or-steal-round-start", handleRoundStart);
    socket.on("split-or-steal-round-results", handleResults);

    return () => {
      socket.off("split-or-steal-round-start", handleRoundStart);
      socket.off("split-or-steal-round-results", handleResults);
    };
  }, [socket]);

  const startRound = () => {
    socket?.emit("split-or-steal-start-round", sessionId);
  };

  return (
    <div className="split-or-steal-dashboard dark">
      <h2>Split or Steal</h2>
      {phase === "setup" && isHost && (
        <button onClick={startRound}>Start Round</button>
      )}
      {phase !== "setup" && (
        <div className="pairings">
          {pairs.map((p, idx) => (
            <div key={idx} className="pair">
              <span>{players.find((pl) => pl.id === p[0])?.name}</span>
              <span>vs</span>
              <span>{p[1] ? players.find((pl) => pl.id === p[1])?.name : "-"}</span>
            </div>
          ))}
        </div>
      )}
      {phase === "reveal" && (
        <div className="results">
          {results.map((r, i) => (
            <div key={i} className="result">
              <strong>
                {players.find((p) => p.id === r.a)?.name} {r.choiceA} /
                {players.find((p) => p.id === r.b)?.name} {r.choiceB}
              </strong>
              <span>
                {r.aSips} - {r.bSips} sips
              </span>
            </div>
          ))}
          <h3>Leaderboard</h3>
          <ul>
            {Object.entries(leaderboard).map(([id, lb]: any) => (
              <li key={id}>
                {players.find((p) => p.id === id)?.name}: {lb.sips} sips, {" "}
                {lb.steals} steals
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SplitOrStealDashboard;
