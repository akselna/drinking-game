import React, { useState, useRef, useEffect } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/ParticipantPanel.css";

interface ParticipantPanelProps {
  players: any[];
  isHost: boolean;
  currentUserId: string;
  socket: CustomSocket | null;
  sessionId: string;
  lamboVotes: string[]; // Added prop for lambo votes
}

const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  players,
  isHost,
  currentUserId,
  socket,
  sessionId,
  lamboVotes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !(event.target as Element).classList.contains("participant-toggle")
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const handleTransferHost = (newHostId: string) => {
    if (socket && isHost && newHostId !== currentUserId) {
      socket.emit("transfer-host", sessionId, newHostId);
    }
  };

  // Find the host player
  const hostPlayer = players.find(
    (player) => player.isHost || player.id === socket?.hostId
  );

  // Sort players so host appears at the top
  const sortedPlayers = [...players].sort((a, b) => {
    const aIsHost = a.isHost || a.id === socket?.hostId;
    const bIsHost = b.isHost || b.id === socket?.hostId;

    if (aIsHost && !bIsHost) return -1;
    if (!aIsHost && bIsHost) return 1;
    return 0;
  });

  return (
    <>
      {!isOpen && (
        <button
          className="participant-toggle"
          onClick={togglePanel}
          aria-label="Vis deltakere"
        >
          👥
        </button>
      )}

      {/* Overlay shown when panel is open */}
      <div
        className={`overlay ${isOpen ? "open" : ""}`}
        onClick={togglePanel}
      ></div>

      {/* Participant panel */}
      <div
        ref={panelRef}
        className={`participant-panel ${isOpen ? "open" : ""}`}
      >
        <div className="participant-panel-header">
          <h2>Deltakere ({players.length})</h2>
          <button onClick={togglePanel} className="close-button">
            ✕
          </button>
        </div>

        <ul className="participant-list">
          {sortedPlayers.map((player) => {
            const isPlayerHost = hostPlayer && player.id === hostPlayer.id;
            const isCurrentUser = player.id === currentUserId;
            const hasVotedLambo = lamboVotes.includes(player.id);

            return (
              <li
                key={player.id}
                className={`participant-item ${isPlayerHost ? "host" : ""} ${
                  isCurrentUser ? "current-user" : ""
                } ${player.disconnected ? "disconnected" : ""}`}
              >
                <div className="participant-info">
                  {isPlayerHost && (
                    <div className="host-indicator">
                      <span className="host-label">VERT</span>
                      <span className="host-badge" title="Vert">
                        👑
                      </span>
                    </div>
                  )}
                  <span className="participant-name">
                    {player.name} {isCurrentUser && " (Deg)"}
                    {hasVotedLambo && (
                      <span
                        className="lambo-vote-indicator"
                        title="Stemt for Lambo"
                      >
                        🎉
                      </span>
                    )}
                  </span>
                  {player.disconnected && (
                    <span
                      className="disconnected-badge"
                      title="Midlertidig frakoblet"
                    >
                      🔄
                    </span>
                  )}
                </div>

                {isHost && !isPlayerHost && !isCurrentUser && (
                  <div className="participant-actions">
                    <button
                      onClick={() => handleTransferHost(player.id)}
                      title="Gjør til vert"
                      className="transfer-host-button"
                    >
                      👑
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="participant-footer">
          <p className="session-id">
            Øktkode: <strong>{sessionId}</strong>
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `Bli med i drikkeleken min! Kode: ${sessionId}`
              );
              alert("Invitasjonstekst kopiert til utklippstavlen!");
            }}
            className="invite-button"
          >
            Inviter venner
          </button>
        </div>
      </div>
    </>
  );
};

export default ParticipantPanel;
