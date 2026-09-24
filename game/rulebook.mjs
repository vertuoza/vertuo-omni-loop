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
  classMultiplier: (regions) => regions >= 4 ? 2.5 : regions === 3 ? 2 : regions === 2 ? 1.5 : 1,
  crossSectorMultiplier: 1.25,
  terraformOwner: 100,
  terraformExpedition: 50,
  terraformCloser: 25,
  streakStep: 0.1,
  streakCap: 0.5,
  crossTeamMultiplier: 1.5,
  nightShiftMultiplier: 1.5,
  rescue: 20,
  trancheMinutes: 240,
  distressAfterWorkingMinutes: 480,      // 8 working hours
  lostAfterWorkingMinutes: 10 * 9 * 60,  // 10 working days
  aftershockWindowDays: 14,
  threatWeights: Object.freeze({
    transmission: 1, 'unconfirmed-ground': 3, beacon: 5,
    'fault-line': 3, 'under-fire': 2, aftershock: 5, distress: 4,
  }),
  threatBands: Object.freeze([0, 3, 8, 15, 25]), // score ≥ band[i] → threat i+1 (I..V)
});
