// Placeholder for server/forraeder/routes.js
const express = require('express');
const router = express.Router();
const {
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
  assignTask,
  submitTask,
  checkWinConditions,
  FORRAEDER_PHASES,
  games // Direct access for MVP via HTTP, normally encapsulate more
} = require('./gameLogic');

// Middleware to simulate socket.io user context for HTTP for MVP
// In a real app with socket.io, playerId would come from socket session.
// For HTTP, we might pass it in body or as a header.
const getPlayerInfo = (req) => {
    // For MVP, let's assume playerId and playerName might be in request body or headers
    // This is a simplification. In a real app, this would be tied to auth/session.
    const playerId = req.body.playerId || req.headers['x-player-id'];
    const playerName = req.body.playerName || req.headers['x-player-name'] || 'Ukjent Spiller';
    const isHost = req.body.isHost || (req.headers['x-is-host'] === 'true'); // Simplistic host check
    return { playerId, playerName, isHost };
};


// --- Admin Routes ---

// Create a new game session (HTTP endpoint for MVP)
// Host (admin) initiates this.
router.post('/create', (req, res) => {
  const { playerId, playerName } = getPlayerInfo(req); // Assuming host info is passed
  if (!playerId) return res.status(400).json({ error: "Host playerId is required" });

  const game = createGame(playerId, playerName || `Host ${playerId}`);
  // In a socket.io app, you'd emit this to the host.
  // For HTTP, host gets the gameId to share.
  res.json({ message: "Game created successfully", gameId: game.id, initialGameState: game });
});

// Add a player to a game (could be admin adding, or player joining with a code)
router.post('/:gameId/join', (req, res) => {
    const { gameId } = req.params;
    const { playerId, playerName } = getPlayerInfo(req); // Player wanting to join

    if (!playerId || !playerName) {
        return res.status(400).json({ error: "playerId and playerName are required to join" });
    }
    const result = addPlayer(gameId, playerId, playerName);
    if (result.error) return res.status(400).json(result);
    res.json({ message: `${playerName} joined game ${gameId}`, gameState: result });
});

// Start the game and assign roles (Admin action)
router.post('/:gameId/start', (req, res) => {
  const { gameId } = req.params;
  // Potentially add host check here if needed for HTTP
  const result = assignRoles(gameId);
  if (result.error) return res.status(400).json(result);
  // Emit to all players in a socket app: io.to(gameId).emit('forraeder-game-started', result);
  res.json({ message: "Game started, roles assigned.", gameState: result });
});

// Set game phase (Admin action)
router.post('/:gameId/phase', (req, res) => {
  const { gameId } = req.params;
  const { phase } = req.body; // e.g., "OPPDRAG", "DISKUSJON"
  if (!phase) return res.status(400).json({ error: "Phase is required" });

  const result = setGamePhase(gameId, phase);
  if (result.error) return res.status(400).json(result);

  let postPhaseActionGameState = result;
  let winCheck = { gameOver: false };

  // Perform actions based on new phase
  if (phase === FORRAEDER_PHASES.NATT) {
      // After voting, tally votes and eliminate before officially moving to night
      // Or, admin reviews votes and then moves to NATT
      // For this HTTP version, let's assume tally is an explicit step or phase.
  } else if (phase === FORRAEDER_PHASES.OPPDRAG) { // Moving to a new day
      // This implies night has finished. Process night's results.
      const nightOutcome = processNightPhase(gameId);
      if (nightOutcome.error) return res.status(400).json(nightOutcome);
      postPhaseActionGameState = nightOutcome; // game state after night processing
      winCheck = checkWinConditions(gameId);
      if (winCheck.gameOver) {
          postPhaseActionGameState.winner = winCheck.winner;
          postPhaseActionGameState.reason = winCheck.reason;
      }
  }

  // Emit to all: io.to(gameId).emit('forraeder-phase-changed', postPhaseActionGameState);
  res.json({ message: `Game phase set to ${phase}`, gameState: postPhaseActionGameState, winCondition: winCheck });
});

// Endpoint for admin to tally votes and eliminate player
router.post('/:gameId/tally-votes', (req, res) => {
    const { gameId } = req.params;
    // Add host check if necessary
    const result = tallyVotesAndEliminate(gameId);
    if (result.error) return res.status(400).json(result);

    const winCheck = checkWinConditions(gameId);
     if (winCheck.gameOver) {
        result.winner = winCheck.winner;
        result.reason = winCheck.reason;
    }
    // Emit to all: io.to(gameId).emit('forraeder-player-eliminated', result);
    res.json({ message: "Votes tallied. Player elimination processed.", gameState: result, winCondition: winCheck });
});


