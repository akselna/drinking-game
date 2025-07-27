// Basic game engine utilities for Split or Steal

function pairPlayers(players) {
  const shuffled = players.slice().sort(() => Math.random() - 0.5);
  const pairs = [];
  while (shuffled.length > 1) {
    const a = shuffled.shift();
    const b = shuffled.shift();
    pairs.push([a, b]);
  }
  if (shuffled.length === 1) {
    pairs.push([shuffled.shift(), null]);
  }
  return pairs;
}

function calculateResults(pairs, choices) {
  return pairs.map(([a, b]) => {
    if (!b) {
      return { pair: [a], outcome: 'solo', sips: {} };
    }
    const cA = choices[a.id];
    const cB = choices[b.id];
    let outcome = '';
    const sips = {};
    if (cA === 'split' && cB === 'split') {
      outcome = 'split-split';
      sips[a.id] = 1;
      sips[b.id] = 1;
    } else if (cA === 'split' && cB === 'steal') {
      outcome = 'split-steal';
      sips[a.id] = 3;
      sips[b.id] = 0;
    } else if (cA === 'steal' && cB === 'split') {
      outcome = 'steal-split';
      sips[a.id] = 0;
      sips[b.id] = 3;
    } else {
      outcome = 'steal-steal';
      sips[a.id] = 2;
      sips[b.id] = 2;
    }
    return { pair: [a, b], outcome, sips };
  });
}

function updateLeaderboard(leaderboard, results) {
  results.forEach((res) => {
    Object.entries(res.sips).forEach(([id, s]) => {
      if (!leaderboard[id]) {
        leaderboard[id] = { sips: 0, steals: 0, splits: 0 };
      }
      leaderboard[id].sips += s;
    });
    if (res.outcome === 'split-steal') {
      const [a, b] = res.pair;
      leaderboard[b.id].steals = (leaderboard[b.id].steals || 0) + 1;
      leaderboard[a.id].splits = (leaderboard[a.id].splits || 0) + 1;
    } else if (res.outcome === 'steal-split') {
      const [a, b] = res.pair;
      leaderboard[a.id].steals = (leaderboard[a.id].steals || 0) + 1;
      leaderboard[b.id].splits = (leaderboard[b.id].splits || 0) + 1;
    } else if (res.outcome === 'split-split') {
      const [a, b] = res.pair;
      leaderboard[a.id].splits = (leaderboard[a.id].splits || 0) + 1;
      leaderboard[b.id].splits = (leaderboard[b.id].splits || 0) + 1;
    }
  });
  return leaderboard;
}

module.exports = { pairPlayers, calculateResults, updateLeaderboard };
