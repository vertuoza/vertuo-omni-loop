// OMNI KART's numbers (PRD 1359): one constants block, chosen by eye, so a follow-up tunes the feel
// without touching the engine. World units are the circuit's texture pixels (a tile is 16), times in
// seconds, speeds in units a second, angles in radians.
export const RULES = Object.freeze({
  /** A kart's body, as a circle: what the walls push out of. */
  radius: 5,
  /** The fastest a kart goes on the road, and the fastest it reverses. */
  topSpeed: 110,
  reverseSpeed: 40,
  /** What A adds to the speed, what letting go takes off, what ▼ takes off a kart going forwards, and what it adds backwards once stopped. */
  accel: 70,
  coast: 45,
  brake: 160,
  reverseAccel: 50,
  /** Grass halves the top speed, and a kart faster than the top speed it is on slows to it at this rate. */
  grassFactor: 0.5,
  overspeedDrag: 220,
  /** The turn rate at best grip, the speed it is reached at, and the part of it that is left at the top speed. */
  steer: 2.6,
  gripSpeed: 25,
  steerAtTop: 0.6,
  /** How much of the speed into a wall comes back out of it. */
  bounce: 0.4,
  /** The longest step played at once, and the fixed sub-step it is played in: a slow frame never carries a kart through a wall. */
  maxDt: 0.05,
  subStep: 1 / 120,
  /** The countdown before the race, and how long GO shows once it has begun. */
  /** The rivals: the slowest top speed (a share of the player's), how far off the line they drive, how close a waypoint counts as passed, the angle a turn is steered from, and when a turn is sharp. */
  skillMin: 0.92,
  lineOffset: 14,
  waypointReach: 40,
  rivalAim: 0.04,
  rivalSharp: 0.7,
  rivalCorner: 60,
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
  spinSpeed: 0.3,
  spinRate: Math.PI * 2,
  /** How a rival uses what it holds: a BLOB when a kart is this close behind (and this far to the side at most), an ORB when one is ahead within this range and this many radians in line. */
  blobBehindRange: 45,
  blobLateral: 12,
  orbRange: 130,
  orbLine: 0.18,
  /** How long FINAL LAP shows once the third lap starts. */
  finalBanner: 2.5,
  countdown: 3,
  goBanner: 0.75,
  /** The score: points for the place (1ST to 6TH), and one point per tenth of a second under the par time. */
  placePoints: [1000, 700, 500, 350, 200, 100],
} as const);
