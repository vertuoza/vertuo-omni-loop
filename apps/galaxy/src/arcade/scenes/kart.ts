// OMNI KART on the canvas (PRD 1359): the scene's group. The game's code lives in `arcade/kart/` and
// is imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (guard.test.ts): the loaded game comes in as `FrameState.kart` and draws
// itself, and until then, or if it never loads, the canvas is the dark behind the text layer's line
// (kart.tsx). The grid the race is drawn on is the one it started on, as SUPER OMNI WORLD keeps its own.
import type { Tint } from '@omni/design';
import type { Action } from '../keys';
import type { Grid } from '../grid';
import type { FrameState, KartDraw, Pages, SceneName } from './common.ts';
import { space } from './common.ts';
import { fleet } from '../fleets';
import type { Sfx } from '../sound';
import type { SongName } from '../score';

/** The race is laid out on the tall grid too: the Game Boy held upright plays it on 320×288. */
export const TALL_SCENES: readonly SceneName[] = ['kart'];

export const PAGES: Pages = {};

/** What the text layer shows of the race: its phase, and the countdown's number or the GO that follows it. */
export interface KartHud {
  phase: 'ready' | 'countdown' | 'race' | 'paused' | 'finish';
  beat: '3' | '2' | '1' | 'GO' | null;
  /** The race's own line, once it has begun: the player's place (1 to 6), the lap (1 to `laps`), the race time in tenths of a second and whether FINAL LAP shows. */
  run?: KartRun;
  /** The results table, once the player crossed the line at the end of the last lap. */
  results?: KartResults;
}

/** One line of the results table: a place, the driver and the time in tenths of a second (none for a kart still racing). */
export interface KartRow { place: number; name: string; tenths: number | null; you: boolean }

/** The finish: the six places, the player's place and time, and the race time that is sent. */
export interface KartResults { rows: readonly KartRow[]; place: number; tenths: number }

/** The items a kart holds. */
export type KartItem = 'boost' | 'blob' | 'orb';

export interface KartRun { place: number; lap: number; laps: number; tenths: number; final: boolean; /** The item the player holds; none when the hands are empty. */ item: KartItem | null }

/** A rival's driver: its sprite and tint, as the fleet's look gives them. */
export interface KartDriver { sprite: string; tint: Tint | null; color: string | null; name?: string }

/** The most rivals on the grid: the other five karts. */
export const RIVALS = 5;

/**
 * The rivals the workspace gives the race: its fleets other than the player's own, in the order the
 * arcade lists them, each with its mascot in its colour; at most five. Fewer, and the game fills the
 * rest with mascots no rival drives yet.
 */
export function kartCast(fleets: readonly { name: string }[], team: string | null): KartDriver[] {
  return fleets.filter((f) => f.name !== team).slice(0, RIVALS).map((f) => {
    const { sprite, tint, color, label } = fleet(f.name);
    return { sprite, tint, color, name: label };
  });
}

