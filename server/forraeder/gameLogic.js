// Placeholder for server/forraeder/gameLogic.js

const games = {}; // In-memory store for game states. For MVP. Consider a database for persistence.

const FORRAEDER_PHASES = {
  SETUP: 'setup', // Initial phase, waiting for players, roles not assigned
  OPPDRAG: 'oppdrag', // Day phase: players get tasks
  DISKUSJON: 'diskusjon', // Discussion phase
  AVSTEMNING: 'avstemning', // Voting phase
  NATT: 'natt', // Night phase: traitors act
  AVSLUTTET: 'avsluttet', // Game has ended
};

// Helper to generate unique IDs (simple version for MVP)
const generateId = () => Math.random().toString(36).substring(2, 10);

const createGame = (hostId, hostName) => {
  const gameId = generateId();
  games[gameId] = {
    id: gameId,
    hostId: hostId,
    players: [{ id: hostId, name: hostName, role: null, isAlive: true, votesFor: 0 }],
    phase: FORRAEDER_PHASES.SETUP,
    roles: { forraedere: [], lojale: [] }, // Store IDs of players in roles
    totalPoints: 0,
    messages: [], // Admin messages
    tasks: {}, // Player specific tasks { playerId: taskDescription }
    submissions: {}, // { playerId: submissionContent }
    votes: {}, // { voterId: votedPlayerId }
    eliminatedPlayer: null, // Stores the player eliminated in the current round
    killedPlayer: null, // Stores the player killed in the current night phase
    createdAt: new Date().toISOString(),
    // Add more game-specific state as needed
  };
  console.log(`Forraeder game created: ${gameId} by host ${hostName} (${hostId})`);
  return games[gameId];
};

const addPlayer = (gameId, playerId, playerName) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  if (game.phase !== FORRAEDER_PHASES.SETUP) return { error: "Game has already started" };
  if (game.players.find(p => p.id === playerId || p.name === playerName)) return { error: "Player already in game or name taken" };

  game.players.push({ id: playerId, name: playerName, role: null, isAlive: true, votesFor: 0 });
  console.log(`Player ${playerName} (${playerId}) joined game ${gameId}`);
  return game;
};

const assignRoles = (gameId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  if (game.players.length < 3) return { error: "Not enough players to assign roles (min 3)" }; // Example minimum

  // Determine number of traitors (e.g., 1 for 3-5 players, 2 for 6-8, etc. - simplified for MVP)
  let numForraedere = 1;
  if (game.players.length >= 6) numForraedere = 2;
  if (game.players.length >= 9) numForraedere = 3; // Max 3 for now

  const playerIds = game.players.map(p => p.id);
  const shuffledPlayerIds = [...playerIds].sort(() => 0.5 - Math.random());

  const forraederIds = shuffledPlayerIds.slice(0, numForraedere);
  const lojalIds = shuffledPlayerIds.slice(numForraedere);

  game.roles.forraedere = forraederIds;
  game.roles.lojale = lojalIds;

  game.players.forEach(player => {
    if (forraederIds.includes(player.id)) {
      player.role = 'Forræder';
    } else {
      player.role = 'Lojal';
    }
  });

  game.phase = FORRAEDER_PHASES.OPPDRAG; // Move to first phase after roles
  console.log(`Roles assigned in game ${gameId}. Forrædere: ${numForraedere}`);
  return game;
};

const setGamePhase = (gameId, phase) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  if (!Object.values(FORRAEDER_PHASES).includes(phase)) return { error: "Invalid phase" };

  game.phase = phase;
  console.log(`Game ${gameId} phase changed to ${phase}`);

  // Reset round-specific data when moving to certain phases
  if (phase === FORRAEDER_PHASES.OPPDRAG) {
    game.votes = {};
    game.eliminatedPlayer = null;
    game.killedPlayer = null;
    game.players.forEach(p => p.votesFor = 0);
    // Potentially assign new tasks here
  }
  if (phase === FORRAEDER_PHASES.AVSTEMNING) {
      game.votes = {}; // Reset votes for the new voting round
      game.players.forEach(p => p.votesFor = 0);
  }
  if (phase === FORRAEDER_PHASES.NATT) {
    // Reset night action for traitors
    game.traitorNightAction = null;
  }

  return game;
};

