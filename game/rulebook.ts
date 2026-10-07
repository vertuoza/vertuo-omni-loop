// Every number the economy uses that is not a fact of the delivery layer (spec §6).
export const RULEBOOK = Object.freeze({
  zoneSecured: 10,
  woundClose: Object.freeze({
    transmission: 5, 'unconfirmed-ground': 15, beacon: 25,
    'fault-line': 20, 'under-fire': 10, aftershock: 20,
  }),
  decayPerTranche: Object.freeze({
    transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
    'fault-line': 3, 'under-fire': 3, aftershock: 5,
  }),
  classMultiplier: (regions: number): number => regions >= 4 ? 2.5 : regions === 3 ? 2 : regions === 2 ? 1.5 : 1,
  crossSectorMultiplier: 1.25,
  terraformOwner: 100,
  terraformExpedition: 50,
  terraformCloser: 25,
  streakStep: 0.1,
  streakCap: 0.5,
  crossTeamMultiplier: 1.5,
  nightShiftMultiplier: 1.5,
  rescue: 20,
  // An answered ask round tied to a numbered PRD (PRD 1180): below the cheapest outbox answer, so
  // asking many questions never outruns delivery work.
  questionAnswered: 2,
  trancheMinutes: 240,
  distressAfterWorkingMinutes: 480,      // 8 working hours
  lostAfterWorkingMinutes: 10 * 9 * 60,  // 10 working days
  aftershockWindowDays: 14,
  threatWeights: Object.freeze({
    transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
    'fault-line': 3, 'under-fire': 2, aftershock: 5, distress: 4,
  }),
  threatBands: Object.freeze([0, 3, 8, 15, 25]), // score ≥ band[i] → threat i+1 (I..V)
  // XP, levels and the games they unlock (game/experience.ts). XP is every positive personal credit
  // ever earned, across seasons, and never resets. Change a number here and merge it: the next poll
  // recomputes every player's XP from the whole ledger (`pnpm game:xp`).
  xp: Object.freeze({
    // Weight of each personal credit. 0 leaves a credit out.
    weights: Object.freeze({ zoneSecured: 1, woundClosed: 1, rescue: 1, expedition: 1, closer: 1, questionAnswered: 1 }),
    // LV 1 at the first point; LV n (n ≥ 2) at step·n·(n−1).
    curve: Object.freeze({ first: 1, step: 25 }),
    cap: 99,
    // The level each game unlocks at.
    unlocks: Object.freeze({ invaders: 1, platformer: 2 }),
  }),
});
