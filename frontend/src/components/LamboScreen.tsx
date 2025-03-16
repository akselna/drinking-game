import React, { useEffect, useState } from "react";
import "../styles/LamboScreen.css";
import { CustomSocket } from "../types/socket.types";

interface LamboScreenProps {
  sessionId: string;
  socket: CustomSocket | null;
  isHost: boolean;
  players: any[];
  selectedDrinker: string | null;
  onClose: () => void;
}

const LamboScreen: React.FC<LamboScreenProps> = ({
  sessionId,
  socket,
  isHost,
  players,
  selectedDrinker,
  onClose,
}) => {
  const [emojis, setEmojis] = useState<
    { id: number; style: React.CSSProperties }[]
  >([]);

  // Find the selected drinker player
  const drinkerPlayer = players.find((player) => player.id === selectedDrinker);

  // Check if current user is the drinker
  const isDrinker = socket?.id === selectedDrinker;

  // Generate random beer emojis animation
  useEffect(() => {
    const emojiCount = 30;
    const newEmojis = [];

    for (let i = 0; i < emojiCount; i++) {
      newEmojis.push({
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          animationDuration: `${Math.random() * 3 + 2}s`,
          animationDelay: `${Math.random() * 2}s`,
        },
      });
    }

    setEmojis(newEmojis);
  }, []);

  // Handle close button (host only)
  const handleClose = () => {
    if (socket && isHost) {
      socket.emit("end-lambo", sessionId);
    }
    onClose();
  };

  return (
    <div className="lambo-screen">
      <div className="lambo-content">
        <h1 className="lambo-title">🎉 LAMBO! 🎉</h1>

        {drinkerPlayer && (
          <div className="lambo-drinker">
            <p className="lambo-instruction">
              <span className="drinker-name">{drinkerPlayer.name}</span> må
              drikke!
            </p>
          </div>
        )}

        {isDrinker ? (
          <div className="lambo-lyrics drinker-lyrics">
            <div className="lyrics-label drinker-label">
              Dranker synger: (You)
            </div>
            <p>Jeg mitt glass utdrukket har, mine herrer lambo.</p>
            <p>Se der fins ei dråpen kvar, mine herrer lambo.</p>
            <p>Som bevis der på jeg vender, flasken på dens rette ende</p>
            <p className="instruction-text">
              (Drankeren vender fysisk glass/flaske el. annet med toppen ned
              over hodet som bevis.)
            </p>
          </div>
        ) : (
          <div className="lambo-lyrics spectator-lyrics">
            <div className="lyrics-label spectator-label">
              Tilskuere synger: (You)
            </div>
            <p>Se der står en fyllehund, mine herrer lambo.</p>
            <p>Sett nu flasken for din munn, mine herrer lambo.</p>
            <p>Se hvordan den dråpen vanker ned ad halsen på den dranker</p>
            <p>Lambo, lambo, mine herrer lambo</p>
            <p className="instruction-text">
              (Repeteres til vedkommende verset er rettet mot har drukket opp)
            </p>
            <div className="lambo-closing">
              <p>Lambo, lambo, mine herrer lambo</p>
              <p>Hun/han kunne kunsten hun/han var et jævla fyllesvin.</p>
              <p>Så går vi til nestemann og ser hva hun/han formår.</p>
            </div>
          </div>
        )}

        {isHost && (
          <button onClick={handleClose} className="lambo-close-button">
            Avslutt Lambo
          </button>
        )}

        {!isHost && (
          <p className="waiting-for-host">
            Venter på at verten skal avslutte Lambo...
          </p>
        )}
      </div>

      {/* Flying beer emojis */}
      <div className="emoji-container">
        {emojis.map((emoji) => (
          <div key={emoji.id} className="flying-emoji" style={emoji.style}>
            🍺
          </div>
        ))}
      </div>
    </div>
  );
};

export default LamboScreen;
