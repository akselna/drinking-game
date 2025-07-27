// Simple game engine for Split or Steal
// Keeps state for pairings, choices and leaderboard

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function initGame(players, totalRounds = 3) {
  const leaderboard = {};
  players.forEach((p) => {
    leaderboard[p.id] = { sips: 0, steals: 0, splits: 0 };
  });

  return {
    phase: 'setup',
    round: 0,
    totalRounds,
    pairs: [],
    choices: {},
    leaderboard,
    results: [],
  };
}

function pairPlayers(players) {
  const shuffled = shuffle([...players]);
  const pairs = [];
  while (shuffled.length >= 2) {
    const a = shuffled.pop();
    const b = shuffled.pop();
    pairs.push([a.id, b.id]);
  }
  // If odd, last player sits out
  if (shuffled.length === 1) {
    pairs.push([shuffled.pop().id, null]);
  }
  return pairs;
}

function calculateResults(state) {
  const pairResults = [];
  state.pairs.forEach(([a, b]) => {
    if (!b) return; // skip odd player
    const choiceA = state.choices[a];
    const choiceB = state.choices[b];
    let aSips = 0;
    let bSips = 0;
    if (choiceA === 'SPLIT' && choiceB === 'SPLIT') {
      aSips = bSips = 1;
    } else if (choiceA === 'SPLIT' && choiceB === 'STEAL') {
      aSips = 3;
    } else if (choiceA === 'STEAL' && choiceB === 'SPLIT') {
      bSips = 3;
    } else {
      aSips = bSips = 2;
    }
    pairResults.push({ a, b, choiceA, choiceB, aSips, bSips });
  });
  return pairResults;
}

function updateLeaderboard(state, results) {
  results.forEach((r) => {
    const lA = state.leaderboard[r.a];
    const lB = state.leaderboard[r.b];
    if (lA) {
      lA.sips += r.aSips;
      if (r.choiceA === 'STEAL') lA.steals += 1;
      if (r.choiceA === 'SPLIT') lA.splits += 1;
    }
    if (lB) {
      lB.sips += r.bSips;
      if (r.choiceB === 'STEAL') lB.steals += 1;
      if (r.choiceB === 'SPLIT') lB.splits += 1;
    }
  });
  return state.leaderboard;
}

module.exports = {
  initGame,
  pairPlayers,
  calculateResults,
  updateLeaderboard,
};
