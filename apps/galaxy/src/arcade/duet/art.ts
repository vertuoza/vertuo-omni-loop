// OMNI DUET's playfield on the canvas (PRD 1633): the 320×288 field over its chapter's backdrop (issue
// 1692: drifting squares, diagonal stripes, a dotted spiral, falling triangles, and a darker one for
// endless mode), the circle with nothing at its centre, the two orbs on it, each with its short trail
// (the warm one in the orange ramp, the cool one in the theme's cyan), and the wave's obstacles
// falling through it as Entropy blocks, in Entropy's ramp with spikes along their long edges, each
// with a soft trail fading upward above it, a ghost fading out before it reaches the circle. The
// scene places the field on the grid (scenes/duet.ts); this file draws in the field's own game
// pixels, with whole-pixel rectangles only, never moving or turning the canvas. Every colour equal to
// a theme token is read from the frame's theme (ADR-0046). Under reduced motion the backdrop stands
// still and no trail is drawn.
import { RAMPS, rampFrom } from '@omni/design';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Action } from '../keys';
import type { FrameState } from '../scenes/common.ts';
import type { DuetGame, DuetHud } from '../scenes/duet.ts';
import type { Theme } from '../theme';
import { corners, type Block } from './collide';
import { LINE_SECONDS, lineOf } from './lines';
import { orbs, RULES, type Point } from './rules';
import { CHAPTER_TITLES, crashWave, CRASH_SECONDS, newRun, pause, press, step, waveOf, wavesIn, type Crash, type Run } from './run';
import { placedAt, sightOf, type Wave } from './waves';

/** The warm orb's ramp, light to dark: no theme token is orange. */
const WARM = defined(RAMPS.O, 'the orange ramp');

/** The blocks' ramp, light to dark: Entropy's own, as the blob is drawn. No theme token is in it. */
const ENTROPY = defined(RAMPS.Z, "Entropy's ramp");

/** The sub-steps a wave's line shows for, once the wave begins. */
const LINE_STEPS = Math.round(LINE_SECONDS / RULES.subStep);

/**
 * What the text layer reads of a run: the wave is counted from 1, never past a chapter's last, and
 * with no last in endless mode; in a wave's first `LINE_SECONDS` of play, its line.
 */
export function hudOf(run: Run): DuetHud {
  const waves = wavesIn(run);
  const line = run.phase === 'play' && run.tick < LINE_STEPS ? lineOf(run) : '';
  return {
    phase: run.phase, chapter: defined(CHAPTER_TITLES[run.chapter], "the run's chapter"), endless: run.endless,
    wave: run.endless ? run.wave + 1 : Math.min(run.wave + 1, waves), waves, lives: run.lives, score: run.score,
    passed: run.passed, started: run.started, ...(line ? { line } : {}),
  };
}

