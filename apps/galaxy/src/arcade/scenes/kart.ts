// OMNI KART on the canvas (PRD 1359): the scene's group. The game's code lives in `arcade/kart/` and
// is imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (guard.test.ts): the loaded game comes in as `FrameState.kart` and draws
// itself, and until then, or if it never loads, the canvas is the dark behind the text layer's line
// (kart.tsx). The grid the race is drawn on is the one it started on, as SUPER OMNI WORLD keeps its own.
import type { Hero, Tint } from '@omni/design';
import type { Action } from '../keys';
import type { KartOptions, OptionsView } from '../kart/options';
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
  phase: 'ready' | 'countdown' | 'race' | 'paused' | 'finish' | 'left';
  /** In a MULTI race (PRD 1572): whether the race's menu (BACK TO RACE / LEAVE RACE) is open over the race. Absent in a SINGLE race. */
  menu?: boolean;
  beat: '3' | '2' | '1' | 'GO' | null;
  /** The race's own line, once it has begun: the player's place (1 to 6), the lap (1 to `laps`), the race time in tenths of a second and whether FINAL LAP shows. */
  run?: KartRun;
  /** The results table, once the player crossed the line at the end of the last lap. */
  results?: KartResults;
}

/** One line of the results table: a place, the driver and the time in tenths of a second (none for a kart still racing). */
export interface KartRow { place: number; name: string; tenths: number | null; you: boolean; /** MULTI (PRD 1572): the player left, or went silent, before the line. */ out?: boolean }

/** The finish: the six places, the player's place and time, and the race time that is sent. */
export interface KartResults { rows: readonly KartRow[]; place: number; tenths: number; /** MULTI: the table fills in as each player finishes, so a text layer reads it afresh. */ live?: true }

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

/** The player left the race from its pause. In MULTI, `grid` is back to the grid: from the race's menu (LEAVE RACE), from YOU LEFT THE RACE, or A on the results. */
export interface KartQuit { quit: boolean; /** A on the results: another race, with a new seed. */ again: boolean; grid?: boolean }

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
    case 'ready': case 'countdown': case 'paused': case 'left': case undefined: return null;
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
  /** The tab is hidden: a SINGLE race pauses; a MULTI race is left at once (PRD 1572), `YOU LEFT THE RACE`, and nothing is sent to the score. */
  away(): void;
  /** The scene is left (or the page closes): a MULTI race in play sends its `leave` and the game stops listening. Nothing for a SINGLE race. */
  close(): void;
  hud(): KartHud;
  /** The cues since the last call, in order, then forgotten. */
  cues(): readonly KartCue[];
  /** The player's speed as a share of its top speed on the road, 0 to 1. */
  speed(): number;
}

/** Where the game's import stands: on its way, the game ready, or the import failed. */
export type KartStatus = 'loading' | 'ready' | 'failed';

/** What the arcade holds while the kart scene is up: where the import stands, the retries asked for, the grid it started on and the game once loaded. */
export interface ArcadeKart {
  status: KartStatus; retry: number; grid: Grid; game: KartGame | null; hud: KartHud | null;
  /** The ready screen's choice (PRD 1572): still choosing, or SINGLE picked, which is today's ready line and today's race. */
  choice: KartChoice;
  /** The player's options (PRD 1762), kept in the browser: none until the game's code has loaded with them. */
  options: KartOptions | null;
  /** Whether MULTI can be picked: the account gave a link to the grid. */
  multi: boolean;
  /** What the GRID shows, once MULTI is picked (PRD 1572); none before. */
  lobby: KartGridView | null;
}

/** Where the ready screen stands: choosing between SINGLE, MULTI and OPTIONS (the cursor on one), SINGLE picked, MULTI picked: on the workspace's grid, or on the OPTIONS panel (PRD 1762). */
export type KartChoice = { step: 'choose'; cursor: KartCursor } | { step: 'single' } | { step: 'grid' } | { step: 'live' } | { step: 'options'; view: OptionsView };

/** The ready screen's three lines, in order. */
export type KartCursor = 'single' | 'multi' | 'options';

/** A player on the GRID screen: their hero, name and best time in tenths (none before a first race), whether it is the player at this screen and whether they hold a place. */
export interface KartGridRow { id: string; name: string; hero: Hero; fleet: string | null; best: number | null; you: boolean; seat: boolean }

/**
 * What the GRID screen shows (PRD 1572): where the link stands (`joining`, `joined`, `reconnecting`
 * or `out` of reach), the players in their starting order and the line under them: START RACE,
 * WAITING FOR <NAME>, WAITING FOR RACERS, GRID FULL · 4 RACERS, RECONNECTING… or GRID OUT OF REACH · A TO RETRY.
 */
export interface KartGridView { state: 'joining' | 'joined' | 'reconnecting' | 'out'; rows: readonly KartGridRow[]; line: string }

