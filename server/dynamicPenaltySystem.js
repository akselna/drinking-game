class DynamicPenaltySystem {
  constructor() {
    this.history = [];
    this.penalties = {
      splitSplit: 3,
      splitSteal: 8,
      stealSteal: 10,
    };
  }

  recordRound(choice1, choice2) {
    this.history.push({ choice1, choice2 });
    if (this.history.length > 10) {
      this.history.shift();
    }
    this.updatePenalties();
  }

  updatePenalties() {
    const totalSteals = this.history.reduce((sum, round) => {
      return sum + (round.choice1 === 'STEAL' ? 1 : 0) + (round.choice2 === 'STEAL' ? 1 : 0);
    }, 0);
    const stealFraction = totalSteals / (2 * 10);
    const adjustment = Math.round(5 * stealFraction);
    this.penalties = {
      splitSplit: 3 + adjustment,
      splitSteal: 8 - adjustment,
      stealSteal: 10 + adjustment,
    };
  }

  getPenalties() {
    return { ...this.penalties };
  }
}

module.exports = DynamicPenaltySystem;
