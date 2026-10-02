// The poster planet's clock (PRD 394): how far it has turned and how far the invasion has spread at
// a given second, and the loop that draws it onto a canvas with the game's own drawPlanet. Kept
// apart from the component so it runs with a stubbed canvas, a stubbed frame clock and a stubbed page.
import { drawPlanet } from '@omni/design';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { PLANET, PLANET_PROGRESS } from './art';

/** The planet's label: what the planet's box says, whether the frames or the canvas show. */
export const PLANET_LABEL = 'A pixel planet, green patches of secured ground spreading across it: the invasion';

/** The media query under which the planet stays still and no canvas is mounted. */
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** One turn of the planet, in seconds: slow, like the game's title planet. */
export const PLANET_TURN_SECONDS = 60;
/** How long each step of the invasion lasts, in seconds: the server-drawn frames' own pace. */
export const PLANET_STEP_SECONDS = 1.5;

/** Whether the planet may turn here: the browser allows motion. No matchMedia, no motion. */
export function planetMoves(win: { matchMedia?: (query: string) => { matches: boolean } }): boolean {
  return typeof win.matchMedia === 'function' && !win.matchMedia(REDUCED_MOTION).matches;
}

/** The planet at second `t`: its turn (radians) and how much of it is secured. */
export function planetAt(t: number): { rot: number; progress: number } {
  const step = Math.floor(t / PLANET_STEP_SECONDS) % PLANET_PROGRESS.length;
  return { rot: (t / PLANET_TURN_SECONDS) * Math.PI * 2, progress: at(PLANET_PROGRESS, step, 'the planet\'s progress') };
}

/** What the loop needs from the browser: a clock, frames, and the page's visibility. */
export interface SpinClock {
  now(): number;
  frame(fn: (ms: number) => void): number;
  cancel(id: number): void;
  doc: {
    hidden: boolean;
    addEventListener(type: 'visibilitychange', fn: () => void): void;
    removeEventListener(type: 'visibilitychange', fn: () => void): void;
  };
}

/** The browser's own clock. */
export function browserClock(): SpinClock {
  return {
    now: () => performance.now(),
    frame: (fn) => requestAnimationFrame(fn),
    cancel: (id) => { cancelAnimationFrame(id); },
    doc: document,
  };
}

/**
 * Draws the planet onto `ctx` (a square canvas of side `size`) every frame, turning, while the
 * invasion steps through PLANET_PROGRESS. It draws once at once, calls `onFirst` after that first
 * frame, draws nothing while the page is hidden, and stops for good when the returned function runs.
 */
export function spinPlanet(
  ctx: CanvasRenderingContext2D,
  size: number,
  clock: SpinClock,
  o: { draw?: typeof drawPlanet; onFirst?: () => void } = {},
): () => void {
  const draw = o.draw ?? drawPlanet;
  const start = clock.now();
  let id: number | null = null;
  let stopped = false;
  ctx.imageSmoothingEnabled = false;

  const paint = () => {
    const { rot, progress } = planetAt((clock.now() - start) / 1000);
    ctx.clearRect(0, 0, size, size);
    draw(ctx, { cx: size / 2, cy: size / 2, r: PLANET.r, seed: PLANET.seed, rot, progress });
  };
  const loop = () => {
    id = null;
    if (stopped || clock.doc.hidden) return;
    paint();
    id = clock.frame(loop);
  };
  const onVisibility = () => {
    if (clock.doc.hidden) {
      if (id !== null) clock.cancel(id);
      id = null;
    } else if (id === null && !stopped) {
      id = clock.frame(loop);
    }
  };

  clock.doc.addEventListener('visibilitychange', onVisibility);
  paint();
  o.onFirst?.();
  if (!clock.doc.hidden) id = clock.frame(loop);

  return () => {
    stopped = true;
    if (id !== null) clock.cancel(id);
    id = null;
    clock.doc.removeEventListener('visibilitychange', onVisibility);
  };
}
