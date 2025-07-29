// splitOrStealGameEngine.js
// Game logic utilities for Split or Steal

/**
 * Randomly pair players for a duel
 * @param {Array} participants - Array of participant objects {id, name}
 * @returns {Object|null} - {player1, player2} or null if insufficient players
 */
function pairPlayers(participants) {
  // Filter out players who might be disconnected or invalid. The list of
  // participants should already contain only the players that were manually
  // configured by the host.
  const availablePlayers = participants.filter((p) => p && p.id && p.name);

  console.log(
    `Pairing players - Available: ${availablePlayers.length}`,
    availablePlayers
  );

  if (availablePlayers.length < 2) {
    console.log("Not enough players to pair");
    return null;
  }

  // Shuffle the array to get random pairing
  const shuffled = [...availablePlayers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const pair = {
    player1: shuffled[0],
    player2: shuffled[1],
  };

  console.log("Created pair:", pair);

  return pair;
}

/**
 * Calculate results based on player choices
 * @param {Object} player1 - First player object
 * @param {Object} player2 - Second player object
 * @param {string} choice1 - 'SPLIT' or 'STEAL'
 * @param {string} choice2 - 'SPLIT' or 'STEAL'
 * @returns {Object} - Results with points and outcome message
 */
function calculateResults(player1, player2, choice1, choice2) {
  let player1Points = 0;
  let player2Points = 0;
  let outcomeMessage = ""; // This will now be empty
  let drinkingPenalty = [];

  if (choice1 === "SPLIT" && choice2 === "SPLIT") {
    // Both players split - each gets 2 points
    player1Points = 2;
    player2Points = 2;
  } else if (choice1 === "STEAL" && choice2 === "STEAL") {
    // Both players steal - nobody gets points, both drink
    player1Points = 0;
    player2Points = 0;
    drinkingPenalty = [player1.id, player2.id];
  } else {
    // One splits, one steals - stealer gets all points, splitter drinks
    if (choice1 === "STEAL" && choice2 === "SPLIT") {
      player1Points = 4;
      player2Points = 0;
      drinkingPenalty = [player2.id];
    } else {
      // (choice1 === "SPLIT" && choice2 === "STEAL")
      player1Points = 0;
      player2Points = 4;
      drinkingPenalty = [player1.id];
    }
  }

  return {
    player1Points,
    player2Points,
    outcomeMessage, // Will be an empty string
    drinkingPenalty,
    choices: {
      [player1.id]: choice1,
      [player2.id]: choice2,
    },
  };
}

/**
 * Update leaderboard with new points
 * @param {Object} leaderboard - Current leaderboard {playerId: points}
 * @param {string} player1Id - First player ID
 * @param {string} player2Id - Second player ID
 * @param {number} player1Points - Points for player 1
 * @param {number} player2Points - Points for player 2
 * @returns {Object} - Updated leaderboard
 */
function updateLeaderboard(
  leaderboard,
  player1Id,
  player2Id,
  player1Points,
  player2Points
) {
  const newLeaderboard = { ...leaderboard };

  // Initialize players if they don't exist in leaderboard
  if (!newLeaderboard[player1Id]) {
    newLeaderboard[player1Id] = 0;
  }
  if (!newLeaderboard[player2Id]) {
    newLeaderboard[player2Id] = 0;
  }

  // Add points
  newLeaderboard[player1Id] += player1Points;
  newLeaderboard[player2Id] += player2Points;

  return newLeaderboard;
}

/**
 * Get sorted leaderboard for display
 * @param {Object} leaderboard - Current leaderboard {playerId: points}
 * @param {Array} allPlayers - All players in session for name lookup
 * @returns {Array} - Sorted array of {id, name, points}
 */
function getSortedLeaderboard(leaderboard, allPlayers) {
  return Object.entries(leaderboard)
    .map(([playerId, points]) => {
      const player = allPlayers.find((p) => p.id === playerId);
      return {
        id: playerId,
        name: player ? player.name : "Unknown",
        points: points,
      };
    })
    .sort((a, b) => b.points - a.points);
}

/**
 * Calculate dynamic drinking penalties based on recent history
 * @param {Array} history - Array of {choice1, choice2}
 * @param {number} [maxRounds=10] - How many rounds to keep in history
 * @returns {Object} - {splitSplit, splitSteal, stealSteal, stealFraction}
 */
function calculatePenalties(history = [], maxRounds = 10) {
  const recent = history.slice(-maxRounds);
  const totalChoices = recent.length * 2;
  let stealCount = 0;
  let splitCount = 0;
  for (const round of recent) {
    if (round.choice1 === "STEAL") stealCount++;
    if (round.choice2 === "STEAL") stealCount++;
    if (round.choice1 === "SPLIT") splitCount++;
    if (round.choice2 === "SPLIT") splitCount++;
  }

  const stealFraction = totalChoices > 0 ? stealCount / totalChoices : 0;
  const splitFraction = totalChoices > 0 ? splitCount / totalChoices : 0;

  const stealDelta = Math.round(5 * stealFraction);
  const splitDelta = Math.round(5 * splitFraction);

  return {
    // Increase Cheers/Cheers penalty when splits dominate
    splitSplit: 3 + splitDelta,
    // Make stealing less attractive when many steal
    splitSteal: 8 - stealDelta,
    // Punish Tears/Tears heavily if stealing is common
    stealSteal: 10 + stealDelta,
    stealFraction,
    splitFraction,
  };
}

module.exports = {
  pairPlayers,
  calculateResults,
  updateLeaderboard,
  getSortedLeaderboard,
  calculatePenalties,
};
