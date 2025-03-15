import React, { useState, useEffect, useRef } from "react";
import { CustomSocket } from "../types/socket.types";
import "../styles/MusicGuess.css";

interface Song {
  id: string;
  title: string;
  artist: string;
  previewUrl: string | null;
  albumImageUrl: string | null;
  selectedBy: string;
  selectedByName: string;
}

interface MusicGuessProps {
  sessionId: string;
  players: any[];
  isHost: boolean;
  gameState: any;
  socket: CustomSocket | null;
  restartGame: () => void;
  leaveSession: () => void;
  returnToLobby: () => void;
}

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string | null;
  albumImageUrl: string | null;
  spotifyUrl?: string;
  popularity?: number;
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
  // Game state
  const [phase, setPhase] = useState<string>(
    gameState?.phase || "topic-selection"
  );
  const [topic, setTopic] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [submittedCount, setSubmittedCount] = useState<number>(0);
  const [currentPlayingSong, setCurrentPlayingSong] = useState<Song | null>(
    null
  );
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [votesReceived, setVotesReceived] = useState<number>(0);
  const [results, setResults] = useState<any[]>([]);
  const [searchTimer, setSearchTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [playerSongs, setPlayerSongs] = useState<Song[]>([]);
  const [revealedSongs, setRevealedSongs] = useState<Song[]>([]);
  const [songsLeft, setSongsLeft] = useState<number>(0);
  const [songIndex, setSongIndex] = useState<number>(0);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [canPlay, setCanPlay] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle phase naming consistency
  useEffect(() => {
    if (gameState) {
      // Convert category-selection to topic-selection for consistency
      if (gameState.phase === "category-selection") {
        setPhase("topic-selection");
      } else {
        setPhase(gameState.phase || "topic-selection");
      }
    }
  }, [gameState]);

  // Initialize state from props
  useEffect(() => {
    if (gameState) {
      // Sync the local state with the game state from server
      setPhase(gameState.phase || "topic-selection");

      if (gameState.topic) {
        setTopic(gameState.topic);
      }

      if (gameState.playerSongs) {
        setPlayerSongs(gameState.playerSongs);
        if (gameState.phase === "song-selection") {
          // Check if current user has already submitted a song
          const userSong = gameState.playerSongs.find(
            (song: Song) => song.selectedBy === socket?.id
          );
          if (userSong) {
            setSelectedSong(userSong);
            setHasSubmitted(true);
          }
        }
        setSubmittedCount(gameState.playerSongs.length);
      }

      if (gameState.phase === "guessing" && gameState.currentSong) {
        setCurrentPlayingSong(gameState.currentSong);
        setSongIndex(gameState.songIndex || 0);
        setSongsLeft(
          (gameState.playerSongs?.length || 0) - (gameState.songIndex || 0) - 1
        );

        // Check if user has already voted
        if (gameState.votes && socket?.id && gameState.votes[socket.id]) {
          setVotedFor(gameState.votes[socket.id]);
          setHasVoted(true);
        }

        setVotesReceived(
          gameState.votes ? Object.keys(gameState.votes).length : 0
        );
      }

      if (gameState.phase === "results" && gameState.results) {
        setResults(gameState.results);
        setRevealedSongs(gameState.revealedSongs || []);
      }
    }
  }, [gameState, socket?.id]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Handle topic set
    const handleTopicSet = (data: any) => {
      setTopic(data.topic);
      setPhase("song-selection");
    };

    // Handle song submission updates
    const handleSongSubmitted = (data: any) => {
      setSubmittedCount(data.submittedCount);
      setPlayerSongs(data.playerSongs || []);
    };

    // Handle guessing phase start
    const handleStartGuessing = (data: any) => {
      setPhase("guessing");
      setCurrentPlayingSong(data.currentSong);
      setSongIndex(data.songIndex || 0);
      setSongsLeft(data.totalSongs - 1);
      setHasVoted(false);
      setVotedFor(null);
      setVotesReceived(0);
      setTimer(60);

      // Reset audio player
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    };

    // Handle voting updates
    const handleVoteUpdate = (data: any) => {
      setVotesReceived(data.votedCount);
    };
    const handleResults = (data: any) => {
      setPhase("results");
      setResults(data.results);

      // Create a new array with the current song (if it exists) and existing revealed songs
      const updatedSongs = [...revealedSongs];
      if (currentPlayingSong) {
        // Only add the current song if it's not already in the array
        if (!updatedSongs.some((song) => song.id === currentPlayingSong.id)) {
          updatedSongs.push(currentPlayingSong);
        }
      }

      setRevealedSongs(updatedSongs);
      setCurrentPlayingSong(null);

      // Stop audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    };

    // Handle next song
    const handleNextSong = (data: any) => {
      setCurrentPlayingSong(data.currentSong);
      setSongIndex(data.songIndex);
      setSongsLeft(data.songsLeft);
      setHasVoted(false);
      setVotedFor(null);
      setVotesReceived(0);
      setTimer(60);

      // Reset audio player
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    };

    // Handle game end
    const handleGameEnd = (data: any) => {
      setPhase("game-end");
      setRevealedSongs(data.allSongs || []);
    };

    // Register event listeners
    socket.on("music-guess-topic-set", handleTopicSet);
    socket.on("music-guess-song-submitted", handleSongSubmitted);
    socket.on("music-guess-start-guessing", handleStartGuessing);
    socket.on("music-guess-vote-update", handleVoteUpdate);
    socket.on("music-guess-results", handleResults);
    socket.on("music-guess-next-song", handleNextSong);
    socket.on("music-guess-game-end", handleGameEnd);

    // Clean up on unmount
    return () => {
      socket.off("music-guess-topic-set", handleTopicSet);
      socket.off("music-guess-song-submitted", handleSongSubmitted);
      socket.off("music-guess-start-guessing", handleStartGuessing);
      socket.off("music-guess-vote-update", handleVoteUpdate);
      socket.off("music-guess-results", handleResults);
      socket.off("music-guess-next-song", handleNextSong);
      socket.off("music-guess-game-end", handleGameEnd);

      // Clear any timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (searchTimer) {
        clearTimeout(searchTimer);
      }
    };
  }, [socket, searchTimer, currentPlayingSong, revealedSongs]);

  // Handle audio events
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handleCanPlay = () => {
      setCanPlay(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCanPlay(true);
    };

    const handleError = (e: any) => {
      console.error("Audio error:", e);
      setCanPlay(false);
    };

    // Add event listeners
    audioElement.addEventListener("canplaythrough", handleCanPlay);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("error", handleError);

    // Clean up
    return () => {
      audioElement.removeEventListener("canplaythrough", handleCanPlay);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("error", handleError);
    };
  }, [currentPlayingSong]);

  // Timer for voting
  useEffect(() => {
    if (phase === "guessing" && timerActive && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimerActive(false);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [phase, timerActive, timer]);

  // Submit topic (host only)
  const submitTopic = () => {
    if (!socket || !isHost || !topic.trim()) return;
    const fullTopic = topic.startsWith("Music that")
      ? topic
      : `Music that ${topic}`;
    socket.emit("music-guess-set-topic", sessionId, fullTopic);
  };

  // Search for songs - FIXED function

  const searchSongs = (query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    // Clear any existing search timer
    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    // Set a new timer to prevent too many requests
    if (query.trim().length > 2) {
      setIsSearching(true);

      const timer = setTimeout(async () => {
        try {
          // Call the working API endpoint
          console.log("Searching for:", query);
          const response = await fetch(
            `/api/spotify/search?q=${encodeURIComponent(query)}`
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to search for songs");
          }

          const data = await response.json();
          console.log("Search results:", data);

          if (data.tracks && Array.isArray(data.tracks)) {
            setSearchResults(data.tracks);
          } else {
            // Handle case where no tracks are returned
            setSearchResults([]);
            setSearchError("No songs found matching your search.");
          }
        } catch (error) {
          console.error("Error searching songs:", error);
          setSearchError("Failed to search for songs. Try again later.");
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 500); // Debounce for 500ms

      setSearchTimer(timer);
    } else {
      setSearchResults([]);
    }
  };

  // Select song
  const selectSong = (song: SpotifyTrack) => {
    const newSong: Song = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      previewUrl: song.previewUrl,
      albumImageUrl: song.albumImageUrl,
      selectedBy: socket?.id || "",
      selectedByName:
        players.find((p) => p.id === socket?.id)?.name || "Unknown",
    };

    setSelectedSong(newSong);
  };

  // Submit song
  const submitSong = () => {
    if (!socket || !selectedSong) return;
    socket.emit("music-guess-submit-song", sessionId, selectedSong);
    setHasSubmitted(true);
  };

  // Start guessing phase (host only)
  const startGuessing = () => {
    if (!socket || !isHost) return;
    socket.emit("music-guess-start-guessing", sessionId);
  };

  // Play/pause current song
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setTimerActive(true);
        })
        .catch((err) => {
          console.error("Error playing audio:", err);
        });
    }
  };

  // Submit vote
  const submitVote = () => {
    if (!socket || !votedFor) return;
    socket.emit("music-guess-vote", sessionId, votedFor);
    setHasVoted(true);
  };

  // Force show results (host only)
  const forceShowResults = () => {
    if (!socket || !isHost) return;
    socket.emit("music-guess-force-results", sessionId);
  };

  // Next song (host only)
  const nextSong = () => {
    if (!socket || !isHost) return;
    socket.emit("music-guess-next-song", sessionId);
  };

  // Render the appropriate phase
  switch (phase) {
    case "topic-selection":
      return (
        <div className="music-guess topic-phase">
          <h2>Musikkgjetting</h2>

          {isHost ? (
            <div className="topic-container">
              <p className="topic-instruction">
                Skriv inn et tema for musikk å gjette på. Startende med "Musikk
                som..." eller vi legger det til.
              </p>

              <div className="topic-input-group">
                <div className="topic-prefix">Musikk som</div>
                <input
                  type="text"
                  value={topic.replace(/^Musik+\s+som\s+/i, "")}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="...får deg tilbake på dansegulvet"
                  className="topic-input"
                />
              </div>

              <button
                onClick={submitTopic}
                className="topic-submit-button"
                disabled={!topic.trim()}
              >
                Start spillet
              </button>
            </div>
          ) : (
            <div className="waiting-message">
              <p>Venter på at verten skal velge et tema...</p>
            </div>
          )}

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

    case "song-selection":
      return (
        <div className="music-guess song-selection-phase">
          <h2>Velg en sang</h2>

          <div className="topic-display">
            <p>
              Tema: <strong>{topic}</strong>
            </p>
            <p className="submission-count">
              {submittedCount} av {players.length} har valgt en sang
            </p>
          </div>

          {!hasSubmitted ? (
            <div className="song-selection-container">
              <div className="search-container">
                <div className="search-instruction">
                  Search for a song that fits the theme
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => searchSongs(e.target.value)}
                  placeholder="Search for songs..."
                  className="search-input"
                />

                {isSearching && <div className="search-spinner">Søker...</div>}

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((song) => (
                      <div
                        key={song.id}
                        className={`search-result ${
                          selectedSong?.id === song.id ? "selected" : ""
                        }`}
                        onClick={() => selectSong(song)}
                      >
                        <div className="song-image">
                          {song.albumImageUrl ? (
                            <img src={song.albumImageUrl} alt={song.title} />
                          ) : (
                            <div className="no-image">🎵</div>
                          )}
                        </div>
                        <div className="song-info">
                          <div className="song-title">{song.title}</div>
                          <div className="song-artist">{song.artist}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSong && (
                <div className="selected-song-container">
                  <h3>Din valgte sang:</h3>
                  <div className="selected-song">
                    <div className="song-image">
                      {selectedSong.albumImageUrl ? (
                        <img
                          src={selectedSong.albumImageUrl}
                          alt={selectedSong.title}
                        />
                      ) : (
                        <div className="no-image">🎵</div>
                      )}
                    </div>
                    <div className="song-info">
                      <div className="song-title">{selectedSong.title}</div>
                      <div className="song-artist">{selectedSong.artist}</div>
                    </div>
                  </div>

                  <button onClick={submitSong} className="song-submit-button">
                    Bekreft valg
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="waiting-message">
              <p>Takk for ditt valg! Venter på andre spillere...</p>
            </div>
          )}

          {isHost &&
            submittedCount > 0 &&
            submittedCount === players.length && (
              <div className="host-controls">
                <button onClick={startGuessing} className="start-button">
                  Start gjettingen!
                </button>
              </div>
            )}

          {isHost && submittedCount > 0 && submittedCount < players.length && (
            <div className="host-message">
              <p>Du kan starte spillet når alle har valgt en sang.</p>
            </div>
          )}

          <div className="game-controls">
            <button className="leave-button" onClick={leaveSession}>
              Forlat økt
            </button>
          </div>
        </div>
      );

    case "guessing":
      return (
        <div className="music-guess guessing-phase">
          <h2>Hvem valgte denne sangen?</h2>

          {currentPlayingSong && (
            <div className="current-song">
              <div className="song-info">
                <div className="song-image">
                  {currentPlayingSong.albumImageUrl ? (
                    <img src={currentPlayingSong.albumImageUrl} alt="Album" />
                  ) : (
                    <div className="no-image">🎵</div>
                  )}
                </div>
                <div className="song-details">
                  <h3 className="song-title">{currentPlayingSong.title}</h3>
                  <p className="song-artist">{currentPlayingSong.artist}</p>
                </div>
              </div>

              <div className="audio-player">
                <audio
                  ref={audioRef}
                  src={currentPlayingSong.previewUrl || ""}
                  preload="auto"
                />
                <button
                  onClick={togglePlay}
                  className={`play-button ${isPlaying ? "playing" : ""}`}
                  disabled={!currentPlayingSong.previewUrl}
                >
                  {isPlaying ? "⏸ Pause" : "▶️ Spill av"}
                </button>

                {!currentPlayingSong.previewUrl && (
                  <p className="no-preview">
                    Forhåndsvisning ikke tilgjengelig
                  </p>
                )}

                {timerActive && (
                  <div className="timer-container">
                    <div className="timer-bar">
                      <div
                        className="timer-progress"
                        style={{ width: `${(timer / 60) * 100}%` }}
                      ></div>
                    </div>
                    <div className="timer-text">{timer} sekunder igjen</div>
                  </div>
                )}
              </div>

              {isPlaying && !hasVoted ? (
                <div className="voting-container">
                  <h3>Hvem tror du valgte denne sangen?</h3>
                  <div className="players-grid">
                    {players
                      .filter((player) => player.id !== socket?.id) // Can't vote for yourself
                      .map((player) => (
                        <button
                          key={player.id}
                          className={`player-button ${
                            votedFor === player.id ? "selected" : ""
                          }`}
                          onClick={() => setVotedFor(player.id)}
                        >
                          {player.name}
                        </button>
                      ))}
                  </div>

                  <button
                    onClick={submitVote}
                    className="vote-button"
                    disabled={!votedFor}
                  >
                    Send inn stemme
                  </button>
                </div>
              ) : hasVoted ? (
                <div className="vote-submitted">
                  <p>Din stemme er registrert!</p>
                  <p className="votes-count">
                    {votesReceived} av {players.length - 1} har stemt
                  </p>
                  <div className="votes-progress">
                    <div
                      className="votes-bar"
                      style={{
                        width: `${
                          (votesReceived / (players.length - 1)) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              ) : null}

              <div className="song-progress">
                <p>
                  Sang {songIndex + 1} av {playerSongs.length}
                </p>
                <p>{songsLeft} sanger gjenstår</p>
              </div>

              {isHost && (
                <div className="host-controls">
                  <button onClick={forceShowResults} className="force-button">
                    Vis resultater
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="game-controls">
            <button className="leave-button" onClick={leaveSession}>
              Forlat økt
            </button>
          </div>
        </div>
      );

    case "results":
      return (
        <div className="music-guess results-phase">
          <h2>Resultat</h2>

          <div className="result-song-info">
            <h3>Sangen var valgt av:</h3>
            <div className="song-owner">
              <span className="owner-name">
                {results.length > 0 &&
                results[0]?.votedForId === currentPlayingSong?.selectedBy
                  ? results[0]?.votedForName
                  : playerSongs.find((s) => s.id === currentPlayingSong?.id)
                      ?.selectedByName || "Ukjent"}
              </span>
            </div>
          </div>

          <div className="voting-results">
            <h3>Slik stemte dere:</h3>
            <div className="votes-list">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`vote-item ${
                    result.correct ? "correct" : "incorrect"
                  }`}
                >
                  <div className="voter">
                    <span className="voter-name">{result.voterName}</span>{" "}
                    stemte på
                  </div>
                  <div className="vote-target">
                    <span className="target-name">{result.votedForName}</span>
                  </div>
                  <div className="vote-result">
                    {result.correct ? "✓ Riktig!" : "✗ Feil!"}
                  </div>
                  <div className="drinking-rule">
                    {result.correct
                      ? "Riktig! Ingen straff."
                      : "2 slurker for feil gjetning!"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="song-owner-punishment">
            <h3>Straff for sangvelgeren:</h3>
            <p>
              {playerSongs.find((s) => s.id === currentPlayingSong?.id)
                ?.selectedByName || "Ukjent"}
              får {results.filter((r) => r.correct).length * 2} slurker! (2
              slurker for hver riktig gjetning)
            </p>
          </div>

          {isHost && (
            <div className="host-controls">
              {songsLeft > 0 ? (
                <button onClick={nextSong} className="next-button">
                  Neste sang
                </button>
              ) : (
                <div className="game-end-options">
                  <p>Alle sanger er spilt!</p>
                  <div className="end-buttons">
                    <button onClick={restartGame} className="restart-button">
                      Spill igjen
                    </button>
                    <button onClick={returnToLobby} className="lobby-button">
                      Tilbake til hovedmenyen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isHost && songsLeft === 0 && (
            <div className="waiting-message">
              <p>Alle sanger er spilt! Venter på vertens valg...</p>
            </div>
          )}

          <div className="game-controls">
            <button className="leave-button" onClick={leaveSession}>
              Forlat økt
            </button>
          </div>
        </div>
      );

    case "game-end":
      return (
        <div className="music-guess end-phase">
          <h2>Spillet er ferdig!</h2>

          <div className="all-songs-container">
            <h3>Alle sanger som ble spilt:</h3>
            <div className="songs-list">
              {revealedSongs.map((song, index) => (
                <div key={index} className="revealed-song">
                  <div className="song-info">
                    {song.albumImageUrl && (
                      <img
                        src={song.albumImageUrl}
                        alt={song.title}
                        className="song-thumbnail"
                      />
                    )}
                    <div className="song-details">
                      <div className="song-title">{song.title}</div>
                      <div className="song-artist">{song.artist}</div>
                    </div>
                  </div>
                  <div className="song-selected-by">
                    Valgt av:{" "}
                    <span className="selector-name">{song.selectedByName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <div className="host-controls">
              <div className="end-buttons">
                <button onClick={restartGame} className="restart-button">
                  Spill igjen
                </button>
                <button onClick={returnToLobby} className="lobby-button">
                  Tilbake til hovedmenyen
                </button>
              </div>
            </div>
          )}

          {!isHost && (
            <div className="waiting-message">
              <p>Venter på vertens valg...</p>
            </div>
          )}

          <div className="game-controls">
            <button className="leave-button" onClick={leaveSession}>
              Forlat økt
            </button>
          </div>
        </div>
      );

    default:
      return (
        <div className="music-guess">
          <h2>Musikkgjetting</h2>
          <div className="loading-container">
            <p>Laster spill... (Phase: {gameState?.phase})</p>
            <p>
              Hvis denne meldingen vises for lenge, kan det være et problem med
              tilkoblingen eller en uventet spillfase.
            </p>
            <div className="debug-info">
              <p>Debug info:</p>
              <ul>
                <li>Current phase: {gameState?.phase || "unknown"}</li>
                <li>Socket connected: {socket ? "Yes" : "No"}</li>
                <li>Players: {players.length}</li>
                <li>Is host: {isHost ? "Yes" : "No"}</li>
              </ul>
            </div>
            <button
              onClick={returnToLobby}
              className="lobby-button"
              style={{ marginTop: "20px" }}
            >
              Tilbake til hovedmenyen
            </button>
          </div>
        </div>
      );
  }
};

export default MusicGuess;