const submitVote = (gameId, voterId, votedPlayerId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  if (game.phase !== FORRAEDER_PHASES.AVSTEMNING) return { error: "Not in voting phase" };

  const voter = game.players.find(p => p.id === voterId);
  if (!voter || !voter.isAlive) return { error: "Voter not found or not alive" };
  if (game.votes[voterId]) return { error: "Voter has already voted" };

  const votedPlayer = game.players.find(p => p.id === votedPlayerId);
  if (!votedPlayer || !votedPlayer.isAlive) return { error: "Voted player not found or not alive" };

  game.votes[voterId] = votedPlayerId;
  console.log(`Player ${voter.name} voted for ${votedPlayer.name} in game ${gameId}`);
  return game;
};

const tallyVotesAndEliminate = (gameId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  // Should be called after AVSTEMNING phase or when admin triggers it

  const voteCounts = {};
  game.players.forEach(p => voteCounts[p.id] = 0);

  for (const voterId in game.votes) {
    const votedPlayerId = game.votes[voterId];
    if (voteCounts[votedPlayerId] !== undefined) {
      voteCounts[votedPlayerId]++;
    }
  }

  game.players.forEach(p => p.votesFor = voteCounts[p.id] || 0);


  let maxVotes = 0;
  let playersToEliminate = [];
  for (const playerId in voteCounts) {
    if (voteCounts[playerId] > maxVotes) {
      maxVotes = voteCounts[playerId];
      playersToEliminate = [playerId];
    } else if (voteCounts[playerId] === maxVotes && maxVotes > 0) {
      playersToEliminate.push(playerId);
    }
  }

  if (playersToEliminate.length === 1) {
    const eliminatedPlayerId = playersToEliminate[0];
    const player = game.players.find(p => p.id === eliminatedPlayerId);
    if (player) {
      player.isAlive = false;
      game.eliminatedPlayer = { id: player.id, name: player.name, role: player.role };
      console.log(`Player ${player.name} eliminated in game ${gameId}. Role: ${player.role}`);
    }
  } else if (playersToEliminate.length > 1) {
    // Handle tie - for MVP, maybe no one is eliminated, or random, or admin decides.
    // For now, let's say no one is eliminated on a tie to keep it simple.
    game.eliminatedPlayer = { tiedVote: true, playersInvolved: playersToEliminate.map(id => game.players.find(p=>p.id===id)?.name) };
    console.log(`Tie in voting in game ${gameId}. No one eliminated (MVP behavior).`);
  } else {
    game.eliminatedPlayer = { noMajority: true };
    console.log(`No majority vote in game ${gameId}. No one eliminated.`);
  }

  // game.phase = FORRAEDER_PHASES.NATT; // Or admin moves to next phase
  return game;
};

const recordTraitorAction = (gameId, traitorId, targetPlayerId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  if (game.phase !== FORRAEDER_PHASES.NATT) return { error: "Not in night phase" };

  const traitor = game.players.find(p => p.id === traitorId);
  if (!traitor || traitor.role !== 'Forræder' || !traitor.isAlive) return { error: "Invalid traitor or traitor not alive" };

  const target = game.players.find(p => p.id === targetPlayerId);
  if (!target || !target.isAlive || target.role === 'Forræder') return { error: "Invalid target or target is a traitor/not alive" };

  // In MVP, one traitor can make the decision. If multiple, they need to coordinate.
  // For now, we'll just record the first valid action.
  // A more complex system would involve a separate voting/agreement step for traitors.
  game.traitorNightAction = { traitorId, targetPlayerId, targetName: target.name };
  console.log(`Traitor ${traitor.name} targeted ${target.name} for elimination in game ${gameId}`);
  return game;
};

const processNightPhase = (gameId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };
  // Should be called after NATT phase or when admin triggers it

  if (game.traitorNightAction) {
    const targetPlayer = game.players.find(p => p.id === game.traitorNightAction.targetPlayerId);
    if (targetPlayer) {
      targetPlayer.isAlive = false;
      game.killedPlayer = { id: targetPlayer.id, name: targetPlayer.name, role: targetPlayer.role };
      console.log(`Player ${targetPlayer.name} was killed during the night in game ${gameId}. Role: ${targetPlayer.role}`);
    }
  } else {
    game.killedPlayer = { noKill: true };
    console.log(`No player was killed during the night in game ${gameId}.`);
  }
  game.traitorNightAction = null; // Reset for next night
  // game.phase = FORRAEDER_PHASES.OPPDRAG; // Or admin moves to next phase
  return game;
};


