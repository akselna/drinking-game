const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store session data
let sessions = {};

// Keeps track of which socket belongs to which player
let playerSessions = {};

// Game types
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Create a new session
  socket.on("create-session", (hostName) => {
    // Generate a random 6-character session ID
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();

    sessions[sessionId] = {
      host: socket.id,
      players: [{ id: socket.id, name: hostName }],
      gameType: GAME_TYPES.NONE,
      gameState: null,
      neverHaveIEverStatements: [],
      activeRound: null,
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

    if (!sessions[sessionIdUpper]) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Check if session is full (max 10 players)
    if (sessions[sessionIdUpper].players.length >= 10) {
      socket.emit("error", { message: "Session is full" });
      return;
    }

    // Check if this is a reconnection (same name coming back)
    const existingPlayerIndex = sessions[sessionIdUpper].players.findIndex(
      (player) => player.name === playerName
    );

    if (existingPlayerIndex >= 0) {
      // This is a reconnection - update the player's ID
      const oldId = sessions[sessionIdUpper].players[existingPlayerIndex].id;
      sessions[sessionIdUpper].players[existingPlayerIndex].id = socket.id;

      // If this was the host, update the host reference
      if (sessions[sessionIdUpper].host === oldId) {
        sessions[sessionIdUpper].host = socket.id;
      }
    } else {
      // This is a new player - check if name is already taken
      const nameExists = sessions[sessionIdUpper].players.some(
        (player) => player.name === playerName
      );

      if (nameExists) {
        socket.emit("error", { message: "Name already taken in this session" });
        return;
      }

      // Add new player to the session
      sessions[sessionIdUpper].players.push({
        id: socket.id,
        name: playerName,
      });
    }

    // Track which session this socket belongs to
    playerSessions[socket.id] = {
      sessionId: sessionIdUpper,
      name: playerName,
    };

    socket.join(sessionIdUpper);

    // Tell the player they've joined successfully
    socket.emit("session-joined", {
      sessionId: sessionIdUpper,
      isHost: socket.id === sessions[sessionIdUpper].host,
      gameType: sessions[sessionIdUpper].gameType,
      gameState: sessions[sessionIdUpper].gameState,
      players: sessions[sessionIdUpper].players,
    });

    // Update all players in the session
    io.to(sessionIdUpper).emit(
      "update-players",
      sessions[sessionIdUpper].players
    );
  });

  // Select a game (host only)
  socket.on("select-game", (sessionId, gameType) => {
    const session = sessions[sessionId];

    if (!session) {
      socket.emit("error", { message: "Session not found" });
      return;
    }

    // Only the host can select the game
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can select the game" });
      return;
    }

    if (!Object.values(GAME_TYPES).includes(gameType)) {
      socket.emit("error", { message: "Invalid game type" });
      return;
    }

    session.gameType = gameType;

    // Initialize the game state based on the game type
    if (gameType === GAME_TYPES.NEVER_HAVE_I_EVER) {
      session.gameState = {
        phase: "collecting", // collecting or revealing
        statements: [],
        currentStatementIndex: -1,
        responses: {},
        timer: 60, // Initial timer in seconds
      };
    } else if (gameType === GAME_TYPES.MUSIC_GUESS) {
      session.gameState = {
        phase: "category-selection",
      };
    }

    // Notify all players in the session about the game selection
    io.to(sessionId).emit("game-selected", {
      gameType,
      gameState: session.gameState,
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

    // Add the statement to the collection
    session.gameState.statements.push({
      text: statement,
      author: player.name,
      authorId: socket.id,
    });

    // Check if all players have submitted
    const totalStatements = session.gameState.statements.length;
    const totalPlayers = session.players.length;

    console.log(
      `Session ${sessionId}: ${totalStatements}/${totalPlayers} statements submitted`
    );

    // Notify all players about the submission progress
    io.to(sessionId).emit("statement-submitted", {
      submittedCount: totalStatements,
      totalPlayers: totalPlayers,
    });

    // If all players have submitted, we can start revealing (or wait for the timer)
    if (
      totalStatements >= totalPlayers &&
      session.gameState.phase === "collecting"
    ) {
      console.log(
        `All players have submitted statements in session ${sessionId}, starting reveal phase`
      );
      startRevealingPhase(sessionId);
    }
  });

  // Never Have I Ever - Start game timer
  socket.on("start-never-timer", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can start the timer
    if (socket.id !== session.host) {
      socket.emit("error", { message: "Only the host can start the timer" });
      return;
    }

    console.log(`Host started timer for session ${sessionId}`);

    // Start a 60-second timer for submissions
    let timeLeft = 60;

    // Notify all players that the timer has started
    io.to(sessionId).emit("timer-update", { timeLeft });

    const timerId = setInterval(() => {
      timeLeft--;

      // Notify all players about the timer update
      io.to(sessionId).emit("timer-update", { timeLeft });

      // If time is up or all players have submitted, start revealing phase
      if (timeLeft <= 0) {
        console.log(`Timer ended for session ${sessionId}`);
        clearInterval(timerId);
        if (session.gameState.phase === "collecting") {
          console.log(
            `Time's up in session ${sessionId}, starting reveal phase`
          );
          startRevealingPhase(sessionId);
        }
      }
    }, 1000);

    // Store the timer ID so we can clear it if needed
    session.gameState.timerId = timerId;
  });

  // Never Have I Ever - Submit response to a statement
  socket.on("submit-response", (sessionId, response) => {
    const session = sessions[sessionId];

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

  // Force reveal phase (for when automatic transition doesn't work)
  socket.on("force-reveal-phase", (sessionId) => {
    const session = sessions[sessionId];

    if (!session || session.gameType !== GAME_TYPES.NEVER_HAVE_I_EVER) {
      socket.emit("error", { message: "Invalid session or game type" });
      return;
    }

    // Only the host can force reveal
    if (socket.id !== session.host) {
      socket.emit("error", {
        message: "Only the host can force start revealing",
      });
      return;
    }

    console.log(
      `Host ${socket.id} forcing reveal phase for session ${sessionId}`
    );

    // Make sure we have at least one statement
    if (
      !session.gameState.statements ||
      session.gameState.statements.length === 0
    ) {
      socket.emit("error", { message: "No statements submitted yet" });
      return;
    }

    startRevealingPhase(sessionId);
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
        session.gameState = {
          phase: "category-selection",
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
});

// Helper function to handle player disconnection
function handlePlayerDisconnect(socketId) {
  // Check if this socket is associated with a session
  if (playerSessions[socketId]) {
    const sessionId = playerSessions[socketId].sessionId;
    const session = sessions[sessionId];

    if (session) {
      const playerIndex = session.players.findIndex(
        (player) => player.id === socketId
      );

      if (playerIndex !== -1) {
        // If this was the host, determine a new host or close the session
        if (socketId === session.host) {
          if (session.players.length > 1) {
            // Find the next player who isn't this one
            const newHostIndex = (playerIndex + 1) % session.players.length;
            session.host = session.players[newHostIndex].id;

            // Remove the disconnected player
            session.players.splice(playerIndex, 1);

            // Notify all players about the host change
            io.to(sessionId).emit("host-changed", {
              newHost: session.host,
              players: session.players,
            });
          } else {
            // Last player left, delete the session
            if (session.gameState && session.gameState.timerId) {
              clearInterval(session.gameState.timerId);
            }
            delete sessions[sessionId];
            delete playerSessions[socketId];
            return; // Skip the rest for this session
          }
        } else {
          // Regular player disconnected
          session.players.splice(playerIndex, 1);
        }

        // Update all players in the session
        io.to(sessionId).emit("update-players", session.players);
      }

      // Remove the player session mapping
      delete playerSessions[socketId];
    }
  }
}

// Helper function to start the revealing phase
function startRevealingPhase(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  console.log(`Starting revealing phase for session ${sessionId}`);

  // Clear any existing timer
  if (session.gameState.timerId) {
    clearInterval(session.gameState.timerId);
    session.gameState.timerId = null;
  }

  // Make sure we have statements
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

  // Move to the first statement
  session.gameState.currentStatementIndex = 0;

  // Make sure we have a first statement
  if (!session.gameState.statements[0]) {
    console.log(`First statement missing for session ${sessionId}`);
    return;
  }

  console.log(`Emitting phase-changed event for session ${sessionId}`);

  // Notify all players that we're moving to the revealing phase
  io.to(sessionId).emit("phase-changed", {
    phase: "revealing",
    statement: session.gameState.statements[0],
    statementIndex: 0,
    totalStatements: session.gameState.statements.length,
  });
}

// Helper function to move to the next statement
function moveToNextStatement(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // Increment the statement index
  session.gameState.currentStatementIndex++;

  console.log(
    `Moving to statement ${session.gameState.currentStatementIndex} in session ${sessionId}`
  );

  // Check if we've gone through all statements
  if (
    session.gameState.currentStatementIndex >=
    session.gameState.statements.length
  ) {
    // Game is over
    console.log(`All statements revealed in session ${sessionId}, game ended`);
    io.to(sessionId).emit("game-ended", {
      statements: session.gameState.statements,
      responses: session.gameState.responses,
    });

    // Don't reset the game state immediately - wait for user to choose restart or return to lobby
    session.gameState.phase = "ended";
  } else {
    // Send the next statement to all players
    console.log(
      `Sending statement ${session.gameState.currentStatementIndex} to players in session ${sessionId}`
    );
    io.to(sessionId).emit("next-statement", {
      statement:
        session.gameState.statements[session.gameState.currentStatementIndex],
      statementIndex: session.gameState.currentStatementIndex,
      totalStatements: session.gameState.statements.length,
    });
  }
}

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
