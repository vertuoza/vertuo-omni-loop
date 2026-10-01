// @ts-nocheck
// The whole galaxy is drawn from this one palette: navy-and-white hero suits, a purple
// plasma glow, comic yellow for anything worth points, and red for Entropy and danger.
// One character per colour, so sprites can be written as strings.
export const PALETTE = Object.freeze({
  k: '#0b0a26', // outline, the void
  x: '#000000',
  q: '#ffffff',
  N: '#1a2170', // suit navy, shade
  n: '#2f3fc4', // suit navy
  w: '#f2f4ff', // suit white
  W: '#b5bde8', // suit white, shade
  p: '#a45cff', // plasma purple
  P: '#6a2fd0', // plasma purple, shade
  s: '#f5c19a', // skin
  S: '#d08a63', // skin, shade
  h: '#1c1826', // hair
  g: '#c9cbd6', // grey streak
  e: '#56c8ff', // eye blue
  r: '#ff3b5c', // Entropy red
  R: '#a8183a', // Entropy red, shade
  y: '#ffd84a', // comic yellow
  Y: '#d99a14', // gold, shade
  o: '#ff9b30', // orange
  b: '#9a5a2c', // beaver brown
  B: '#5e3417', // beaver brown, shade
  t: '#d9a06e', // muzzle tan
  v: '#9b5de5', // octopod violet
  V: '#5f35a8', // octopod violet, shade
  m: '#ff8fd0', // tentacle pink
  c: '#6ff0ff', // cyan glow
  G: '#8fe8ff', // goggle lens
  l: '#d8dcf0', // light grey
  a: '#3a3f5e', // agent suit slate
  A: '#5b5f80', // slate, light
  z: '#4ee08a', // terraform green
  Z: '#1d8f55', // terraform green, shade
});

// Named swatches the UI uses outside sprites. tokens.mjs writes them, with the arcade's own
// colours, into tokens.css as custom properties (`navyDark` becomes `--navy-dark`).
export const INK = Object.freeze({
  void: '#07061c',
  deep: '#0e0d33',
  navy: PALETTE.n,
  navyDark: PALETTE.N,
  white: PALETTE.w,
  plasma: PALETTE.p,
  plasmaDark: PALETTE.P,
  yellow: PALETTE.y,
  gold: PALETTE.Y,
  red: PALETTE.r,
  redDark: PALETTE.R,
  cyan: PALETTE.c,
  green: PALETTE.z,
  greenDark: PALETTE.Z,
  slate: PALETTE.A,
  // The logo's 4-tone ramp, lit from the top left: highlight, yellow, orange, ember.
  highlight: '#fff3a8',
  orange: PALETTE.o,
  ember: '#d9531a',
  // The print ad's voice: its accent, its text column, and the space behind the hero art.
  magenta: '#ff3ea5',
  adPurple: '#5b1a86',
  starfield: '#05040f',
});
