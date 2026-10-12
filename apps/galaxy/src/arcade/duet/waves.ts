// OMNI DUET's waves (PRD 1633, issues 1672 and 1689): four chapters written by hand as text, one
// wave per entry, and the checks that prove every wave passable. A wave is a few obstacles that fall
// one behind the other, at the wave's speed and faster over its last stretch; it is passed once its
// last obstacle is entirely below the circle. Every obstacle is a word of a small vocabulary set on
// the circle, never on a grid: a still one is dodged by one clear pose of the pair, upright (12 and 6
// o'clock) or level (3 and 9 o'clock), and hits the other; a moving one, a centre block sliding across
// the circle or a rod turning on it, hits every pose held still and is dodged by turning the pair
// with it, ◀ or ▶. The waves sit in one text block so a follow-up tunes them without touching the
// engine, and `waveProblems` keeps every wave passable whatever the tuning.
import { hits, corners, type Block } from './collide';
import { orbs, RULES } from './rules';

/** The circle's radius, R: every size and distance of the vocabulary is counted in it. */
const R = RULES.radius;

/**
 * The vocabulary's sizes, in R, so a follow-up tunes them in one place. With R = 56 and orbs of
 * radius 6:
 *
 * - a half bar, 2 R long and 0.3 R thick (112 × 17 px), from the left or the right towards the
 *   centre, its inner end stopping R/3 (19 px) short of the centre line: upright, the orbs stand 13 px
 *   clear of it; level, the orb on its side is inside it. It never moves: moving, it only ever moved
 *   away from the upright orbs, so its motion changed nothing (issue 1689);
 * - a centre block, a square 0.75 R wide (42 px) on the centre line: level, the orbs stand 29 px
 *   clear of it; upright, they are inside it;
 * - a sliding centre block swings across the whole circle as it falls, its middle `slide.reach` R
 *   either side of the centre line, from one side to the other over `slide.across` R of fall, on a
 *   path fixed in the playfield: it stands at its far side as its middle crosses the centre's height
 *   (where the level orb on that side is) and on the centre line as it crosses the upright orbs'
 *   heights, so it sweeps half the circle, top to bottom, and every pose held still is struck;
 * - a rod, `rod.length` R long and `rod.thick` R thick (Duet's own, measured: 123 × 18 px), turns
 *   about its middle on the centre line, `spinTurnsPerSecond` turns a second, as fast as ◀ or ▶ turns
 *   the pair, lying level as its middle crosses the centre's height: its ends reach past the level
 *   orbs and its middle runs down the upright ones, so every pose held still is struck, and turning
 *   the pair with it clears it (a shorter rod never reaches the level orbs; a slower one leaves no
 *   way round its ends at chapter IV's speeds).
 */
export const SHAPE = Object.freeze({
  half: Object.freeze({ length: 2, thick: 0.3, short: 1 / 3 }),
  centre: Object.freeze({ side: 0.75 }),
  slide: Object.freeze({ reach: 1, across: 2 }),
  rod: Object.freeze({ length: 2.2, thick: 0.33 }),
  spinTurnsPerSecond: 0.6,
  /** A ghost is drawn whole until its middle enters the playfield, and is gone once its middle is `gone` R above the circle's top. */
  ghost: Object.freeze({ gone: 2 }),
});

/**
 * How each wave speeds up at its end: over its last `share` of its time, the fall speeds up evenly to
 * `gain` above the wave's speed, which stays the speed it is written at (the fall only: the pair turns
 * as fast as ever). Chapter I speeds up gently, the rest fully.
 */
export const RAMP = Object.freeze({ share: 0.35, gentle: 0.15, full: 0.3 });

/** The two obstacles. */
export type Kind = 'half' | 'centre';

/** How an obstacle moves as it falls: not at all, side to side, or turning about its middle. */
export type Motion = 'still' | 'slide' | 'turn';

/** The two clear poses of the pair: upright, at 12 and 6 o'clock, and level, at 3 and 9 o'clock. */
export type Pose = 'upright' | 'level';

