// src/components/SplitOrStealSetup.tsx
import React, { useState } from "react";
import { CustomSocket } from "../types/socket.types";
import BlueDotBackground from "./BlueDotBackground";

// --- Interfaces ---
interface Participant {
  id: string;
  name: string;
}

interface SplitOrStealSetupProps {
  sessionId: string;
  isHost: boolean;
  socket: CustomSocket | null;
  players?: any[];
  restartGame?: () => void;
  leaveSession?: () => void;
  returnToLobby?: () => void;
}

// --- Component ---
const SplitOrStealSetup: React.FC<SplitOrStealSetupProps> = ({
  sessionId,
  isHost,
  socket,
}) => {
  const [countdownDuration, setCountdownDuration] = useState<number>(30);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState<string>("");

  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;
    if (
      participants.some(
        (p) => p.name.toLowerCase() === newParticipantName.trim().toLowerCase()
      )
    ) {
      alert("A participant with this name already exists!");
      return;
    }
    const newParticipant: Participant = {
      id: `custom_${Date.now()}`,
      name: newParticipantName.trim(),
    };
    setParticipants([...participants, newParticipant]);
    setNewParticipantName("");
  };

  const handleRemoveParticipant = (participantId: string) => {
    setParticipants(participants.filter((p) => p.id !== participantId));
  };

  const handleStartGame = () => {
    if (!socket || !isHost || participants.length < 2) return;
    socket.emit("split-steal-config", sessionId, {
      countdownDuration,
      participants,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddParticipant();
    }
  };

  // --- Render Non-Host View ---
  if (!isHost) {
    return (
      <BlueDotBackground>
        <div style={styles.container}>
          <h1 style={styles.mainTitle}>💰 Cheers Or Tears</h1>
          <div style={styles.card}>
            <h3 style={{ ...styles.subTitle, color: "#4d9eff" }}>
              Waiting for Host
            </h3>
            <p style={{ fontSize: "1.2rem", opacity: 0.8 }}>
              The host is setting up the game...
            </p>
          </div>
        </div>
      </BlueDotBackground>
    );
  }

  // --- Render Host View ---
  return (
    <BlueDotBackground>
      <div style={styles.container}>
        <h1 style={styles.mainTitle}>💰 Cheers Or Tears</h1>

        <div
          style={{
            ...styles.card,
            minWidth: "600px",
            animation: "fadeIn 0.5s ease-out",
          }}
        >
          <h2 style={styles.subTitle}>Game Setup</h2>

          {/* Countdown Duration */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Countdown Between Duels (10-300s)
            </label>
            <input
              type="number"
              min="10"
              max="300"
              value={countdownDuration}
              onChange={(e) =>
                setCountdownDuration(parseInt(e.target.value, 10) || 30)
              }
              style={styles.input}
            />
          </div>

          {/* Participants List */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Participants ({participants.length})
            </label>
            <div style={styles.participantsList}>
              {participants.length === 0 ? (
                <p
                  style={{ textAlign: "center", opacity: 0.7, padding: "1rem" }}
                >
                  No participants added yet.
                </p>
              ) : (
                participants.map((p) => (
                  <div key={p.id} style={styles.participantItem}>
                    <span>{p.name}</span>
                    <button
                      onClick={() => handleRemoveParticipant(p.id)}
                      style={styles.removeButton}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add Participant Form */}
          <div style={{ ...styles.formGroup, display: "flex", gap: "1rem" }}>
            <input
              type="text"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter participant name"
              maxLength={20}
              style={{ ...styles.input, flex: 1 }}
            />
            <button
              onClick={handleAddParticipant}
              disabled={!newParticipantName.trim()}
              style={styles.button.primary}
            >
              Add
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={handleStartGame}
            disabled={participants.length < 2}
            style={
              participants.length < 2
                ? styles.button.disabled
                : styles.button.success
            }
          >
            {participants.length < 2
              ? "Need at least 2 participants"
              : `Start Game with ${participants.length} Participants`}
          </button>
        </div>
      </div>
    </BlueDotBackground>
  );
};

// --- Styles ---
const baseButton: React.CSSProperties = {
  padding: "0.8rem 2rem",
  border: "none",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "1rem",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.3s ease",
  textShadow: "0 1px 3px rgba(0,0,0,0.3)",
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column" as "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as "center",
    width: "100%",
  },
  mainTitle: {
    fontSize: "4rem",
    fontWeight: 900,
    letterSpacing: "-2px",
    marginBottom: "2rem",
    background:
      "linear-gradient(135deg, #FFE066 0%, #FFA500 50%, #FF8C00 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    textShadow: "0 0 30px rgba(255, 165, 0, 0.5)",
  },
  card: {
    background: "rgba(20, 20, 20, 0.9)",
    backdropFilter: "blur(10px)",
    borderRadius: "20px",
    padding: "2.5rem",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
    border: "2px solid rgba(255, 255, 255, 0.1)",
  },
  subTitle: {
    fontSize: "2rem",
    fontWeight: 700,
    marginBottom: "2rem",
    background: "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  formGroup: {
    marginBottom: "1.5rem",
    textAlign: "left" as "left",
  },
  label: {
    display: "block",
    marginBottom: "0.75rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.8)",
  },
  input: {
    width: "100%",
    padding: "0.8rem 1.2rem",
    background: "rgba(0, 0, 0, 0.3)",
    border: "2px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "1rem",
    boxSizing: "border-box" as "border-box",
  },
  participantsList: {
    maxHeight: "200px",
    overflowY: "auto" as "auto",
    padding: "0.5rem",
    background: "rgba(0, 0, 0, 0.2)",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  participantItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.8rem 1rem",
    margin: "0.5rem",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
  },
  removeButton: {
    padding: "0.3rem 0.6rem",
    background: "rgba(255, 69, 69, 0.2)",
    border: "1px solid rgba(255, 69, 69, 0.3)",
    borderRadius: "6px",
    color: "#ff4545",
    fontSize: "1rem",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  button: {
    primary: {
      ...baseButton,
      background: "linear-gradient(135deg, #4d9eff 0%, #1a5fb4 100%)",
    },
    success: {
      ...baseButton,
      background: "linear-gradient(135deg, #28a745 0%, #218838 100%)",
      width: "100%",
      padding: "1rem",
    },
    disabled: {
      ...baseButton,
      background: "rgba(100, 100, 100, 0.3)",
      cursor: "not-allowed",
      width: "100%",
      padding: "1rem",
    },
  },
};

export default SplitOrStealSetup;
