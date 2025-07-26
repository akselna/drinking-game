const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const spotifyService = require("./spotify");
const path = require("path");
const sessionTimers = new Map();

function generateSessionId(length = 6) {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789"; // Exclude 0 and O
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const app = express();
const SESSION_INACTIVITY_TIMEOUT = 3600000; // 1 hour in milliseconds

function sanitizeSessionForClient(session) {
  if (!session) return null;

  // Create a deep copy of the session
  const cleanSession = JSON.parse(
    JSON.stringify({
      host: session.host,
      players: session.players,
      gameType: session.gameType,
      lastActivity: session.lastActivity,
      lamboVotes: session.lamboVotes || [],
    })
  );

  // If there's game state, clone it too but exclude timer references
  if (session.gameState) {
    // Create a sanitized version of gameState without timer references
    const sanitizedGameState = { ...session.gameState };

    // Remove timer IDs and other non-serializable properties
    delete sanitizedGameState.timerId;

    // Add the sanitized game state to the clean session
    cleanSession.gameState = sanitizedGameState;
  }

  return cleanSession;
}

// Add this function to implement session cleanup
function setupSessionCleanup() {
  // Run cleanup every 15 minutes
  setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach((sessionId) => {
      const session = sessions[sessionId];

      // If session doesn't have lastActivity, add it now
      if (!session.lastActivity) {
        session.lastActivity = now;
        return;
      }

      // Check if session has been inactive for too long
      if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
        console.log(`Cleaning up inactive session ${sessionId}`);

        // Clear any timers
        if (session.gameState && session.gameState.timerId) {
          clearInterval(session.gameState.timerId);
        }

        // Notify remaining players if any
        io.to(sessionId).emit("error", {
          message: "Session expired due to inactivity",
        });

        // Delete session
        delete sessions[sessionId];

        // Remove all player->session mappings for this session
        Object.keys(playerSessions).forEach((socketId) => {
          if (playerSessions[socketId].sessionId === sessionId) {
            delete playerSessions[socketId];
          }
        });
      }
    });
  }, 900000); // Check every 15 minutes
}

// Call this function after server setup
setupSessionCleanup();

// Update activity timestamp on relevant actions
// Add this at the beginning of each socket event handler that indicates activity
function updateSessionActivity(sessionId) {
  if (sessions[sessionId]) {
    sessions[sessionId].lastActivity = Date.now();
  }
}
app.use(cors());

// IMPORTANT: Define API routes BEFORE serving static files
// Spotify API endpoints
app.get("/api/spotify/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Optional market parameter, defaults to US if not provided
    const market = req.query.market || "US";

    // Search tracks using our Spotify service
    const tracks = await spotifyService.searchTracks(query, market);

    res.json({ tracks });
  } catch (error) {
    console.error("Error in Spotify search endpoint:", error.message);
    res.status(500).json({
      error: "Failed to search Spotify",
      message: error.message,
    });
  }
});

app.get("/api/spotify/status", async (req, res) => {
  try {
    // Try to get a token to verify API connection
    await spotifyService.getSpotifyToken();
    res.json({ status: "ok", message: "Spotify API connection successful" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Could not connect to Spotify API",
      error: error.message,
    });
  }
});

// AFTER defining all API routes, THEN serve static files
app.use(express.static(path.join(__dirname, "../frontend/build")));

// FINALLY, add the catch-all route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

let sessions = {};

// Keeps track of which socket belongs to which player
let playerSessions = {};
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
  DRINK_OR_JUDGE: "drinkOrJudge", // Added new game type
  BEAT4BEAT: "beat4Beat", // Add this line
  NOT_ALLOWED_TO_LAUGH: "notAllowedToLaugh", // Added new game type
  SKJENKEHJULET: "skjenkehjulet",
};

const skjenkehjuletCategories = [
  "Hvite sokker",
  "Briller",
  "Lengste hår",
  "Korteste hår",
  "Eldste",
  "Yngste",
  "Høyeste",
  "Laveste",
  "Blå øyne",
  "Brune øyne",
  "Piercing",
  "Tatovering",
  "Rødt plagg",
  "Blått plagg",
  "Hvitt plagg",
  "Svart plagg",
  "Caps",
  "Kjole/skjørt",
  "Sneakers",
  "Høye hæler",
  "Mannlig",
  "Kvinnelig",
  "Student",
  "Jobber",
  "Single",
  "I forhold",
  "Har kjæledyr",
  "Bor hjemme",
  "Har bil",
  "Har moped",
  "Har iPhone",
  "Har Android",
  "Drikker kaffe",
  "Drikker te",
  "Røyker",
  "Snuser",
  "Har snap-score over 100k",
  "Har TikTok",
  "Spiller spill",
  "Trener regelmessig",
];

// Predefinerte "Jeg har aldri" setninger som brukes når brukerne går tom for egne
const neverHaveIEverStatements = [
  "...hoppet i fallskjerm",
  "...vært i USA",
  "...stjålet noe",
  "...blitt arrestert",
  "...løyet til foreldrene mine",
  "...brutt en lov",
  "...tatt en tatovering",
  "...mistet telefonen min",
  "...kastet opp på offentlig sted",
  "...deltatt i en demonstrasjon",
  "...vært på blind date",
  "...prøvd å lære meg å spille et instrument",
  "...vært på en øde øy",
  "...møtt en kjendis",
  "...ridd på en hest",
  "...deltatt i et TV-program",
  "...gitt falsk telefonnummer til noen",
  "...gitt penger til en tigger",
  "...sovet på gaten",
  "...spilt i et band",
  "...løpt et maraton",
  "...gått på ski utenfor preparerte løyper",
  "...blitt utvist fra skolen",
  "...klatret i et fjell",
  "...haiket",
  "...fått en bot",
  "...gått meg vill i en fremmed by",
  "...tatt improvisasjonsteater",
  "...vært på fest i et annet land",
  "...stått på scenen foran over 100 mennesker",
];

const punishments = {
  mild: [
    { type: "1 slurk", amount: 1, probability: 0.4, color: "#4CAF50" },
    { type: "2 slurker", amount: 2, probability: 0.3, color: "#FFC107" },
    { type: "3 slurker", amount: 3, probability: 0.2, color: "#FF9800" },
    { type: "Bunnløs", amount: 999, probability: 0.1, color: "#F44336" },
  ],
  medium: [
    { type: "1 slurk", amount: 1, probability: 0.25, color: "#4CAF50" },
    { type: "2 slurker", amount: 2, probability: 0.3, color: "#FFC107" },
    { type: "3 slurker", amount: 3, probability: 0.25, color: "#FF9800" },
    { type: "5 slurker", amount: 5, probability: 0.15, color: "#E91E63" },
    { type: "Bunnløs", amount: 999, probability: 0.05, color: "#F44336" },
  ],
  blackout: [
    { type: "2 slurker", amount: 2, probability: 0.2, color: "#FFC107" },
    { type: "3 slurker", amount: 3, probability: 0.25, color: "#FF9800" },
    { type: "5 slurker", amount: 5, probability: 0.25, color: "#E91E63" },
    { type: "7 slurker", amount: 7, probability: 0.15, color: "#9C27B0" },
    { type: "Bunnløs", amount: 999, probability: 0.15, color: "#F44336" },
  ],
};
// Helper function to select punishment based on probability
function selectPunishmentByProbability(gameMode) {
  const modePunishments = punishments[gameMode];
  const random = Math.random();
  let cumulativeProbability = 0;

  for (let i = 0; i < modePunishments.length; i++) {
    cumulativeProbability += modePunishments[i].probability;
    if (random <= cumulativeProbability) {
      return { ...modePunishments[i], slotIndex: i };
    }
  }

  // Fallback to last punishment if something goes wrong
  return {
    ...modePunishments[modePunishments.length - 1],
    slotIndex: modePunishments.length - 1,
  };
}

// Helper function to shuffle array
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}


// Countdown timer function
function startSkjenkehjuletCountdown(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  const timer = setInterval(() => {
    if (
      !sessions[sessionId] ||
      sessions[sessionId].gameState.phase !== "countdown"
    ) {
      clearInterval(timer);
      return;
    }

    session.gameState.timeRemaining--;

    // Send countdown update
    io.to(sessionId).emit("skjenkehjulet-countdown-update", {
      timeRemaining: session.gameState.timeRemaining,
    });

    // When countdown reaches 0, start punishment selection
    if (session.gameState.timeRemaining <= 0) {
      clearInterval(timer);
      startPunishmentSelection(sessionId);
    }
  }, 1000);

  // Store timer reference for cleanup
  session.gameState.timerId = timer;
}

// Start punishment selection
function startPunishmentSelection(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // Select punishment based on probability
  const selectedPunishment = selectPunishmentByProbability(
    session.gameState.gameMode
  );

  session.gameState.currentPunishment = selectedPunishment;
  session.gameState.phase = "punishment-animation";

  console.log(
    `Selected punishment for session ${sessionId}: ${selectedPunishment.type} (slot ${selectedPunishment.slotIndex})`
  );

  // Notify clients to start ball animation
  io.to(sessionId).emit("skjenkehjulet-punishment-animation", {
    punishment: selectedPunishment,
    targetSlot: selectedPunishment.slotIndex,
  });

  // After animation delay, trigger wheel spin
  setTimeout(() => {
    triggerWheelSpin(sessionId);
  }, 4000); // 4 seconds for ball animation
}

