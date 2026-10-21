// OMNI KART on the canvas (PRD 1359): the scene's group. The game's code lives in `arcade/kart/` and
// is imported only when its cabinet opens, so this file, like every other scene's, imports nothing from
// that folder at run time (guard.test.ts): the loaded game comes in as `FrameState.kart` and draws
// itself, and until then, or if it never loads, the canvas is the dark behind the text layer's line
// (kart.tsx). The grid the race is drawn on is the one it started on, as STARHOP keeps its own.
import type { Hero, Tint } from '@omni/design';
import type { Action } from '../keys';
import type { KartOptions, OptionsView } from '../kart/options';
import type { KartLook } from '../kart/look';
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
  /** PRD 1963: `TURBO` shows under GO on a rocket start. */
  turbo?: true;
  /** The race's own line, once it has begun: the player's place (1 to 6), the lap (1 to `laps`), the race time in tenths of a second and whether FINAL LAP shows. */
  run?: KartRun;
  /** The results table, once the player crossed the line at the end of the last lap. */
  results?: KartResults;
  /** The podium that shows before the results (PRD 1762): the first three on their steps; A moves on to the results. */
  podium?: KartPodium;
}

/** One line of the results table: a place, the driver and the time in tenths of a second (none for a kart still racing). */
export interface KartRow { place: number; name: string; tenths: number | null; you: boolean; /** MULTI (PRD 1572): the player left, or went silent, before the line. */ out?: boolean; /** The driver's fleet tint and kart look (PRD 1762), to draw their kart on the podium. */ tint?: Tint | null; look?: KartLook }

/** One step of the podium: the driver and the time, or `…` while a MULTI driver has not crossed the line. */
export interface KartStep { place: 1 | 2 | 3; name: string; filled: boolean; tenths: number | null; you: boolean; tint?: Tint | null; look?: KartLook }

/** The podium (PRD 1762): the steps in the order they stand (second, first, third), and `YOU 5TH` when the player is off it. */
export interface KartPodium { steps: readonly KartStep[]; place: string | null }

/** The finish: the six places, the player's place and time, and the race time that is sent. */
export interface KartResults { rows: readonly KartRow[]; place: number; tenths: number; /** The clock at the player's third crossing, in tenths: the time sent to the board, shown as 3-LAP TIME (the race time in a 3-lap race). */ threeLap: number; /** MULTI: the table fills in as each player finishes, so a text layer reads it afresh. */ live?: true }

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
  | { kind: 'spin' } | { kind: 'fall' } | { kind: 'finalLap' }
  // PRD 1963, the player's own kart only: a tick as the sparks turn blue and orange, a whoosh at a mini-turbo, a rocket start or a slipstream, a sputter on a stall.
  | { kind: 'tick'; color: 'blue' | 'orange' } | { kind: 'whoosh' } | { kind: 'sputter' };

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
    case 'tick': return { sfx: cue.color === 'blue' ? 'tickBlue' : 'tickOrange', far: 0 };
    case 'whoosh': return { sfx: 'whoosh', far: 0 };
    case 'sputter': return { sfx: 'sputter', far: 0 };
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

/** The level the engine's hum rises to while GAS is held in the countdown (PRD 1963), a share of the top speed. */
export const REV_LEVEL = 0.7;

