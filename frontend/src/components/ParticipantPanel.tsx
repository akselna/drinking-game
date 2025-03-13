import React, { useState, useRef, useEffect } from "react";
import { Socket } from "socket.io-client";
import "../styles/ParticipantPanel.css";

interface ParticipantPanelProps {
  players: any[];
  isHost: boolean;
  currentUserId: string;
  socket: Socket | null;
  sessionId: string;
}

const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  players,
  isHost,
  currentUserId,
  socket,
  sessionId,
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

  return (
    <>
      {/* Button to toggle participant panel */}
      <button
        className="participant-toggle"
        onClick={togglePanel}
        aria-label="Vis deltakere"
      >
        👥
      </button>

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
          {players.map((player) => {
            const isPlayerHost = hostPlayer && player.id === hostPlayer.id;
            const isCurrentUser = player.id === currentUserId;

            return (
              <li
                key={player.id}
                className={`participant-item ${isPlayerHost ? "host" : ""} ${
                  isCurrentUser ? "current-user" : ""
                }`}
              >
                <div className="participant-info">
                  <span className="participant-name">
                    {player.name} {isCurrentUser && " (Deg)"}
                  </span>
                  {isPlayerHost && (
                    <span className="host-badge" title="Vert">
                      👑
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
