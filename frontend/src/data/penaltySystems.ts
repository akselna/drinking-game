export type PenaltyMode = "party" | "casual" | "blackout";

export interface PenaltySystem {
  splitSplit: string; // penalty for each player when both split
  splitSteal: { splitter: string; stealer: string }; // penalty when one splits
  stealSteal: string; // penalty for each player when both steal
}

export const PENALTY_SYSTEMS: Record<PenaltyMode, PenaltySystem> = {
  party: {
    splitSplit: "5 sips",
    splitSteal: { splitter: "10 sips", stealer: "none" },
    stealSteal: "20 sips",
  },
  casual: {
    splitSplit: "2 sips",
    splitSteal: { splitter: "5 sips", stealer: "none" },
    stealSteal: "10 sips",
  },
  blackout: {
    splitSplit: "10 sips",
    splitSteal: { splitter: "½-chug (~12–15 sips)", stealer: "none" },
    stealSteal: "Full chug (~30–35 sips)",
  },
};
