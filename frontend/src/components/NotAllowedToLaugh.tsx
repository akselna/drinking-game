import React, { useState, useEffect, useRef } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/NotAllowedToLaugh.css";
import { MemeTemplate } from "../types/meme.types";
import { memeTemplates } from "../data/memeTemplates";

interface NotAllowedToLaughProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

interface GameState {
  phase: "setup" | "submission" | "reveal";
  responses: string[];
  currentResponse: string | null;
  currentResponseIndex: number;
  timerDuration: number;
  timeRemaining: number;
  responseCount?: number;
}

const NotAllowedToLaugh: React.FC<NotAllowedToLaughProps> = ({
  sessionId,
  players,
  isHost,
  gameState,
  socket,
  restartGame,
  leaveSession,
  returnToLobby,
}) => {
  // Local state
  const [newResponse, setNewResponse] = useState<string>("");
  const [shakeAnimation, setShakeAnimation] = useState<boolean>(false);
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [localGameState, setLocalGameState] = useState<any>({
    phase: "setup",
    responses: [],
    currentResponse: null,
    currentResponseIndex: 0,
    timerDuration: 60,
    timeRemaining: 60,
  });
  const responseInputRef = useRef<HTMLInputElement>(null);

  // Meme-relaterte state-variabler
  const [responseType, setResponseType] = useState<"text" | "meme">("text");
  const [selectedMeme, setSelectedMeme] = useState<string | null>(null);
  const [memeTopText, setMemeTopText] = useState<string>("");
  const [memeBottomText, setMemeBottomText] = useState<string>("");
  const [showMemeSelector, setShowMemeSelector] = useState<boolean>(false);

  // Add this useEffect to prevent unwanted GIF autoplay on mobile
  useEffect(() => {
    // Find all GIF images and add a handler to control animation
    const gifImages = document.querySelectorAll(".gif-image");

    // Function to check if element is in viewport
    const isInViewport = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <=
          (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <=
          (window.innerWidth || document.documentElement.clientWidth)
      );
    };

    // Add intersection observer to only animate GIFs when visible
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // GIF is visible, allow animation by removing static class
            entry.target.classList.remove("gif-static");
          } else {
            // GIF is not visible, pause animation
            entry.target.classList.add("gif-static");
          }
        });
      });

      gifImages.forEach((img) => observer.observe(img));

      return () => {
        gifImages.forEach((img) => observer.unobserve(img));
      };
    }
  }, []);

  // Initialize state from gameState prop
  useEffect(() => {
    if (gameState) {
      console.log("Game state updated:", gameState);
      setLocalGameState(gameState);
    }
  }, [gameState]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle timer updates
    const handleTimerUpdate = (data: any) => {
      console.log("Timer update:", data);
      setLocalGameState((prev: GameState) => ({
        ...prev,
        timeRemaining: data.timeRemaining,
        timerDuration: data.timerDuration || prev.timerDuration,
      }));
    };

    // Handle new response submitted
    const handleResponseSubmitted = (data: any) => {
      console.log("Response submitted:", data);
      setLocalGameState((prev: GameState) => ({
        ...prev,
        responses: Array.isArray(data.responses)
          ? data.responses
          : prev.responses,
        responseCount: data.responseCount || prev.responses.length,
      }));
    };

    // Handle phase changes
    const handlePhaseChanged = (data: any) => {
      console.log("Phase changed:", data);
      setLocalGameState((prev: GameState) => ({
        ...prev,
        phase: data.phase,
        responses: data.responses || prev.responses,
        timeRemaining: data.timeRemaining || prev.timeRemaining,
        timerDuration: data.timerDuration || prev.timerDuration,
        currentResponseIndex: data.currentResponseIndex || 0,
        currentResponse: data.currentResponse || null,
      }));
    };

    // Handle next response
    const handleNextResponse = (data: any) => {
      console.log("Next response:", data);
      setFadeIn(false);

      setTimeout(() => {
        setLocalGameState((prev: GameState) => ({
          ...prev,
          currentResponse: data.currentResponse,
          currentResponseIndex: data.currentResponseIndex,
        }));

        setFadeIn(true);
        setShakeAnimation(true);
      }, 50);
    };

    // Register event listeners
    socket.on("laugh-timer-update", handleTimerUpdate);
    socket.on("laugh-response-submitted", handleResponseSubmitted);
    socket.on("laugh-phase-changed", handlePhaseChanged);
    socket.on("laugh-next-response", handleNextResponse);

    // Clean up
    return () => {
      socket.off("laugh-timer-update", handleTimerUpdate);
      socket.off("laugh-response-submitted", handleResponseSubmitted);
      socket.off("laugh-phase-changed", handlePhaseChanged);
      socket.off("laugh-next-response", handleNextResponse);
    };
  }, [socket]);

  // Handle timer setup and start (host only)
  const startGame = (seconds: number) => {
    if (!socket || !isHost) return;
    socket.emit("laugh-start-game", sessionId, seconds);
  };

  // Add this function before your return statements, around line 150
  const renderMemeTemplate = (template: MemeTemplate | undefined) => {
    if (!template) return null;

    // Check if URL ends with video extensions or gif
    const isVideo =
      template.type === "video" ||
      template.url.endsWith(".mp4") ||
      template.url.endsWith(".webm");
    const isGif = template.url.endsWith(".gif");

    return (
      <div className="meme-image-container">
        {isVideo ? (
          <video
            src={template.url}
            controls={false}
            loop
            muted
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <img
            src={template.url}
            alt="Meme template"
            className={isGif ? "gif-image" : ""}
          />
        )}
        <div className="meme-text top">{memeTopText}</div>
        <div className="meme-text bottom">{memeBottomText}</div>
      </div>
    );
  };
  // Handle response submission
  const handleSubmitResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    if (responseType === "text") {
      // Handle text response as before
      if (!newResponse.trim()) return;

      socket.emit("laugh-submit-response", sessionId, {
        type: "text",
        text: newResponse.trim(),
      });
      setNewResponse("");
    } else if (responseType === "meme" && selectedMeme) {
      // Handle meme response
      if (!memeTopText.trim() && !memeBottomText.trim()) {
        return; // Don't submit empty memes
      }

      socket.emit("laugh-submit-response", sessionId, {
        type: "meme",
        templateId: selectedMeme,
        topText: memeTopText.trim(),
        bottomText: memeBottomText.trim(),
      });

      // Reset meme state
      setMemeTopText("");
      setMemeBottomText("");
      setSelectedMeme(null);
      setShowMemeSelector(false);
    }

    // Focus back on input after submission
    if (responseInputRef.current) {
      responseInputRef.current.focus();
    }
  };

  // Show next response (host only)
  const showNextResponse = () => {
    if (!socket || !isHost) return;
    socket.emit("laugh-next-response", sessionId);
  };

  // Handle restart game
  const handleRestartGame = () => {
    if (!socket || !isHost) return;
    socket.emit("laugh-restart-game", sessionId);
  };

  // Reset shake animation after it's done
  useEffect(() => {
    if (shakeAnimation) {
      const timer = setTimeout(() => {
        setShakeAnimation(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shakeAnimation]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Use local state for rendering
  const {
    phase,
    responses,
    currentResponse,
    currentResponseIndex,
    timeRemaining,
    timerDuration,
  } = localGameState;

  // Setup Phase
  if (phase === "setup") {
    return (
      <div className="not-allowed-to-laugh setup-phase">
        <h2>Ikke lov å le på vors</h2>

        {/* Response counter */}
        <div className="response-counter">
          <div className="counter-label">Antall svar</div>
          <div className="counter-value">{responses?.length || 0}</div>
        </div>

        {isHost ? (
          <div className="setup-container">
            <div className="timer-setup">
              <label>Tid for å sende inn svar (sekunder):</label>
              <input
                type="number"
                min="10"
                max="300"
                defaultValue="60"
                className="timer-input"
                onChange={(e) => {
                  const value = Math.max(10, parseInt(e.target.value) || 10);
                  if (socket)
                    socket.emit("laugh-set-duration", sessionId, value);

                  // Update local state immediately for better UI feedback
                  setLocalGameState((prev: GameState) => ({
                    ...prev,
                    timerDuration: value,
                    timeRemaining: value,
                  }));
                }}
              />
            </div>

            <button
              onClick={() => startGame(timerDuration)}
              className="start-button"
            >
              Start spillet
            </button>
          </div>
        ) : (
          <div className="waiting-message">
            <p>Waiting for the host to start the game...</p>
          </div>
        )}

        <div className="game-instructions">
          <h3>Hvordan spille:</h3>
          <ol>
            <li>Verten setter en timer for svar.</li>
            <li>Alle sender inn memes eller tekst.</li>
            <li>Når tiden er ute, leses svarene opp – ingen latter.</li>
            <li>Ler du, drikker du.</li>
          </ol>
        </div>
      </div>
    );
  }

  // Submission Phase
  if (phase === "submission") {
    return (
      <div className="not-allowed-to-laugh submission-phase">
        <h2>Ikke lov å le på vors</h2>

        {/* Response counter */}
        <div className="response-counter">
          <div className="counter-label">Antall svar</div>
          <div className="counter-value">{responses?.length || 0}</div>
        </div>

        {/* Timer */}
        <div className="timer-container">
          <div className="timer-progress">
            <div
              className="timer-bar"
              style={{
                width: `${
                  ((timeRemaining || 0) / (timerDuration || 60)) * 100
                }%`,
              }}
            ></div>
          </div>
          <div className="timer-display">{formatTime(timeRemaining || 0)}</div>
        </div>

        {/* Response submission form */}
        <div className="submission-container">
          <div className="response-type-toggle">
            <div
              className={`response-type-option ${
                responseType === "text" ? "active" : ""
              }`}
              onClick={() => setResponseType("text")}
            >
              Text
            </div>
            <div
              className={`response-type-option ${
                responseType === "meme" ? "active" : ""
              }`}
              onClick={() => setResponseType("meme")}
            >
              Meme
            </div>
          </div>

          {responseType === "text" ? (
            <form onSubmit={handleSubmitResponse}>
              <div className="input-group">
                <input
                  type="text"
                  ref={responseInputRef}
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Type something funny..."
                  className="response-input"
                />
              </div>
              <button type="submit" className="submit-button">
                Send svar
              </button>
            </form>
          ) : (
            <div className="meme-submission">
              {!selectedMeme ? (
                <button
                  onClick={() => setShowMemeSelector(true)}
                  className="select-meme-button"
                >
                  Velg en meme template
                </button>
              ) : (
                <>
                  <div className="meme-editor">
                    <h3>Legg til tekst</h3>

                    <div className="meme-preview">
                      {renderMemeTemplate(
                        memeTemplates.find((t) => t.id === selectedMeme)
                      )}
                    </div>

                    <div className="meme-text-inputs">
                      <div className="input-group">
                        <label>Topptekst:</label>
                        <input
                          type="text"
                          value={memeTopText}
                          onChange={(e) => setMemeTopText(e.target.value)}
                          className="meme-text-input"
                          placeholder="Add top text"
                        />
                      </div>

                      <div className="input-group">
                        <label>Bunntekst:</label>
                        <input
                          type="text"
                          value={memeBottomText}
                          onChange={(e) => setMemeBottomText(e.target.value)}
                          className="meme-text-input"
                          placeholder="Add bottom text"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="meme-buttons">
                    <button
                      onClick={() => setSelectedMeme(null)}
                      className="cancel-button"
                    >
                      Velg en annen meme
                    </button>
                    <button
                      onClick={handleSubmitResponse}
                      className="submit-button"
                    >
                      Send inn meme
                    </button>
                  </div>
                </>
              )}

              {showMemeSelector && (
                <div className="meme-selector-modal">
                  <div className="meme-selector-content">
                    <button
                      className="close-selector"
                      onClick={() => setShowMemeSelector(false)}
                    >
                      ✕
                    </button>
                    <div className="meme-selector">
                      <h3>Velg en meme template</h3>
                      <div className="meme-grid">
                        {memeTemplates.map((template) => {
                          const isVideo =
                            template.type === "video" ||
                            template.url.endsWith(".mp4") ||
                            template.url.endsWith(".webm");
                          const isGif = template.url.endsWith(".gif");

                          return (
                            <div
                              key={template.id}
                              className={`meme-item ${
                                selectedMeme === template.id ? "selected" : ""
                              } ${isVideo ? "video-meme" : ""} ${
                                isGif ? "gif-meme" : ""
                              }`}
                              onClick={() => {
                                setSelectedMeme(template.id);
                                setShowMemeSelector(false);
                              }}
                            >
                              {isVideo ? (
                                <video
                                  src={template.url}
                                  muted
                                  loop
                                  autoPlay
                                  playsInline
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : (
                                <img
                                  src={template.url}
                                  alt={template.name}
                                  className={isGif ? "gif-image" : ""}
                                />
                              )}
                              <span>{template.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="submission-info">
            <p>Submit as many responses as you want before the timer ends!</p>
            <p>Current submissions: {responses?.length || 0}</p>
          </div>
        </div>
      </div>
    );
  }

  // Reveal Phase
  if (phase === "reveal") {
    return (
      <div className="not-allowed-to-laugh reveal-phase">
        <h2>Husk å ikke le!</h2>

        {/* Response counter */}
        <div className="response-counter">
          <div className="counter-label">Antall svar</div>
          <div className="counter-value">{responses?.length || 0}</div>
        </div>

        {/* Response display */}
        <div className="response-display">
          {currentResponse ? (
            <div
              className={`response-content ${fadeIn ? "fade-in" : ""} ${
                shakeAnimation ? "shake" : ""
              }`}
            >
              {typeof currentResponse === "string" ? (
                <div className="text-response">{currentResponse}</div>
              ) : currentResponse.type === "meme" ? (
                <div className="meme-response">
                  <div className="meme-image-container">
                    {(() => {
                      const template = memeTemplates.find(
                        (t) => t.id === currentResponse.templateId
                      );
                      const isVideo =
                        template?.type === "video" ||
                        template?.url.endsWith(".mp4") ||
                        template?.url.endsWith(".webm");
                      const isGif = template?.url.endsWith(".gif");

                      return isVideo ? (
                        <video
                          src={template?.url}
                          controls
                          loop
                          autoPlay
                          muted
                          playsInline
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <img
                          src={template?.url}
                          alt="Meme"
                          className={isGif ? "gif-image" : ""}
                        />
                      );
                    })()}
                    <div className="meme-text top">
                      {currentResponse.topText}
                    </div>
                    <div className="meme-text bottom">
                      {currentResponse.bottomText}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-response">{currentResponse.text}</div>
              )}
            </div>
          ) : (
            <div className="no-response">
              Press the button to reveal the first response
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="reveal-controls">
          {isHost && (
            <button
              onClick={showNextResponse}
              disabled={currentResponseIndex >= (responses?.length || 0)}
              className="next-button"
            >
              {currentResponseIndex >= (responses?.length || 0)
                ? "Ingen flere svar"
                : "Neste svar"}
            </button>
          )}

          <div className="response-progress">
            <span>
              {currentResponseIndex} / {responses?.length || 0}
            </span>
          </div>

          {isHost && (
            <button onClick={handleRestartGame} className="reset-button">
              Spill igjen
            </button>
          )}
        </div>

        {!isHost && (
          <div className="player-message">
            <p>Wait for the host to reveal the responses!</p>
          </div>
        )}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="not-allowed-to-laugh">
      <h2>Ikke lov å le på vors</h2>
      <p>Loading game...</p>
    </div>
  );
};

export default NotAllowedToLaugh;