/** The GRID's two lines the game's code does not say: while joining, and when the grid cannot be reached (or its code did not load). */
export const GRID_JOINING_LINE = 'JOINING THE GRID…';
export const GRID_OUT_LINE = 'GRID OUT OF REACH · A TO RETRY';

/** What a press does on the GRID: B goes back to the choice, A tries again once the grid was out of reach, A or START asks to start the race (the grid says whether this player may). */
export function gridPress(view: KartGridView | null, action: Action): 'back' | 'retry' | 'start' | null {
  if (action === 'b') return 'back';
  if (action === 'a' && view?.state === 'out') return 'retry';
  return (action === 'a' || action === 'start') && view?.state === 'joined' ? 'start' : null;
}

/** The choice B goes back to from the GRID: the cursor stays on MULTI. */
export const BACK_TO_CHOICE: KartChoice = { step: 'choose', cursor: 'multi' };

/** The ready screen's first state: the cursor on SINGLE. */
export const FIRST_CHOICE: KartChoice = { step: 'choose', cursor: 'single' };

/** The ready screen's first state once the OPTIONS panel is left: the cursor on OPTIONS. */
export const BACK_TO_OPTIONS: KartChoice = { step: 'choose', cursor: 'options' };

/** What KEYS says while it waits for a key, and when the key pressed stays the arcade's. */
export const PRESS_A_KEY = 'PRESS A KEY';
export const KEY_RESERVED = 'KEY USED BY THE ARCADE';

/** The OPTIONS panel as it opens: on KEYS. */
export const OPTIONS_OPEN: KartChoice = { step: 'options', view: { screen: 'menu', cursor: 'keys' } };

/** The line under COMET RING · 3 LAPS for the circuit, before the choice. */
export const CHOICE_LINE = 'COMET RING · 3 LAPS';
/** The two ways to race. */
export const SINGLE_LINE = 'SINGLE';
export const MULTI_LINE = 'MULTI';
export const OPTIONS_LINE = 'OPTIONS';
/** MULTI when the account has no link to the grid: it cannot be picked. */
export const MULTI_CLOSED_LINE = 'MULTI · SIGN IN TO RACE';

/**
 * What a press does on the choice: ▲ ▼ move the cursor over SINGLE, MULTI and OPTIONS (MULTI is skipped
 * when it cannot be picked), A or START picks: SINGLE is today's ready line, MULTI the workspace's grid,
 * OPTIONS its panel. B is the room's, through `kartPress`.
 */
export function choicePress(choice: KartChoice, action: Action, multi: boolean): KartChoice {
  if (choice.step !== 'choose') return choice;
  if (action === 'up' || action === 'down') return moveChoice(choice, action === 'up' ? -1 : 1, multi);
  return action === 'a' || action === 'start' ? pickChoice(choice, multi) : choice;
}

/** ▲ ▼ over the lines the player can pick; the cursor stops at the ends. */
function moveChoice(choice: Extract<KartChoice, { step: 'choose' }>, by: -1 | 1, multi: boolean): KartChoice {
  const order: readonly KartCursor[] = multi ? ['single', 'multi', 'options'] : ['single', 'options'];
  const next = order[Math.max(0, Math.min(order.length - 1, order.indexOf(choice.cursor) + by))] ?? choice.cursor;
  return next === choice.cursor ? choice : { step: 'choose', cursor: next };
}

/** A or START on the line under the cursor. */
function pickChoice(choice: Extract<KartChoice, { step: 'choose' }>, multi: boolean): KartChoice {
  if (choice.cursor === 'single') return { step: 'single' };
  if (choice.cursor === 'options') return OPTIONS_OPEN;
  return multi ? { step: 'grid' } : choice;
}

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

/** What a MULTI race's menu is called, and what the screen says after the player left it (PRD 1572). */
export const MENU_LINE = 'RACE MENU';
export const LEFT_LINE = 'YOU LEFT THE RACE';

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
  a === b || (!!a && !!b && a.phase === b.phase && a.menu === b.menu && a.beat === b.beat && sameResults(a.results, b.results) && sameRun(a.run, b.run));

/** The same results table: one object, or, for a MULTI race's live table, the same rows. */
const sameResults = (a: KartResults | undefined, b: KartResults | undefined): boolean =>
  a === b || (!!a && !!b && !!a.live && !!b.live && a.place === b.place && a.tenths === b.tenths && a.rows.length === b.rows.length
    && a.rows.every((r, i) => { const o = b.rows[i]; return !!o && r.place === o.place && r.name === o.name && r.tenths === o.tenths && r.you === o.you && r.out === o.out; }));

const sameRun = (a: KartRun | undefined, b: KartRun | undefined): boolean =>
  a === b || (!!a && !!b && a.place === b.place && a.lap === b.lap && a.laps === b.laps && a.tenths === b.tenths && a.final === b.final && a.item === b.item);

export function drawKart(ctx: CanvasRenderingContext2D, s: FrameState) {
  if (s.kart) { s.kart.draw(ctx, s); return; }
  space(ctx, s, 0.2); // loading, or failed: the Omni sky behind the line
}
