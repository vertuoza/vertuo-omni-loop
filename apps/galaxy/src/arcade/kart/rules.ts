// OMNI KART's numbers (PRD 1359): one constants block, chosen by eye, so a follow-up tunes the feel
// without touching the engine. World units are the circuit's texture pixels (a tile is 16), times in
// seconds, speeds in units a second, angles in radians.
/** How hard the rivals drive (PRD 1762). */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const RULES = Object.freeze({
  /** A kart's body, as a circle: what karts are pushed apart by and what items reach. */
  radius: 5,
  /** The fastest a kart goes on the road, and the fastest it reverses. */
  topSpeed: 110,
  reverseSpeed: 40,
  /** What A adds to the speed, what letting go takes off, what ▼ takes off a kart going forwards, and what it adds backwards once stopped. */
  accel: 70,
  coast: 45,
  brake: 160,
  reverseAccel: 50,
  /** A kart faster than the top speed it is at (once a BOOST is over) slows to it at this rate. */
  overspeedDrag: 220,
  /** The slope on the top speed (PRD 1698): the share of it a unit of slope takes off uphill and adds downhill, within a third either way (kart.ts). */
  climb: 1.2,
  /** The surfaces (PRD 1923): powder caps the top speed at this share of it; on ice the direction of travel turns towards the heading at `iceGrip` radians a second and never lags it by more than `iceSlip` radians. */
  powder: 0.55,
  iceGrip: 0.4,
  iceSlip: 1.0,
  /** PRD 1963: on ice the gas adds `iceAccel` of what it adds on road, the brake takes off `iceBrake` of it and letting go takes off `iceCoast` of it; off the ice a carried direction of travel turns back to the heading at `grip` radians a second. */
  iceAccel: 0.6,
  iceBrake: 0.4,
  iceCoast: 0.3,
  grip: 6,
  /** PRD 1963, the hop and the drift: the hop is drawn `hopHeight` pixels up over `hopTime` seconds; a drift starts at `driftMin` of the top speed, turns at `driftTight`, `driftMid` or `driftWide` radians a second (the drift's arrow, neither, the other), its travel turns towards the heading at `driftGrip` and lags it by `driftSlip` at most; its charge is blue from `chargeBlue` seconds and orange from `chargeOrange`, and releasing gives a BOOST of `miniBlue` or `miniOrange` seconds. */
  hopHeight: 4,
  hopTime: 0.25,
  driftMin: 0.5,
  driftTight: 2.2,
  driftMid: 1.5,
  driftWide: 0.9,
  driftGrip: 0.8,
  driftSlip: 0.45,
  chargeBlue: 0.8,
  chargeOrange: 1.8,
  miniBlue: 0.5,
  miniOrange: 1,
  /** The turn rate at best grip, the speed it is reached at, and the part of it that is left at the top speed. */
  steer: 2.6,
  gripSpeed: 25,
  steerAtTop: 0.6,
  /** The longest step played at once, and the fixed sub-step it is played in: a slow frame never carries a kart over the void unseen. */
  maxDt: 0.05,
  subStep: 1 / 120,
  /** The countdown before the race, and how long GO shows once it has begun. */
  /** The rivals: the slowest top speed (a share of the player's), how far off the line they drive, how far past the road a waypoint's gate counts as passed, and the angle a turn is steered from. */
  skillMin: 0.92,
  lineOffset: 14,
  /** How far past the road's width a waypoint's gate still counts (PRD 1829): out over the void on the inside of a bend, so a corner cut on the inside still counts. */
  gateSlack: 48,
  rivalAim: 0.04,
  /** A rival with a wheel over the void keeps the gas on below this speed, so one that has stalled on the edge can still steer clear (PRD 1775). */
  rivalCrawl: 12,
  rivalCorner: 60,
  /** How far ahead a rival looks for the edge, in seconds of its speed (PRD 1698): a wheel over the void there, or under it, steers it back. */
  rivalLook: 0.25,
  /** Where a rival aims on the centre line (PRD 1829): seconds of its speed ahead of it, at least this many pixels. */
  rivalAhead: 0.3,
  rivalAheadMin: 20,
  /** How much of a turn's radius a rival keeps in hand when it picks its speed for it, how far (pixels, and seconds of its speed) it looks ahead for a turn, and the share of that speed over which it brakes rather than lifts. */
  rivalCurve: 0.9,
  rivalHorizon: 40,
  rivalHorizonTime: 0.3,
  rivalBrake: 1.1,
  /** PRD 1963: a HARD rival hops into a bend tighter than this many tiles and drifts through it. */
  rivalDriftRadius: 8,
  /** How far before a ramp (game pixels) no rival throws a BLOB or an ORB, at or at a kart on the way to it: a spin there is a fall into the gap beyond. */
  rampCalm: 160,
  /** How far past a gate's line (game pixels) a kart still counts as through it, when it was pushed over the line between two steps. */
  gateSlab: 8,
  /** The rubber band: the most a rival's pace moves, and the gap in game pixels at which it moves that much. */
  rubber: 0.05,
  rubberRange: 400,
  /** The items: a box's pickup reach and how long it stays away, then BOOST (its length and its share of the top speed), BLOB (how far behind it lands, its reach, and how many lie at most), ORB (its speed as a share of the top speed, its reach, bounces and life) and the spin-out (its length, the share of the speed left, and the turn rate). */
  boxReach: 11,
  boxBack: 3,
  boostTime: 1.5,
  boostFactor: 1.4,
  blobBehind: 14,
  blobReach: 9,
  blobMax: 6,
  orbSpeed: 2,
  orbAhead: 12,
  orbReach: 8,
  orbBounces: 3,
  orbLife: 4,
  spinTime: 1,
  /** The fall into the void (PRD 1447): how long a kart falls, and how long it blinks once it is back on the road. */
  fallTime: 1,
  blinkTime: 0.5,
  /** How far behind a gap across the racing line a kart that fell into it comes back (bug 1820): 6.5 tiles, so that from rest it reaches the gap fast enough to clear it, on COMET RING from the run-up pad. */
  runUp: 104,
  /** How far from the road a kart's centre goes before it falls: half its width as drawn (art.ts `KART_WORLD`), so it falls once all of it has tipped over the edge. */
  overhang: 7,
  /** A kart's four wheels (PRD 1698): how far ahead and behind its centre they stand and how far to each side, and how fast a wheel over the void draws the kart towards the edge. */
  wheelAlong: 6,
  wheelAcross: 3,
  tipPull: 8,
  /** How long both wheels of one side stay over the void, in a row, before the kart tips over (PRD 1775). */
  tipGrace: 0.5,
  /** The jump (PRD 1775): the vertical speed a kart leaves a ramp with (a share of its speed), gravity in units a second squared, and the share of its turn rate a kart in the air keeps. */
  launch: 0.9,
  gravity: 400,
  airSteer: 0.3,
  spinSpeed: 0.3,
  spinRate: Math.PI * 2,
  /** How a rival uses what it holds: a BLOB when a kart is this close behind (and this far to the side at most), an ORB when one is ahead within this range and this many radians in line. */
  blobBehindRange: 45,
  blobLateral: 12,
  orbRange: 130,
  orbLine: 0.18,
  /** The rivals' difficulty (PRD 1762): per level, the range of a rival's own pace (a share of the player's top speed, never above 1), how far off the line it drives, the rubber band, and how long a rival holds an item before it uses it (seconds). NORMAL is the numbers above, unchanged. */
  levels: {
    easy: { skillMin: 0.8, skillMax: 0.88, lineOffset: 14, rubber: 0.1, hold: 2.5 },
    normal: { skillMin: 0.92, skillMax: 1, lineOffset: 14, rubber: 0.05, hold: 0 },
    hard: { skillMin: 0.97, skillMax: 1, lineOffset: 7, rubber: 0.05, hold: 0 },
  },
  /** The tunnel's vault (PRD 1829): how far the ceiling falls from its height over the centre line (mode7.ts `ROOF`) to where it meets the walls; the eye stands 28 up, so the ceiling stays above it. */
  vault: 10,
  /** How long FINAL LAP shows once the third lap starts. */
  finalBanner: 2.5,
  countdown: 3,
  goBanner: 0.75,
  /** MULTI (PRD 1572): how many players of a workspace hold a place on the grid, and the Realtime messages a second a race may cost (sent and delivered both count). */
  places: 4,
  messageBudget: 80,
  /** The most `state` messages a player sends a second (when few race), how long a remote kart is carried forward on its last state at most (seconds), and how long a player may stay silent before they are OUT (seconds). */
  sendMax: 10,
  carry: 0.5,
  outAfter: 10,
} as const);