/** A filled convex polygon, row by row on whole pixels: a turned block, drawn without turning the canvas. */
function polygon(ctx: CanvasRenderingContext2D, pts: readonly Point[]) {
  const ys = pts.map((p) => p.y);
  const top = Math.floor(Math.min(...ys)), bottom = Math.ceil(Math.max(...ys));
  for (let y = top; y < bottom; y++) {
    const mid = y + 0.5;
    let left = Infinity, right = -Infinity;
    pts.forEach((a, i) => {
      const b = defined(pts[(i + 1) % pts.length], 'the next corner');
      if ((a.y <= mid && b.y > mid) || (b.y <= mid && a.y > mid)) {
        const x = a.x + ((mid - a.y) / (b.y - a.y)) * (b.x - a.x);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    });
    if (right > left) ctx.fillRect(Math.round(left), y, Math.max(1, Math.round(right) - Math.round(left)), 1);
  }
}

/** One Entropy block: its dark edge, its body, a lit line along its top, and a spike every 4 pixels along its long edges. */
function block(ctx: CanvasRenderingContext2D, b: Block) {
  // The block's own directions on the screen: along its length, and out of its top edge.
  const along = { x: Math.cos(b.angle), y: -Math.sin(b.angle) }, up = { x: -Math.sin(b.angle), y: -Math.cos(b.angle) };
  ctx.fillStyle = defined(ENTROPY[3], "a block's edge");
  polygon(ctx, corners(b));
  ctx.fillStyle = defined(ENTROPY[1], "a block's body");
  polygon(ctx, corners({ ...b, w: b.w - 2, h: b.h - 2 }));
  ctx.fillStyle = defined(ENTROPY[0], "a block's light");
  const lit = b.h / 2 - 2;
  polygon(ctx, corners({ ...b, cx: b.cx + up.x * lit, cy: b.cy + up.y * lit, w: b.w - 4, h: 1 }));
  ctx.fillStyle = defined(ENTROPY[2], "a block's spikes");
  for (let d = -b.w / 2 + 2; d <= b.w / 2 - 2; d += 4) {
    for (const side of [1, -1]) {
      const out = side * (b.h / 2 + 1);
      ctx.fillRect(Math.round(b.cx + along.x * d + up.x * out), Math.round(b.cy + along.y * d + up.y * out), 1, 1);
    }
  }
}

/** A filled disc of radius `r` about (`cx`, `cy`), row by row on whole pixels. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const x0 = Math.round(cx), y0 = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x0 - w, y0 + dy, w * 2 + 1, 1);
  }
}

/** One orb: its body in the ramp's base, lit from the top left. */
function orb(ctx: CanvasRenderingContext2D, at: Point, ramp: readonly string[]) {
  ctx.fillStyle = defined(ramp[2], "an orb's shade");
  disc(ctx, at.x, at.y, RULES.orbRadius);
  ctx.fillStyle = defined(ramp[1], "an orb's colour");
  disc(ctx, at.x - 1, at.y - 1, RULES.orbRadius - 1);
  ctx.fillStyle = defined(ramp[0], "an orb's light");
  ctx.fillRect(Math.round(at.x) - 3, Math.round(at.y) - 3, 2, 2);
}

/** The circle the orbs ride, dotted in the theme's dim. */
function track(ctx: CanvasRenderingContext2D, s: FrameState) {
  ctx.fillStyle = s.theme.dim;
  const dots = 72;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2;
    ctx.fillRect(Math.round(RULES.centre.x + Math.cos(a) * RULES.radius), Math.round(RULES.centre.y - Math.sin(a) * RULES.radius), 1, 1);
  }
}

// ── The backdrops ─────────────────────────────────────────────────────────────────────────────────

/** The circle's hub, which no backdrop covers: the circle's centre stays the field's dark. */
const HUB = RULES.radius * 0.4;

const { w: W, h: H } = RULES.field;

/** One rectangle of a backdrop, on whole pixels, left out where it would reach into the hub. */
function speck(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const { x: cx, y: cy } = RULES.centre;
  const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(y, Math.min(cy, y + h));
  if (Math.hypot(nx - cx, ny - cy) < HUB) return;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** `v` wrapped into [0, `m`). */
const wrap = (v: number, m: number) => ((v % m) + m) % m;

/** A fixed scatter in [0, 1) for item `i`'s `k`th number: the same backdrop every frame. */
const scatter = (i: number, k: number) => wrap(Math.sin(i * 127.1 + k * 311.7) * 43758.5453, 1);

/** Chapter I's: hollow squares drifting slowly up. */
function squares(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 16; i++) {
    const size = 6 + Math.floor(scatter(i, 0) * 10);
    const x = scatter(i, 1) * W, y = wrap(scatter(i, 2) * (H + 24) - t * 6, H + 24) - 12;
    speck(ctx, x, y, size, 1);
    speck(ctx, x, y + size - 1, size, 1);
    speck(ctx, x, y + 1, 1, size - 2);
    speck(ctx, x + size - 1, y + 1, 1, size - 2);
  }
}

