// OMNI DUET's waves (PRD 1633, issue 1672): four chapters written by hand as text, one wave per
// entry, and the checks that prove every wave passable. A wave is a few obstacles that fall one behind
// the other at the wave's speed; it is passed once its last obstacle is entirely below the circle.
// Every obstacle is a word of a small vocabulary set on the circle, never on a grid: each one is
// dodged by one clear pose of the pair, upright (12 and 6 o'clock) or level (3 and 9 o'clock), and
// hits the other. The waves sit in one text block so a follow-up tunes them without touching the
// engine, and `waveProblems` keeps every wave passable whatever the tuning.
import { hits, corners, type Block } from './collide';
import { orbs, RULES } from './rules';

/** The circle's radius, R: every size and distance of the vocabulary is counted in it. */
const R = RULES.radius;

/**
 * The vocabulary's sizes, in R, so a follow-up tunes them in one place. With R = 56 and orbs of
 * radius 6, each leaves its pose a margin of 7 pixels at the least (the tests hold it to more than
 * the orbs 2 pixels wider):
 *
 * - a half bar, 2 R long and 0.3 R thick (112 × 17 px), from the left or the right towards the
 *   centre, its inner end stopping R/3 (19 px) short of the centre line: upright, the orbs stand 13 px
 *   clear of it; level, the orb on its side is inside it;
 * - a centre block, a square 0.75 R wide (42 px) on the centre line: level, the orbs stand 29 px
 *   clear of it; upright, they are inside it.
 *
 * A sliding obstacle moves along the wave's width by at most its own reach, which keeps that pose
 * clear: a half bar only away from the centre line and back, a centre block either side of where it
 * stands. A turning obstacle turns about its own middle, stays clear of its pose
 * whichever way it points, and stands as written as it crosses the centre's height, so it still hits
 * the other pose there.
 */
export const SHAPE = Object.freeze({
  half: Object.freeze({ length: 2, thick: 0.3, short: 1 / 3 }),
  centre: Object.freeze({ side: 0.75 }),
  /** How far each kind slides from where it stands, in R, and how fast, in R a second. */
  slideReach: Object.freeze({ half: 0.4, centre: 0.3 }),
  slideSpeed: 0.7,
  /** A turning obstacle turns this many turns a second about its middle. */
  spinTurnsPerSecond: 0.3,
});

/** The two obstacles. */
export type Kind = 'half' | 'centre';

/** How an obstacle moves as it falls: not at all, side to side, or turning about its middle. */
export type Motion = 'still' | 'slide' | 'turn';

/** The two clear poses of the pair: upright, at 12 and 6 o'clock, and level, at 3 and 9 o'clock. */
export type Pose = 'upright' | 'level';

/** The one pose that dodges each kind, at its angle: the pair is the same half a turn on. */
export const POSE: Readonly<Record<Kind, { pose: Pose; angle: number }>> = Object.freeze({
  half: { pose: 'upright', angle: Math.PI / 2 },
  centre: { pose: 'level', angle: 0 },
});

/**
 * One obstacle as written: its kind, its side (-1 left, 1 right, 0 the centre block's), how it moves,
 * whether it moves the other way round (`back`), and how far above the playfield's top its middle
 * stands as the wave begins, in game pixels.
 */
export interface Piece { kind: Kind; side: -1 | 0 | 1; motion: Motion; back: boolean; above: number }

export interface Wave { speed: number; pieces: readonly Piece[] }

export interface Chapter { numeral: string; name: string; waves: readonly Wave[] }

/**
 * The legend every wave is written in. A wave's first line is its speed, in game pixels a second:
 * `speed 60`. Each line after it is one obstacle, in the order they reach the orbs, written as its
 * words, a ` · `, then its distance behind the one before:
 *
 *   L half · 0          a half bar from the left (R from the right)
 *   centre · 2R         a centre block
 *
 * after which `slide` makes it slide and `turn` turn, and `back` the other way round: a slide sets off
 * to the right (a half bar away from the centre line), `slide back` to the left (a half bar from its
 * far end); a turn goes anticlockwise, as ◀ turns the pair, `turn back` clockwise.
 *
 * The distance is in R, the circle's radius (`2R`, `1.5R`), or `0`: the free space between this
 * obstacle and the one before it, each taken at its full reach (a turning one as the disc it sweeps).
 * The first obstacle's distance is the space above the playfield before it enters.
 */