// Trigger wheel spin
function triggerWheelSpin(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // Select random category from wheel
  const categoryIndex = Math.floor(
    Math.random() * session.gameState.wheelCategories.length
  );
  const selectedCategory = session.gameState.wheelCategories[categoryIndex];

  session.gameState.currentCategory = selectedCategory;
  session.gameState.phase = "wheel-spin";

  console.log(
    `Wheel spinning in session ${sessionId}, selected: ${selectedCategory}`
  );

  // Notify clients to start wheel animation
  io.to(sessionId).emit("skjenkehjulet-wheel-spin", {
    category: selectedCategory,
    categoryIndex: categoryIndex,
  });

  // After wheel animation, show result
  setTimeout(() => {
    showSkjenkehjuletResult(sessionId);
  }, 3000); // 3 seconds for wheel animation
}


// Show result
function showSkjenkehjuletResult(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  session.gameState.phase = "result";

  console.log(
    `Showing result for session ${sessionId}: ${session.gameState.currentCategory} must drink ${session.gameState.currentPunishment.type}`
  );

  // Notify clients to show result
  io.to(sessionId).emit("skjenkehjulet-result", {
    category: session.gameState.currentCategory,
    punishment: session.gameState.currentPunishment,
  });
}



// Cleanup timers when game is restarted or session ends
function cleanupSkjenkehjuletTimers(sessionId) {
  const session = sessions[sessionId];
  if (session && session.gameState && session.gameState.timerId) {
    clearInterval(session.gameState.timerId);
    session.gameState.timerId = null;
  }
}

