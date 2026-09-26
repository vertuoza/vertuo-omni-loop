// Entropy Invaders, as a pure and seeded engine: no DOM, no clock, no random of its own. `newGame()`
// lines the alien Entropy up over the player's hero, `step(game, held, dt)` plays `dt` seconds with
// the buttons held, and `press(game, action)` answers a press (START pauses, B from the pause leaves).
// The scene draws what the state holds, in the pixels of the grid it is laid out for: the wide grid
// (640×360, 5 rows × 10, four shields) or the tall one (320×288, 5 rows × 6, three shields).
//
// Each row is one kind of Entropy, the one that pays most on top, and each alien pays its kind's
// close value as it is passed in: the view's `rules.woundClose`, the rulebook's own numbers.
import type { WoundKind } from '@omni/galaxy';
import type { Action } from '../keys';

export type Layout = 'wide' | 'tall';

/** The highest score a game can reach: the cap `submit_score()` holds scores to. */
export const SCORE_CAP = 9_999_999;
export const LIVES = 3;
/** How long the ready screen (the score table) shows before the formation moves; A skips it. */
export const READY_SECONDS = 3;
/** How long the game over shows its score before a key leaves it: a held A must not skip it. */
export const OVER_SECONDS = 1;
/** How long the hero blinks after a hit, out of reach of the next bomb. */
export const HURT_SECONDS = 1.5;
/** The longest step played at once: a slow frame is played as several short ones would not be. */
const MAX_DT = 1 / 20;

/** The formation's kinds of Entropy, in the spec's order: beacon on top, transmission at the bottom. */
export const FORMATION_KINDS: readonly WoundKind[] = ['beacon', 'fault-line', 'unconfirmed-ground', 'under-fire', 'transmission'];

/** The rows' kinds, top first: the one that pays most on top, a tie kept in the spec's order. */
export function rowKinds(values: Readonly<Record<WoundKind, number>>): WoundKind[] {
  return [...FORMATION_KINDS].sort((a, b) => values[b] - values[a]);
}

/** A field: where everything stands and how fast it moves, in the pixels of its grid. */
export interface Field {
  w: number; h: number;
  cols: number; rows: number;
  /** The side of an alien's box: the `entropy` sprite, 24×24. */
  alien: number;
  /** From one alien to the next, across and down; the first row's top. */
  dx: number; dy: number; top: number;
  /** A march step across, and the step down at an edge; the gap kept from the field's sides. */
  march: number; drop: number; margin: number;
  /** The seconds between two march steps with the whole formation, on the first wave. */
  marchEvery: number;
  /** The hero: its box (the hero sprite, 32×48), where it flies, how fast. */
  hero: { w: number; h: number; y: number; speed: number };
  bolt: { w: number; h: number; speed: number };
  bomb: { w: number; h: number; speed: number; max: number };
  /** The shields: how many, their top, their cells (a cell is `cell` pixels square), their spacing. */
  shields: { count: number; y: number; cell: number; cols: number; rows: number; step: number };
  /** The ground line, under the hero; the top of the field (under the score line). */
  ground: number; ceiling: number;
}

export const FIELDS: Readonly<Record<Layout, Field>> = {
  wide: {
    w: 640, h: 360, cols: 10, rows: 5, alien: 24, dx: 34, dy: 30, top: 50, march: 6, drop: 12, margin: 8, marchEvery: 0.6,
    hero: { w: 32, h: 48, y: 302, speed: 150 }, bolt: { w: 4, h: 16, speed: 360 }, bomb: { w: 4, h: 12, speed: 120, max: 3 },
    shields: { count: 4, y: 266, cell: 4, cols: 15, rows: 7, step: 126 }, ground: 351, ceiling: 40,
  },
  tall: {
    w: 320, h: 288, cols: 6, rows: 5, alien: 24, dx: 34, dy: 26, top: 38, march: 4, drop: 8, margin: 6, marchEvery: 0.6,
    hero: { w: 32, h: 48, y: 236, speed: 120 }, bolt: { w: 4, h: 14, speed: 300 }, bomb: { w: 4, h: 10, speed: 100, max: 2 },
    shields: { count: 3, y: 204, cell: 4, cols: 13, rows: 6, step: 100 }, ground: 285, ceiling: 30,
  },
};

/** What a step did, for the sounds: a march step, a bolt fired, an alien hit, the hero hit, a new wave, the end. */
export type GameEvent = 'march' | 'fire' | 'hit' | 'hurt' | 'wave' | 'over';

export interface Shield { x: number; y: number; cells: boolean[] }
export interface Boom { x: number; y: number; at: number }