/** The one pose that dodges each still kind, at its angle: the pair is the same half a turn on. */
export const POSE: Readonly<Record<Kind, { pose: Pose; angle: number }>> = Object.freeze({
  half: { pose: 'upright', angle: Math.PI / 2 },
  centre: { pose: 'level', angle: 0 },
});

/**
 * One obstacle as written: its kind, its side (-1 left, 1 right, 0 the centre block's), how it moves,
 * whether it moves the other way round (`back`), whether it fades from sight before it reaches the
 * circle (`ghost`), and how far above the playfield's top its middle stands as the wave begins, in
 * game pixels.
 */
export interface Piece { kind: Kind; side: -1 | 0 | 1; motion: Motion; back: boolean; ghost: boolean; above: number }

/** A wave's speed-up: it begins `from` seconds into the wave and lasts `seconds`, ending `gain` above the wave's speed. */
export interface Ramp { from: number; seconds: number; gain: number }

/** A wave: `speed`, the speed it is written at and falls at until its speed-up, in game pixels a second. */
export interface Wave { speed: number; ramp: Ramp; pieces: readonly Piece[] }

export interface Chapter { numeral: string; name: string; waves: readonly Wave[] }

/**
 * The legend every wave is written in. A wave's first line is its speed, in game pixels a second:
 * `speed 60`. Each line after it is one obstacle, in the order they reach the orbs, written as its
 * words, a ` · `, then its distance behind the one before:
 *
 *   L half · 0          a half bar from the left (R from the right)
 *   centre · 2R         a centre block
 *
 * after which a centre block may `slide` across the circle or `turn`, a rod, and `back` the other way
 * round: a slide sets off to the right and sweeps the circle's left half, top to bottom, the way ◀
 * turns the pair, `slide back` the mirror, the way ▶ turns it; a rod turns anticlockwise, as ◀ turns
 * the pair, `turn back` clockwise. `ghost`, last, fades the obstacle from sight before it reaches the
 * circle; it is still there.
 *
 * The distance is in R, the circle's radius (`2R`, `1.5R`), or `0`: the free space between this
 * obstacle and the one before it, each taken at its full reach (a rod as the disc it sweeps).
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
  ghost: 'ghost',
});

/** An obstacle's size in game pixels, unturned: its width and its height. */
function sizeOf(piece: Pick<Piece, 'kind' | 'motion'>): { w: number; h: number } {
  if (piece.kind === 'half') return { w: SHAPE.half.length * R, h: SHAPE.half.thick * R };
  if (piece.motion === 'turn') return { w: SHAPE.rod.length * R, h: SHAPE.rod.thick * R };
  return { w: SHAPE.centre.side * R, h: SHAPE.centre.side * R };
}

/** Where an obstacle's middle stands across the playfield, before it slides. */
function anchorOf(kind: Kind, side: number): number {
  if (kind === 'half') return RULES.centre.x + side * (SHAPE.half.short + SHAPE.half.length / 2) * R;
  return RULES.centre.x;
}

/** How far an obstacle reaches above and below its middle: half its height, or for a rod the disc it sweeps. */
export function reachOf(piece: Pick<Piece, 'kind' | 'motion'>): number {
  const { w, h } = sizeOf(piece);
  return piece.motion === 'turn' ? Math.hypot(w, h) / 2 : h / 2;
}

/**
 * The turn that dodges a moving obstacle, the way it moves round the circle: 1 for ◀ (a slide or a
 * rod), -1 for ▶ (either `back`), 0 for a still one, which a pose dodges.
 */
