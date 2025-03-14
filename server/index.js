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
const GAME_TYPES = {
  NONE: "none",
  NEVER_HAVE_I_EVER: "neverHaveIEver",
  MUSIC_GUESS: "musicGuess",
  DRINK_OR_JUDGE: "drinkOrJudge", // Added new game type
};

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

// Modify the "submit-never-statement" event handler to allow submissions during any phase
// Finn denne event handleren og erstatt den med denne oppdaterte versjonen:

// Modifiser moveToNextStatement for å bruke predefinerte spørsmål når man går tom for brukerspørsmål
// Finn denne funksjonen og erstatt den med:

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
    console.log(`Ran out of statements in session ${sessionId}`);

    // Check if there are any pending statements from users to use next
    if (
      session.gameState.pendingStatements &&
      session.gameState.pendingStatements.length > 0
    ) {
      console.log(
        `Using ${session.gameState.pendingStatements.length} pending user statements`
      );

      // Add pending statements to the main statements array
      session.gameState.statements = session.gameState.statements.concat(
        session.gameState.pendingStatements
      );

      // Clear the pending statements
      session.gameState.pendingStatements = [];

      // Reset the current index to point to the first new statement
      session.gameState.currentStatementIndex =
        session.gameState.statements.length -
        session.gameState.pendingStatements.length;
    }
    // If no pending statements, use predefined ones
    else {
      // Initialize used statements array if it doesn't exist
      if (!session.gameState.usedPredefinedStatements) {
        session.gameState.usedPredefinedStatements = [];
      }

      // Find statements that haven't been used recently
      const availableStatements = neverHaveIEverStatements.filter(
        (stmt) => !session.gameState.usedPredefinedStatements.includes(stmt)
      );

      // If we've used all statements or nearly all, reset the used list
      if (availableStatements.length < 5) {
        session.gameState.usedPredefinedStatements = [];
        console.log(`Reset used statements list for session ${sessionId}`);
      }

      // Get a random statement from the available ones
      const randomIndex = Math.floor(
        Math.random() *
          (availableStatements.length || neverHaveIEverStatements.length)
      );

      const statement = availableStatements.length
        ? availableStatements[randomIndex]
        : neverHaveIEverStatements[randomIndex];

      // Mark this statement as used
      session.gameState.usedPredefinedStatements.push(statement);

      // Add this predefined statement to the game
      session.gameState.statements.push({
        text: statement,
        author: "Spillet",
        authorId: "system",
        isPredefined: true,
      });

      console.log(
        `Added predefined statement: "${statement}" to session ${sessionId}`
      );

      // Reset the current index to show this new statement
      session.gameState.currentStatementIndex =
        session.gameState.statements.length - 1;
    }

    // Send the new statement to all players
    io.to(sessionId).emit("next-statement", {
      statement:
        session.gameState.statements[session.gameState.currentStatementIndex],
      statementIndex: session.gameState.currentStatementIndex,
      totalStatements: session.gameState.statements.length,
    });
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

    // Add this condition for our new game type
    else if (gameType === GAME_TYPES.DRINK_OR_JUDGE) {
      session.gameState = {
        phase: "statement", // Phases: statement, voting, results
        statements: [
          "Hvem i rommet ville vært dårligst til å overleve en zombieapokalypse?",
          "Hvem i rommet er mest sannsynlig til å bli berømt?",
          "Hvem i rommet er mest sannsynlig til å ende opp som statsminister?",
          "Hvem i rommet ville klart seg lengst i ødemarken?",
          "Hvem i rommet er mest sannsynlig til å bli rik?",
          "Hvem i rommet er mest sannsynlig til å gjøre noe flaut på jobb/skole?",
          "Hvem i rommet er mest sannsynlig til å bli arrestert?",
          "Hvem i rommet er mest sannsynlig til å gråte under en romantisk film?",
          "Hvem i rommet er mest sannsynlig til å miste telefonen sin?",
          "Hvem i rommet er mest sannsynlig til å glemme sin egen bursdag?",
          "Hvem i rommet er mest sannsynlig til å spørre om en selfie med en kjendis?",
          "Hvem i rommet er mest sannsynlig til å dra på festival uten billetter?",
          "Hvem i rommet er mest sannsynlig til å holde en tale uten forberedelse?",
          "Hvem i rommet er mest sannsynlig til å bli lurt av en svindler?",
          "Hvem i rommet er mest sannsynlig til å glemme hvem du er?",
          "Hvem i rommet er mest sannsynlig til å overleve en naturkatastrofe?",
          "Hvem i rommet er mest sannsynlig til å bruke en hel dag på sosiale medier?",
          "Hvem i rommet er mest sannsynlig til å forelske seg i en fremmed?",
          "Hvem i rommet er mest sannsynlig til å drikke for mye på et jobbparty?",
          "Hvem i rommet er mest sannsynlig til å få mat i hele ansiktet?",
          "Hvem i rommet er mest kverulerende?",
          "Hvem i rommet ville vært verst på en øde øy?",
          "Hvem i rommet er mest dramatisk?",
          "Hvem i rommet er mest sosial?",
          "Hvem i rommet er mest sta?",
          "Hvem i rommet er mest sannsynlig til å spise noe som har falt på bakken?",
          "Hvem i rommet er mest sannsynlig til å bli invitert på TV?",
        ],
        currentStatementIndex: 0,
        votes: {},
        results: [],
        usedStatements: [],
      };
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
    if (gameType === GAME_TYPES.NEVER_HAVE_I_EVER) {
      // Default statements in Norwegian
      const defaultStatements = [
        "sett nordlyset",
        "gått på ski",
        "badet i havet om vinteren",
        "reist utenfor Europa",
        "drukket for mye og angret dagen etter",
        "løyet til en venn for å slippe unna noe",
        "latet som jeg kjenner en kjendis",
        "stjålet noe",
        "kastet opp på en date",
        "kysset noen jeg nettopp møtte",
        "sendt en melding til feil person",
        "fått bot",
        "vært på blind date",
        "sunget karaoke foran andre mennesker",
        "danset på et bord",
      ];

      // Initialize the game state with default statements
      session.gameState = {
        phase: "collecting", // collecting or revealing
        statements: defaultStatements.map((statement) => ({
          text: statement,
          author: "Spillet",
          authorId: "system",
        })),
        currentStatementIndex: -1,
        responses: {},
        timer: 60, // Initial timer in seconds
      };
    } else if (gameType === GAME_TYPES.MUSIC_GUESS) {
      session.gameState = {
        phase: "topic-selection", // This is crucial - start at topic-selection phase
        topic: "",
        playerSongs: [],
        votes: {},
        revealedSongs: [],
      };
    }

    // Notify all players in the session about the game selection
    io.to(sessionId).emit("game-selected", {
      gameType,
      gameState: session.gameState,
    });
  });

  // Start next statement for Drink or Judge
  socket.on("drink-or-judge-next-statement", (sessionId) => {
    const session = sessions[sessionId];

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

    // If we've used all statements, reset the used statements list
    if (availableStatements.length === 0) {
      session.gameState.usedStatements = [];
      availableStatements.push(...session.gameState.statements);
    }

    // Pick a random statement
    const randomIndex = Math.floor(Math.random() * availableStatements.length);
    const nextStatement = availableStatements[randomIndex];

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

    // Shuffle the songs to randomize the order
    const shuffledSongs = [...session.gameState.playerSongs].sort(
      () => Math.random() - 0.5
    );
    session.gameState.playerSongs = shuffledSongs;

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

    // Calculate how many votes received
    const votesReceived = Object.keys(session.gameState.votes).length;
    const totalVoters = session.players.length;

    // Notify all players about the voting progress
    io.to(sessionId).emit("music-guess-vote-update", {
      votedCount: votesReceived,
      totalPlayers: totalVoters,
    });

    // If everyone except the song owner has voted, show results automatically
    // Find the current song owner
    const currentSong =
      session.gameState.playerSongs[session.gameState.currentSongIndex];
    const songOwnerId = currentSong?.selectedBy;

    // Count eligible voters (everyone except the song owner)
    const eligibleVoters = session.players.filter(
      (p) => p.id !== songOwnerId
    ).length;

    // If all eligible voters have voted, show results
    if (votesReceived >= eligibleVoters) {
      showMusicGuessResults(sessionId);
    }
  });

  // Music Guess - Force show results
  socket.on("music-guess-force-results", (sessionId) => {
    const session = sessions[sessionId];

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

    // Add the statement to the collection
    session.gameState.statements.push({
      text: statement,
      author: player.name,
      authorId: socket.id,
    });

    // Important change: Only emit statement-submitted, don't check for phase transition
    // This allows adding statements even during the revealing phase
    io.to(sessionId).emit("statement-submitted", {
      submittedCount:
        session.gameState.statements.length - defaultStatements.length, // Only count player statements
      totalPlayers: session.players.length,
    });

    // If all players have submitted during collecting phase AND we're still in collecting phase,
    // we can start revealing
    const totalStatements =
      session.gameState.statements.length - defaultStatements.length;
    const totalPlayers = session.players.length;

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

  // Shuffle the statements before revealing
  session.gameState.statements = shuffleArray(session.gameState.statements);

  // Start with the first statement
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

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Helper function to move to the next statement
// Modify the moveToNextStatement function to shuffle the statements if we're starting the game
function moveToNextStatement(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;

  // If this is the first statement (index was -1), shuffle the statements
  if (session.gameState.currentStatementIndex === -1) {
    session.gameState.statements = shuffleArray(session.gameState.statements);
  }

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