// Modify the "submit-never-statement" event handler to allow submissions during any phase
// Finn denne event handleren og erstatt den med denne oppdaterte versjonen:

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Create a new session
  socket.on("create-session", (hostName) => {
    // Generate a random 6-character session ID without ambiguous characters
    const sessionId = generateSessionId();

    updateSessionActivity(sessionId);

    sessions[sessionId] = {
      host: socket.id,
      players: [{ id: socket.id, name: hostName }],
      gameType: GAME_TYPES.NONE,
      gameState: null,
      neverHaveIEverStatements: [],
      activeRound: null,
      lamboVotes: [], // Track who voted for Lambo
    };

    // Track which session this socket belongs to
    playerSessions[socket.id] = {
      sessionId: sessionId,
      name: hostName,
    };

    socket.join(sessionId);
    socket.emit("session-created", {
      sessionId,
      isHost: true,
      players: sessions[sessionId].players,
    });
  });

  // Join an existing session
  socket.on("join-session", (sessionId, playerName) => {
    const sessionIdUpper = sessionId.toUpperCase();

    updateSessionActivity(sessionIdUpper);

    if (!sessions[sessionIdUpper]) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Check if session is full (max 10 players)
    if (sessions[sessionIdUpper].players.length >= 15) {
      socket.emit("error", { message: "Session is full" });
      return;
    }

    const session = sessions[sessionIdUpper];
    let isReconnectingHost = false;

    // Check if this is a reconnecting host
    if (
      disconnectedHosts[sessionIdUpper] &&
      disconnectedHosts[sessionIdUpper].hostName === playerName
    ) {
      console.log(
        `Host ${playerName} reconnected to session ${sessionIdUpper} within grace period`
      );

      // Clear the timeout that would have transferred host status
      clearTimeout(disconnectedHosts[sessionIdUpper].timeoutId);

      // Find the disconnected player entry
      const disconnectedPlayerIndex = session.players.findIndex(
        (player) => player.disconnected && player.name === playerName
      );

      if (disconnectedPlayerIndex !== -1) {
        // Update the player's socket ID and remove disconnected flag
        session.players[disconnectedPlayerIndex].id = socket.id;
        delete session.players[disconnectedPlayerIndex].disconnected;

        // Update the host reference to the new socket ID
        session.host = socket.id;
        isReconnectingHost = true;
      }

      // Clean up disconnected host entry
      delete disconnectedHosts[sessionIdUpper];
    }

    // If not a reconnecting host, handle as before
    if (!isReconnectingHost) {
      // Check if this is a reconnection (same name coming back)
      const existingPlayerIndex = session.players.findIndex(
        (player) => player.name === playerName
      );

      if (existingPlayerIndex >= 0) {
        // This is a reconnection - update the player's ID
        const oldId = session.players[existingPlayerIndex].id;
        session.players[existingPlayerIndex].id = socket.id;

        // Remove disconnected flag if it exists
        if (session.players[existingPlayerIndex].disconnected) {
          delete session.players[existingPlayerIndex].disconnected;
        }

        // If this was the host, update the host reference
        if (sessions[sessionIdUpper].host === oldId) {
          sessions[sessionIdUpper].host = socket.id;
        }
      } else {
        // This is a new player - check if name is already taken
        const nameExists = session.players.some(
          (player) => player.name === playerName
        );

        if (nameExists) {
          socket.emit("error", {
            message: "Name already taken in this session",
          });
          return;
        }

        // Add new player to the session
        session.players.push({
          id: socket.id,
          name: playerName,
        });
      }
    }

    // Track which session this socket belongs to
    playerSessions[socket.id] = {
      sessionId: sessionIdUpper,
      name: playerName,
    };

    socket.join(sessionIdUpper);

    // CHANGE: Explicitly send the host ID to all players
    // This is the critical change that ensures all players know who the host is
    const sanitizedSession = sanitizeSessionForClient(session);
    socket.emit("session-joined", {
      sessionId: sessionIdUpper,
      isHost: socket.id === session.host,
      hostId: session.host,
      gameType: sanitizedSession.gameType,
      gameState: sanitizedSession.gameState,
      players: sanitizedSession.players,
    });

    // Update all players in the session
    io.to(sessionIdUpper).emit("update-players", session.players);
  });

  // Beat4Beat - Set Total Rounds
  socket.on("beat4beat-set-rounds", (sessionId, totalRounds) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can set the number of rounds
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can set the number of rounds",
      });
      return;
    }

    // Validate rounds (ensure between 3-20)
    const rounds = Math.min(20, Math.max(3, parseInt(totalRounds) || 10));

    // Update game state
    session.gameState.totalRounds = rounds;

    // Notify all clients about the updated rounds setting
    io.to(sessionId).emit("beat4beat-rounds-updated", {
      totalRounds: rounds,
    });
  });

  // Beat4Beat - Start Round
  socket.on("beat4beat-start-round", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start a round
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can start the round" });
      return;
    }

    // Reset game state for a new round
    session.gameState.buzzOrder = [];
    session.gameState.roundActive = true;
    session.gameState.phase = "buzzing";
    session.gameState.winnerId = null;

    // Calculate the number of potential buzzers (all players except host)
    const totalBuzzers = session.players.length - 1;

    // Notify all clients about the round start
    io.to(sessionId).emit("beat4beat-round-start", {
      roundActive: true,
      phase: "buzzing",
      totalBuzzers: totalBuzzers,
    });
  });

  // Beat4Beat - Player Buzz
  // Update this part in the Beat4Beat - Player Buzz handler
  socket.on("beat4beat-buzz", (sessionId, timestamp) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Make sure the round is active
    if (!session.gameState.roundActive) {
      socket.emit("error", { message: "Round is not active" });
      return;
    }

    // Host should not be able to buzz
    if (socket.id === session.host) {
      socket.emit("error", { message: "The host cannot buzz" });
      return;
    }

    // Check if player has already buzzed
    const alreadyBuzzed = session.gameState.buzzOrder.some(
      (item) => item.playerId === socket.id
    );
    if (alreadyBuzzed) {
      return;
    }

    // Find the player
    const player = session.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Add player to buzz order
    session.gameState.buzzOrder.push({
      playerId: socket.id,
      playerName: player.name,
      timestamp: timestamp,
    });

    // Sort by timestamp
    session.gameState.buzzOrder.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate total buzzers (all players except host)
    const totalBuzzers = session.players.filter(
      (p) => p.id !== session.host
    ).length;

    // Notify all clients about the updated buzz order
    io.to(sessionId).emit("beat4beat-buzz-update", {
      buzzOrder: session.gameState.buzzOrder,
      totalBuzzers: totalBuzzers,
    });

    // If all players have buzzed, automatically end the round after a short delay
    if (session.gameState.buzzOrder.length >= totalBuzzers) {
      // Wait 3 seconds then end the round automatically
      setTimeout(() => {
        // Check if the session and round are still active before ending
        if (sessions[sessionId] && sessions[sessionId].gameState.roundActive) {
          // Set round as inactive
          session.gameState.roundActive = false;
          session.gameState.phase = "results";

          // Determine winner (first to buzz)
          const winnerId =
            session.gameState.buzzOrder.length > 0
              ? session.gameState.buzzOrder[0].playerId
              : null;
          session.gameState.winnerId = winnerId;

          // Notify all clients about the round end
          io.to(sessionId).emit("beat4beat-round-end", {
            roundActive: false,
            phase: "results",
            winnerId: winnerId,
            buzzOrder: session.gameState.buzzOrder,
          });
        }
      }, 3000);
    }
  });

  // Beat4Beat - End Round
  socket.on("beat4beat-end-round", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can end a round
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can end the round" });
      return;
    }

    // Set round as inactive
    session.gameState.roundActive = false;
    session.gameState.phase = "results";

    // Determine winner (first to buzz)
    const winnerId =
      session.gameState.buzzOrder.length > 0
        ? session.gameState.buzzOrder[0].playerId
        : null;
    session.gameState.winnerId = winnerId;

    // Notify all clients about the round end
    io.to(sessionId).emit("beat4beat-round-end", {
      roundActive: false,
      phase: "results",
      winnerId: winnerId,
      buzzOrder: session.gameState.buzzOrder,
    });
  });

  // Beat4Beat - Award Points
  socket.on("beat4beat-award-points", (sessionId, playerId, points) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can award points
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can award points" });
      return;
    }

    // Make sure the player exists
    const player = session.players.find((p) => p.id === playerId);
    if (!player) {
      socket.emit("error", { message: "Player not found" });
      return;
    }

    // Update scores
    if (!session.gameState.scores) {
      session.gameState.scores = {};
    }

    // If player doesn't have a score yet, initialize to 0
    if (!session.gameState.scores[playerId]) {
      session.gameState.scores[playerId] = 0;
    }

    // Add points
    session.gameState.scores[playerId] += points;

    // Notify all clients about the updated scores
    io.to(sessionId).emit("beat4beat-score-update", {
      scores: session.gameState.scores,
    });
  });

  // Beat4Beat - Next Round
  socket.on("beat4beat-next-round", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can move to the next round
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can start the next round",
      });
      return;
    }

    // Increment round number
    session.gameState.roundNumber++;

    // Update game progress
    const totalRounds = session.gameState.totalRounds || 10;
    session.gameState.gameProgress = Math.min(
      100,
      ((session.gameState.roundNumber - 1) / totalRounds) * 100
    );

    // Reset for next round
    session.gameState.buzzOrder = [];
    session.gameState.roundActive = false;
    session.gameState.phase = "waiting";
    session.gameState.winnerId = null;

    // Notify all clients about the next round
    io.to(sessionId).emit("beat4beat-next-round", {
      roundNumber: session.gameState.roundNumber,
      phase: "waiting",
      gameProgress: session.gameState.gameProgress,
      totalRounds: session.gameState.totalRounds,
    });

    // Check if game is finished
    if (session.gameState.roundNumber > session.gameState.totalRounds) {
      // Game is over - move to final results phase
      session.gameState.phase = "game-end";
      io.to(sessionId).emit("beat4beat-game-end", {
        scores: session.gameState.scores,
        totalRounds: session.gameState.totalRounds,
      });
    }
  });

  // Beat4Beat - Reset Game
  socket.on("beat4beat-reset", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.BEAT4BEAT) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can reset the game
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can reset the game" });
      return;
    }

    // Reset the game state
    session.gameState = {
      phase: "waiting",
      buzzOrder: [],
      roundActive: false,
      roundNumber: 1,
      scores: {},
      winnerId: null,
    };

    // Notify all clients about the reset
    io.to(sessionId).emit("game-restarted", {
      gameType: session.gameType,
      gameState: session.gameState,
    });
  });
  // Select a game (host only)
  socket.on("select-game", (sessionId, gameType) => {
    const session = sessions[sessionId];
    updateSessionActivity(sessionId);

    // Check if session exists
    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Verify that only the host can select the game
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can select the game" });
      return;
    }

    // Validate the game type
    if (!Object.values(GAME_TYPES).includes(gameType)) {
      socket.emit("error", { message: "Invalid game type" });
      return;
    }

    // Set the game type
    session.gameType = gameType;

    // Initialize game state based on game type
    if (gameType === GAME_TYPES.DRINK_OR_JUDGE) {
      session.gameState = {
        phase: "statement",
        statements: [
          "📵 Hvem i rommet er alltid på mobilen?",
          "💪 Hvem i rommet har mest viljestyrke?",
          "🍺 Hvem i rommet er best på å styrte?",
          "🚘 Hvem i rommet er dårligst sjåfør?",
          "🐗 Hvem i rommet er mest vill?",
          "💸 Hvem i rommet spanderer alltid på fylla?",
          "🌊 Hvem i rommet er kåtest?",
          "🤓 Hvem i rommet er flinkest på skolen?",
          "🤲 Hvem i rommet tar seg mest på puppene?",
          "🎅 Hvem i rommet trodde lengst på julenissen?",
          "⏳ Hvem i rommet er mest ubesluttsom?",
          "🥃 Hvem i rommet har høyest toleranse?",
          "✌️ Hvem i rommet er mest rettferdig?",
          "😏 Hvem i rommet lager de sjukeste lydene i senga?",
          "🎗 Hvem i rommet gir mest til veldedighet?",
          "🙄 Hvem i rommet er mest overlegen?",
          "💯 Hvem i rommet kommer til å lykkes best i livet?",
          "🪂 Hvem i rommet er en adrenalin junkie?",
          "🏆 Hvem i rommet googler seg selv oftest?",
          "😇 Hvem i rommet er lykkeligst?",
          "🕵️‍♀️ Hvem i rommet er den verste stalkeren?",
          "🎻 Hvem i rommet har dårligst musikksmak?",
          "🥱 Hvem i rommet kommer til å sovne med en pizza i hånden?",
          "🚿 Hvem i rommet har shava og er forberedt på alt?",
          "🎖 Hvem i rommet har hatt seg med flest?",
          "🏋️‍♀️ Hvem i rommet er sterkest?",
          "🤮 Hvem i rommet kommer mest sannsynlig til å spy i kveld?",
          "🗣 Hvem i rommet har finest dialekt?",
          "🔮 Hvem i rommet havner på gata?",
          "☀️ Hvem i rommet lyser opp rommet?",
          "🦄 Hvem i rommet skiller seg mest ut i mengden?",
          "😎 Hvem i rommet har størst kjendisfaktor?",
          "🧗‍♂️ Hvem i rommet er mest eventyrlysten?",
          "👓 Hvem i rommet har best syn?",
          "💤 Hvem i rommet snorker mest?",
          "💩 Hvem i rommet slipper de verste fisene?",
          "🙋‍♂️ Hvem i rommet kunne levd best med bare en arm og ett ben?",
          "🏃‍♂️ Hvem i rommet løper fortest?",
          "🤓 Hvem i rommet nørder mest?",
          "💍 Hvem i rommet kommer til å gifte seg først?",
          "🛫 Hvem i rommet er medlem av Mile High Club?",
          "💰 Hvem i rommet kommer til å bli rikest?",
          "💋 Hvem i rommet er den beste til å kysse?",
          "🐾 Hvem i rommet tar med seg noen hjem i kveld?",
          "🌵 Hvem i rommet stikker mest?",
          "🐎 Hvem i rommet rir best?",
          "🏡 Hvem i rommet bor finest?",
          "🥽 Hvem i rommet er mest positiv til nye utfordringer?",
          "👨 Hvem i rommet er en av gutta?",
          "📸 Hvem i rommet tar flest selfies?",
          "🔚 Hvem i rommet kommer raskest?",
          "🏝 Hvem i rommet kunne du vært på en øde øy med?",
          "🥶 Hvem i rommet har lettest for å bryte isen med noen ukjente?",
          "🎓 Hvem i rommet kommer mest sannsynlig til å stryke et fag dette semesteret?",
          "🚵 Hvem i rommet er mest sporty?",
          "🔥 Hvem i rommet lager best stemning på vors?",
          "👀 Hvem i rommet har de vakreste øyene?",
          "❌ Hvem i rommet kommer seg ikke inn på byen i kveld?",
          "🛏 Hvem i rommet er best i senga?",
          "🆘 Hvem i rommet er mest drita?",
          "🏫 Hvem i rommet har best karakterer nå?",
          "🎮 Hvem i rommet er den svetteste gameren?",
          "🐻 Hvem i rommet har best sjanse til å overleve mot en bjørn?",
          "👓 Hvem i rommet kler briller best?",
          "🥺 Hvem i rommet er snillest?",
          "👌 Hvem i rommet har hooket med flest?",
          "💼 Hvem i rommet er mest klar for arbeidslivet?",
          "👱‍♀️ Hvem i rommet har flest blonde øyeblikk?",
          "😡 Hvem i rommet har mest temperament?",
          "😘 Hvem i rommet holder på med flere samtidig?",
          "😌 Hvem i rommet selv tror den er morsomst?",
          "💔 Hvem i rommet har hatt flest kjærester?",
          "🐭 Hvem i rommet er en liten luremus?",
          "🎧 Hvem i rommet har verst musikksmak?",
          "🎭 Hvem i rommet har mest humørsvingninger?",
          "😵 Hvem i rommet synger styggest?",
          "💈 Hvem i rommet har mest kroppshår?",
          "☠️ Hvem i rommet er tøffest i trynet?",
          "💄 Hvem i rommet har finest lepper?",
          "🔞 Hvem i rommet har den mest skitne nettleserhistorikken?",
          "🚇 Hvem i rommet er best kjent i byen dere er i?",
          "🚑 Hvem i rommet har vært flest ganger på legevakten det siste året?",
          "💃 Hvem i rommet hadde gjort det best på Skal vi danse?",
          "👨‍👩‍👦 Hvem i rommet kunne du aldri hatt med i et familieselskap?",
          "🤯 Hvem i rommet tåler smerte best?",
          "🤣 Hvem i rommet driter seg alltid ut?",
          "🏆 Hvem i rommet er flinkest til å sjekke opp på byen?",
          "🚁 Hvem i rommet er mest spontan?",
          "🔮 Hvem i rommet tror på synske?",
          "📞 Hvem i rommet har kortest telefonsamtaler?",
          "💰 Hvem i rommet har størst lommebok?",
          "🚽 Hvem i rommet ser på mest reality-drit?",
          "💙 Hvem i rommet har tatt kongla flest ganger?",
          "🦶 Hvem i rommet har størst føtter?",
          "🕵️‍♂️ Hvem i rommet er mest mystisk?",
          "🙊 Hvem i rommet minner mest om en ape?",
          "💌 Hvem i rommet har hatt flest kjønnssykdommer?",
          "🏃 Hvem i rommet tar alltid en for laget?",
          "😷 Hvem i rommet er mest frekk i kjeften?",
          "💯 Hvem i rommet skal ta bonski?",
          "🍺 Hvem i rommet må drikke 5 slurker?",
        ],
        currentStatementIndex: 0,
        votes: {},
        results: [],
        usedStatements: [],
      };
      shuffleArray(session.gameState.statements);
    } else if (gameType === GAME_TYPES.NEVER_HAVE_I_EVER) {
      const defaultStatements = [
        "🎤 Møtt en kjendis",
        "😢 Grått offentlig",
        "💊 Blitt dopet ned",
        "🐄 Melket en ku",
        "📝 Jukset på en prøve",
        "🤥 Løyet om alderen min",
        "📺 Vært på TV",
        "🏡 Vært på hyttetur",
        "🔞 Hatt sex utenfor soverommet",
        "🚿 Ikke dusjet på en uke",
        "👊 Vært i slåsskamp",
        "🎭 Vært med på et talentshow",
        "📸 Sendt nudes",
        "🍆 Brukt sexleketøy",
        "🎮 Bikket over 1000 timer på et spill",
        "🚬 Prøvd narkotika",
        "💔 Vært utro",
        "🎲 Gamblet penger",
        "📺 Søkt om å bli med på et realityshow",
        "🚁 Vært i et helikopter",
        "🛒 Stjålet noe fra en butikk",
        "🚪 Fått sparken",
        "🔞 Ligget med flere enn to på samme kveld",
        "🐱 Spist katt/hund",
        "🆔 Brukt falsk ID",
        "🚪 Gått inn på foreldrene mine",
        "👍 Fått over 1.000 likes på en post",
        "🔫 Skutt med en pistol",
        "📺 Sett på filmer eller serier i en hel dag",
        "👮 Hatt problemer med politiet",
        "✈️ Dratt på ferie alene",
        "🏃 Løpt et maraton",
        "🍺 Drukket for mye",
        "🤔 Glemt navnet på noen jeg har ligget med",
        "🏥 Vært innlagt på et sykehus",
        "🎮 Spilt Fortnite",
        "🍻 Drukket 4 dager på rad",
        "🔞 Ligget med en av familiemedlemmene til en venn",
        "📺 Sett på anime",
        "🤥 Løyet i løpet av dette spillet",
        "💋 Kysset flere enn 5 på en kveld",
        "🛒 Stjålet noe",
        "✈️ Mistet flyet mitt",
        "📱 Sendt fylla meldinger til noen jeg ikke burde",
        "🎲 Tapt et veddemål",
        "🏊 Nakenbadet",
        "🎤 Sunget karaoke",
        "🦴 Brukket et ben",
        "⛵ Vært på en yacht",
        "💑 Vært på en tinderdate",
        "🖊️ Tatt en tatovering",
        "👮 Lyvd til politiet",
        "💔 Slått opp med noen",
        "🪥 Brukt noen andres tannbørste",
        "🚽 Tettet do hos noen andre",
        "😴 Sovnet i offentligheten",
        "💋 Kysset noen offentlig",
        "💰 Brukt noen for penger",
        "🔞 Hatt et one-night stand",
        "🤥 Lurt noen",
        "🚗 Kjørt på noe ved uhell",
        "😂 Ledd så mye at jeg tisset på meg",
        "📱 Gått gjennom en annens meldinger",
        "🚬 Prøvd hasj",
        "🚶 Hatt walk of shame",
        "✈️ Dratt på alenetur til utlandet",
        "🤥 Lyvd til foreldrene mine om hvor jeg har vært",
        "🏰 Vært på en Disney-park",
        "👻 Ghostet noen",
        "👻 Trodd på spøkelser",
        "🤒 Faket at jeg var syk for å slippe skolen",
        "📱 Slettet et innlegg fordi det fikk for få likes",
        "🍔 Kastet mat eller drikke på noen",
        "👙 Brukt noen andres undertøy",
        "📺 Sett en hel serie på en dag",
        "🌍 Vært utenfor Europa",
        "🌟 Sett en A-kjendis i virkeligheten",
        "📝 Stryket på en prøve",
        "🤝 Donert penger til veldedighet",
        "❤️ Vært forelsket",
        "🍷 Tatt alkohol fra foreldrene mine",
        "🍕 Tatt mat fra kjøleskapet som ikke var mitt",
        "🏊 Tisset i bassenget",
        "🌏 Vært i Asia",
        "💔 Fått vennen min til å slå opp med kjæresten",
        "🗣️ Sladret på noen",
        "🔞 Sagt feil navn under sex",
        "👶 Tenkt at en baby er direkte stygg",
        "💤 Hatt en våtdrøm",
        "😠 Vært langsint lenger enn et år",
        "🥗 Vært på en diett",
        "🚬 Aldri tatt syre",
        "📱 Aldri lest partnerens meldinger",
        "📧 Aldri lest partnerens e-poster",
        "🏥 Aldri vært innlagt på sykehus utenom fødsel",
        "🎤 Aldri sunget offentlig",
        "🎸 Aldri spilt et musikkinstrument",
        "🏂 Aldri stått på snowboard",
        "⛷️ Aldri gått på ski",
        "✈️ Aldri reist til et fremmed land",
        "🤒 Aldri faket syk fra jobb",
        "🍹 Aldri sendt en drink til en fremmed",
        "🍸 Aldri akseptert en drink fra en fremmed",
        "💰 Aldri løyet om inntekten min",
        "🔞 Aldri hatt sex på et offentlig sted",
        "🚶‍♂️ Aldri vært naken offentlig",
        "👴 Aldri datet noen 10 år eldre",
        "👶 Aldri datet noen 5 år yngre",
        "📱 Aldri sendt melding eller tatt en samtale på kino",
        "💔 Aldri overbevist en venn om å slå opp med partneren",
        "🤐 Aldri vært noens alibi",
        "🚇 Aldri hoppet over en sperre",
        "🗣️ Aldri sladret på noen på jobb",
        "👮 Aldri løyet til en politibetjent",
        "🐶 Aldri skyldt på et kjæledyr for en fis",
        "👶 Aldri tenkt at en venns baby var stygg",
        "🎰 Aldri vunnet mer enn 50 dollar på gambling",
        "🎲 Aldri tapt mer enn 50 dollar på gambling",
        "🥗 Aldri blitt veganer",
        "💃 Aldri danset på et bord",
        "🚗 Aldri hatt et road rage-utbrudd",
        "✂️ Aldri klippet mitt eget hår",
        "⏰ Aldri vært våken i 24 timer eller mer",
        "👟 Aldri mistet skoene mine på en kveld ute",
        "😢 Aldri grått eller flørtet meg ut av en bot",
        "🔍 Aldri snoket i en venns rom eller eiendeler",
        "🚗 Aldri hatt sex i en bil",
        "👥 Aldri jobbet med noen jeg ikke tålte",
        "🍽️ Aldri spist mat som falt på gulvet",
        "📺 Aldri brukt en hel dag på reality-TV",
        "📸 Aldri mottatt nudes",
        "🤦 Aldri kalt partneren min feil navn",
        "🌩️ Aldri danset i regnet",
        "💒 Aldri sneket meg inn på en fest eller et bryllup",
        "🩹 Aldri fått sting",
      ];
      session.gameState = {
        phase: "collecting",
        statements: defaultStatements.map((statement) => ({
          text: statement,
          author: "Spillet",
          authorId: "system",
        })),
        currentStatementIndex: -1,
        responses: {},
        timer: 60,
        usedStatements: [],
        availableStatements: [],
        defaultStatements: defaultStatements.map((statement) => ({
          text: statement,
          author: "Spillet",
          authorId: "system",
        })),
      };
    } else if (gameType === GAME_TYPES.MUSIC_GUESS) {
      session.gameState = {
        phase: "topic-selection", // Changed from "category-selection" to match client expectation
        topic: "",
        playerSongs: [],
        votes: {},
        revealedSongs: [],
      };
      } else if (gameType === GAME_TYPES.BEAT4BEAT) {
        session.gameState = {
          phase: "waiting",
          buzzOrder: [],
          roundActive: false,
          roundNumber: 1,
          scores: {},
          winnerId: null,
        };
      } else if (gameType === GAME_TYPES.SKJENKEHJULET) {
        session.gameState = {
          phase: "setup",
          countdownTime: 10,
          gameMode: "medium",
          timeRemaining: 0,
          currentPunishment: null,
          currentCategory: "",
          wheelCategories: [],
          roundNumber: 1,
        };
      } else if (gameType === GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      session.gameState = {
        phase: "setup",
        responses: [],
        currentResponse: null,
        currentResponseIndex: 0,
        timerDuration: 60,
        timeRemaining: 60,
      };
    }

    // Notify all players about the game selection
    io.to(sessionId).emit("game-selected", {
      gameType: session.gameType,
      gameState: session.gameState,
    });
  });

  // Skjenkehjulet - Start Game
  socket.on("skjenkehjulet-start-game", (sessionId, settings) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.SKJENKEHJULET) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start the game
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can start the game" });
      return;
    }

    updateSessionActivity(sessionId);

    // Initialize game state
    session.gameState = {
      phase: "countdown",
      countdownTime: settings.countdownTime || 10,
      gameMode: settings.gameMode || "medium",
      timeRemaining: settings.countdownTime || 10,
      currentPunishment: null,
      currentCategory: "",
      wheelCategories: shuffleArray(skjenkehjuletCategories).slice(0, 10),
      roundNumber: 1,
    };

    console.log(
      `Skjenkehjulet game started in session ${sessionId} with ${settings.gameMode} mode`
    );

    // Start countdown timer
    startSkjenkehjuletCountdown(sessionId);

    // Notify all clients
    io.to(sessionId).emit("skjenkehjulet-game-start", {
      countdownTime: session.gameState.countdownTime,
      gameMode: session.gameState.gameMode,
      wheelCategories: session.gameState.wheelCategories,
    });
  });


  // Next round
  socket.on("skjenkehjulet-next-round", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.SKJENKEHJULET) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start next round
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can start the next round" });
      return;
    }

    updateSessionActivity(sessionId);

    // Clear any existing timer
    if (session.gameState.timerId) {
      clearInterval(session.gameState.timerId);
    }

    // Increment round number and shuffle categories
    session.gameState.roundNumber++;
    session.gameState.wheelCategories = shuffleArray(
      skjenkehjuletCategories
    ).slice(0, 10);

    // Reset state for new round
    session.gameState.phase = "countdown";
    session.gameState.timeRemaining = session.gameState.countdownTime;
    session.gameState.currentPunishment = null;
    session.gameState.currentCategory = "";

    console.log(
      `Starting round ${session.gameState.roundNumber} in session ${sessionId}`
    );

    // Start countdown
    startSkjenkehjuletCountdown(sessionId);

    // Notify clients
    io.to(sessionId).emit("skjenkehjulet-next-round", {
      countdownTime: session.gameState.countdownTime,
      wheelCategories: session.gameState.wheelCategories,
      roundNumber: session.gameState.roundNumber,
    });
  });

  // Set timer duration (host only)
  socket.on("laugh-set-duration", (sessionId, duration) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can set the duration
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can set the timer duration",
      });
      return;
    }

    // Update timer duration (between 10 and 300 seconds)
    session.gameState.timerDuration = Math.min(600, Math.max(10, duration));
    session.gameState.timeRemaining = session.gameState.timerDuration;

    // Notify all clients about the updated duration
    io.to(sessionId).emit("laugh-timer-update", {
      timerDuration: session.gameState.timerDuration,
      timeRemaining: session.gameState.timeRemaining,
    });
  });

  // Start the game (host only)
  socket.on("laugh-start-game", (sessionId, duration) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start the game
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can start the game",
      });
      return;
    }

    // Set timer duration if provided, otherwise use the existing one
    if (duration) {
      session.gameState.timerDuration = Math.min(600, Math.max(10, duration));
    }

    // Reset game state
    session.gameState.phase = "submission";
    session.gameState.responses = [];
    session.gameState.currentResponse = null;
    session.gameState.currentResponseIndex = 0;
    session.gameState.timeRemaining = session.gameState.timerDuration;

    // Start the timer
    let timer = setInterval(() => {
      // Get the session again to ensure it still exists
      const currentSession = sessions[sessionId];
      if (
        !currentSession ||
        currentSession.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH
      ) {
        clearInterval(timer);
        return;
      }

      currentSession.gameState.timeRemaining--;

      // Update clients about timer
      io.to(sessionId).emit("laugh-timer-update", {
        timeRemaining: currentSession.gameState.timeRemaining,
        timerDuration: currentSession.gameState.timerDuration,
      });

      // If timer is up, move to reveal phase
      if (currentSession.gameState.timeRemaining <= 0) {
        clearInterval(timer);

        // Shuffle responses
        if (currentSession.gameState.responses.length > 0) {
          currentSession.gameState.responses = shuffleArray([
            ...currentSession.gameState.responses,
          ]);
        }

        // Move to reveal phase
        currentSession.gameState.phase = "reveal";

        // Notify clients about phase change
        io.to(sessionId).emit("laugh-phase-changed", {
          phase: "reveal",
          responses: currentSession.gameState.responses,
          currentResponseIndex: 0,
          currentResponse: null,
        });
      }
    }, 1000);

    // Store timer ID for cleanup
    session.gameState.timerId = timer;

    // Notify clients about game start
    io.to(sessionId).emit("laugh-phase-changed", {
      phase: "submission",
      timerDuration: session.gameState.timerDuration,
      timeRemaining: session.gameState.timeRemaining,
      responses: [],
    });
  });

  // Submit a response
  // Submit a response
  socket.on("laugh-submit-response", (sessionId, response) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Check that we're in submission phase
    if (session.gameState.phase !== "submission") {
      socket.emit("error", {
        message: "Responses can only be submitted during the submission phase",
      });
      return;
    }

    // Find the player
    const player = session.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Add the response
    session.gameState.responses.push(response);

    console.log(
      `Player ${player.name} submitted response in session ${sessionId}`
    );

    // Notify all clients about the new response
    io.to(sessionId).emit("laugh-response-submitted", {
      responseCount: session.gameState.responses.length,
      responses: session.gameState.responses, // ADD THIS LINE to send the full responses array
    });
  });

  // Show next response (host only)
  socket.on("laugh-next-response", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can reveal responses
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can reveal responses",
      });
      return;
    }

    // Check if we have any more responses to show
    if (
      session.gameState.currentResponseIndex <
      session.gameState.responses.length
    ) {
      // Get the next response
      const nextResponse =
        session.gameState.responses[session.gameState.currentResponseIndex];

      // Update game state
      session.gameState.currentResponse = nextResponse;
      session.gameState.currentResponseIndex++;

      // Notify clients about the new response
      io.to(sessionId).emit("laugh-next-response", {
        currentResponse: nextResponse,
        currentResponseIndex: session.gameState.currentResponseIndex,
      });
    }
  });

  // Restart game (host only)
  socket.on("laugh-restart-game", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NOT_ALLOWED_TO_LAUGH) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can restart the game
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can restart the game",
      });
      return;
    }

    // Clear any existing timer
    if (session.gameState.timerId) {
      clearInterval(session.gameState.timerId);
      session.gameState.timerId = null;
    }

    // Reset game state
    session.gameState = {
      phase: "setup",
      responses: [],
      currentResponse: null,
      currentResponseIndex: 0,
      timerDuration: 60,
      timeRemaining: 60,
    };

    // Notify all clients about the game restart
    io.to(sessionId).emit("laugh-phase-changed", {
      phase: "setup",
      responses: [],
      currentResponse: null,
      currentResponseIndex: 0,
      timerDuration: 60,
      timeRemaining: 60,
    });

    console.log(`Game restarted in session ${sessionId}`);
  });

  // Start next statement for Drink or Judge

  socket.on("drink-or-judge-next-statement", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.DRINK_OR_JUDGE) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can move to the next statement
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can move to the next statement",
      });
      return;
    }

    // Reset votes for the new statement
    session.gameState.votes = {};

    // Choose a random statement that hasn't been used yet
    const availableStatements = session.gameState.statements.filter(
      (statement) => !session.gameState.usedStatements.includes(statement)
    );

    // If we've used all statements, reset the used statements list and RESHUFFLE
    if (availableStatements.length === 0) {
      session.gameState.usedStatements = [];
      // Reshuffle all statements for a new random order
      shuffleArray(session.gameState.statements);
      availableStatements.push(...session.gameState.statements);
    }

    // Pick the first statement (already randomized by previous shuffle)
    const nextStatement = availableStatements[0];

    // Mark this statement as used
    session.gameState.usedStatements.push(nextStatement);

    // Set the current statement
    session.gameState.currentStatement = nextStatement;

    // Move to voting phase
    session.gameState.phase = "voting";

    // Notify all clients about the new statement and phase
    io.to(sessionId).emit("drink-or-judge-statement", {
      statement: nextStatement,
      phase: "voting",
      players: session.players,
    });
  });

  socket.on("prev-statement", (sessionId, index) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can navigate statements
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can navigate statements",
      });
      return;
    }

    // Ensure the index is valid
    if (index < 0 || index >= session.gameState.usedStatements.length) {
      socket.emit("error", { message: "Invalid statement index" });
      return;
    }

    console.log(
      `Host navigated to statement index ${index} in session ${sessionId}`
    );

    // Get the statement at the requested index from used statements
    const statement = session.gameState.usedStatements[index];
    session.gameState.currentStatementIndex = index;

    // Notify all players about the navigation
    io.to(sessionId).emit("navigation-update", {
      statement: statement,
      statementIndex: index,
      totalStatements: session.gameState.availableStatements.length,
    });
  });

  // Music Guess - Set topic
  socket.on("music-guess-set-topic", (sessionId, topic) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can set the topic
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can set the topic" });
      return;
    }

    // Initialize game state with the topic
    session.gameState = {
      phase: "song-selection",
      topic: topic,
      playerSongs: [],
      votes: {},
      revealedSongs: [],
    };

    // Notify all players about the topic
    io.to(sessionId).emit("music-guess-topic-set", {
      topic: topic,
      phase: "song-selection",
    });
  });

  // Music Guess - Submit song
  socket.on("music-guess-submit-song", (sessionId, song) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Validate the song data
    if (!song || !song.id || !song.title || !song.artist) {
      socket.emit("error", { message: "Invalid song data" });
      return;
    }

    // Find the player who submitted
    const player = session.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Check if player has already submitted a song
    const existingSongIndex = session.gameState.playerSongs.findIndex(
      (s) => s.selectedBy === socket.id
    );

    if (existingSongIndex >= 0) {
      // Replace the existing song
      session.gameState.playerSongs[existingSongIndex] = {
        ...song,
        selectedBy: socket.id,
        selectedByName: player.name,
      };
    } else {
      // Add the new song
      session.gameState.playerSongs.push({
        ...song,
        selectedBy: socket.id,
        selectedByName: player.name,
      });
    }

    console.log(
      `Player ${player.name} submitted song "${song.title}" in session ${sessionId}`
    );

    // Notify all players about the submission progress
    io.to(sessionId).emit("music-guess-song-submitted", {
      submittedCount: session.gameState.playerSongs.length,
      totalPlayers: session.players.length,
      playerSongs: session.gameState.playerSongs.map((s) => ({
        ...s,
        // Don't expose who selected which song yet
        selectedBy: s.selectedBy === socket.id ? s.selectedBy : null,
        selectedByName: s.selectedBy === socket.id ? s.selectedByName : null,
      })),
    });
  });

  // Music Guess - Start guessing phase

  socket.on("music-guess-start-guessing", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start the guessing phase
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can start the guessing phase",
      });
      return;
    }

    // Make sure we have at least one song
    if (
      !session.gameState.playerSongs ||
      session.gameState.playerSongs.length === 0
    ) {
      socket.emit("error", { message: "No songs have been submitted yet" });
      return;
    }

    // IMPROVED SHUFFLING: Use Fisher-Yates shuffle for more random results
    const playerSongs = [...session.gameState.playerSongs];
    for (let i = playerSongs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerSongs[i], playerSongs[j]] = [playerSongs[j], playerSongs[i]];
    }

    // Log the shuffle for debugging
    console.log(`Shuffled ${playerSongs.length} songs in session ${sessionId}`);

    // Update the game state with shuffled songs
    session.gameState.playerSongs = playerSongs;

    // Set the first song as current
    session.gameState.currentSongIndex = 0;
    session.gameState.currentSong = session.gameState.playerSongs[0];
    session.gameState.phase = "guessing";
    session.gameState.votes = {};

    // Notify all players that we're starting the guessing phase
    io.to(sessionId).emit("music-guess-start-guessing", {
      phase: "guessing",
      currentSong: {
        id: session.gameState.currentSong.id,
        title: session.gameState.currentSong.title,
        artist: session.gameState.currentSong.artist,
        previewUrl: session.gameState.currentSong.previewUrl,
        albumImageUrl: session.gameState.currentSong.albumImageUrl,
        // Don't expose who selected the song yet
        selectedBy: null,
        selectedByName: null,
      },
      songIndex: 0,
      totalSongs: session.gameState.playerSongs.length,
    });
  });

  // Music Guess - Submit vote
  socket.on("music-guess-vote", (sessionId, votedForId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Store the player's vote
    session.gameState.votes[socket.id] = votedForId;

    // Get current player
    const currentPlayer = session.players.find((p) => p.id === socket.id);
    if (!currentPlayer) return;

    console.log(
      `Player ${currentPlayer.name} voted for ${votedForId} in session ${sessionId}`
    );

    // Find the current song owner
    const currentSong =
      session.gameState.playerSongs[session.gameState.currentSongIndex];
    const songOwnerId = currentSong?.selectedBy;

    // Calculate eligible voters (everyone except the song owner)
    const eligibleVoters = session.players.filter((p) => p.id !== songOwnerId);
    const eligibleVoterIds = eligibleVoters.map((p) => p.id);

    // Calculate how many eligible voters have voted
    const eligibleVotesReceived = Object.keys(session.gameState.votes).filter(
      (voterId) => eligibleVoterIds.includes(voterId)
    ).length;

    // Notify all players about the voting progress
    io.to(sessionId).emit("music-guess-vote-update", {
      votedCount: eligibleVotesReceived,
      totalPlayers: eligibleVoters.length,
    });

    // If all eligible voters have voted, show results automatically
    if (eligibleVotesReceived >= eligibleVoters.length) {
      showMusicGuessResults(sessionId);
    }
  });
  // Music Guess - Force show results
  socket.on("music-guess-force-results", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can force results
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can force show results" });
      return;
    }

    showMusicGuessResults(sessionId);
  });

  // Music Guess - Next song
  socket.on("music-guess-next-song", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.MUSIC_GUESS) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can move to the next song
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can move to the next song",
      });
      return;
    }

    // Move to the next song
    const nextIndex = session.gameState.currentSongIndex + 1;

    // Check if we've gone through all songs
    if (nextIndex >= session.gameState.playerSongs.length) {
      // Game is over
      session.gameState.phase = "game-end";

      // Add the last song to revealed songs if not already there
      if (
        session.gameState.currentSong &&
        !session.gameState.revealedSongs.some(
          (s) => s.id === session.gameState.currentSong.id
        )
      ) {
        session.gameState.revealedSongs.push(session.gameState.currentSong);
      }

      io.to(sessionId).emit("music-guess-game-end", {
        allSongs: session.gameState.playerSongs,
      });
      return;
    }

    // Update game state for next song
    session.gameState.currentSongIndex = nextIndex;
    session.gameState.currentSong = session.gameState.playerSongs[nextIndex];
    session.gameState.votes = {};
    session.gameState.phase = "guessing"; // Explicitly set phase

    // Notify all players about the next song
    io.to(sessionId).emit("music-guess-next-song", {
      currentSong: {
        id: session.gameState.currentSong.id,
        title: session.gameState.currentSong.title,
        artist: session.gameState.currentSong.artist,
        previewUrl: session.gameState.currentSong.previewUrl,
        albumImageUrl: session.gameState.currentSong.albumImageUrl,
        // Don't expose who selected the song yet
        selectedBy: null,
        selectedByName: null,
      },
      songIndex: nextIndex,
      songsLeft: session.gameState.playerSongs.length - nextIndex - 1,
      phase: "guessing", // Include phase in payload
    });
  });

  // Submit vote
  socket.on("drink-or-judge-vote", (sessionId, votedPlayerId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.DRINK_OR_JUDGE) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Store the vote (each player can only vote once per round)
    session.gameState.votes[socket.id] = votedPlayerId;

    // Calculate how many people have voted
    const totalVotes = Object.keys(session.gameState.votes).length;

    // Notify all players about vote progress (without revealing who voted for whom)
    io.to(sessionId).emit("drink-or-judge-vote-update", {
      votedCount: totalVotes,
      totalPlayers: session.players.length,
    });

    // If everyone has voted, move to results phase
    if (totalVotes >= session.players.length) {
      // Tally the votes
      const voteCounts = {};

      // Initialize vote counts for all players
      session.players.forEach((player) => {
        voteCounts[player.id] = 0;
      });

      // Count the votes
      Object.values(session.gameState.votes).forEach((votedId) => {
        if (voteCounts[votedId] !== undefined) {
          voteCounts[votedId] += 1;
        }
      });

      // Create results array with player names and vote counts
      const results = session.players
        .map((player) => ({
          id: player.id,
          name: player.name,
          votes: voteCounts[player.id] || 0,
        }))
        .sort((a, b) => b.votes - a.votes); // Sort by votes (highest first)

      // Store results in game state
      session.gameState.results = results;
      session.gameState.phase = "results";

      // Send results to all players
      io.to(sessionId).emit("drink-or-judge-results", {
        results: results,
        statement: session.gameState.currentStatement,
      });
    }
  });

  // Force show results (host only)
  socket.on("drink-or-judge-force-results", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.DRINK_OR_JUDGE) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can force results
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can force show results",
      });
      return;
    }

    // Tally the votes (even if not everyone has voted)
    const voteCounts = {};

    // Initialize vote counts
    session.players.forEach((player) => {
      voteCounts[player.id] = 0;
    });

    // Count votes
    Object.values(session.gameState.votes).forEach((votedId) => {
      if (voteCounts[votedId] !== undefined) {
        voteCounts[votedId] += 1;
      }
    });

    // Create results
    const results = session.players
      .map((player) => ({
        id: player.id,
        name: player.name,
        votes: voteCounts[player.id] || 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    // Update game state
    session.gameState.results = results;
    session.gameState.phase = "results";

    // Send results to all players
    io.to(sessionId).emit("drink-or-judge-results", {
      results: results,
      statement: session.gameState.currentStatement,
    });
  });

  // Never Have I Ever - Submit statement
  socket.on("submit-never-statement", (sessionId, statement) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Find the player who submitted
    const player = session.players.find((p) => p.id === socket.id);
    if (!player) return;

    console.log(
      `Player ${player.name} submitted statement: "${statement}" in session ${sessionId}`
    );

    // Create the statement object
    const newStatement = {
      text: statement,
      author: player.name,
      authorId: socket.id,
    };

    // Add the statement to the collection
    session.gameState.statements.push(newStatement);

    // If we're already in revealing phase, also add it to available statements
    if (
      session.gameState.phase === "revealing" &&
      session.gameState.availableStatements
    ) {
      session.gameState.availableStatements.push(newStatement);
    }

    // Count only user-submitted statements for the collection progress
    const userSubmittedStatements = session.gameState.statements.filter(
      (s) => s.authorId !== "system"
    );
    const totalUserStatements = userSubmittedStatements.length;
    const totalPlayers = session.players.length;

    console.log(
      `Session ${sessionId}: ${totalUserStatements}/${totalPlayers} user statements submitted`
    );

    // Notify all players about the submission progress, count only user statements
    io.to(sessionId).emit("statement-submitted", {
      submittedCount: totalUserStatements,
      totalPlayers: totalPlayers,
      // Also send the full statements array so clients have complete state
      statements: session.gameState.statements,
    });

    // If all players have submitted AND we're still in collecting phase,
    // we can start revealing (or wait for the timer)
    if (
      totalUserStatements >= totalPlayers &&
      session.gameState.phase === "collecting"
    ) {
      console.log(
        `All players have submitted statements in session ${sessionId}, starting reveal phase`
      );
      startRevealingPhase(sessionId);
    }
  });

  // Never Have I Ever - Start game timer

  // Never Have I Ever - Start game timer
  socket.on("start-never-timer", (sessionId, duration) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start the timer
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can start the timer" });
      return;
    }

    // Make sure the game state exists
    if (!session.gameState) {
      session.gameState = {
        phase: "collecting",
        statements: [],
        currentStatementIndex: -1,
        responses: {},
        timer: 60,
      };
    }

    console.log(`Host started timer for session ${sessionId}`);

    // Set the timer duration if provided
    let timeLeft = duration || 60;

    // Store the current timeLeft in the game state
    session.gameState.timeLeft = timeLeft;

    // Notify all players that the timer has started
    io.to(sessionId).emit("timer-update", { timeLeft });

    // Clear any existing timer for this session
    if (sessionTimers.has(sessionId)) {
      clearInterval(sessionTimers.get(sessionId));
    }

    const timerId = setInterval(() => {
      // Check if the session still exists before updating
      if (!sessions[sessionId]) {
        console.log(`Session ${sessionId} no longer exists, clearing timer`);
        clearInterval(timerId);
        sessionTimers.delete(sessionId);
        return;
      }

      // Check if gameState still exists
      if (!sessions[sessionId].gameState) {
        console.log(
          `GameState for session ${sessionId} no longer exists, clearing timer`
        );
        clearInterval(timerId);
        sessionTimers.delete(sessionId);
        return;
      }

      // Decrement the timer
      timeLeft--;
      sessions[sessionId].gameState.timeLeft = timeLeft;

      // Notify all players about the timer update
      io.to(sessionId).emit("timer-update", { timeLeft });

      // If time is up or all players have submitted, start revealing phase
      if (timeLeft <= 0) {
        console.log(`Timer ended for session ${sessionId}`);
        clearInterval(timerId);
        sessionTimers.delete(sessionId);

        // Double-check if session still exists before starting reveal phase
        if (
          sessions[sessionId] &&
          sessions[sessionId].gameState &&
          sessions[sessionId].gameState.phase === "collecting"
        ) {
          console.log(
            `Time's up in session ${sessionId}, starting reveal phase`
          );
          startRevealingPhase(sessionId);
        }
      }
    }, 1000);

    // Store the timer ID so we can clear it if needed
    sessionTimers.set(sessionId, timerId);
  });

  // Never Have I Ever - Submit response to a statement
  socket.on("submit-response", (sessionId, response) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Store the player's response for the current statement
    if (!session.gameState.responses[session.gameState.currentStatementIndex]) {
      session.gameState.responses[session.gameState.currentStatementIndex] = {};
    }

    session.gameState.responses[session.gameState.currentStatementIndex][
      socket.id
    ] = response;

    // Check if all players have responded
    const responseCount = Object.keys(
      session.gameState.responses[session.gameState.currentStatementIndex]
    ).length;

    console.log(
      `Session ${sessionId}: ${responseCount}/${session.players.length} responses received for statement ${session.gameState.currentStatementIndex}`
    );

    // Notify all players about the response
    io.to(sessionId).emit("response-received", {
      respondedCount: responseCount,
      totalPlayers: session.players.length,
    });

    // If all players have responded, we can move to the next statement
    if (responseCount >= session.players.length) {
      // Wait a bit to show results, then move to next statement
      console.log(
        `All players responded in session ${sessionId}, moving to next statement in 3 seconds`
      );
      setTimeout(() => {
        moveToNextStatement(sessionId);
      }, 3000);
    }
  });

  // Never Have I Ever - Next statement (host can force next)
  socket.on("next-statement", (sessionId) => {
    const session = sessions[sessionId];

    updateSessionActivity(sessionId);

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can force move to next statement
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can move to the next statement",
      });
      return;
    }

    console.log(
      `Host manually moved to next statement in session ${sessionId}`
    );
    moveToNextStatement(sessionId);
  });

  // Restart game (host only) - Original version is replaced with the enhanced version below
  /*
  socket.on("restart-game", (sessionId) => {
    // Old implementation - replaced with enhanced one below
  });
  */

  // Enhanced version of restart-game

  socket.on("restart-game", (sessionId, returnToLobby = false) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only host can restart the game
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can restart or return to lobby",
      });
      return;
    }
    // Clear any existing timers for this session
    if (sessionTimers.has(sessionId)) {
      clearInterval(sessionTimers.get(sessionId));
      sessionTimers.delete(sessionId);
    }

    // Clear any existing timers
    if (session.gameState && session.gameState.timerId) {
      clearInterval(session.gameState.timerId);
    }

    console.log(
      `Host ${socket.id} restarting game in session ${sessionId}, returnToLobby: ${returnToLobby}`
    );

    if (returnToLobby) {
      // Reset the game state to "none"
      session.gameType = GAME_TYPES.NONE;
      session.gameState = null;

      // Inform all players that they are back in the lobby
      io.to(sessionId).emit("return-to-lobby", {
        players: session.players,
      });
    } else {
      // Reset the game state
      if (session.gameType === GAME_TYPES.NEVER_HAVE_I_EVER) {
        session.gameState = {
          phase: "collecting",
          statements: [],
          currentStatementIndex: -1,
          responses: {},
          timer: 60,
        };
      } else if (session.gameType === GAME_TYPES.MUSIC_GUESS) {
        // FIX: Properly initialize music game to topic selection phase
        session.gameState = {
          phase: "topic-selection", // Changed from category-selection to topic-selection
          topic: "",
          playerSongs: [],
          votes: {},
          revealedSongs: [],
        };
      } else if (session.gameType === GAME_TYPES.DRINK_OR_JUDGE) {
        session.gameState = {
          phase: "statement",
          statements: [
            // Same statement list as original...
          ],
          currentStatementIndex: 0,
          votes: {},
          results: [],
          usedStatements: [],
        };
      }

      // Notify all players the game has been restarted
      io.to(sessionId).emit("game-restarted", {
        gameType: session.gameType,
        gameState: session.gameState,
      });
    }
  });

  // Return to lobby (host only)
  socket.on("return-to-lobby", (sessionId) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only the host can return to lobby
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can return to the lobby",
      });
      return;
    }

    console.log(`Host ${socket.id} returning session ${sessionId} to lobby`);

    // Clear any existing timers
    if (session.gameState && session.gameState.timerId) {
      clearInterval(session.gameState.timerId);
    }

    // Reset the game state to "none"
    session.gameType = GAME_TYPES.NONE;
    session.gameState = null;

    // Inform all players that they are back in the lobby
    io.to(sessionId).emit("return-to-lobby", {
      players: session.players,
    });
  });

  // End game event handler
  socket.on("end-game", (sessionId) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only the host can end the game
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can end the game" });
      return;
    }

    console.log(`Host ${socket.id} ending game in session ${sessionId}`);

    // Emit game-ended event with all statements and responses
    io.to(sessionId).emit("game-ended", {
      statements: session.gameState.statements,
      responses: session.gameState.responses,
    });

    // Set phase to ended
    session.gameState.phase = "ended";
  });

  // Explicitly leave a session
  socket.on("leave-session", () => {
    handlePlayerDisconnect(socket.id);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    handlePlayerDisconnect(socket.id);
    console.log("User disconnected:", socket.id);
  });

  socket.on("transfer-host", (sessionId, newHostId) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only the current host can transfer host rights
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the current host can transfer host rights",
      });
      return;
    }

    // Check if the new host is a valid participant
    const newHostPlayer = session.players.find(
      (player) => player.id === newHostId
    );
    if (!newHostPlayer) {
      socket.emit("error", { message: "Selected player not found in session" });
      return;
    }

    // Update the host
    const oldHostId = session.host;
    session.host = newHostId;

    console.log(
      `Host transferred from ${oldHostId} to ${newHostId} in session ${sessionId}`
    );

    // Notify all players about the host change
    io.to(sessionId).emit("host-changed", {
      newHost: newHostId,
      newHostName: newHostPlayer.name,
      players: session.players,
    });
  });
  socket.on("lambo-vote", (sessionId) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Check if user already voted
    if (session.lamboVotes.includes(socket.id)) {
      return; // Already voted
    }

    // Add vote
    session.lamboVotes.push(socket.id);

    console.log(`Player ${socket.id} voted for Lambo in session ${sessionId}`);

    // Calculate threshold
    const votePercentage =
      (session.lamboVotes.length / session.players.length) * 100;

    // Notify all clients about vote update
    io.to(sessionId).emit("lambo-votes-update", {
      voters: session.lamboVotes,
      percentage: votePercentage,
    });

    // Check if threshold is reached (75%)
    if (votePercentage >= 75) {
      console.log(
        `Lambo threshold reached in session ${sessionId}, activating Lambo!`
      );

      // Select random player to drink
      const randomPlayerIndex = Math.floor(
        Math.random() * session.players.length
      );
      const selectedDrinker = session.players[randomPlayerIndex].id;

      // Notify all clients that Lambo is activated
      io.to(sessionId).emit("lambo-activated", {
        selectedDrinker: selectedDrinker,
      });
    }
  });

  // End Lambo (host only)
  socket.on("end-lambo", (sessionId) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only host can end Lambo
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can end Lambo" });
      return;
    }

    console.log(`Host ended Lambo in session ${sessionId}`);

    // Reset Lambo votes
    session.lamboVotes = [];

    // Notify all clients that Lambo is ended
    io.to(sessionId).emit("lambo-ended");
  });
});

