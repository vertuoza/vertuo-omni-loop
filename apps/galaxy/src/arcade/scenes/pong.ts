// OMNI PONG on the canvas (PRD 2101): the scene's group. The game's code lives in `arcade/pong/` and is
// imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (pong/guard.test.ts): the loaded game comes in as `FrameState.pong` and draws
// its court itself, on the whole grid. Until the game has loaded, or if it never does, the canvas is the
// sky behind the text layer's line (pong.tsx), whose words are kept here.
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { LimitName } from '../pong/rules';
import type { Steer } from '../pong/steer';
import type { FrameState, Pages, PongDraw, SceneName } from './common.ts';
import { space } from './common.ts';

export { LOADING_LINE, NOT_LOADED } from './duet.ts';

/** The court is laid out on the tall grid too: the Game Boy held upright plays it on 320×288. */
export const TALL_SCENES: readonly SceneName[] = ['pong'];

export const PAGES: Pages = {};

/**
 * Where the microphone stands: not asked for (or stopped), being asked for, on, refused by the browser
 * (or on an insecure page, which is the same to the player), or with no microphone to give.
 */
export type MicState = 'off' | 'asking' | 'on' | 'blocked' | 'missing';

/**
 * What the text layer shows of the game: its phase, the limit and its pitch in Hz, half the still band
 * around it, where the microphone stands, what the steering reads and the pitch heard (rounded), if any.
 */
export interface PongHud {
  phase: 'ready';
  limit: LimitName;
  limitHz: number;
  band: number;
  mic: MicState;
  steer: Steer;
  hz: number | null;
}

/** What a press did to the game: B left for the room. */
export interface PongPressed { leave: boolean }

/** The game itself, as the arcade drives it: stepped by the canvas loop, answering presses, paused and closed from outside. */
export interface PongGame extends PongDraw {
  /** Plays `dt` seconds: the pitch is read from the microphone, when it is on. */
  step(dt: number): void;
  press(action: Action): PongPressed;
  /** A pause from outside: a blurred window, a hidden tab. The microphone is stopped, and A asks for it again. */
  pause(): void;
  /** The scene left: the microphone is stopped for good. */
  close(): void;
  hud(): PongHud;
}

/** Where the game's import stands: on its way, the game ready, or the import failed. */
export type PongStatus = 'loading' | 'ready' | 'failed';

/** What the arcade holds while the pong scene is up: where the import stands, the retries asked for, the grid it started on, the game once loaded and its text layer. */
export interface ArcadePong { status: PongStatus; retry: number; grid: Grid; game: PongGame | null; hud: PongHud | null }

export const PONG_TITLE = 'OMNI PONG';
/** The two ways the voice steers, before the microphone is on. */
export const STEER_LINE = 'HIGH ▲ · LOW ▼';
export const MIC_REQUIRED = 'MIC REQUIRED';

/** Why the microphone is not on, in one line under MIC REQUIRED. */
export const MIC_REASON: Readonly<Record<'blocked' | 'missing', string>> = { blocked: 'MIC BLOCKED IN THE BROWSER', missing: 'NO MIC FOUND' };

/** The limit as the ready screen shows it, its arrows around it: `◀ PITCH · MID ▶`. */
export const pitchLine = (hud: PongHud): string => `◀ PITCH · ${hud.limit} ▶`;

/** The pitch meter's sign: what the steering reads. */
export const METER_SIGN: Readonly<Record<Steer, string>> = { up: '▲', still: '·', down: '▼' };

/** The Hz the meter's bar spans on each side of the limit. */
export const METER_SPAN = 60;

/** Where a pitch sits on the meter's bar, from 0 (its left end) to 1 (its right end); null for no pitch. */
export function meterAt(hz: number | null, limitHz: number): number | null {
  if (hz === null) return null;
  return Math.min(1, Math.max(0, (hz - limitHz + METER_SPAN) / (2 * METER_SPAN)));
}

/** The still band on the meter's bar: where it starts and how wide it is, as shares of the bar. */
export const meterBand = (band: number): { left: number; width: number } => ({ left: (METER_SPAN - band) / (2 * METER_SPAN), width: band / METER_SPAN });

/**
 * What the ready screen says under the title, by where the microphone stands: the limit, then how to
 * steer (or the live meter), then the call; or MIC REQUIRED, its reason and A to ask again.
 */
export type ReadyLines =
  | { kind: 'ask'; pitch: string; steer: string; call: 'TURN ON MIC' }
  | { kind: 'meter'; pitch: string; call: 'PLAY' }
  | { kind: 'refused'; warn: string; why: string; call: 'ASK AGAIN' };

export function readyLines(hud: PongHud): ReadyLines {
  if (hud.mic === 'on') return { kind: 'meter', pitch: pitchLine(hud), call: 'PLAY' };
  if (hud.mic === 'blocked' || hud.mic === 'missing') return { kind: 'refused', warn: MIC_REQUIRED, why: MIC_REASON[hud.mic], call: 'ASK AGAIN' };
  return { kind: 'ask', pitch: pitchLine(hud), steer: STEER_LINE, call: 'TURN ON MIC' };
}

/** The game, loaded: what `import('arcade/pong/index')` gives. */
export type PongModule = typeof import('../pong/index');

/**
 * Imports the game and makes it, with the browser's microphone. A failed import (offline, or a chunk
 * gone after a deploy) is logged with `console.error` and answers null, so the screen can say so and A
 * can try again.
 */
export async function loadPong(load: () => Promise<Pick<PongModule, 'createPong' | 'browserMic'>>): Promise<PongGame | null> {
  try {
    const m = await load();
    return m.createPong({ mic: m.browserMic() });
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * What a press does around the game: A imports again after a failure, B goes back to the room while
 * the game loads or after it failed. Once it has loaded every press is the game's.
 */
export function pongPress(status: PongStatus, action: Action): 'retry' | 'back' | null {
  if (action === 'b') return status !== 'ready' ? 'back' : null;
  return status === 'failed' && action === 'a' ? 'retry' : null;
}

/** Whether two text layers say the same: the arcade re-renders only when they differ. */
export const samePongHud = (a: PongHud | null, b: PongHud | null): boolean =>
  a === b || (!!a && !!b && a.phase === b.phase && a.limit === b.limit && a.limitHz === b.limitHz && a.band === b.band
    && a.mic === b.mic && a.steer === b.steer && a.hz === b.hz);

/** The Omni sky over the whole grid, then the loaded game's court on it. */
export function drawPong(ctx: CanvasRenderingContext2D, s: FrameState) {
  space(ctx, s, 0.2);
  s.pong?.draw(ctx, s); // loading, or failed: the sky behind the line
}
