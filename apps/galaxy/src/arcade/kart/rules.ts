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
  /** The turn rate at best grip, the speed it is reached at, and the part of it that is left at the top speed. */
  steer: 2.6,
  gripSpeed: 25,
  steerAtTop: 0.6,
  /** The longest step played at once, and the fixed sub-step it is played in: a slow frame never carries a kart over the void unseen. */
  maxDt: 0.05,
  subStep: 1 / 120,
  /** The countdown before the race, and how long GO shows once it has begun. */
  /** The rivals: the slowest top speed (a share of the player's), how far off the line they drive, how close a waypoint counts as passed, the angle a turn is steered from, and when a turn is sharp. */
  skillMin: 0.92,
  lineOffset: 14,
  waypointReach: 40,
  /** How far from a waypoint crossing its corner's diagonal passes it too: out over the void on the inside, so a corner cut on the inside still counts. */
  cornerGate: 104,
  rivalAim: 0.04,
  rivalSharp: 0.7,
  rivalCorner: 60,
  /** How far ahead a rival looks for the edge, in seconds of its speed (PRD 1698): a wheel over the void there, or under it, steers it back. */
  rivalLook: 0.25,
  /** How close to a corner's waypoint a rival turns in for the next one. */
  rivalTurnIn: 64,
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
  /** How far from the road a kart's centre goes before it falls: half its width as drawn (art.ts `KART_WORLD`), so it falls once all of it has tipped over the edge. */
  overhang: 7,
  /** A kart's four wheels (PRD 1698): how far ahead and behind its centre they stand and how far to each side, and how fast a wheel over the void draws the kart towards the edge. */
  wheelAlong: 6,
  wheelAcross: 3,
  tipPull: 16,
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