const LEGEND = Object.freeze({
  obstacles: new Map<string, { kind: Kind; side: -1 | 0 | 1 }>([
    ['L half', { kind: 'half', side: -1 }],
    ['R half', { kind: 'half', side: 1 }],
    ['centre', { kind: 'centre', side: 0 }],
  ]),
  motions: Object.freeze(['slide', 'turn'] as const),
  back: 'back',
});

/** An obstacle's size in game pixels, unturned: its width and its height. */
function sizeOf(kind: Kind): { w: number; h: number } {
  if (kind === 'half') return { w: SHAPE.half.length * R, h: SHAPE.half.thick * R };
  return { w: SHAPE.centre.side * R, h: SHAPE.centre.side * R };
}

/** Where an obstacle's middle stands across the playfield, before it slides. */
function anchorOf(kind: Kind, side: number): number {
  if (kind === 'half') return RULES.centre.x + side * (SHAPE.half.short + SHAPE.half.length / 2) * R;
  return RULES.centre.x;
}

/** How far an obstacle reaches above and below its middle: half its height, or for a turning one the disc it sweeps. */
export function reachOf(piece: Pick<Piece, 'kind' | 'motion'>): number {
  const { w, h } = sizeOf(piece.kind);
  return piece.motion === 'turn' ? Math.hypot(w, h) / 2 : h / 2;
}

/** Whether a word is one of `words`. */
const oneOf = <T extends string>(words: readonly T[], word: string | undefined): word is T => words.some((w) => w === word);

/** A word the legend does not know, or none where one was needed. */
const unknown = (word: string | undefined) => new Error(word === undefined ? 'no obstacle named' : `"${word}" is not in the legend`);

/** Why the front of an obstacle's words names no obstacle: a side the kind cannot have, a side missing, or a word not in the legend. */
function misnamed([first, second]: readonly string[]): Error {
  if (first === 'L' || first === 'R') return second === 'centre' ? new Error('a centre block has no side') : unknown(second);
  return first === 'half' ? new Error('a half bar needs its side, L or R') : unknown(first);
}

/** Reads an obstacle's side and kind from the front of its words, `L half` or `centre`, and how many words they took. */
function readKind(words: readonly string[]): { kind: Kind; side: -1 | 0 | 1; used: number } {
  const used = words[0] === 'L' || words[0] === 'R' ? 2 : 1;
  const named = LEGEND.obstacles.get(words.slice(0, used).join(' '));
  if (!named) throw misnamed(words);
  return { ...named, used };
}

/** Reads an obstacle's words: `L half`, `centre slide`, `R half turn back`. Throws a refusal's message. */
function readWords(text: string): Omit<Piece, 'above'> {
  const words = text.split(/\s+/).filter((w) => w !== '');
  const { kind, side, used } = readKind(words);
  const [moving, way, ...more] = words.slice(used);
  if (moving === undefined) return { kind, side, motion: 'still', back: false };
  if (!oneOf(LEGEND.motions, moving)) throw unknown(moving);
  if (way !== undefined && way !== LEGEND.back) throw unknown(way);
  if (more.length) throw unknown(more[0]);
  return { kind, side, motion: moving, back: way === LEGEND.back };
}

const DISTANCE = /^(?:0|(\d+(?:\.\d+)?)R)$/;

/** Reads a distance, `0`, `2R` or `1.5R`, into game pixels. Throws a refusal's message. */
function readDistance(text: string | undefined): number {
  const found = DISTANCE.exec(text ?? '');
  if (!found) throw new Error(`"${text ?? ''}" is not a distance: 0 or a number of R, such as 2R or 1.5R`);
  return Number(found[1] ?? 0) * R;
}

const HEADER = /^speed (\d+)$/;

/** One obstacle line, split into its words and its distance. */
function splitLine(line: string): { words: string; distance: string | undefined } {
  const [words = '', distance, ...more] = line.split(' · ');
  if (more.length) throw new Error('more than one " · " on the line');
  return { words, distance };
}