/** The race time as the clock shows it: minutes, seconds and tenths, as 1:05.3. */
export function raceTime(tenths: number): string {
  const total = Math.max(0, Math.floor(tenths));
  const seconds = Math.floor(total / 10);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${total % 10}`;
}

/** The player left the race from its pause. */
export interface KartQuit { quit: boolean; /** A on the results: another race, with a new seed. */ again: boolean }

/**
 * What happened in the race, as the arcade hears it (PRD 1427): the countdown's beeps and GO, an item used
 * by a racer (`you`: the player; `tiles`: how far the racer is from the player), the player's box, a hit on a
 * racer, the player's spin-out, and fall, and the final lap starting.
 */
export type KartCue =
  | { kind: 'beep'; beat: '3' | '2' | '1' } | { kind: 'go' }
  | { kind: 'item'; item: KartItem; you: boolean; tiles: number }
  | { kind: 'box' }
  | { kind: 'hit'; item: 'blob' | 'orb'; you: boolean; tiles: number }
  | { kind: 'spin' } | { kind: 'fall' } | { kind: 'finalLap' };

/** How far a rival's sound carries, in tiles: beyond it nothing is heard. */
export const HEARD_TILES = 20;

/**
 * The effect a cue plays and how far away it sounds, 0 (the player's own) to 1 (`HEARD_TILES` away); null
 * when it is not heard: a rival beyond `HEARD_TILES`. A rival's is never quite 0: it is never as loud as the player's.
 */
export function soundOf(cue: KartCue): { sfx: Sfx; far: number } | null {
  switch (cue.kind) {
    case 'beep': return { sfx: 'beep', far: 0 };
    case 'go': return { sfx: 'go', far: 0 };
    case 'box': return { sfx: 'box', far: 0 };
    case 'spin': return { sfx: 'spin', far: 0 };
    case 'fall': return { sfx: 'fall', far: 0 };
    case 'finalLap': return { sfx: 'finalLap', far: 0 };
    case 'item':
    case 'hit': {
      const effect: Sfx = cue.kind === 'hit' ? 'impact' : cue.item;
      if (cue.you) return { sfx: effect, far: 0 };
      if (cue.tiles > HEARD_TILES) return null;
      return { sfx: effect, far: Math.max(0.05, cue.tiles / HEARD_TILES) };
    }
  }
}

/**
 * The song the race plays (PRD 1427): none on the ready screen and during the countdown, `race` from GO, `lastLap` once
 * FINAL LAP shows, none while paused (it starts again on resume) and the arcade's `fanfare` on the results.
 */
export function kartSong(hud: KartHud | null): SongName | null {
  switch (hud?.phase) {
    case 'race': return hud.run?.final ? 'lastLap' : 'race';
    case 'finish': return 'fanfare';
    case 'ready': case 'countdown': case 'paused': case undefined: return null;
  }
}

/** Whether the race's engine hums: during the countdown and the race, not on the ready screen, the pause or the results. */
export const kartEngineOn = (hud: KartHud | null): boolean => hud?.phase === 'countdown' || hud?.phase === 'race';

/**
 * The race itself, as the arcade drives it (PRD 1359, slice 2): stepped by the canvas loop with the
 * buttons held, answering presses, paused from outside, and read by the text layer through `hud()`.
 */
export interface KartGame extends KartDraw {
  /** Plays `dt` seconds with the buttons held; answers the race time (tenths) on the step that finishes the race (once), else null. */
  step(held: ReadonlySet<Action>, dt: number): number | null;
  press(action: Action): KartQuit;
  pause(): void;
  hud(): KartHud;
  /** The cues since the last call, in order, then forgotten. */
  cues(): readonly KartCue[];
  /** The player's speed as a share of its top speed on the road, 0 to 1. */
  speed(): number;
}

/** Where the game's import stands: on its way, the game ready, or the import failed. */
export type KartStatus = 'loading' | 'ready' | 'failed';

/** What the arcade holds while the kart scene is up: where the import stands, the retries asked for, the grid it started on and the game once loaded. */
export interface ArcadeKart { status: KartStatus; retry: number; grid: Grid; game: KartGame | null; hud: KartHud | null }

/** The line over the screen when the import failed. */
export const NOT_LOADED = 'GAME DID NOT LOAD · A TO RETRY';

/** What the ready screen says: the circuit, its laps and what starts the race. Its laps are `LAPS` of kart/track.ts. */
export const READY_LINE = 'COMET RING · 3 LAPS · PRESS START';

/** The game, loaded: what `import('arcade/kart/index')` gives. */
export type KartModule = typeof import('../kart/index');

/**
 * Imports the game and makes it. A failed import (offline, or a chunk gone after a deploy) is logged
 * with `console.error` and answers null, so the screen can say so and A can try again.
 */
export async function loadKart(load: () => Promise<Pick<KartModule, 'createKart'>>, seed = 1359, cast: readonly KartDriver[] = []): Promise<KartGame | null> {
  try {
    return (await load()).createKart({ seed, cast });
  } catch (err) {
    console.error(err);
    return null;
  }
}

/** What the screen before the race says it is: PAUSED, with its way on and its way out. */
export const PAUSED_LINE = 'PAUSED';

/**
 * What a press does on the screens before the race: A imports again after a failure, B goes back to
 * the room. Once the game has loaded and its race began (`phase` past `ready`), B is the race's own
 * and the room is left from the pause only (or B on the results): the rest of the buttons go to the race.
 */
export function kartPress(status: KartStatus, action: Action, phase: KartHud['phase'] = 'ready'): 'retry' | 'back' | null {
  if (action === 'b') return phase === 'ready' || phase === 'finish' ? 'back' : null;
  return status === 'failed' && action === 'a' ? 'retry' : null;
}

/** Whether two text layers say the same: the arcade re-renders only when they differ. */
export const sameKartHud = (a: KartHud | null, b: KartHud | null): boolean =>
  a === b || (!!a && !!b && a.phase === b.phase && a.beat === b.beat && a.results === b.results && sameRun(a.run, b.run));

const sameRun = (a: KartRun | undefined, b: KartRun | undefined): boolean =>
  a === b || (!!a && !!b && a.place === b.place && a.lap === b.lap && a.laps === b.laps && a.tenths === b.tenths && a.final === b.final && a.item === b.item);

export function drawKart(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.kart) { s.kart.draw(ctx, s); return; }
  space(ctx, s, 0.2); // loading, or failed: the Omni sky behind the line
}
