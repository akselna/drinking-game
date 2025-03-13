import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import "../styles/MusicGuess.css";

interface MusicGuessProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: Socket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

const MusicGuess: React.FC<MusicGuessProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  // You'll need to implement the actual game logic for Music Guess
  // This is a placeholder component until you add the full implementation

  return (
    <div className="music-guess">
      <h2>Musikkgjetting</h2>

      <div className="game-message">
        <p>Denne spilltypen er under utvikling.</p>
        <p>Kommende funksjoner:</p>
        <ul>
          <li>Kategoriutvelgelse</li>
          <li>Sangsøking</li>
          <li>Avspilling av forhåndsvisninger</li>
          <li>Gjetting på hvem som valgte hvilken sang</li>
        </ul>
      </div>

      <div className="game-controls">
        <button className="lobby-button" onClick={returnToLobby}>
          Tilbake til hovedmenyen
        </button>
        <button className="leave-button" onClick={leaveSession}>
          Forlat økt
        </button>
      </div>
    </div>
  );
};

export default MusicGuess;