export interface Game {
  layout: Layout;
  rows: number; cols: number;
  /** Each row's kind of Entropy and what one of them pays, top first. */
  kinds: WoundKind[]; values: number[];
  /** Which aliens are still there, row by row. */
  alive: boolean[];
  /** The formation's offset from where it lined up, and the way it marches. */
  fx: number; fy: number; dir: 1 | -1;
  /** Seconds to the next march step, and the steps taken (the sprites' frame, the bass's note). */
  marchIn: number; marchStep: number;
  heroX: number; lives: number; hurtUntil: number;
  bolt: { x: number; y: number } | null;
  bombs: { x: number; y: number }[];
  /** Seconds to the formation's next bomb. */
  bombIn: number;
  shields: Shield[];
  wave: number; score: number;
  /** Seconds of play; the ready screen's time left; paused; over, and when. */
  t: number; readyLeft: number; paused: boolean; over: boolean; overAt: number;
  booms: Boom[];
  /** The random generator's state: the same seed plays the same game. */
  seed: number;
  /** What the last step did. */
  events: GameEvent[];
}

/** One draw of a seeded generator (mulberry32): a number in [0, 1), and the next state. */
function draw(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) >>> 0;
  let r = Math.imul(s ^ (s >>> 15), 1 | s);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, s];
}

/** A shield's cells, row by row: an arch, its top corners cut, a notch under it. */
function shieldCells(cols: number, rows: number): boolean[] {
  const notch = Math.round(cols / 3);
  return Array.from({ length: cols * rows }, (_, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    if (r === 0 && (c < 2 || c >= cols - 2)) return false;
    if (r === 1 && (c < 1 || c >= cols - 1)) return false;
    if (r >= rows - 2 && c >= notch && c < cols - notch) return false;
    return true;
  });
}

function shieldsFor(f: Field): Shield[] {
  const { count, y, cell, cols, rows, step } = f.shields;
  const x0 = Math.round((f.w - ((count - 1) * step + cols * cell)) / 2);
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * step, y, cells: shieldCells(cols, rows) }));
}

/** Where the formation's first column lines up, centred on the field. */
const leftOf = (f: Field) => Math.round((f.w - ((f.cols - 1) * f.dx + f.alien)) / 2);

/** The box of the alien at `row`, `col`, where the formation stands now. */
export function alienAt(g: Game, row: number, col: number): { x: number; y: number; size: number } {
  const f = FIELDS[g.layout];
  return { x: leftOf(f) + g.fx + col * f.dx, y: f.top + g.fy + row * f.dy, size: f.alien };
}

/** The seconds between two march steps: shorter each wave, and shorter as the formation thins out. */
export function marchEvery(g: Game): number {
  const f = FIELDS[g.layout];
  const base = Math.max(0.2, f.marchEvery * 0.85 ** (g.wave - 1));
  const left = g.alive.filter(Boolean).length / g.alive.length;
  return base * (0.1 + 0.9 * left);
}

export function newGame({ layout, values, seed }: { layout: Layout; values: Readonly<Record<WoundKind, number>>; seed: number }): Game {
  const f = FIELDS[layout];
  const kinds = rowKinds(values);
  const g: Game = {
    layout, rows: f.rows, cols: f.cols, kinds, values: kinds.map((k) => values[k] ?? 0),
    alive: Array(f.rows * f.cols).fill(true), fx: 0, fy: 0, dir: 1, marchIn: 0, marchStep: 0,
    heroX: Math.round((f.w - f.hero.w) / 2), lives: LIVES, hurtUntil: 0, bolt: null, bombs: [], bombIn: 1.2,
    shields: shieldsFor(f), wave: 1, score: 0, t: 0, readyLeft: READY_SECONDS, paused: false, over: false, overAt: 0,
    booms: [], seed: seed >>> 0, events: [],
  };
  return { ...g, marchIn: marchEvery(g) };
}

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Wears away the cells of the shields under `box`, and one more around the first cell hit; true when one was hit. */
function wear(shields: Shield[], f: Field, box: { x: number; y: number; w: number; h: number }, from: 'below' | 'above'): boolean {
  const { cell, cols, rows } = f.shields;
  for (const s of shields) {
    if (!overlaps(box, { x: s.x, y: s.y, w: cols * cell, h: rows * cell })) continue;
    const c0 = Math.max(0, Math.floor((box.x - s.x) / cell)), c1 = Math.min(cols - 1, Math.floor((box.x + box.w - 1 - s.x) / cell));
    const order = Array.from({ length: rows }, (_, i) => (from === 'below' ? rows - 1 - i : i));
    for (const r of order) {
      const y = s.y + r * cell;
      if (y >= box.y + box.h || y + cell <= box.y) continue;
      for (let c = c0; c <= c1; c++) {
        if (!s.cells[r * cols + c]) continue;
        // The cell hit, and the one past it the shot was heading for.
        s.cells[r * cols + c] = false;
        const r2 = from === 'below' ? r - 1 : r + 1;
        if (r2 >= 0 && r2 < rows) s.cells[r2 * cols + c] = false;
        return true;
      }
    }
  }
  return false;
}