const sendAdminMessage = (gameId, messageText) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };

  const message = {
    id: generateId(),
    text: messageText,
    timestamp: new Date().toISOString(),
    sender: 'Administrator'
  };
  game.messages.push(message);
  console.log(`Admin message sent in game ${gameId}: "${messageText}"`);
  return game; // Return the updated game state, including the new message
};


const getGameState = (gameId, playerId) => {
  const game = games[gameId];
  if (!game) return { error: "Game not found" };

  const player = game.players.find(p => p.id === playerId);
  if (!player) return { error: "Player not found in this game" };

  // Customize what information is sent to the player
  // For example, only their own role, not others' unless revealed.
  const { roles, ...gameCommonState } = game; // Exclude detailed roles list from player state

  return {
    ...gameCommonState,
    myRole: player.role,
    isAlive: player.isAlive,
    // Only send specific parts of the full game state relevant to this player
    players: game.players.map(p => ({ // Send a sanitized list of players
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        // role: (p.id === playerId || !p.isAlive) ? p.role : 'Ukjent', // Reveal role if it's me or if player is dead
        votesFor: p.votesFor || 0, // How many votes this player has received
    })),
    // If it's night and player is a traitor, they might get special info
    // For MVP, this is handled by admin communication or a separate channel if implemented
  };
};

const getAdminGameState = (gameId) => {
    const game = games[gameId];
    if (!game) return { error: "Game not found" };
    // Admin gets the full state, including all roles
    return game;
};


// --- MVP Task and Submission Logic (very simplified) ---
const assignTask = (gameId, playerId, taskDescription) => {
    const game = games[gameId];
    if (!game) return { error: "Game not found" };
    if (game.phase !== FORRAEDER_PHASES.OPPDRAG) return { error: "Not in task phase" };

    game.tasks[playerId] = taskDescription;
    console.log(`Task assigned to player ${playerId} in game ${gameId}: ${taskDescription}`);
    return game;
};

const submitTask = (gameId, playerId, submissionContent) => {
    const game = games[gameId];
    if (!game) return { error: "Game not found" };
    if (game.phase !== FORRAEDER_PHASES.OPPDRAG) return { error: "Not in task phase" };
    if (!game.tasks[playerId]) return { error: "No task assigned to this player" };

    game.submissions[playerId] = submissionContent;
    // For MVP, let's say completing a task adds 10 points.
    // This would be more complex with validation in a full version.
    game.totalPoints += 10;
    console.log(`Task submission from player ${playerId} in game ${gameId}. New total points: ${game.totalPoints}`);
    return game;
};


// --- Game End Condition Check ---
const checkWinConditions = (gameId) => {
    const game = games[gameId];
    if (!game) return { error: "Game not found" };

    const alivePlayers = game.players.filter(p => p.isAlive);
    const aliveForraedere = alivePlayers.filter(p => p.role === 'Forræder');
    const aliveLojale = alivePlayers.filter(p => p.role === 'Lojal');

    if (aliveForraedere.length === 0) {
        game.phase = FORRAEDER_PHASES.AVSLUTTET;
        game.winner = 'Lojale';
        console.log(`Game ${gameId} ended. Lojale win!`);
        return { gameOver: true, winner: 'Lojale', reason: "Alle forrædere er eliminert." };
    }

    if (aliveForraedere.length >= aliveLojale.length) {
        game.phase = FORRAEDER_PHASES.AVSLUTTET;
        game.winner = 'Forrædere';
        console.log(`Game ${gameId} ended. Forrædere win!`);
        return { gameOver: true, winner: 'Forrædere', reason: "Forræderne er i flertall eller likt antall med lojale." };
    }

    return { gameOver: false };
};


module.exports = {
  createGame,
  addPlayer,
  assignRoles,
  setGamePhase,
  submitVote,
  tallyVotesAndEliminate,
  recordTraitorAction,
  processNightPhase,
  sendAdminMessage,
  getGameState,
  getAdminGameState,
  assignTask, // MVP
  submitTask, // MVP
  checkWinConditions,
  FORRAEDER_PHASES,
  games, // Exposing for direct manipulation in routes for MVP, not ideal for production
};