/** Reads one wave's text. `where` names it in a refusal: `chapter II · SLIDE, wave 4`. */
export function parseWave(text: string, where: string): Wave {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const header = HEADER.exec(lines[0] ?? '');
  if (!header) throw new Error(`${where}: the first line is not "speed <n>"`);
  if (lines.length < 2) throw new Error(`${where}: no obstacles`);
  const pieces: Piece[] = [];
  let top = 0;
  lines.slice(1).forEach((line, i) => {
    try {
      const { words, distance } = splitLine(line);
      const written = readWords(words);
      const reach = reachOf(written);
      const above = top + readDistance(distance) + reach;
      pieces.push({ ...written, above });
      top = above + reach;
    } catch (e) {
      throw new Error(`${where}, line ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return { speed: Number(header[1]), pieces };
}

/** Reads a chapter's waves, each refused with the chapter, the wave and the line of what is wrong. */
export function parseChapter(numeral: string, name: string, texts: readonly string[]): Chapter {
  return { numeral, name, waves: texts.map((t, i) => parseWave(t, `chapter ${numeral} · ${name}, wave ${i + 1}`)) };
}

/** A back-and-forth between -reach and reach, setting off upwards from 0, after `d` pixels travelled. */
function swing(d: number, reach: number): number {
  const p = d % (4 * reach);
  if (p < reach) return p;
  if (p < 3 * reach) return 2 * reach - p;
  return p - 4 * reach;
}

/** How far a sliding obstacle stands from where it was written, `t` seconds after the wave began. */
function slid(p: Piece, t: number): number {
  const reach = SHAPE.slideReach[p.kind] * R;
  const d = SHAPE.slideSpeed * R * t;
  // A half bar slides only away from the centre line and back, `back` setting off from its far end.
  if (p.kind === 'half') return p.side * Math.abs(swing(d + (p.back ? reach : 0), reach));
  return (p.back ? -1 : 1) * swing(d, reach);
}

/** The wave's obstacles `tick` sub-steps after it began to enter: fallen, slid and turned. */
export function blocksAt(wave: Wave, tick: number): Block[] {
  const t = tick * RULES.subStep;
  return wave.pieces.map((p) => {
    const { w, h } = sizeOf(p.kind);
    const cx = anchorOf(p.kind, p.side) + (p.motion === 'slide' ? slid(p, t) : 0);
    // A turning obstacle stands as written as its middle crosses the centre's height: it turns, yet
    // passes the circle's middle where it hits the other pose.
    const crossing = (RULES.centre.y + p.above) / wave.speed;
    const angle = p.motion === 'turn' ? (p.back ? -1 : 1) * Math.PI * 2 * SHAPE.spinTurnsPerSecond * (t - crossing) : 0;
    return { cx, cy: -p.above + wave.speed * t, w, h, angle };
  });
}

/** The lowest the orbs reach: a block entirely below it can no longer touch them. */
const BELOW = RULES.centre.y + RULES.radius + RULES.orbRadius;

/** Whether every block of the wave has fallen entirely below the circle. */
export function passedAt(wave: Wave, tick: number): boolean {
  return blocksAt(wave, tick).every((b) => corners(b).every((c) => c.y > BELOW));
}

/** Whether a block overlaps either orb with the pair at `angle`; the check may take the orbs wider, `r`, to keep room to spare. */
export function struck(angle: number, blocks: readonly Block[], r: number = RULES.orbRadius): boolean {
  if (blocks.length === 0) return false;
  return orbs(angle).some((o) => blocks.some((b) => hits({ x: o.x, y: o.y, r }, b)));
}

// ── The spacing rule ─────────────────────────────────────────────────────────────────────────────

/**
 * The seconds the pair needs between two obstacles: none when both ask the same pose, else the time
 * ◀ or ▶ held takes to turn from one pose to the other (a quarter turn; the pair looks the same half
 * a turn on, so no turn between two poses is longer) plus a person's reaction delay.
 */
export function turnSeconds(from: Kind, to: Kind): number {
  const apart = Math.abs(POSE[from].angle - POSE[to].angle) % Math.PI;
  const turns = Math.min(apart, Math.PI - apart) / (Math.PI * 2);
  return turns === 0 ? 0 : turns / RULES.turnsPerSecond + RULES.reactionSeconds;
}

/** The free space between two obstacles that follow each other in a wave, in game pixels, each at its full reach. */
export function spaceBetween(before: Piece, after: Piece): number {
  return after.above - reachOf(after) - (before.above + reachOf(before));
}

/**
 * Every pair of obstacles that follow each other too closely, named by chapter, wave and line: one
 * asking another pose must stand at least the turn's time plus the reaction delay, at the wave's
 * speed, behind the one before. Two asking the same pose may follow as closely as they like.
 */
export function spacingProblems(chapters: readonly Chapter[]): string[] {
  return chapters.flatMap((chapter) => chapter.waves.flatMap((wave, i) => wave.pieces.flatMap((p, k) => {
    const before = wave.pieces[k - 1];
    if (!before) return [];
    const need = turnSeconds(before.kind, p.kind) * wave.speed;
    const space = spaceBetween(before, p);
    return space + 1e-9 >= need ? [] : [`chapter ${chapter.numeral} · ${chapter.name}, wave ${i + 1}, line ${k + 2}: ${space.toFixed(1)} px behind, not ${need.toFixed(1)}`];
  })));
}

// ── The passability check ────────────────────────────────────────────────────────────────────────

/**
 * The angles the orbs can stand at, as a ring of `bins` and the bins one sub-step's turn moves them.
 * With 0.6 turns a second and 60 steps a second, a step is 1/100 of a turn: 100 bins, 1 a step, and
 * a run that starts at angle 0 is always on a bin. A tuning with no small whole ring is checked on
 * 720 bins, the step rounded.
 */
export function ring(): { bins: number; move: number } {
  const perStep = RULES.turnsPerSecond * RULES.subStep;
  for (let bins = 1; bins <= 2000; bins++) {
    const move = bins * perStep;
    if (Math.abs(move - Math.round(move)) < 1e-9) return { bins, move: Math.round(move) };
  }
  return { bins: 720, move: Math.max(1, Math.round(720 * perStep)) };
}

/** No wave lasts longer than this: a wave that never passes is named, not waited on forever. */
const LONGEST = 60 / RULES.subStep;

/** The hold no way through starts from. */
const NEVER = 255;

/** The turn of each way the check indexes: 0 is ▶ (clockwise), 1 still, 2 ◀ (anticlockwise). */
const TURNS: readonly (-1 | 0 | 1)[] = [-1, 0, 1];

/**
 * The person the check plays: the least time, in seconds, between two changes of what they hold (0
 * for perfect, instant inputs), and the orbs' radius as the check takes it. Both default to the game's.
 */
interface Player { reactionSeconds?: number; orbRadius?: number }

/** The way through a wave, worked backwards: one table a sub-step, and the sub-steps a hold lasts before it may change. */
interface Ways { tables: Uint8Array[]; react: number }

/** The first sub-step `wave` is passed at, or 0 when it is not within `LONGEST`. */
function passTick(wave: Wave): number {
  for (let tick = 1; tick <= LONGEST; tick++) if (passedAt(wave, tick)) return tick;
  return 0;
}

/** The bins a block of `wave` covers after a sub-step, for orbs of radius `r`, or null when it covers none. */
function coverage(wave: Wave, r: number, bins: number): (tick: number) => Uint8Array | null {
  // Each bin's two orbs, placed once; a block is tested only against an orb within its reach.
  const pairs = Array.from({ length: bins }, (_, b) => orbs((b / bins) * Math.PI * 2).map((o) => ({ x: o.x, y: o.y, r })));
  const reach = (b: Block) => r + Math.hypot(b.w, b.h) / 2;
  return (tick) => {
    const blocks = tick > 0 ? blocksAt(wave, tick).filter((b) => Math.abs(b.cy - RULES.centre.y) <= RULES.radius + reach(b)) : [];
    if (!blocks.length) return null;
    const out = pairs.map((pair) => (pair.some((o) => blocks.some((k) => Math.abs(o.y - k.cy) <= reach(k) && hits(o, k))) ? 1 : 0));
    return out.includes(1) ? Uint8Array.from(out) : null;
  };
}

/**
 * The person's ways through `wave`, worked backwards from the sub-step it is passed. A state is the bin
 * the orbs stand at, the way they turn (0 for ▶, 1 still, 2 for ◀) and for how many sub-steps
 * that has been held. Holding longer never closes a way, so a table keeps, for each bin and way, the
 * fewest sub-steps held that still get through (capped at `react`, the sub-steps a hold lasts before
 * it may change), NEVER when none does. `tables[t]` holds the states after sub-step t, from t = 0, as
 * the wave begins, to the sub-step it is passed; with `all` false, only `tables[0]` is kept. Null when
 * the wave never passes.
 */
function ways(wave: Wave, player: Player, all: boolean): Ways | null {
  const last = passTick(wave);
  if (!last) return null;
  const { bins, move } = ring();
  const react = Math.max(1, Math.round((player.reactionSeconds ?? RULES.reactionSeconds) / RULES.subStep));
  const blockedAt = coverage(wave, player.orbRadius ?? RULES.orbRadius, bins);
  return { tables: backFrom(last, blockedAt, { react, bins, move }, all), react };
}

/** The tables of `ways`, worked back from sub-step `last` to 0: every one with `all`, else only the first. */
function backFrom(last: number, blockedAt: (tick: number) => Uint8Array | null, on: { react: number; bins: number; move: number }, all: boolean): Uint8Array[] {
  const { react, bins, move } = on;
  const end = blockedAt(last);
  let next: Uint8Array = new Uint8Array(bins * 3).map((_, i) => (end?.[Math.floor(i / 3)] ? NEVER : 1));
  // While no block covers a bin and every state gets through, the sub-step before is the same: no need to work it out.
  let clear = !end;
  const tables = [next];
  for (let tick = last - 1; tick >= 0; tick--) {
    const blocked = blockedAt(tick);
    if (!clear || blocked) {
      next = stepBack(next, blocked, react, bins, move);
      clear = !blocked && next.every((need) => need === 1);
    }
    if (all) tables.unshift(next);
  }
  return all ? tables : [next];
}

/**
 * One sub-step of `ways`, worked backwards: for each state after it, the fewest sub-steps held that
 * still get through, from `next`, the same for the sub-step after; a bin `blocked` gets NEVER.
 */
function stepBack(next: Uint8Array, blocked: Uint8Array | null, react: number, bins: number, move: number): Uint8Array {
  const cur = new Uint8Array(bins * 3).fill(NEVER);
  for (let b = 0; b < bins; b++) {
    if (blocked?.[b]) continue;
    // Where each way leads, the sub-step after: ▶ to the bin before, still to this one, ◀ to the bin after.
    const led = [next[((b - move + bins) % bins) * 3] ?? NEVER, next[b * 3 + 1] ?? NEVER, next[((b + move) % bins) * 3 + 2] ?? NEVER];
    led.forEach((on, di) => {
      // Held on: the hold grows by one sub-step, so it needs one fewer than the state it leads to.
      const kept = on === NEVER ? NEVER : Math.max(1, on - 1);
      // Changed: only once held for `react`, into a state a fresh hold gets through from.
      const changed = led.some((v, ni) => ni !== di && v === 1);
      cur[b * 3 + di] = changed ? Math.min(kept, react) : kept;
    });
  }
  return cur;
}

/** The bin nearest `angle` on the check's ring. */
function binOf(angle: number, bins: number): number {
  return ((Math.round((angle / (Math.PI * 2)) * bins) % bins) + bins) % bins;
}

/**
 * One way through `wave` for orbs that stand at `angle` as it begins, holding what they like: the turn
 * of each sub-step (1 anticlockwise, ◀; -1 clockwise, ▶; 0 still) until it is passed, each change of
 * turn at least the reaction delay after the last, or null when there is none. The check's own
 * search, kept: a test plays a run through its waves with it.
 */
export function route(wave: Wave, angle: number, player: Player = {}): (-1 | 0 | 1)[] | null {
  const { bins, move } = ring();
  const found = ways(wave, player, true);
  if (!found) return null;
  const { tables, react } = found;
  let b = binOf(angle, bins);
  // As the wave begins the person may hold anything, held long enough to change.
  const first = [1, 0, 2].find((i) => (tables[0]?.[b * 3 + i] ?? NEVER) <= react);
  if (first === undefined) return null;
  let di = first, held = react;
  const turns: (-1 | 0 | 1)[] = [];
  for (const table of tables.slice(1)) {
    const at = (i: number) => ((b + (i - 1) * move + bins) % bins) * 3 + i;
    const was = di;
    // Hold on while that still gets through; else change, which the tables promise is then allowed.
    let ni: number | undefined = was;
    if ((table[at(was)] ?? NEVER) > Math.min(held + 1, react)) ni = held >= react ? [0, 1, 2].find((i) => i !== was && table[at(i)] === 1) : undefined;
    if (ni === undefined) return null;
    held = ni === was ? Math.min(held + 1, react) : 1;
    b = (b + (ni - 1) * move + bins) % bins;
    di = ni;
    turns.push(TURNS[ni] ?? 0);
  }
  return turns;
}

/** Whether a person gets through `wave` from any angle, whatever they hold, even having just changed it. */
function humanPassable(wave: Wave, player: Player = {}): boolean {
  const start = ways(wave, player, false)?.tables[0];
  return start !== undefined && start.every((need) => need <= 1);
}

/**
 * Every wave a person cannot get through, named by its chapter and number. A person reacts: each
 * change of what they hold (◀, ▶ or nothing) comes at least `RULES.reactionSeconds` after the last,
 * and the orbs turn no faster than ◀ or ▶ held turns them. Each wave must be passable so from any
 * angle, whatever is held and however recently it changed: no way through one wave leaves the orbs
 * where the next cannot be passed, and a wave begun again after a hit can be passed from wherever the
 * orbs stand. `player` plays a slower person, or wider orbs, to prove room to spare.
 */
export function waveProblems(chapters: readonly Chapter[], player: Player = {}): string[] {
  return chapters.flatMap((chapter) => chapter.waves.flatMap((wave, i) =>
    humanPassable(wave, player) ? [] : [`chapter ${chapter.numeral} · ${chapter.name}, wave ${i + 1}: no human way through`]));
}

// ── The chapters ─────────────────────────────────────────────────────────────────────────────────
//
// Written for a pair that turns slowly (0.6 turns a second), in Duet's way: each obstacle asks one
// pose, and a wave chains them so a person reads it as poses to hold and turns to make. Runs of the
// same obstacle, evenly spaced, are passed by holding the pose; obstacles of either pose at equal
// gaps by a steady back-and-forth. The waves fall about 2 R a second, as Duet's do, and are short:
// three to six obstacles, 8 seconds at most from the first entering to the last passing the orbs,
// and none passed by holding the orbs still. Chapter I (95 to 113 px/s) alternates still half bars
// and centre blocks 1.75 to 2.25 R apart, one idea a wave, each asking two changes of pose at the
// least; II (105 to 123) brings in sliding ones, III (115 to 133) turning ones, and IV (125 to 143)
// mixes all three, tighter, down to 1.25 R within a run of one pose.

const DRIFT = [
  `speed 95
   L half · 0
   centre · 2.25R
   R half · 2.25R`,
  `speed 97
   centre · 0
   R half · 2R
   centre · 2R
   L half · 2R`,
  `speed 99
   L half · 0
   R half · 1.5R
   centre · 2R
   L half · 2R`,
  `speed 101
   centre · 0
   centre · 1.5R
   L half · 2R
   centre · 2R`,
  `speed 103
   R half · 0
   centre · 1.75R
   L half · 1.75R
   centre · 1.75R
   R half · 1.75R`,
  `speed 105
   L half · 0
   L half · 1.5R
   centre · 2R
   centre · 1.5R
   R half · 2R`,
  `speed 107
   centre · 0
   R half · 1.75R
   centre · 1.75R
   L half · 1.75R
   centre · 1.75R`,
  `speed 109
   R half · 0
   L half · 1.5R
   R half · 1.5R
   centre · 2R
   L half · 2R`,
  `speed 111
   centre · 0
   centre · 1.5R
   centre · 1.5R
   R half · 2R
   centre · 2R`,
  `speed 113
   L half · 0
   centre · 1.75R
   R half · 1.75R
   centre · 1.75R
   L half · 1.75R`,
];

const SLIDE = [
  `speed 105
   L half slide · 0
   centre · 2R
   R half slide · 2R
   centre slide · 2R`,
  `speed 107
   centre slide · 0
   L half · 2R
   centre slide back · 2R
   R half slide · 2R`,
  `speed 109
   R half slide · 0
   R half slide back · 1.5R
   centre slide · 2R
   L half slide · 2R
   centre · 2R`,
  `speed 111
   L half slide · 0
   centre slide · 2R
   centre slide back · 1.5R
   R half slide · 2R
   L half slide back · 1.5R`,
  `speed 113
   centre slide · 0
   R half slide · 2R
   centre slide back · 2R
   L half slide back · 2R
   centre · 2R`,
  `speed 115
   R half slide back · 0
   L half slide · 1.5R
   centre slide · 2R
   R half · 2R
   centre slide back · 2R`,
  `speed 117
   centre slide · 0
   centre slide back · 1.25R
   L half slide · 1.75R
   R half slide · 1.25R
   centre slide · 1.75R
   L half slide back · 1.75R`,
  `speed 119
   L half slide · 0
   centre slide · 2R
   R half slide back · 2R
   centre slide back · 2R
   L half slide · 2R`,
  `speed 121
   R half slide · 0
   L half slide back · 1.5R
   R half slide · 1.5R
   centre slide back · 2R
   centre slide · 1.5R
   L half slide · 2R`,
  `speed 123
   centre slide · 0
   L half slide · 1.75R
   centre slide back · 1.75R
   R half slide back · 1.75R
   centre slide · 1.75R
   L half slide · 1.75R`,
];

const SPIN = [
  `speed 115
   centre turn · 0
   L half · 1.75R
   centre turn back · 1.75R
   R half · 1.75R`,
  `speed 117
   L half turn · 0
   centre · 1.75R
   R half · 1.75R
   centre turn · 1.75R`,
  `speed 119
   R half turn · 0
   centre turn · 1.5R
   L half slide · 1.5R
   centre · 1.5R
   R half · 1.5R`,
  `speed 121
   L half turn · 0
   L half turn back · 1R
   centre turn · 1.75R
   centre turn back · 1R
   R half slide · 1.75R`,
  `speed 123
   centre turn · 0
   R half turn · 1.5R
   centre turn back · 1.5R
   L half · 1.5R
   centre slide · 1.5R`,
  `speed 125
   R half turn back · 0
   R half slide · 1R
   centre turn · 1.75R
   L half turn · 1.75R
   centre · 1.75R`,
  `speed 127
   centre turn · 0
   centre turn back · 1R
   L half turn · 1.75R
   R half slide back · 1R
   centre slide · 1.75R`,
  `speed 129
   L half turn · 0
   centre turn back · 1.6R
   R half turn · 1.6R
   centre turn · 1.6R
   L half · 1.6R`,
  `speed 131
   R half turn · 0
   L half turn back · 1R
   centre turn · 1.75R
   centre slide · 1R
   L half turn · 1.75R`,
  `speed 133
   centre turn back · 0
   L half turn · 1.6R
   centre turn · 1.6R
   R half · 1.6R
   centre turn back · 1.6R`,
];

const STORM = [
  `speed 125
   L half · 0
   R half slide · 1.25R
   centre turn · 1.75R
   centre · 1.25R
   L half turn · 1.75R`,
  `speed 127
   centre turn · 0
   centre slide · 1.25R
   R half · 1.75R
   L half slide back · 1.25R
   centre · 1.75R`,
  `speed 129
   R half turn · 0
   L half · 1.25R
   centre slide · 1.75R
   R half slide · 1.75R
   centre turn back · 1.75R`,
  `speed 131
   centre slide · 0
   L half turn · 1.75R
   L half slide · 1.25R
   centre · 1.75R
   centre turn · 1.25R
   R half · 1.75R`,
  `speed 133
   L half slide · 0
   centre turn back · 1.75R
   R half · 1.75R
   R half turn · 1.25R
   centre slide · 1.75R`,
  `speed 135
   centre · 0
   L half slide · 1.75R
   R half slide back · 1.25R
   centre turn · 1.75R
   centre slide back · 1.25R
   L half · 1.75R`,
  `speed 137
   R half slide · 0
   centre turn · 1.75R
   L half turn · 1.75R
   centre slide · 1.75R
   R half · 1.75R`,
  `speed 139
   centre turn · 0
   R half slide back · 1.75R
   L half · 1.25R
   centre slide · 1.75R
   centre · 1.25R
   R half turn · 1.75R`,
  `speed 141
   L half turn · 0
   centre · 1.75R
   R half slide · 1.75R
   L half slide back · 1.25R
   centre turn back · 1.75R`,
  `speed 143
   centre slide · 0
   centre turn · 1.25R
   L half · 1.75R
   R half turn back · 1.25R
   centre · 1.75R
   L half slide · 1.75R`,
];

/** The four chapters, in the order they are played. */
export const CHAPTERS: readonly Chapter[] = Object.freeze([
  parseChapter('I', 'DRIFT', DRIFT),
  parseChapter('II', 'SLIDE', SLIDE),
  parseChapter('III', 'SPIN', SPIN),
  parseChapter('IV', 'STORM', STORM),
]);

// ── Endless mode ─────────────────────────────────────────────────────────────────────────────────

/** The one seed every endless run draws its waves from: the same waves for every player. */
export const ENDLESS_SEED = 0x1633;

/**
 * How endless waves are drawn: one to `maxGroups` of `ENDLESS_GROUPS`, each `spacing` behind the one
 * before (2.5 R: at the top speed, room for a quarter turn and a person's reaction to spare), the
 * first `lead` above the playfield; the speed starts at `speed`, 145 px/s, just above chapter IV's
 * fastest (143), rises by one every `rise` waves and stops at `topSpeed`, 155 px/s, so every wave
 * stays passable for a person however long the run.
 */
const ENDLESS = Object.freeze({ speed: 145, rise: 5, topSpeed: 155, maxGroups: 3, spacing: '2.5R', lead: '0.25R' });

/**
 * The groups an endless wave is built from: chapter IV's own obstacles, cut where a wave asks a new
 * pose, so each group is a run of one pose as chapter IV spaced it; each group once. A group's first
 * line keeps only its words: the wave sets its distance.
 */
export const ENDLESS_GROUPS: readonly (readonly string[])[] = Object.freeze([...new Map(STORM.flatMap((text) => {
  const lines = text.split('\n').slice(1).map((l) => l.trim()).filter((l) => l !== '');
  const groups: string[][] = [];
  let pose: Pose | undefined;
  for (const line of lines) {
    const { words } = splitLine(line);
    const now = POSE[readWords(words).kind].pose;
    if (now !== pose) groups.push([words]);
    else groups.at(-1)?.push(line);
    pose = now;
  }
  return groups.map((g) => [JSON.stringify(g), Object.freeze(g)] as const);
})).values()]);

/** A small seeded generator (mulberry32): the same seed gives the same numbers, in [0, 1). */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const drawn = new Map<number, Wave>();

/** Endless wave `n` (from 0): drawn from `ENDLESS_SEED` and its number alone, so any wave is reached at once. */
export function endlessWave(n: number): Wave {
  const known = drawn.get(n);
  if (known) return known;
  const next = random(Math.imul(ENDLESS_SEED, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b));
  const pick = () => ENDLESS_GROUPS[Math.floor(next() * ENDLESS_GROUPS.length)] ?? ['centre'];
  const count = 1 + Math.floor(next() * ENDLESS.maxGroups);
  const lines = Array.from({ length: count }, (_, i) => {
    const [first = 'centre', ...rest] = pick();
    return [`${first} · ${i === 0 ? ENDLESS.lead : ENDLESS.spacing}`, ...rest];
  }).flat();
  const speed = Math.min(ENDLESS.topSpeed, ENDLESS.speed + Math.floor(n / ENDLESS.rise));
  const wave = parseWave([`speed ${speed}`, ...lines].join('\n'), `endless, wave ${n + 1}`);
  if (drawn.size >= 64) drawn.clear();
  drawn.set(n, wave);
  return wave;
}

/** The first `count` endless waves. */
export const endlessWaves = (count: number): Wave[] => Array.from({ length: count }, (_, n) => endlessWave(n));
