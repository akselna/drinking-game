// splitOrStealGameEngine.js
// Game logic utilities for Split or Steal

/**
 * Randomly pair players for a duel
 * @param {Array} participants - Array of participant objects {id, name}
 * @returns {Object|null} - {player1, player2} or null if insufficient players
 */
function pairPlayers(participants) {
  // Filter out players who might be disconnected or invalid. Also ensure
  // non-player entities like a host or a shared controller are excluded.
  const availablePlayers = participants.filter(
    (p) =>
      p &&
      p.id &&
      p.name &&
      !["host", "control device"].includes(p.name.toLowerCase())
  );

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
  let outcomeMessage = "";
  let drinkingPenalty = [];

  if (choice1 === "SPLIT" && choice2 === "SPLIT") {
    // Both players split - each gets 2 points
    player1Points = 2;
    player2Points = 2;
    outcomeMessage = `${player1.name} and ${player2.name} both chose to SPLIT! They each get 2 points! 🤝`;
  } else if (choice1 === "STEAL" && choice2 === "STEAL") {
    // Both players steal - nobody gets points, both drink
    player1Points = 0;
    player2Points = 0;
    outcomeMessage = `${player1.name} and ${player2.name} both chose to STEAL! Nobody gets points and both must drink! 🍺`;
    drinkingPenalty = [player1.id, player2.id];
  } else {
    // One splits, one steals - stealer gets all points, splitter drinks
    if (choice1 === "STEAL" && choice2 === "SPLIT") {
      player1Points = 4;
      player2Points = 0;
      outcomeMessage = `${player1.name} STOLE from ${player2.name}! ${player1.name} gets 4 points, ${player2.name} must drink! 💰`;
      drinkingPenalty = [player2.id];
    } else {
      player1Points = 0;
      player2Points = 4;
      outcomeMessage = `${player2.name} STOLE from ${player1.name}! ${player2.name} gets 4 points, ${player1.name} must drink! 💰`;
      drinkingPenalty = [player1.id];
    }
  }

  return {
    player1Points,
    player2Points,
    outcomeMessage,
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

module.exports = {
  pairPlayers,
  calculateResults,
  updateLeaderboard,
  getSortedLeaderboard,
};