export function wayOf(piece: Pick<Piece, 'motion' | 'back'>): -1 | 0 | 1 {
  if (piece.motion === 'still') return 0;
  return piece.back ? -1 : 1;
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

/** Reads how an obstacle moves from the words after its kind: nothing, `slide`, `turn back`. */
function readMotion(kind: Kind, words: readonly string[]): { motion: Motion; back: boolean } {
  const [moving, way, ...more] = words;
  if (moving === undefined) return { motion: 'still', back: false };
  if (!oneOf(LEGEND.motions, moving)) throw unknown(moving);
  if (kind === 'half') throw new Error('a half bar does not move');
  if (way !== undefined && way !== LEGEND.back) throw unknown(way);
  if (more.length) throw unknown(more[0]);
  return { motion: moving, back: way === LEGEND.back };
}

/** Reads an obstacle's words: `L half`, `centre slide`, `centre turn back ghost`. Throws a refusal's message. */
function readWords(text: string): Omit<Piece, 'above'> {
  const words = text.split(/\s+/).filter((w) => w !== '');
  const ghost = words.at(-1) === LEGEND.ghost;
  const { kind, side, used } = readKind(ghost ? words.slice(0, -1) : words);
  return { kind, side, ...readMotion(kind, words.slice(used, ghost ? -1 : undefined)), ghost };
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

/** The lowest the orbs reach: a block entirely below it can no longer touch them. */
const BELOW = RULES.centre.y + RULES.radius + RULES.orbRadius;

/**
 * A wave's speed-up, `gain` above `speed` at its end: the wave lasts `T`, from its start until its last
 * obstacle's reach is below the circle, and speeds up evenly over its last `RAMP.share` of it. At
 * `speed` until `from`, then `gain`·`speed`·`share`·T/2 further by the end: T·speed·(1 + gain·share/2)
 * is the fall that passes the wave.
 */
function rampOf(speed: number, pieces: readonly Piece[], gain: number): Ramp {
  const fall = Math.max(...pieces.map((p) => p.above + reachOf(p))) + BELOW;
  const seconds = fall / (speed * (1 + (gain * RAMP.share) / 2));
  return { from: seconds * (1 - RAMP.share), seconds: seconds * RAMP.share, gain };
}

/** Reads one wave's text. `where` names it in a refusal: `chapter II · SLIDE, wave 4`. `gain` is its speed-up. */
export function parseWave(text: string, where: string, gain: number = RAMP.full): Wave {
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
  const speed = Number(header[1]);
  return { speed, ramp: rampOf(speed, pieces, gain), pieces };
}

/** Reads a chapter's waves, each refused with the chapter, the wave and the line of what is wrong. */
export function parseChapter(numeral: string, name: string, texts: readonly string[], gain: number = RAMP.full): Chapter {
  return { numeral, name, waves: texts.map((t, i) => parseWave(t, `chapter ${numeral} · ${name}, wave ${i + 1}`, gain)) };
}

// ── The fall ─────────────────────────────────────────────────────────────────────────────────────

/** The wave's fall speed `t` seconds after it began: its speed, then evenly faster over its speed-up. */
export function speedAt(wave: Wave, t: number): number {
  const { from, seconds, gain } = wave.ramp;
  return wave.speed * (1 + gain * Math.min(1, Math.max(0, (t - from) / seconds)));
}

/** How far the wave has fallen `t` seconds after it began: its speed integrated, the speed-up included. */
export function fallen(wave: Wave, t: number): number {
  const { from, seconds, gain } = wave.ramp;
  const v = wave.speed;
  if (t <= from) return v * t;
  const ramped = Math.min(t - from, seconds);
  return v * t + (gain * v * ramped * ramped) / (2 * seconds) + gain * v * Math.max(0, t - from - seconds);
}

/** The time the wave has fallen `d` pixels: `fallen`'s inverse. */
export function timeAt(wave: Wave, d: number): number {
  const { from, seconds, gain } = wave.ramp;
  const v = wave.speed;
  if (d <= v * from || gain === 0) return d / v;
  if (d >= fallen(wave, from + seconds)) return (d + gain * v * (from + seconds / 2)) / (v * (1 + gain));
  // Within the speed-up: v (from + x) + gain v x² / (2 seconds) = d.
  const a = (gain * v) / (2 * seconds);
  return from + (-v + Math.sqrt(v * v + 4 * a * (d - v * from))) / (2 * a);
}

/** A back-and-forth between -1 and 1, at 1 when `u` is 0, at -1 when `u` is ±1, every 2. */
function swing(u: number): number {
  const p = ((u % 2) + 3) % 2 - 1;
  return 1 - 2 * Math.abs(p);
}

/** Where a sliding centre block's middle stands across the playfield as its middle stands at height `cy`: its path is fixed. */
function slid(p: Piece, cy: number): number {
  // At its far side (the left for `slide`, the right for `back`) as it crosses the centre's height.
  return (p.back ? 1 : -1) * SHAPE.slide.reach * R * swing((cy - RULES.centre.y) / (SHAPE.slide.across * R));
}

/** The wave's obstacles `tick` sub-steps after it began to enter: fallen, slid and turned. */
export function blocksAt(wave: Wave, tick: number): Block[] {
  const t = tick * RULES.subStep;
  const down = fallen(wave, t);
  return wave.pieces.map((p) => {
    const { w, h } = sizeOf(p);
    const cy = -p.above + down;
    const cx = anchorOf(p.kind, p.side) + (p.motion === 'slide' ? slid(p, cy) : 0);
    // A rod lies level as its middle crosses the centre's height: there it reaches past the level orbs.
    const angle = p.motion === 'turn' ? wayOf(p) * Math.PI * 2 * SHAPE.spinTurnsPerSecond * (t - timeAt(wave, RULES.centre.y + p.above)) : 0;
    return { cx, cy, w, h, angle };
  });
}

/**
 * How much of an obstacle is seen, from 1 to 0: a ghost is whole until its middle enters the
 * playfield, then fades evenly until it is `SHAPE.ghost.gone` R above the circle's top, and is unseen
 * from there; any other is always whole. Only what is seen: a ghost strikes as any obstacle does.
 */
export function sightOf(piece: Pick<Piece, 'ghost'>, block: Pick<Block, 'cy'>): number {
  if (!piece.ghost) return 1;
  const gone = RULES.centre.y - RULES.radius - SHAPE.ghost.gone * R;
  return Math.min(1, Math.max(0, (gone - block.cy) / gone));
}

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
 * The seconds the pair needs between two obstacles: none when both are still and ask the same pose,
 * else the time ◀ or ▶ held takes to turn from one pose to the other (a quarter turn; the pair looks
 * the same half a turn on, so no turn between two poses is longer) plus a person's reaction delay. A
 * moving obstacle asks a turn, so one before or after it asks that quarter turn and reaction too.
 */
export function turnSeconds(from: Pick<Piece, 'kind' | 'motion'>, to: Pick<Piece, 'kind' | 'motion'>): number {
  const quarter = 0.25 / RULES.turnsPerSecond + RULES.reactionSeconds;
  if (from.motion !== 'still' || to.motion !== 'still') return quarter;
  return POSE[from.kind].pose === POSE[to.kind].pose ? 0 : quarter;
}

/** The free space between two obstacles that follow each other in a wave, in game pixels, each at its full reach. */
export function spaceBetween(before: Piece, after: Piece): number {
  return after.above - reachOf(after) - (before.above + reachOf(before));
}

/**
 * Every pair of obstacles that follow each other too closely, named by chapter, wave and line: one
 * asking a turn must stand at least the turn's time plus the reaction delay behind the one before, at
 * the speed the wave falls at as it reaches the circle's middle (its speed-up counted: the speed never
 * falls, so no faster speed passes the gap). Two still ones asking the same pose may follow as
 * closely as they like.
 */
export function spacingProblems(chapters: readonly Chapter[]): string[] {
  return chapters.flatMap((chapter) => chapter.waves.flatMap((wave, i) => wave.pieces.flatMap((p, k) => {
    const before = wave.pieces[k - 1];
    if (!before) return [];
    const need = turnSeconds(before, p) * speedAt(wave, timeAt(wave, RULES.centre.y + p.above));
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


// ── Spirals and zigzags ──────────────────────────────────────────────────────────────────────────

/**
 * The sub-steps obstacle `k` of `wave` can strike the orbs at, the first and the last: while it covers
 * a bin of the ring. Null when it never does.
 */
export function windowOf(wave: Wave, k: number): { first: number; last: number } | null {
  const piece = wave.pieces[k];
  const last = passTick(wave);
  if (!piece || !last) return null;
  const covers = coverage({ ...wave, pieces: [piece] }, RULES.orbRadius, ring().bins);
  let first = 0, end = 0;
  for (let tick = 1; tick <= last; tick++) {
    if (!covers(tick)) continue;
    if (!first) first = tick;
    end = tick;
  }
  return first ? { first, last: end } : null;
}

/**
 * Whether a person gets through `wave` holding only the turns `allowed` from sub-step `from` to `to`
 * (1 ◀, -1 ▶, 0 still), each change of what they hold the reaction delay after the last, from any
 * angle as the wave begins: the check's search, worked forwards.
 */
export function throughHolding(wave: Wave, from: number, to: number, allowed: readonly (-1 | 0 | 1)[]): boolean {
  const last = passTick(wave);
  if (!last) return false;
  const { bins, move } = ring();
  const react = Math.max(1, Math.round(RULES.reactionSeconds / RULES.subStep));
  const blockedAt = coverage(wave, RULES.orbRadius, bins);
  const index = (b: number, di: number, held: number) => (b * 3 + di) * react + held - 1;
  // As the wave begins the person may stand anywhere, holding anything, held long enough to change.
  let alive = new Uint8Array(bins * 3 * react);
  for (let b = 0; b < bins; b++) for (let di = 0; di < 3; di++) alive[index(b, di, react)] = 1;
  for (let tick = 1; tick <= last; tick++) {
    const blocked = blockedAt(tick);
    const fits = (di: number) => tick < from || tick > to || allowed.includes(TURNS[di] ?? 0);
    const next = new Uint8Array(alive.length);
    alive.forEach((on, i) => {
      if (!on) return;
      const held = (i % react) + 1, di = Math.floor(i / react) % 3, b = Math.floor(i / react / 3);
      for (let ni = 0; ni < 3; ni++) {
        if ((ni !== di && held < react) || !fits(ni)) continue;
        const nb = (b + (ni - 1) * move + bins) % bins;
        if (!blocked?.[nb]) next[index(nb, ni, ni === di ? Math.min(held + 1, react) : 1)] = 1;
      }
    });
    if (!next.includes(1)) return false;
    alive = next;
  }
  return true;
}

/**
 * A run of three moving obstacles or more, in a row: a spiral when each moves the same way round, so
 * the pair turns that way through the whole run; a zigzag when each moves the other way round from
 * the one before, so the pair changes its turn at every one.
 */
export interface Pattern { shape: 'spiral' | 'zigzag'; first: number; last: number }

/** The spirals and zigzags `wave` is written with, by its obstacles' words: the tests prove each one asks what it says. */
export function patternsOf(wave: Wave): Pattern[] {
  const found: Pattern[] = [];
  const ways = wave.pieces.map(wayOf);
  for (const shape of ['spiral', 'zigzag'] as const) {
    const follows = (k: number) => ways[k] !== 0 && ways[k - 1] !== 0 && (shape === 'spiral' ? ways[k] === ways[k - 1] : ways[k] === -(ways[k - 1] ?? 0));
    let first = 0;
    for (let k = 1; k <= ways.length; k++) {
      if (k < ways.length && follows(k)) continue;
      if (k - first >= 3) found.push({ shape, first, last: k - 1 });
      first = k;
    }
  }
  return found;
}

// ── The chapters ─────────────────────────────────────────────────────────────────────────────────
//
// Written for a pair that turns slowly (0.6 turns a second), in Duet's way: each still obstacle asks
// one pose, each moving one a turn, and a wave chains them so a person reads it as poses to hold and
// turns to make. The waves fall about 2 R a second, as Duet's do, speeding up over their last 35%,
// and are short: three to six obstacles, 8 seconds at most from the first entering to the last
// passing the orbs, and none passed by holding the orbs still. Chapter I (95 to 113 px/s, +15% at
// each wave's end) alternates still half bars and centre blocks 1.75 to 2.25 R apart, one idea a wave,
// each asking two changes of pose at the least. II (105 to 123, +30% from here on) brings in the
// sliding block, III (115 to 133) the rod, and IV (125 to 143) mixes all three, its moving obstacles
// 2.4 R apart (room for a quarter turn and a reaction at endless mode's top speed, sped up), down to
// 1.25 R within a run of one pose; its last four waves hide some obstacles (`ghost`), its eighth is
// rods alone and its ninth ghosts alone. From chapter II, each chapter chains moving obstacles into
// spirals, three or more that move the same way round, passed holding that one turn, and zigzags,
// three or more each moving the other way round from the one before, which ask a change of turn at
// every one (`patternsOf`).

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
   L half · 0
   centre slide · 2R
   R half · 2R
   centre · 1.75R`,
  `speed 107
   centre · 0
   centre slide back · 2R
   L half · 2R
   centre slide · 2R`,
  `speed 109
   centre slide · 0
   centre slide · 2R
   centre slide · 2R
   R half · 2R`,
  `speed 111
   R half · 0
   centre slide · 2R
   centre slide back · 2R
   centre slide · 2R`,
  `speed 113
   centre slide back · 0
   centre slide back · 2R
   centre slide back · 2R
   centre · 2R`,
  `speed 115
   L half · 0
   L half · 1.5R
   centre slide back · 2R
   centre slide · 2R
   centre slide back · 2R`,
  `speed 117
   centre slide · 0
   centre slide · 2R
   centre slide · 2R
   centre slide · 2R
   R half · 2.25R`,
  `speed 119
   centre slide back · 0
   centre slide · 2R
   centre slide back · 2R
   centre slide · 2R`,
  `speed 121
   centre · 0
   centre slide back · 2R
   centre slide back · 2R
   centre slide back · 2R
   L half · 2.25R`,
  `speed 123
   centre slide · 0
   centre slide back · 2R
   centre slide · 2R
   R half · 2.25R
   centre slide back · 2.25R`,
];

const SPIN = [
  `speed 115
   L half · 0
   centre turn · 2R
   R half · 2R
   centre · 1.75R`,
  `speed 117
   centre · 0
   centre turn back · 2R
   L half · 2R
   centre turn · 2R`,
  `speed 119
   centre turn · 0
   centre turn · 2R
   centre turn · 2R`,
  `speed 121
   R half · 0
   centre turn · 2R
   centre turn back · 2R
   centre turn · 2R`,
  `speed 123
   centre turn back · 0
   centre turn back · 2R
   centre turn back · 2R
   centre · 2R`,
  `speed 125
   centre slide · 0
   centre turn back · 2R
   centre turn · 2R
   centre turn back · 2R`,
  `speed 127
   L half · 0
   R half · 1.5R
   centre turn · 2R
   centre slide · 2R
   centre turn · 2R`,
  `speed 129
   centre turn · 0
   centre slide back · 2R
   centre turn · 2R
   centre slide back · 2R`,
  `speed 131
   centre · 0
   centre turn back · 2R
   centre slide back · 2R
   centre turn back · 2R
   L half · 2.25R`,
  `speed 133
   centre turn · 0
   centre turn back · 2.25R
   centre turn · 2.25R
   R half · 2.25R`,
];

const STORM = [
  `speed 125
   L half · 0
   R half · 1.25R
   centre slide · 2.4R
   centre turn · 2.4R
   centre slide · 2.4R`,
  `speed 127
   centre · 0
   centre turn back · 2.4R
   centre slide · 2.4R
   centre turn back · 2.4R`,
  `speed 129
   centre slide back · 0
   centre turn back · 2.4R
   centre slide back · 2.4R
   L half · 2.4R
   R half · 1.25R`,
  `speed 131
   R half · 0
   centre turn · 2.4R
   centre slide back · 2.4R
   centre turn · 2.4R`,
  `speed 133
   centre turn · 0
   centre turn · 2.4R
   centre slide · 2.4R
   centre · 2.25R`,
  `speed 135
   L half · 0
   L half · 1.25R
   centre slide back · 2.4R
   centre slide · 2.4R
   centre slide back · 2.4R`,
  `speed 137
   centre slide · 0
   centre slide ghost · 2.4R
   centre slide · 2.4R
   R half ghost · 2.4R
   L half · 1.25R`,
  `speed 139
   centre turn · 0
   centre turn back ghost · 2.4R
   centre turn · 2.4R`,
  `speed 141
   L half ghost · 0
   centre ghost · 2R
   R half ghost · 2R
   centre slide back ghost · 2.4R`,
  `speed 143
   centre turn back · 0
   centre turn back ghost · 2.4R
   centre turn back · 2.4R
   centre ghost · 2.4R`,
];

/** The four chapters, in the order they are played: chapter I speeds up gently at each wave's end, the others fully. */
export const CHAPTERS: readonly Chapter[] = Object.freeze([
  parseChapter('I', 'DRIFT', DRIFT, RAMP.gentle),
  parseChapter('II', 'SLIDE', SLIDE),
  parseChapter('III', 'SPIN', SPIN),
  parseChapter('IV', 'STORM', STORM),
]);

// ── Endless mode ─────────────────────────────────────────────────────────────────────────────────

/** The one seed every endless run draws its waves from: the same waves for every player. */
export const ENDLESS_SEED = 0x1633;

/**
 * How endless waves are drawn: one to `maxGroups` of `ENDLESS_GROUPS`, each `spacing` behind the one
 * before (2.5 R: at the top speed, sped up, room for a quarter turn and a person's reaction to
 * spare), the first `lead` above the playfield; the speed starts at `speed`, 145 px/s, just above
 * chapter IV's fastest (143), rises by one every `rise` waves and stops at `topSpeed`, 155 px/s, so
 * every wave stays passable for a person however long the run. Each speed is the wave's own, the one
 * it falls at until its speed-up, as a chapter wave's is; the speed-up is the chapters' own. A wave
 * whose groups would all ask one still pose draws its last group again, so none is passed held
 * still; one longer than `longest` seconds drops its last group, never its first.
 *
 * From wave `ghosts.from` (counted from 0), each obstacle is a ghost by chance, `ghosts.start` at
 * first, `ghosts.rise` more each wave, never more than `ghosts.most`, and never every obstacle of a
 * wave: its first then stays in sight. From the same wave, one wave in `themes.every`, by chance, is
 * themed as chapter IV's late waves are: rods alone, or every obstacle a ghost.
 */
const ENDLESS = Object.freeze({
  speed: 145, rise: 5, topSpeed: 155, maxGroups: 3, spacing: '2.5R', lead: '0.25R', longest: 8,
  ghosts: Object.freeze({ from: 10, start: 0.1, rise: 0.002, most: 0.4 }),
  themes: Object.freeze({ from: 10, every: 8 }),
});

/** The pose a still obstacle asks, or `turning` for a moving one, which a turn of the pair dodges. */
const askOf = (p: Pick<Piece, 'kind' | 'motion'>): Pose | 'turning' => (p.motion === 'still' ? POSE[p.kind].pose : 'turning');

/**
 * The groups an endless wave is built from: chapter IV's own obstacles, cut where a wave asks a new
 * pose (its moving obstacles asking a turn, so a spiral or a zigzag stays whole), so each group is a
 * run as chapter IV spaced it; each group once, without its ghosts, which endless mode draws itself.
 * A group's first line keeps only its words: the wave sets its distance.
 */
export const ENDLESS_GROUPS: readonly (readonly string[])[] = Object.freeze([...new Map(STORM.flatMap((text) => {
  const lines = text.split('\n').slice(1).map((l) => l.trim().replace(/ ghost(?= · |$)/, '')).filter((l) => l !== '');
  const groups: string[][] = [];
  let ask: Pose | 'turning' | undefined;
  for (const line of lines) {
    const { words } = splitLine(line);
    const now = askOf(readWords(words));
    if (now !== ask) groups.push([words]);
    else groups.at(-1)?.push(line);
    ask = now;
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

/** The share of endless wave `n`'s obstacles that are ghosts, by chance. */
export function ghostShare(n: number): number {
  const { from, start, rise, most } = ENDLESS.ghosts;
  return n < from ? 0 : Math.min(most, start + (n - from) * rise);
}

/** The seconds from a wave's first obstacle entering the playfield to its last passing the orbs. */
export function secondsOf(wave: Wave): number {
  const first = wave.pieces[0];
  const enters = first ? timeAt(wave, first.above - reachOf(first)) : 0;
  return passTick(wave) * RULES.subStep - enters;
}

/** The groups of rods alone: a turning wave is drawn from them alone. */
const TURNING_GROUPS = ENDLESS_GROUPS.filter((g) => g.every((line) => readWords(splitLine(line).words).motion === 'turn'));

/** A wave of `groups`, at `speed`, each obstacle marked a ghost where `ghosts` says, group by group. */
function endlessOf(groups: readonly (readonly string[])[], ghosts: readonly (readonly boolean[])[], speed: number, where: string): Wave {
  const lines = groups.flatMap((group, i) => group.map((line, k) => {
    const written = k === 0 ? `${line} · ${i === 0 ? ENDLESS.lead : ENDLESS.spacing}` : line;
    return ghosts[i]?.[k] ? written.replace(' · ', ' ghost · ') : written;
  }));
  return parseWave([`speed ${speed}`, ...lines].join('\n'), where);
}

/** Whether every obstacle of `groups` is still and asks one pose: held still, the wave would pass. */
function onePose(groups: readonly (readonly string[])[]): boolean {
  const pieces = groups.flat().map((line) => readWords(splitLine(line).words));
  return pieces.every((p) => p.motion === 'still') && new Set(pieces.map(askOf)).size === 1;
}

const drawn = new Map<number, Wave>();

/** Endless wave `n`'s theme, drawn by `theming`: none, mostly; from `themes.from`, one wave in `themes.every` is rods alone or ghosts alone. */
function themeOf(n: number, theming: () => number): 'turning' | 'ghost' | undefined {
  if (n < ENDLESS.themes.from || theming() >= 1 / ENDLESS.themes.every) return undefined;
  return theming() < 0.5 ? 'turning' : 'ghost';
}

/** One to `maxGroups` groups drawn by `next` from `pool`, the last drawn again while they would all ask one still pose. */
function drawGroups(pool: readonly (readonly string[])[], next: () => number): (readonly string[])[] {
  const pick = () => pool[Math.floor(next() * pool.length)] ?? ['centre'];
  const groups = Array.from({ length: 1 + Math.floor(next() * ENDLESS.maxGroups) }, pick);
  for (let tries = 0; onePose(groups) && tries < 64; tries++) groups[groups.length - 1] = pick();
  return groups;
}

/** Drops groups, the last first and never the first, while the wave lasts longer than `longest` seconds and still asks a turn without it. */
function trimmed(groups: (readonly string[])[], ghosts: boolean[][], speed: number, where: string): void {
  for (;;) {
    if (groups.length < 2 || secondsOf(endlessOf(groups, ghosts, speed, where)) <= ENDLESS.longest) return;
    const drop = [...groups.keys()].reverse().find((i) => i > 0 && !onePose(groups.filter((_, j) => j !== i)));
    if (drop === undefined) return;
    groups.splice(drop, 1);
    ghosts.splice(drop, 1);
  }
}

/** Endless wave `n` (from 0): drawn from `ENDLESS_SEED` and its number alone, so any wave is reached at once. */
export function endlessWave(n: number): Wave {
  const known = drawn.get(n);
  if (known) return known;
  const seed = Math.imul(ENDLESS_SEED, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b);
  // The theme, the groups and the ghosts are each drawn apart, so one never changes the others.
  const theme = themeOf(n, random(seed ^ 0x7e3a));
  const groups = drawGroups(theme === 'turning' ? TURNING_GROUPS : ENDLESS_GROUPS, random(seed));
  const chance = random(seed ^ 0x6057), share = ghostShare(n);
  const ghosts = groups.map((g) => g.map(() => theme === 'ghost' || chance() < share));
  const speed = Math.min(ENDLESS.topSpeed, ENDLESS.speed + Math.floor(n / ENDLESS.rise));
  const where = `endless, wave ${n + 1}`;
  trimmed(groups, ghosts, speed, where);
  if (theme !== 'ghost' && ghosts.flat().every(Boolean) && ghosts[0]) ghosts[0][0] = false;
  const wave = endlessOf(groups, ghosts, speed, where);
  if (drawn.size >= 64) drawn.clear();
  drawn.set(n, wave);
  return wave;
}

/** The first `count` endless waves. */
export const endlessWaves = (count: number): Wave[] => Array.from({ length: count }, (_, n) => endlessWave(n));
