const ROUND_HISTORY = [];

function calculatePenalties(history) {
  const recent = history.slice(-10); // last 10 rounds
  const totalSteals = recent.reduce((acc, r) => acc + r.steals, 0);
  const stealFraction = recent.length ? totalSteals / (recent.length * 2) : 0;
  const adjustment = Math.round(5 * stealFraction);
  return {
    splitSplit: 3 + adjustment,
    splitSteal: 8 - adjustment,
    stealSteal: 10 + adjustment,
  };
}

function evaluateRound(choice1, choice2, penalties) {
  let sips1 = 0;
  let sips2 = 0;

  if (choice1 === 'CHEERS' && choice2 === 'CHEERS') {
    sips1 = penalties.splitSplit;
    sips2 = penalties.splitSplit;
  } else if (choice1 === 'TEARS' && choice2 === 'TEARS') {
    sips1 = penalties.stealSteal;
    sips2 = penalties.stealSteal;
  } else if (choice1 === 'TEARS' && choice2 === 'CHEERS') {
    sips1 = 0;
    sips2 = penalties.splitSteal;
  } else if (choice1 === 'CHEERS' && choice2 === 'TEARS') {
    sips1 = penalties.splitSteal;
    sips2 = 0;
  }

  return { sips1, sips2 };
}

function randomChoice() {
  return Math.random() < 0.5 ? 'CHEERS' : 'TEARS';
}

function runGame(rounds = 20) {
  for (let round = 1; round <= rounds; round++) {
    const penalties = calculatePenalties(ROUND_HISTORY);
    console.log(`\nRound ${round}`);
    console.log(
      `Current penalties - Cheers/Cheers: ${penalties.splitSplit} sips each, ` +
        `Cheers/Tears: ${penalties.splitSteal} sips for the cheerer, 0 for the tearer, ` +
        `Tears/Tears: ${penalties.stealSteal} sips each`
    );

    const choice1 = randomChoice();
    const choice2 = randomChoice();
    const { sips1, sips2 } = evaluateRound(choice1, choice2, penalties);

    console.log(
      `Choices - Player1: ${choice1}, Player2: ${choice2} -> ` +
        `Player1 drinks ${sips1}, Player2 drinks ${sips2}`
    );

    const steals = (choice1 === 'TEARS') + (choice2 === 'TEARS');
    ROUND_HISTORY.push({ steals });
    if (ROUND_HISTORY.length > 10) ROUND_HISTORY.shift();
  }
}

if (require.main === module) {
  const rounds = parseInt(process.argv[2] || '20', 10);
  runGame(rounds);
}
