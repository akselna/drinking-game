import React, { useState, useContext } from "react";
import "../styles/GameLobby.css";
import { SocketContext } from "../context/SocketContext";

// Define the interface for player objects
interface Player {
  id: string;
  name: string;
  disconnected?: boolean;
}

// Define the props interface for the GameLobby component
interface GameLobbyProps {
  sessionId: string;
  players: Player[];
  isHost: boolean;
  onSelectGame: (gameType: string) => void;
  onLeaveSession: () => void;
}

// Define the game option interface
interface GameOption {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const GameLobby: React.FC<GameLobbyProps> = ({
  sessionId,
  players,
  isHost,
  onSelectGame,
  onLeaveSession,
}) => {
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const socket = useContext(SocketContext);

  // Get the current socket ID
  const currentSocketId = socket?.id;

  // Get the host ID from the socket - this will work for ALL users
  // If the current user is host (isHost=true), then they are the host
  // Otherwise, use the hostId that's been stored in the socket
  const hostId = isHost ? currentSocketId : socket?.hostId;

  // Sort players to ensure the host is always at the top
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.id === hostId) return -1;
    if (b.id === hostId) return 1;
    return 0;
  });

  const copySessionCode = (): void => {
    navigator.clipboard.writeText(sessionId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const copyInviteLink = (): void => {
    const inviteText = `Bli med i drikkeleken min! \nKode: ${sessionId} \nhttps://www.fyllehund.no/`;
    navigator.clipboard.writeText(inviteText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleGameSelect = (gameType: string): void => {
    if (!isHost) return; // Only host can select games

    setSelectedGame(gameType);
    setTimeout(() => {
      onSelectGame(gameType);
    }, 300);
  };

  const gameOptions: GameOption[] = [
    {
      id: "neverHaveIEver",
      name: "Jeg har aldri...",
      icon: "🤭",
      color: "#e21b3c",
    },
    {
      id: "musicGuess",
      name: "Hvem satte på sangen?",
      icon: "🎵",
      color: "#1368ce",
    },
    {
      id: "drinkOrJudge",
      name: "Hvem i rommet?",
      icon: "👀",
      color: "#9c27b0",
    },
    { id: "beat4Beat", name: "Beat4Beat", icon: "🎧", color: "#e53935" },
    {
      id: "notAllowedToLaugh",
      name: "Ikke lov å le på vors",
      icon: "😂",
      color: "#6200ea",
    },
  ];

  // Find the host's name for the waiting message
  const hostName = isHost
    ? "verten" // If current user is host, use generic term
    : players.find((p) => p.id === hostId)?.name || "verten";

  return (
    <div className="game-lobby">
      <div className="lobby-container">
        <div className="lobby-header">
          <h1 className="lobby-title">Mine herrer lambo</h1>
        </div>

        <div className="page-grid">
          <div className="left-column">
            {/* Session Code Card */}
            <div className="session-card code-card">
              <div className="card-content">
                <h2 className="card-title">Sesjonskode</h2>
                <div className="session-id">{sessionId}</div>
                <div className="button-group">
                  <button onClick={copySessionCode} className="action-button">
                    <span className="button-icon">
                      {copySuccess ? "✓" : "📋"}
                    </span>
                    <span className="button-text">
                      {copySuccess ? "Kopiert!" : "Kopier kode"}
                    </span>
                  </button>
                  <button
                    onClick={copyInviteLink}
                    className="action-button secondary"
                  >
                    <span className="button-icon">💬</span>
                    <span className="button-text">Del lenke</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Combined Player Count and List Card */}
            <div className="session-card players-card">
              <div className="card-content">
                <h2 className="card-title">Spillere</h2>

                {/* Player count */}
                <div className="player-count">
                  <span className="current-count">{players.length}</span>
                  <span className="max-count">/15</span>
                </div>

                {/* Player list */}
                <div className="players-divider"></div>
                <ul className="players-list">
                  {sortedPlayers.map((player: Player) => (
                    <li
                      key={player.id}
                      className={`player-item ${
                        player.id === hostId ? "host-player" : ""
                      } ${player.disconnected ? "disconnected" : ""}`}
                    >
                      <span className="player-icon">
                        {player.id === hostId ? "👑" : "👤"}
                      </span>
                      <span className="player-name">{player.name}</span>
                      {player.disconnected && (
                        <span
                          className="disconnected-badge"
                          title="Midlertidig frakoblet"
                        >
                          🔄
                        </span>
                      )}
                      {player.id === currentSocketId && (
                        <span className="current-user-badge">(Deg)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column - Game Selection for everyone */}
          <div className="right-column">
            <div className="session-card game-selection-card">
              <div className="card-content">
                <h2 className="card-title">
                  {isHost ? "Velg et spill å spille" : "Tilgjengelige spill"}
                  {!isHost && (
                    <span className="waiting-for-host">
                      Venter på at {hostName} skal velge
                    </span>
                  )}
                </h2>
                <div className="games-grid">
                  {gameOptions.map((game: GameOption) => (
                    <button
                      key={game.id}
                      onClick={() => handleGameSelect(game.id)}
                      className={`game-button ${
                        selectedGame === game.id ? "selected" : ""
                      } ${!isHost ? "non-host" : ""}`}
                      style={{
                        backgroundColor: game.color + "15", // Add transparency to color
                        borderColor: game.color,
                      }}
                      disabled={!isHost}
                    >
                      <span className="game-icon">{game.icon}</span>
                      <span className="game-name">{game.name}</span>
                    </button>
                  ))}
                </div>

                {!isHost && (
                  <div className="host-control-note">
                    Kun verten kan velge spill
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