/** Wears away every shield cell an alien's box covers: the formation eats through as it comes down. */
function trample(shields: Shield[], f: Field, box: { x: number; y: number; w: number; h: number }) {
  const { cell, cols, rows } = f.shields;
  for (const s of shields) {
    if (!overlaps(box, { x: s.x, y: s.y, w: cols * cell, h: rows * cell })) continue;
    for (let i = 0; i < s.cells.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      if (s.cells[i] && overlaps(box, { x: s.x + c * cell, y: s.y + r * cell, w: cell, h: cell })) s.cells[i] = false;
    }
  }
}

function endGame(g: Game) {
  g.over = true;
  g.overAt = g.t;
  g.bolt = null;
  g.bombs = [];
  g.events.push('over');
}

/**
 * Plays `dt` seconds with `held` held (◀ ▶ fly, A fires). A paused game is returned as it was; a
 * game over only lets its clock run, for the moment its score shows.
 */
export function step(game: Game, held: ReadonlySet<Action>, dt: number): Game {
  if (game.paused) return game;
  dt = Math.max(0, Math.min(dt, MAX_DT));
  if (game.over) return { ...game, t: game.t + dt, events: [] };
  const f = FIELDS[game.layout];
  if (game.readyLeft > 0) return { ...game, readyLeft: Math.max(0, game.readyLeft - dt), events: [] };

  const g: Game = {
    ...game, t: game.t + dt, events: [], alive: game.alive.slice(), bombs: game.bombs.map((b) => ({ ...b })),
    shields: game.shields.map((s) => ({ ...s, cells: s.cells.slice() })), booms: game.booms.filter((b) => game.t - b.at < 0.4),
  };
  const total = g.alive.length;

  // The hero flies while one direction is held, and fires while A is held, one bolt at a time.
  const way = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  g.heroX = Math.max(f.margin, Math.min(f.w - f.margin - f.hero.w, g.heroX + way * f.hero.speed * dt));
  if (held.has('a') && !g.bolt) {
    g.bolt = { x: g.heroX + (f.hero.w - f.bolt.w) / 2, y: f.hero.y - f.bolt.h + 6 };
    g.events.push('fire');
  }

  // The bolt climbs: into an alien, into a shield, or out of the field.
  if (g.bolt) {
    const bolt = { x: g.bolt.x, y: g.bolt.y - f.bolt.speed * dt, w: f.bolt.w, h: f.bolt.h };
    g.bolt = { x: bolt.x, y: bolt.y };
    let hit = -1;
    for (let i = 0; i < total && hit < 0; i++) {
      if (!g.alive[i]) continue;
      const a = alienAt(g, Math.floor(i / g.cols), i % g.cols);
      if (overlaps(bolt, { x: a.x + 2, y: a.y + 2, w: a.size - 4, h: a.size - 4 })) hit = i;
    }
    if (hit >= 0) {
      const row = Math.floor(hit / g.cols);
      const a = alienAt(g, row, hit % g.cols);
      g.alive[hit] = false;
      g.score = Math.min(SCORE_CAP, g.score + g.values[row]);
      g.booms.push({ x: a.x + a.size / 2, y: a.y + a.size / 2, at: g.t });
      g.events.push('hit');
      g.bolt = null;
    } else if (wear(g.shields, f, bolt, 'below')) g.bolt = null;
    else if (bolt.y + bolt.h < f.ceiling) g.bolt = null;
  }

  // The last alien hit: the next wave lines up, faster.
  if (!g.alive.some(Boolean)) {
    g.wave += 1;
    g.alive = Array(total).fill(true);
    g.fx = 0; g.fy = 0; g.dir = 1;
    g.bolt = null; g.bombs = [];
    g.shields = shieldsFor(f);
    g.marchIn = marchEvery(g);
    g.events.push('wave');
    return g;
  }

  // The formation marches a step when its time comes, and steps down at an edge.
  g.marchIn -= dt;
  if (g.marchIn <= 0) {
    const cols = new Set<number>(), rows = new Set<number>();
    g.alive.forEach((on, i) => { if (on) { cols.add(i % g.cols); rows.add(Math.floor(i / g.cols)); } });
    const left = alienAt(g, 0, Math.min(...cols)).x, right = alienAt(g, 0, Math.max(...cols)).x + f.alien;
    const edge = g.dir > 0 ? right + f.march > f.w - f.margin : left - f.march < f.margin;
    if (edge) { g.fy += f.drop; g.dir = g.dir > 0 ? -1 : 1; } else g.fx += g.dir * f.march;
    g.marchStep += 1;
    g.marchIn += marchEvery(g);
    if (g.marchIn <= 0) g.marchIn = marchEvery(g);
    g.events.push('march');
    g.alive.forEach((on, i) => {
      if (!on) return;
      const a = alienAt(g, Math.floor(i / g.cols), i % g.cols);
      trample(g.shields, f, { x: a.x, y: a.y, w: a.size, h: a.size });
    });
    const bottom = alienAt(g, Math.max(...rows), 0).y + f.alien;
    if (bottom >= f.hero.y) { endGame(g); return g; }
  }

  // The formation fires back: the lowest alien of a column picked at random drops a bomb.
  g.bombIn -= dt;
  if (g.bombIn <= 0) {
    let pick: number, wait: number;
    [pick, g.seed] = draw(g.seed);
    [wait, g.seed] = draw(g.seed);
    g.bombIn = (0.4 + wait * 1.1) * Math.max(0.5, 0.9 ** (g.wave - 1));
    if (g.bombs.length < f.bomb.max) {
      const cols = [...new Set(g.alive.flatMap((on, i) => (on ? [i % g.cols] : [])))];
      const col = cols[Math.floor(pick * cols.length)];
      let row = g.rows - 1;
      while (!g.alive[row * g.cols + col]) row--;
      const a = alienAt(g, row, col);
      g.bombs.push({ x: a.x + (a.size - f.bomb.w) / 2, y: a.y + a.size });
    }
  }

  // The bombs fall: into a shield, into the hero, or into the ground.
  const hero = { x: g.heroX + 8, y: f.hero.y + 10, w: f.hero.w - 16, h: f.hero.h - 10 };
  const falling: { x: number; y: number }[] = [];
  let hurt = false;
  for (const b of g.bombs) {
    const box = { x: b.x, y: b.y + f.bomb.speed * dt, w: f.bomb.w, h: f.bomb.h };
    if (wear(g.shields, f, box, 'above')) continue;
    if (g.t >= g.hurtUntil && overlaps(box, hero)) { hurt = true; continue; }
    if (box.y < f.ground) falling.push({ x: box.x, y: box.y });
  }
  g.bombs = falling;
  if (hurt) {
    g.lives -= 1;
    g.hurtUntil = g.t + HURT_SECONDS;
    g.bombs = [];
    g.events.push('hurt');
    if (g.lives <= 0) endGame(g);
  }
  return g;
}

