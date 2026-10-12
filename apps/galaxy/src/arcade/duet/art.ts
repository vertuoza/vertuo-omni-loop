// OMNI DUET's playfield on the canvas (PRD 1633): the 320×288 field, the circle with nothing at its
// centre, the two orbs on it, each with its short trail (the warm one in the orange ramp, the
// cool one in the theme's cyan), and the wave's obstacles falling through it as Entropy blocks, in
// Entropy's ramp with spikes along their long edges, a ghost fading out before it reaches the
// circle. The scene places the field on the grid (scenes/duet.ts); this file draws in the field's
// own game pixels. Every colour equal to a theme token is read from the frame's theme (ADR-0046).
import { RAMPS, rampFrom } from '@omni/design';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Action } from '../keys';
import type { FrameState } from '../scenes/common.ts';
import type { DuetGame, DuetHud } from '../scenes/duet.ts';
import { corners, type Block } from './collide';
import { orbs, RULES, type Point } from './rules';
import { CHAPTER_TITLES, newRun, pause, press, step, waveOf, wavesIn, type Run } from './run';
import { blocksAt, sightOf } from './waves';

/** The warm orb's ramp, light to dark: no theme token is orange. */
const WARM = defined(RAMPS.O, 'the orange ramp');

/** The blocks' ramp, light to dark: Entropy's own, as the blob is drawn. No theme token is in it. */
const ENTROPY = defined(RAMPS.Z, "Entropy's ramp");

/** What the text layer reads of a run: the wave is counted from 1, never past a chapter's last, and with no last in endless mode. */
export function hudOf(run: Run): DuetHud {
  const waves = wavesIn(run);
  return {
    phase: run.phase, chapter: defined(CHAPTER_TITLES[run.chapter], "the run's chapter"), endless: run.endless,
    wave: run.endless ? run.wave + 1 : Math.min(run.wave + 1, waves), waves, lives: run.lives, score: run.score,
    passed: run.passed, started: run.started,
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

/** The field: its dark, the circle, the wave's blocks, then each orb's trail and the orb. */
export function drawField(ctx: CanvasRenderingContext2D, s: FrameState, run: Run) {
  ctx.fillStyle = s.theme.void;
  ctx.fillRect(0, 0, RULES.field.w, RULES.field.h);
  track(ctx, s);
  const falling = run.phase === 'play' || (run.phase === 'paused' && run.resume === 'play');
  const wave = falling ? waveOf(run) : undefined;
  // A ghost fades as it falls and is not drawn once gone; with reduced motion too, as a fade moves
  // nothing on the screen and the hidden obstacle is the wave itself, not an effect.
  if (wave) {
    blocksAt(wave, run.tick).forEach((b, i) => {
      const sight = sightOf(defined(wave.pieces[i], "a block's obstacle"), b);
      if (sight <= 0) return;
      ctx.globalAlpha = sight;
      block(ctx, b);
    });
    ctx.globalAlpha = 1;
  }
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
  for (const [p, ramp] of pair(run.angle)) orb(ctx, p, ramp);
}

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