// Send a common message from admin (Admin action)
router.post('/:gameId/admin-message', (req, res) => {
  const { gameId } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message text is required" });

  const result = sendAdminMessage(gameId, message);
  if (result.error) return res.status(400).json(result);
  // Emit to all: io.to(gameId).emit('forraeder-admin-message-received', { gameId, message });
  res.json({ message: "Admin message sent.", gameState: result });
});

// Get full game state for admin
router.get('/:gameId/admin/state', (req, res) => {
    const { gameId } = req.params;
    // Add host check if necessary
    const gameState = getAdminGameState(gameId);
    if (gameState.error) return res.status(404).json(gameState);
    res.json(gameState);
});


// --- Player Routes ---

// Get current game state for a specific player
router.get('/:gameId/state/:playerId', (req, res) => {
  const { gameId, playerId } = req.params;
  const gameState = getGameState(gameId, playerId);
  if (gameState.error) return res.status(404).json(gameState);
  res.json(gameState);
});

// Submit a vote (Player action)
router.post('/:gameId/vote', (req, res) => {
  const { gameId } = req.params;
  const { voterId, votedPlayerId } = req.body; // voterId should be the authenticated player
  if (!voterId || !votedPlayerId) return res.status(400).json({ error: "voterId and votedPlayerId are required" });

  // Here, ensure voterId matches the authenticated user if auth was in place.
  // const { playerId } = getPlayerInfo(req);
  // if (playerId !== voterId) return res.status(403).json({ error: "PlayerId mismatch."})

  const result = submitVote(gameId, voterId, votedPlayerId);
  if (result.error) return res.status(400).json(result);
  // Emit to admin/all for vote count update: io.to(gameId).emit('forraeder-vote-update', { gameId, voterId });
  res.json({ message: `Vote by ${voterId} for ${votedPlayerId} recorded.`, gameState: result });
});

// Forræder action during night (Player action, only for Forrædere)
router.post('/:gameId/traitor-action', (req, res) => {
  const { gameId } = req.params;
  // const { playerId } = getPlayerInfo(req); // Authenticated traitor
  const { traitorId, targetPlayerId } = req.body; // traitorId is the one performing action
   if (!traitorId || !targetPlayerId) return res.status(400).json({ error: "traitorId and targetPlayerId are required" });

  const result = recordTraitorAction(gameId, traitorId, targetPlayerId);
  if (result.error) return res.status(400).json(result);
  // Emit to other traitors or admin: socket.emit('forraeder-traitor-action-recorded', result);
  res.json({ message: "Traitor action recorded.", gameState: result });
});


// --- MVP Task Routes (Simplified for HTTP, would use socket for real-time updates) ---

// Assign a task to a player (Admin action)
router.post('/:gameId/task/assign', (req, res) => {
    const { gameId } = req.params;
    const { playerId, taskDescription } = req.body;
    if (!playerId || !taskDescription) {
        return res.status(400).json({ error: "playerId and taskDescription are required" });
    }
    // Add host/admin check
    const result = assignTask(gameId, playerId, taskDescription);
    if (result.error) return res.status(400).json(result);
    // In a socket app, you might emit this specifically to the player:
    // const playerSocket = getSocketByPlayerId(playerId); if (playerSocket) playerSocket.emit('forraeder-task-assigned', { taskDescription });
    res.json({ message: `Task assigned to ${playerId}`, gameState: result });
});

// Player submits their task completion
router.post('/:gameId/task/submit', (req, res) => {
    const { gameId } = req.params;
    const { playerId, submissionContent } = req.body; // playerId is the one submitting
    if (!playerId || !submissionContent) {
        return res.status(400).json({ error: "playerId and submissionContent are required" });
    }
    const result = submitTask(gameId, playerId, submissionContent);
    if (result.error) return res.status(400).json(result);
    // Emit to admin or all for updates: io.to(gameId).emit('forraeder-task-submitted', { playerId, submissionContent, newTotalPoints: result.totalPoints });
    res.json({ message: `Task submission by ${playerId} received.`, gameState: result });
});

// --- DEBUG/Helper route for MVP to see all game states ---
if (process.env.NODE_ENV !== 'production') { // Only in non-production environments
    router.get('/all-games-debug', (req, res) => {
        res.json(games);
    });
}


module.exports = router;