/** Pauses the game: a hidden tab, a window that lost focus. A game over stays over. */
export function pause(g: Game): Game {
  return g.over || g.paused ? g : { ...g, paused: true, events: [] };
}

/**
 * What a press does to the game, and whether it leaves for the game room. The ready screen: A or
 * START plays at once, B leaves. Playing: START (or B) pauses. The pause: START or A resumes, B
 * leaves. The game over: A, B or START leaves, once its score has shown for a moment.
 */
export function press(g: Game, action: Action): { game: Game; leave: boolean } {
  const stay = { game: g, leave: false };
  if (g.over) return { game: g, leave: (action === 'a' || action === 'b' || action === 'start') && g.t - g.overAt >= OVER_SECONDS };
  if (g.paused) {
    if (action === 'b') return { game: g, leave: true };
    return action === 'start' || action === 'a' ? { game: { ...g, paused: false }, leave: false } : stay;
  }
  if (g.readyLeft > 0) {
    if (action === 'b') return { game: g, leave: true };
    return action === 'a' || action === 'start' ? { game: { ...g, readyLeft: 0 }, leave: false } : stay;
  }
  return action === 'start' || action === 'b' ? { game: { ...g, paused: true, events: [] }, leave: false } : stay;
}

/** What the text layer shows: the score line, and which screen is up. */
export interface GameHud {
  layout: Layout;
  phase: 'ready' | 'play' | 'paused' | 'over';
  score: number; lives: number; wave: number;
}

export function hudOf(g: Game): GameHud {
  const phase = g.over ? 'over' : g.paused ? 'paused' : g.readyLeft > 0 ? 'ready' : 'play';
  return { layout: g.layout, phase, score: g.score, lives: g.lives, wave: g.wave };
}

/** True when two HUDs show the same: the text layer is drawn again only when it changes. */
export const sameHud = (a: GameHud | null, b: GameHud | null) =>
  a === b || (!!a && !!b && a.layout === b.layout && a.phase === b.phase && a.score === b.score && a.lives === b.lives && a.wave === b.wave);