const disconnectedHosts = {}; // Track temporarily disconnected hosts
const HOST_GRACE_PERIOD = 30000; // 30 seconds grace period (in milliseconds)

// Helper function to handle player disconnection
function handlePlayerDisconnect(socketId) {
  // Check if this socket is associated with a session
  if (playerSessions[socketId]) {
    const sessionId = playerSessions[socketId].sessionId;
    const playerName = playerSessions[socketId].name;
    const session = sessions[sessionId];

    if (session) {
      const playerIndex = session.players.findIndex(
        (player) => player.id === socketId
      );

      if (playerIndex !== -1) {
        // If this was the host, use grace period instead of immediately transferring host status
        if (socketId === session.host) {
          console.log(
            `Host ${playerName} (${socketId}) temporarily disconnected from session ${sessionId}`
          );

          // Mark the player as disconnected but keep them in the list for now
          session.players[playerIndex].disconnected = true;

          // Store information about the disconnected host with a timeout
          disconnectedHosts[sessionId] = {
            hostId: socketId,
            hostName: playerName,
            playerIndex: playerIndex,
            disconnectedAt: Date.now(),
            timeoutId: setTimeout(() => {
              // This executes if host doesn't reconnect within grace period
              console.log(
                `Host ${playerName} did not reconnect within grace period (${HOST_GRACE_PERIOD}ms)`
              );

              // Now find the session again (in case it was deleted)
              const session = sessions[sessionId];
              if (!session) return;

              // Find the disconnected host player (index might have changed)
              const playerIndex = session.players.findIndex(
                (p) => p.id === socketId && p.disconnected
              );

              if (playerIndex !== -1) {
                // Actually remove the player now
                session.players.splice(playerIndex, 1);

                if (socketId === session.host && session.players.length <= 1) {
                  if (sessionTimers.has(sessionId)) {
                    clearInterval(sessionTimers.get(sessionId));
                    sessionTimers.delete(sessionId);
                    console.log(
                      `Host ${playerName} left session ${sessionId}, cleared timers`
                    );
                  }
                }

                // Transfer host to another player if there are any left
                if (session.players.length > 0) {
                  const newHostIndex = 0; // Select first player as new host
                  session.host = session.players[newHostIndex].id;

                  // Notify all players about the host change
                  io.to(sessionId).emit("host-changed", {
                    newHost: session.host,
                    newHostName: session.players[newHostIndex].name,
                    players: session.players,
                  });
                } else {
                  // No players left, clean up the session
                  if (session.gameState && session.gameState.timerId) {
                    clearInterval(session.gameState.timerId);
                  }
                  delete sessions[sessionId];
                }
              }

              // Clean up the disconnected host entry
              delete disconnectedHosts[sessionId];
            }, HOST_GRACE_PERIOD),
          };

          // Update players with the disconnected status
          io.to(sessionId).emit("update-players", session.players);

          // Don't delete the player session mapping yet - keep it for grace period
          return;
        } else {
          // For regular players, just remove them immediately
          session.players.splice(playerIndex, 1);
        }

        // Update all players in the session
        io.to(sessionId).emit("update-players", session.players);
      }

      // Remove the player session mapping (for non-hosts)
      delete playerSessions[socketId];
    }
  }
}
function startRevealingPhase(sessionId) {
  const session = sessions[sessionId];
  if (!session) {
    console.log(`Session ${sessionId} not found, can't start revealing phase`);
    return;
  }

  // Ensure gameState exists
  if (!session.gameState) {
    console.log(
      `GameState for session ${sessionId} is null, can't start revealing phase`
    );
    return;
  }

  console.log(`Starting revealing phase for session ${sessionId}`);

  // Clear any existing timer
  if (sessionTimers.has(sessionId)) {
    clearInterval(sessionTimers.get(sessionId));
    sessionTimers.delete(sessionId);
  }

  // Make sure we have statements (either user-submitted or default)
  if (
    !session.gameState.statements ||
    session.gameState.statements.length === 0
  ) {
    console.log(
      `No statements for session ${sessionId}, can't start revealing phase`
    );
    return;
  }

  // Change the phase to revealing
  session.gameState.phase = "revealing";

  // Reset used statements
  session.gameState.usedStatements = [];

  // Clone the statements for the available pool
  session.gameState.availableStatements = [...session.gameState.statements];

  // Shuffle available statements
  shuffleArray(session.gameState.availableStatements);

  // Start with first statement
  session.gameState.currentStatementIndex = 0;
  const firstStatement = session.gameState.availableStatements[0];

  // Mark as used
  session.gameState.usedStatements.push(firstStatement);

  console.log(`Emitting phase-changed event for session ${sessionId}`);

  // Notify all players that we're moving to the revealing phase
  io.to(sessionId).emit("phase-changed", {
    phase: "revealing",
    statement: firstStatement,
    statementIndex: 0,
    // Send total count of available statements
    totalStatements: session.gameState.availableStatements.length,
    // Send all statements so client has complete state
    statements: session.gameState.availableStatements,
  });
}
function setupSessionCleanup() {
  // Run cleanup every 15 minutes
  setInterval(() => {
    const now = Date.now();
    Object.keys(sessions).forEach((sessionId) => {
      const session = sessions[sessionId];

      // If session doesn't have lastActivity, add it now
      if (!session.lastActivity) {
        session.lastActivity = now;
        return;
      }

      // Check if session has been inactive for too long
      if (now - session.lastActivity > SESSION_INACTIVITY_TIMEOUT) {
        console.log(`Cleaning up inactive session ${sessionId}`);

        // Clear any timers associated with this session
        if (sessionTimers.has(sessionId)) {
          clearInterval(sessionTimers.get(sessionId));
          sessionTimers.delete(sessionId);
        }

        // Notify remaining players if any
        io.to(sessionId).emit("error", {
          message: "Session expired due to inactivity",
        });

        // Delete session
        delete sessions[sessionId];

        // Remove all player->session mappings for this session
        Object.keys(playerSessions).forEach((socketId) => {
          if (playerSessions[socketId].sessionId === sessionId) {
            delete playerSessions[socketId];
          }
        });
      }
    });
  }, 900000); // Check every 15 minutes
}