/** The engine's level, 0 to 1, or null when it does not hum: the speed on the road, and while GAS (A) is held in the countdown, the rev of a start. */
export function kartEngineLevel(hud: KartHud | null, speed: number, held: ReadonlySet<Action>): number | null {
  if (!kartEngineOn(hud)) return null;
  return hud?.phase === 'countdown' && held.has('a') ? Math.max(speed, REV_LEVEL) : speed;
}

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
  /** The id of the crew board this race's time goes to (PRD 1923): its circuit's. */
  board: string;
  hud(): KartHud;
  /**
   * Builds what the race's first frame draws, its circuit's ground, a slice at a time, waiting on `pause` between
   * two slices so the page keeps drawing (bug 2152); resolves once it is built. A race drawn before builds it at once.
   */
  ready(pause?: () => Promise<void>): Promise<void>;
  /** The cues since the last call, in order, then forgotten. */
  cues(): readonly KartCue[];
  /** The player's speed as a share of its top speed on the road, 0 to 1. */
  speed(): number;
  /** How loud the player's tyres screech, 0 (silent) to 1 (PRD 1963). */
  skid(): number;
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
  /** The circuits the CIRCUIT step shows (PRD 1923), once the game's code has loaded: none before. */
  circuits: readonly CircuitCard[];
  /** Whether MULTI can be picked: the account gave a link to the grid. */
  multi: boolean;
  /** What the GRID shows, once MULTI is picked (PRD 1572); none before. */
  lobby: KartGridView | null;
}

/** Where the ready screen stands: choosing between SINGLE, MULTI and OPTIONS (the cursor on one), SINGLE picked, MULTI picked: on the workspace's grid, or on the OPTIONS panel (PRD 1762). */
export type KartChoice = { step: 'choose'; cursor: KartCursor } | { step: 'circuit'; then: 'single' | 'grid' } | { step: 'single' } | { step: 'grid' } | { step: 'live' } | { step: 'options'; view: OptionsView };

/** What the CIRCUIT step shows of a circuit (PRD 1923): its name, the board its times go to and its minimap, one run of tiles at a time, over `ground`. */
export interface CircuitCard { id: string; name: string; board: string; cols: number; rows: number; ground: string; runs: readonly { x: number; y: number; w: number; colour: string }[] }

/** The circuit named `id`: its card's name, or, before the cards have loaded, its id in capitals (`frost-eight` is FROST EIGHT). */
export const circuitName = (cards: readonly CircuitCard[], id: string): string => cards.find((c) => c.id === id)?.name ?? id.replace(/-/g, ' ').toUpperCase();

/** The circuits the CIRCUIT step shows and the player's best on each, in tenths, by circuit id (none before the game's code has loaded). */
export interface KartCircuits { cards: readonly CircuitCard[]; bests: Readonly<Record<string, number | null>> }
export const NO_CIRCUITS: KartCircuits = { cards: [], bests: {} };

/** The id of the circuit the options keep: COMET RING before they have loaded. */
export const trackOf = (options: { track: string } | null | undefined): string => options?.track ?? 'comet-ring';

/** The player's best on a circuit's card, in tenths: none yet, or for no card. */
export const bestOn = (bests: Readonly<Record<string, number | null>>, card: CircuitCard | null): number | null => (card ? bests[card.id] ?? null : null);

/** The circuit the player's `track` kept; COMET RING's card is the first. */
export const circuitOfCards = (cards: readonly CircuitCard[], id: string): CircuitCard | null => cards.find((c) => c.id === id) ?? cards[0] ?? null;

/** The ready screen's three lines, in order. */
export type KartCursor = 'single' | 'multi' | 'options';

/** A player on the GRID screen: their hero, name and best time in tenths (none before a first race), whether it is the player at this screen and whether they hold a place. */
export interface KartGridRow { id: string; name: string; hero: Hero; fleet: string | null; best: number | null; /** The player's kart's look (PRD 1762); none draws today's kart. */ look?: { color: string; design: string }; you: boolean; seat: boolean }

/**
 * What the GRID screen shows (PRD 1572): where the link stands (`joining`, `joined`, `reconnecting`
 * or `out` of reach), the players in their starting order and the line under them: START RACE,
 * WAITING FOR <NAME>, WAITING FOR RACERS, GRID FULL · 4 RACERS, RECONNECTING… or GRID OUT OF REACH · A TO RETRY.
 */
export interface KartGridView { state: 'joining' | 'joined' | 'reconnecting' | 'out'; rows: readonly KartGridRow[]; line: string; /** How many laps the grid will run (PRD 1762), when it says. */ laps?: number; /** The id of the circuit the grid will race (PRD 1923): its first arrival's. */ track?: string }

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

