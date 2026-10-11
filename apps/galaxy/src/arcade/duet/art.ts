// OMNI DUET's playfield on the canvas (PRD 1633): the 320×288 field, the Omni Loop crest at the centre
// of the circle, and the two orbs on it, each with its short trail: the warm one in the orange ramp,
// the cool one in the theme's cyan. The scene places the field on the grid (scenes/duet.ts); this file
// draws in the field's own game pixels. Every colour equal to a theme token is read from the frame's
// theme (ADR-0046).
import { drawLogo, logoPixels, RAMPS, rampFrom } from '@omni/design';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Action } from '../keys';
import type { FrameState } from '../scenes/common.ts';
import type { DuetGame, DuetHud } from '../scenes/duet.ts';
import { orbs, RULES, type Point } from './rules';
import { CHAPTERS, newRun, press, step, type Run } from './run';

/** The crest's scale: whole pixels only, as every piece of the brand is drawn. */
const CREST_SCALE = 2;

/** The warm orb's ramp, light to dark: no theme token is orange. */
const WARM = defined(RAMPS.O, 'the orange ramp');

/** What the text layer reads of a run. */
export function hudOf(run: Run): DuetHud {
  return { phase: run.phase, chapter: defined(CHAPTERS[run.chapter], "the run's chapter"), lives: run.lives, score: run.score };
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

/** The field: its dark, the circle, the crest, then each orb's trail and the orb. */
export function drawField(ctx: CanvasRenderingContext2D, s: FrameState, run: Run) {
  ctx.fillStyle = s.theme.void;
  ctx.fillRect(0, 0, RULES.field.w, RULES.field.h);
  track(ctx, s);
  const crest = logoPixels('mark');
  drawLogo(ctx, 'mark', RULES.centre.x - (crest.w * CREST_SCALE) / 2, RULES.centre.y - (crest.h * CREST_SCALE) / 2, { scale: CREST_SCALE });
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

/** The game as the arcade drives and draws it: a new run on its ready screen. */
export function createDuet({ seed }: DuetOptions): DuetGame {
  let run = newRun({ seed });
  return {
    step(held: ReadonlySet<Action>, dt: number) { run = step(run, held, dt).run; },
    press(action: Action) {
      const pressed = press(run, action);
      run = pressed.run;
      return { leave: pressed.events.includes('leave') };
    },
    hud: () => hudOf(run),
    draw(ctx: CanvasRenderingContext2D, s: FrameState) { drawField(ctx, s, run); },
  };
}