// Helper function to show music guess results
function showMusicGuessResults(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // Get the current song
  const currentSongIndex = session.gameState.currentSongIndex;
  const currentSong = session.gameState.playerSongs[currentSongIndex];

  if (!currentSong) return;

  // Process the votes
  const results = [];

  // For each vote cast
  for (const [voterId, votedForId] of Object.entries(session.gameState.votes)) {
    // Find the voter and who they voted for
    const voter = session.players.find((p) => p.id === voterId);
    const votedFor = session.players.find((p) => p.id === votedForId);

    if (!voter || !votedFor) continue;

    // Add to results
    results.push({
      voterId: voterId,
      voterName: voter.name,
      votedForId: votedForId,
      votedForName: votedFor.name,
      correct: votedForId === currentSong.selectedBy,
    });
  }

  // Update game state
  session.gameState.phase = "results";

  // Add this song to revealed songs if not already there
  if (!session.gameState.revealedSongs.some((s) => s.id === currentSong.id)) {
    session.gameState.revealedSongs.push(currentSong);
  }

  // Calculate drinking penalties
  // Wrong guesses: 2 slurks
  // Song owner: 2 slurks for each correct guess
  const correctGuesses = results.filter((r) => r.correct).length;

  // Send results to all players
  io.to(sessionId).emit("music-guess-results", {
    results: results,
    correctVotes: correctGuesses,
    songOwnerId: currentSong.selectedBy,
    songOwnerName: currentSong.selectedByName,
    revealedSongs: session.gameState.revealedSongs,
  });
}

