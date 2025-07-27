export interface PenaltyMode {
  id: string;
  name: string;
  splitSplit: string;
  splitStealSplitter: string;
  splitStealStealer: string;
  stealSteal: string;
}

export const penaltyModes: PenaltyMode[] = [
  {
    id: "party",
    name: "Party Mode",
    splitSplit: "5 sips each",
    splitStealSplitter: "10 sips",
    splitStealStealer: "none",
    stealSteal: "20 sips each (≈ half a 0.5 L bottle)",
  },
  {
    id: "casual",
    name: "Casual Mode",
    splitSplit: "2 sips each",
    splitStealSplitter: "5 sips",
    splitStealStealer: "none",
    stealSteal: "10 sips each (≈ quarter bottle)",
  },
  {
    id: "blackout",
    name: "Blackout Mode",
    splitSplit: "10 sips each",
    splitStealSplitter: "½-chug (~12–15 sips)",
    splitStealStealer: "none",
    stealSteal: "Full chug (~30–35 sips)",
  },
];