/** Chapter II's: dotted diagonal stripes sliding slowly across. */
function stripes(ctx: CanvasRenderingContext2D, t: number) {
  const gap = 24, shift = wrap(t * 5, gap);
  for (let k = -H; k < W; k += gap) for (let d = 0; d < H; d += 4) speck(ctx, k + shift + d, d, 2, 1);
}

/** Chapter III's: a spiral of dots about the circle's centre, turning slowly. */
function spiral(ctx: CanvasRenderingContext2D, t: number) {
  const turn = t * Math.PI * 2 * 0.03;
  for (let a = 0, r = HUB; r < 230; a += 8 / r, r = HUB + 9 * a) {
    speck(ctx, RULES.centre.x + Math.cos(a + turn) * r - 1, RULES.centre.y - Math.sin(a + turn) * r - 1, 2, 2);
  }
}

/** Chapter IV's: small triangles falling slowly, points down. */
function triangles(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 14; i++) {
    const size = 6 + Math.floor(scatter(i, 3) * 6);
    const x = scatter(i, 4) * W, y = wrap(scatter(i, 5) * (H + 24) + t * 10, H + 24) - 12;
    for (let r = 0; r < size; r++) speck(ctx, x - (size - r) / 2, y + r, size - r, 1);
  }
}

/** Endless mode's, darker: a few faint chevrons falling. */
function chevrons(ctx: CanvasRenderingContext2D, t: number) {
  for (let i = 0; i < 10; i++) {
    const x = scatter(i, 6) * W, y = wrap(scatter(i, 7) * (H + 16) + t * 14, H + 16) - 8;
    for (let d = 0; d < 4; d++) {
      speck(ctx, x - d, y + d, 1, 1);
      speck(ctx, x + d, y + d, 1, 1);
    }
  }
}

/** Each chapter's backdrop, in order, then endless mode's: its pattern, its colour (a theme token) and how strongly it is laid. */
const BACKDROPS: readonly { draw: (ctx: CanvasRenderingContext2D, t: number) => void; colour: (theme: Theme) => string; alpha: number }[] = [
  { draw: squares, colour: (theme) => theme.navy, alpha: 0.35 },
  { draw: stripes, colour: (theme) => theme['navy-dark'], alpha: 0.7 },
  { draw: spiral, colour: (theme) => theme['plasma-dark'], alpha: 0.35 },
  { draw: triangles, colour: (theme) => theme.red, alpha: 0.14 },
  { draw: chevrons, colour: (theme) => theme['navy-dark'], alpha: 0.4 },
];

/** The run's backdrop, dim behind everything: the chapter's, or endless mode's; still under reduced motion. */
function backdrop(ctx: CanvasRenderingContext2D, s: FrameState, run: Run) {
  const drop = defined(BACKDROPS[run.endless ? BACKDROPS.length - 1 : Math.min(run.chapter, BACKDROPS.length - 2)], 'a backdrop');
  ctx.fillStyle = drop.colour(s.theme);
  ctx.globalAlpha = drop.alpha;
  drop.draw(ctx, s.reduced ? 0 : s.t);
  ctx.globalAlpha = 1;
}

/** How a block's trail is drawn: `steps` copies of it, up to R above, each fainter, the nearest at `alpha`. */
const TRAIL: Readonly<{ steps: number; alpha: number }> = Object.freeze({ steps: 10, alpha: 0.08 });

/** A block's soft trail, fading upward above it as it falls, in the theme's plasma: `sight` of it, for a fading ghost. */
function blockTrail(ctx: CanvasRenderingContext2D, b: Block, colour: string, sight: number) {
  ctx.fillStyle = colour;
  for (let k = TRAIL.steps; k >= 1; k--) {
    ctx.globalAlpha = sight * TRAIL.alpha * (1 - (k - 1) / TRAIL.steps);
    polygon(ctx, corners({ ...b, cy: b.cy - (k * RULES.radius) / TRAIL.steps }));
  }
}

