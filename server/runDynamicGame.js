const DynamicPenaltySystem = require('./dynamicPenaltySystem');

const system = new DynamicPenaltySystem();

function playRound(round, choice1, choice2) {
  system.recordRound(choice1, choice2);
  const penalties = system.getPenalties();
  let penalty1 = 0;
  let penalty2 = 0;

  if (choice1 === 'SPLIT' && choice2 === 'SPLIT') {
    penalty1 = penalty2 = penalties.splitSplit;
  } else if (choice1 === 'STEAL' && choice2 === 'STEAL') {
    penalty1 = penalty2 = penalties.stealSteal;
  } else if (choice1 === 'STEAL' && choice2 === 'SPLIT') {
    penalty1 = 0;
    penalty2 = penalties.splitSteal;
  } else if (choice1 === 'SPLIT' && choice2 === 'STEAL') {
    penalty1 = penalties.splitSteal;
    penalty2 = 0;
  }

  console.log(`Round ${round}`);
  console.log(`  Player1: ${choice1}, Player2: ${choice2}`);
  console.log(`  Penalties:`);
  console.log(`    Split/Split: ${penalties.splitSplit}`);
  console.log(`    Split/Steal: ${penalties.splitSteal}`);
  console.log(`    Steal/Steal: ${penalties.stealSteal}`);
  console.log(`  Sips -> P1: ${penalty1}, P2: ${penalty2}`);
  console.log('');
}

// Example simulation
const rounds = [
  ['SPLIT', 'SPLIT'],
  ['STEAL', 'SPLIT'],
  ['STEAL', 'STEAL'],
  ['SPLIT', 'SPLIT'],
  ['STEAL', 'SPLIT'],
  ['SPLIT', 'STEAL'],
  ['STEAL', 'STEAL'],
  ['SPLIT', 'SPLIT'],
  ['SPLIT', 'SPLIT'],
  ['STEAL', 'SPLIT'],
  ['STEAL', 'STEAL'],
];

rounds.forEach((choices, idx) => {
  playRound(idx + 1, choices[0], choices[1]);
});