/** The line for the circuit before the choice, with the player's laps (PRD 1762) and the circuit kept (PRD 1923): COMET RING · 5 LAPS. */
export const choiceLine = (laps: number, circuit = 'COMET RING'): string => `${circuit} · ${laps} LAPS`;
export const CHOICE_LINE = choiceLine(3);
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
  if (choice.cursor === 'single') return { step: 'circuit', then: 'single' };
  if (choice.cursor === 'options') return OPTIONS_OPEN;
  return multi ? { step: 'circuit', then: 'grid' } : choice;
}

/** What A does on the CIRCUIT step (PRD 1923): it races after SINGLE and goes to the grid after MULTI. */
export const circuitHint = (then: 'single' | 'grid'): string => (then === 'grid' ? 'GRID' : 'RACE');

/**
 * What a press does on the CIRCUIT step (PRD 1923): ◀ ▶ go round the circuits (`ids`, in driving-menu order) from the one kept (`track`),
 * A or START takes it (SINGLE: the ready line; MULTI: the grid), B goes back to the choice, the cursor where it was picked.
 */
export function circuitPress(choice: Extract<KartChoice, { step: 'circuit' }>, action: Action, track: string, ids: readonly string[]): { choice: KartChoice; track: string } {
  if (action === 'b') return { choice: { step: 'choose', cursor: choice.then === 'grid' ? 'multi' : 'single' }, track };
  if (action === 'a' || action === 'start') return { choice: { step: choice.then }, track };
  if ((action === 'left' || action === 'right') && ids.length > 0) {
    const at = Math.max(0, ids.indexOf(track));
    return { choice, track: ids[(at + (action === 'right' ? 1 : -1) + ids.length) % ids.length] ?? track };
  }
  return { choice, track };
}

/** The line over the screen when the import failed. */
export const NOT_LOADED = 'GAME DID NOT LOAD · A TO RETRY';

/** What the ready screen says: the circuit, its laps and what starts the race. Its laps are the player's (3 unless the options say otherwise). */
/** The laps the player's options ask for: 3 before they have loaded. */
export const lapsOf = (options: { laps: number } | null | undefined): number => options?.laps ?? 3;
export const readyLine = (laps: number, circuit = 'COMET RING'): string => `${choiceLine(laps, circuit)} · PRESS START`;
export const READY_LINE = readyLine(3);

/** The game, loaded: what `import('arcade/kart/index')` gives. */
export type KartModule = typeof import('../kart/index');

/**
 * Imports the game, makes it and builds its circuit's ground (bug 2152). A failed import (offline, or a
 * chunk gone after a deploy) is logged with `console.error` and answers null, so the screen can say so
 * and A can try again.
 */
export async function loadKart(load: () => Promise<Pick<KartModule, 'createKart'>>, seed = 1359, cast: readonly KartDriver[] = [], rules: Pick<KartOptions, 'laps' | 'difficulty' | 'look' | 'track'> | null = null): Promise<KartGame | null> {
  try {
    const game = (await load()).createKart({ seed, cast, ...(rules ? { laps: rules.laps, difficulty: rules.difficulty, look: rules.look, circuit: rules.track } : {}) });
    await game.ready(); // the circuit's ground, built while LOADING… shows, not on the race's first frame (bug 2152)
    return game;
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
  a === b || (!!a && !!b && a.phase === b.phase && a.menu === b.menu && a.beat === b.beat && samePodium(a.podium, b.podium) && sameResults(a.results, b.results) && sameRun(a.run, b.run));

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

/** The same podium: the same steps standing, the same place under them. */
const samePodium = (a: KartPodium | undefined, b: KartPodium | undefined): boolean =>
  a === b || (!!a && !!b && a.place === b.place && podiumKey(a) === podiumKey(b));
const podiumKey = (p: KartPodium): string => p.steps.map((s) => `${s.name}|${s.filled}|${s.tenths}`).join(';');