/** The wave on the screen and its sub-step: the one that struck while a crash shows, the one falling in play or under its pause, else none. */
function shownWave(run: Run): { wave: Wave; tick: number } | undefined {
  if (run.crash) {
    const wave = crashWave(run.crash);
    return wave && { wave, tick: run.crash.tick };
  }
  const falling = run.phase === 'play' || (run.phase === 'paused' && run.resume === 'play');
  const wave = falling ? waveOf(run) : undefined;
  return wave && { wave, tick: run.tick };
}

/**
 * The wave's blocks at `tick`, with their trails under them. A ghost fades as it falls and is not drawn
 * once gone; with reduced motion too, as a fade moves nothing on the screen and the hidden obstacle is
 * the wave itself, not an effect. A trail is motion, drawn only without reduced motion.
 */
function blocks(ctx: CanvasRenderingContext2D, s: FrameState, wave: Wave, tick: number) {
  const seen = placedAt(wave, tick).map(({ piece, block: b }) => ({ b, sight: sightOf(piece, b) })).filter(({ sight }) => sight > 0);
  if (!s.reduced) for (const { b, sight } of seen) blockTrail(ctx, b, s.theme.plasma, sight);
  for (const { b, sight } of seen) {
    ctx.globalAlpha = sight;
    block(ctx, b);
  }
  ctx.globalAlpha = 1;
}

/** The flash over the contact that cost a life, fading as it shows; none under reduced motion. */
function flash(ctx: CanvasRenderingContext2D, s: FrameState, crash: Crash) {
  if (s.reduced) return;
  ctx.globalAlpha = FLASH * (crash.left / CRASH_SECONDS);
  ctx.fillStyle = s.theme.white;
  ctx.fillRect(0, 0, RULES.field.w, RULES.field.h);
  ctx.globalAlpha = 1;
}

/**
 * The field: its dark, its backdrop, the circle, the wave's blocks with their trails, then each orb's
 * trail and the orb. A life just lost shows its contact: the wave as it struck, the orbs where they
 * were hit, under a fading flash.
 */
export function drawField(ctx: CanvasRenderingContext2D, s: FrameState, run: Run) {
  ctx.fillStyle = s.theme.void;
  ctx.fillRect(0, 0, RULES.field.w, RULES.field.h);
  backdrop(ctx, s, run);
  track(ctx, s);
  const shown = shownWave(run);
  if (shown) blocks(ctx, s, shown.wave, shown.tick);
  const cool = rampFrom(s.theme.cyan);
  const pair = (angle: number) => { const [warm, other] = orbs(angle); return [[warm, WARM], [other, cool]] as const; };
  if (!s.reduced) {
    run.trail.forEach((angle, i) => {
      ctx.globalAlpha = 0.5 * (1 - i / RULES.trail);
      for (const [p, ramp] of pair(angle)) {
        ctx.fillStyle = defined(ramp[2], "a trail's colour");
        disc(ctx, p.x, p.y, Math.max(1, RULES.orbRadius - 2 - i));
      }
    });
    ctx.globalAlpha = 1;
  }
  for (const [p, ramp] of pair(run.crash ? run.crash.angle : run.angle)) orb(ctx, p, ramp);
  if (run.crash) flash(ctx, s, run.crash);
}

/** How bright the flash over a contact starts. */
const FLASH = 0.45;

export interface DuetOptions { seed: number }

/**
 * The game as the arcade drives and draws it: a new run on its ready screen. A step or a press says
 * when it moved the run into `over`, once whichever way, so the arcade sends the score reached once.
 */
export function createDuet({ seed }: DuetOptions): DuetGame {
  let run = newRun({ seed });
  return {
    step(held: ReadonlySet<Action>, dt: number) {
      const stepped = step(run, held, dt);
      run = stepped.run;
      return { over: stepped.events.includes('over') };
    },
    press(action: Action) {
      const { run: next, events } = press(run, action);
      run = next;
      return { leave: events.includes('leave'), over: events.includes('over'), again: events.includes('again') };
    },
    pause() { run = pause(run).run; },
    hud: () => hudOf(run),
    draw(ctx: CanvasRenderingContext2D, s: FrameState) { drawField(ctx, s, run); },
  };
}
