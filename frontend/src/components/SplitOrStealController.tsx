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

const SplitOrStealController: React.FC<SplitOrStealProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
}) => {
  const [phase, setPhase] = useState<string>("setup");
  const [choice, setChoice] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(20);
  const [chat, setChat] = useState<string>("");
  const [messages, setMessages] = useState<{ from: string; message: string }[]>(
    []
  );

  useEffect(() => {
    if (!socket) return;

    const handleRoundStart = (data: any) => {
      setPhase("negotiation");
      setChoice(null);
      setTimer(20);
    };

    const handleResults = () => {
      setPhase("reveal");
    };

    const handleChat = (data: any) => {
      setMessages((m) => [...m, data]);
    };

    socket.on("split-or-steal-round-start", handleRoundStart);
    socket.on("split-or-steal-round-results", handleResults);
    socket.on("split-or-steal-chat", handleChat);

    return () => {
      socket.off("split-or-steal-round-start", handleRoundStart);
      socket.off("split-or-steal-round-results", handleResults);
      socket.off("split-or-steal-chat", handleChat);
    };
  }, [socket]);

  const sendChoice = (c: string) => {
    setChoice(c);
    socket?.emit("split-or-steal-choice", sessionId, c);
    setPhase("waiting");
  };

  const sendChat = () => {
    if (!chat) return;
    socket?.emit("split-or-steal-chat", sessionId, chat);
    setChat("");
  };

  return (
    <div className="split-or-steal-controller dark">
      {phase === "negotiation" && (
        <div className="chat-box">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className="msg">
                <strong>{players.find((p) => p.id === m.from)?.name}:</strong>{" "}
                {m.message}
              </div>
            ))}
          </div>
          <div className="input">
            <input
              value={chat}
              onChange={(e) => setChat(e.target.value)}
              maxLength={40}
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      )}
      {phase === "negotiation" && <div className="timer">{timer}</div>}
      {phase === "negotiation" || phase === "waiting" ? (
        <div className="choices">
          <button
            className={`choice split ${choice === "SPLIT" ? "selected" : ""}`}
            onClick={() => sendChoice("SPLIT")}
            disabled={!!choice}
          >
            SPLIT
          </button>
          <button
            className={`choice steal ${choice === "STEAL" ? "selected" : ""}`}
            onClick={() => sendChoice("STEAL")}
            disabled={!!choice}
          >
            STEAL
          </button>
        </div>
      ) : null}
      {phase === "reveal" && <p>See TV for results...</p>}
    </div>
  );
};

export default SplitOrStealController;
