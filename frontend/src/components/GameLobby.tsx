/*
 * OPPDATER EKSISTERENDE FIL: frontend/src/components/GameLobby.tsx
 *
 * Erstatt hele innholdet i den eksisterende GameLobby.tsx filen med denne koden.
 * Dette legger til kategorier og Skjenkehjulet-spillet.
 */

// Updated GameLobby.tsx with categories and Skjenkehjulet

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

// Define the game option interface with category
interface GameOption {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  isNew?: boolean;
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

  // Get the host ID from the socket
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

  // Updated game options with categories
  const gameOptions: GameOption[] = [
    // Classic drinking games
    {
      id: "neverHaveIEver",
      name: "Jeg har aldri...",
      icon: "🤭",
      color: "#e21b3c",
      category: "Klassiske spill",
    },
    {
      id: "musicGuess",
      name: "Hvem satte på sangen?",
      icon: "🎵",
      color: "#1368ce",
      category: "Klassiske spill",
    },
    {
      id: "drinkOrJudge",
      name: "Hvem i rommet?",
      icon: "👀",
      color: "#9c27b0",
      category: "Klassiske spill",
    },
    {
      id: "beat4Beat",
      name: "Beat4Beat",
      icon: "🎧",
      color: "#e53935",
      category: "Klassiske spill",
    },
    {
      id: "notAllowedToLaugh",
      name: "Ikke lov å le på vors",
      icon: "😂",
      color: "#6200ea",
      category: "Klassiske spill",
    },
    // Dashboard games
    {
      id: "skjenkehjulet",
      name: "Skjenkehjulet",
      icon: "🎰",
      color: "#FFD700",
      category: "Dashboard-spill",
      isNew: true,
    },
  ];

  // Group games by category
  const gamesByCategory = gameOptions.reduce((acc, game) => {
    const category = game.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(game);
    return acc;
  }, {} as Record<string, GameOption[]>);

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

          {/* Right Column - Game Selection with Categories */}
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

                <div className="games-by-category">
                  {Object.entries(gamesByCategory).map(([category, games]) => (
                    <div
                      key={category}
                      className={`game-category ${
                        category === "Dashboard-spill"
                          ? "dashboard-category"
                          : ""
                      }`}
                    >
                      <h4 className="category-title">{category}</h4>
                      <div className="category-games">
                        {games.map((game: GameOption) => (
                          <button
                            key={game.id}
                            onClick={() => handleGameSelect(game.id)}
                            className={`game-button ${
                              selectedGame === game.id ? "selected" : ""
                            } ${!isHost ? "non-host" : ""}`}
                            style={{
                              backgroundColor: game.color + "15",
                              borderColor: game.color,
                            }}
                            disabled={!isHost}
                            data-game-id={game.id}
                          >
                            <span className="game-icon">{game.icon}</span>
                            <span className="game-name">{game.name}</span>
                            {game.isNew && (
                              <span className="new-feature-badge">Nytt!</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
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
