import React from "react";
import "../styles/GameLobby.css";

interface GameLobbyProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  onSelectGame: (gameType: string) => void;
  onLeaveSession: () => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({
  sessionId,
  players,
  isHost,
  onSelectGame,
  onLeaveSession,
}) => {
  return (
    <div className="game-lobby">
      <h1>Spillobby</h1>

      <div className="session-info">
        <p className="session-code">
          Sesjonskode: <strong>{sessionId}</strong>
        </p>
        <p className="player-count">Spillere: {players.length}/10</p>
      </div>

      <div className="players-list">
        <h2>Spillere</h2>
        <ul>
          {players.map((player) => (
            <li
              key={player.id}
              className={
                player.id === players.find((p) => p.isHost)?.id ? "host" : ""
              }
            >
              {player.name}{" "}
              {player.id === players.find((p) => p.isHost)?.id && " (Vert)"}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="game-selection">
          <h2>Velg et spill å spille</h2>
          <div className="game-buttons">
            <button
              onClick={() => onSelectGame("neverHaveIEver")}
              className="game-button never-have-i-ever"
            >
              Jeg har aldri...
            </button>
            <button
              onClick={() => onSelectGame("musicGuess")}
              className="game-button music-guess"
            >
              Musikkgjetting
            </button>
            <button
              onClick={() => onSelectGame("drinkOrJudge")}
              className="game-button drink-or-judge"
            >
              Drikk eller Dømmes
            </button>
            <button
              onClick={() => onSelectGame("beat4Beat")}
              className="game-button beat4beat"
            >
              Beat4Beat
            </button>
          </div>
        </div>
      ) : (
        <div className="waiting-message">
          <h2>Venter på at verten skal velge et spill...</h2>
        </div>
      )}

      <button onClick={onLeaveSession} className="leave-button">
        Forlat økten
      </button>
    </div>
  );
};

export default GameLobby;