// Helper function to move to the next statement
// Modify the moveToNextStatement function to shuffle the statements if we're starting the game

// Replace the existing moveToNextStatement function
function moveToNextStatement(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // If we've used all the available statements, end the game
  if (
    session.gameState.usedStatements.length >=
    session.gameState.availableStatements.length
  ) {
    // Game is over
    console.log(`All statements revealed in session ${sessionId}, game ended`);
    io.to(sessionId).emit("game-ended", {
      statements: session.gameState.statements,
      responses: session.gameState.responses,
    });

    // Set phase to ended
    session.gameState.phase = "ended";
    return;
  }

  // Increment the statement index
  const newIndex = session.gameState.currentStatementIndex + 1;
  session.gameState.currentStatementIndex = newIndex;

  // If we're already at the end of used statements, get a new one
  let nextStatement;
  if (newIndex >= session.gameState.usedStatements.length) {
    // Find a statement that hasn't been used yet
    const unusedStatements = session.gameState.availableStatements.filter(
      (statement) =>
        !session.gameState.usedStatements.some(
          (used) =>
            used.text === statement.text && used.authorId === statement.authorId
        )
    );

    // If we have unused statements, pick one randomly
    if (unusedStatements.length > 0) {
      // Get a random unused statement
      const randomIndex = Math.floor(Math.random() * unusedStatements.length);
      nextStatement = unusedStatements[randomIndex];
    }
    // If we've used all statements, reuse a random one (shouldn't happen with end game check above)
    else {
      const randomIndex = Math.floor(
        Math.random() * session.gameState.availableStatements.length
      );
      nextStatement = session.gameState.availableStatements[randomIndex];
    }

    // Add to used statements
    session.gameState.usedStatements.push(nextStatement);
  } else {
    // We're navigating to an already used statement
    nextStatement = session.gameState.usedStatements[newIndex];
  }

  console.log(
    `Sending statement ${session.gameState.currentStatementIndex} to players in session ${sessionId}`
  );

  // Send the next statement to all players
  io.to(sessionId).emit("next-statement", {
    statement: nextStatement,
    statementIndex: session.gameState.currentStatementIndex,
    totalStatements: session.gameState.availableStatements.length,
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Start the server only when this file is run directly
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, server };
