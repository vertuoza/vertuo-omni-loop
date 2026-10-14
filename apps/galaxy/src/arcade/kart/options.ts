// OMNI KART's options (PRD 1762, slice 1): what the player chose, kept in the browser, and the panel that
// changes it. Pure: the arcade reaches this file with a dynamic `import()` once the cabinet is open
// (guard.test.ts), and the browser's storage is handed in.
import type { Action } from '../keys';
import { COLORS, DESIGNS } from './look';
import { DEFAULT_CIRCUIT, isCircuitId } from './circuits';

// The look's sprites and tints reach the arcade through this module: it is the one loaded on demand.
export { kartSprite, kartTint } from './look';

/** The five things a player's hands do in a race. */
export const DRIVE_ACTIONS = ['gas', 'brake', 'left', 'right', 'item'] as const;
export type DriveAction = (typeof DRIVE_ACTIONS)[number];

/** The words the options screen names each action by. */
export const DRIVE_NAMES: Record<DriveAction, string> = { gas: 'GAS', brake: 'BRAKE', left: 'LEFT', right: 'RIGHT', item: 'ITEM' };

export const LAP_CHOICES = [3, 5, 7] as const;
export type Laps = (typeof LAP_CHOICES)[number];

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** The kart's colours by name, read from the look's own table. */
const COLOR_NAMES: readonly string[] = COLORS.map((c) => c.name);

export interface KartOptions {
  /** One key each, as the keyboard types it (`e.key`); a letter in lower case. */
  keys: Record<DriveAction, string>;
  laps: Laps;
  difficulty: Difficulty;
  look: { color: string; design: string };
  /** The id of the circuit chosen (PRD 1923); a store without one, or naming no circuit, reads as COMET RING. */
  track: string;
}

/** The key under which the options are kept in the browser. */
export const OPTIONS_KEY = 'omni-loop:kart-options';

export const DEFAULT_KEYS: Readonly<Record<DriveAction, string>> = { gas: 'ArrowUp', brake: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', item: ' ' };

/** Today's options: ▲ ▼ ◀ ▶ and SPACE, 3 laps, NORMAL, FLEET and CLASSIC. A new object each call. */
export const defaultOptions = (): KartOptions => ({ keys: { ...DEFAULT_KEYS }, laps: 3, difficulty: 'normal', look: { color: 'FLEET', design: 'CLASSIC' }, track: DEFAULT_CIRCUIT.id });

/** The six keys that stay the arcade's: ENTER, TAB and SHIFT (start, select), ESC, M (mute) and F (fullscreen). */
export const RESERVED_KEYS: readonly string[] = ['Enter', 'Tab', 'Shift', 'Escape', 'm', 'f'];

/** The key as it is kept: a letter in lower case, the rest as the keyboard names it. */
export const normalKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

export const isReserved = (key: string): boolean => RESERVED_KEYS.includes(normalKey(key));

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The keys read back: all five, none reserved, no key twice; otherwise the defaults. */
function readKeys(raw: unknown): Record<DriveAction, string> {
  if (!isObject(raw)) return { ...DEFAULT_KEYS };
  const keys: Record<DriveAction, string> = { ...DEFAULT_KEYS };
  for (const action of DRIVE_ACTIONS) {
    const key = raw[action];
    if (typeof key !== 'string' || key === '' || key.length > 24) return { ...DEFAULT_KEYS };
    keys[action] = normalKey(key);
  }
  const values = Object.values(keys);
  if (new Set(values).size !== values.length || values.some(isReserved)) return { ...DEFAULT_KEYS };
  return keys;
}

const isLaps = (v: unknown): v is Laps => LAP_CHOICES.some((laps) => laps === v);
const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.some((level) => level === v);

const nameOf = (raw: unknown, names: readonly string[], fallback: string): string => (typeof raw === 'string' && names.includes(raw) ? raw : fallback);

/** What a store holds, read field by field: a field that cannot be read is its default, the others are kept. */
export function parseOptions(text: string | null | undefined): KartOptions {
  const out = defaultOptions();
  if (typeof text !== 'string') return out;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return out; }
  if (!isObject(raw)) return out;
  out.keys = readKeys(raw.keys);
  if (isLaps(raw.laps)) out.laps = raw.laps;
  if (isDifficulty(raw.difficulty)) out.difficulty = raw.difficulty;
  if (isCircuitId(raw.track)) out.track = raw.track;
  const look = isObject(raw.look) ? raw.look : {};
  out.look = { color: nameOf(look.color, COLOR_NAMES, 'FLEET'), design: nameOf(look.design, DESIGNS, 'CLASSIC') };
  return out;
}

/** The slice of the browser's storage the options need. */
export interface OptionsStore { getItem(key: string): string | null; setItem(key: string, value: string): void }

const browserStore = (): OptionsStore => window.localStorage;

/** The options kept in the browser; the defaults when the store is missing, throws or holds nothing readable. */
export function loadOptions(store: () => OptionsStore = browserStore): KartOptions {
  try { return parseOptions(store().getItem(OPTIONS_KEY)); } catch { return defaultOptions(); }
}

/** Writes the options at once; a store that throws leaves the game playable, with the options of this visit only. */
export function saveOptions(options: KartOptions, store: () => OptionsStore = browserStore): void {
  try { store().setItem(OPTIONS_KEY, JSON.stringify(options)); } catch { /* per-device courtesy only */ }
}

/** What binding a key does: the new keys, or why not (`reserved`). */
export type Bound = { keys: Record<DriveAction, string> } | { refused: 'reserved' };

/** Binds `key` to `action`; a key another action holds swaps with it. The six reserved keys are refused. */
export function bindKey(keys: Readonly<Record<DriveAction, string>>, action: DriveAction, key: string): Bound {
  if (isReserved(key)) return { refused: 'reserved' };
  const next = normalKey(key);
  const out = { ...keys };
  const holder = DRIVE_ACTIONS.find((a) => a !== action && out[a] === next);
  if (holder) out[holder] = out[action];
  out[action] = next;
  return { keys: out };
}

/** The action of the player's keys that `key` stands for, if any. */
export function driveOf(keys: Readonly<Record<DriveAction, string>>, key: string): DriveAction | null {
  const k = normalKey(key);
  return DRIVE_ACTIONS.find((a) => keys[a] === k) ?? null;
}

/** The pad button each driving action holds for the race: ▲ gas is A, ▼ brake is ▼, the item is a press of B. */
export const HELD_AS: Record<Exclude<DriveAction, 'item'>, Action> = { gas: 'a', brake: 'down', left: 'left', right: 'right' };

// ── The panel ──

/** The lines of the OPTIONS panel. */
export const OPTION_LINES = ['keys', 'kart', 'laps', 'difficulty', 'defaults'] as const;
export type OptionLine = (typeof OPTION_LINES)[number];

/** The lines of the KART panel (PRD 1762): its colour, its design, and DEFAULTS, which puts the look back. */
export const KART_LINES = ['color', 'design', 'defaults'] as const;
export type KartLine = (typeof KART_LINES)[number];

/** Where the panel stands: on its lines, on KEYS (with the action under the cursor, waiting for a key or not), or on KART. */
export type OptionsView =
  | { screen: 'menu'; cursor: OptionLine }
  | { screen: 'kart'; cursor: KartLine }
  | { screen: 'keys'; cursor: DriveAction; capture: boolean; refused: boolean };

export const FIRST_OPTIONS: OptionsView = { screen: 'menu', cursor: 'keys' };

/** What a press or a key did to the panel: its new place and options, and whether the panel was left (B on its lines). */
export interface OptionsStep { view: OptionsView; options: KartOptions; leave: boolean }

const step = (view: OptionsView, options: KartOptions, leave = false): OptionsStep => ({ view, options, leave });

const cycle = <T>(list: readonly T[], at: T, by: 1 | -1): T => list[(list.indexOf(at) + by + list.length) % list.length] ?? at;

const move = <T>(list: readonly T[], at: T, action: Action): T =>
  (action === 'up' ? list[Math.max(0, list.indexOf(at) - 1)] : list[Math.min(list.length - 1, list.indexOf(at) + 1)]) ?? at;

type KeysView = Extract<OptionsView, { screen: 'keys' }>;
type MenuView = Extract<OptionsView, { screen: 'menu' }>;

const vertical = (action: Action): boolean => action === 'up' || action === 'down';

/** KEYS: ▲ ▼ move over the five actions, A waits for a key, B goes back to the lines (or cancels the wait). */
function pressKeys(view: KeysView, options: KartOptions, action: Action): OptionsStep {
  if (view.capture) return step(action === 'b' ? { ...view, capture: false, refused: false } : view, options);
  if (action === 'b') return step(FIRST_OPTIONS, options);
  if (vertical(action)) return step({ ...view, cursor: move(DRIVE_ACTIONS, view.cursor, action), refused: false }, options);
  return step(action === 'a' ? { ...view, capture: true, refused: false } : view, options);
}

/** A or START on a line: KEYS and KART open, DEFAULTS puts every option back. */
function pressLine(view: MenuView, options: KartOptions): OptionsStep {
  if (view.cursor === 'keys') return step({ screen: 'keys', cursor: 'gas', capture: false, refused: false }, options);
  if (view.cursor === 'kart') return step({ screen: 'kart', cursor: 'color' }, options);
  return step(view, view.cursor === 'defaults' ? defaultOptions() : options);
}

/** ◀ ▶ on a line: LAPS and DIFFICULTY cycle. */
function changeLine(view: MenuView, options: KartOptions, by: 1 | -1): OptionsStep {
  if (view.cursor === 'laps') return step(view, { ...options, laps: cycle(LAP_CHOICES, options.laps, by) });
  if (view.cursor === 'difficulty') return step(view, { ...options, difficulty: cycle(DIFFICULTIES, options.difficulty, by) });
  return step(view, options);
}

type KartView = Extract<OptionsView, { screen: 'kart' }>;

/** ◀ ▶ on KART: the colour or the design goes round its list; DEFAULTS has nothing to change. */
function shiftLook(options: KartOptions, line: KartLine, by: 1 | -1): KartOptions {
  if (line === 'color') return { ...options, look: { ...options.look, color: cycle(COLOR_NAMES, options.look.color, by) } };
  if (line === 'design') return { ...options, look: { ...options.look, design: cycle(DESIGNS, options.look.design, by) } };
  return options;
}

/** A or START on KART: only DEFAULTS does anything, and puts the look back. */
const pressLook = (options: KartOptions, line: KartLine): KartOptions => (line === 'defaults' ? { ...options, look: defaultOptions().look } : options);

/** KART: ▲ ▼ move over COLOR, DESIGN and DEFAULTS, ◀ ▶ change the colour or the design, A on DEFAULTS puts the look back, B goes back to the lines. */
function pressKart(view: KartView, options: KartOptions, action: Action): OptionsStep {
  if (action === 'b') return step({ screen: 'menu', cursor: 'kart' }, options);
  if (vertical(action)) return step({ screen: 'kart', cursor: move(KART_LINES, view.cursor, action) }, options);
  if (action === 'left' || action === 'right') return step(view, shiftLook(options, view.cursor, action === 'right' ? 1 : -1));
  return step(view, action === 'a' || action === 'start' ? pressLook(options, view.cursor) : options);
}

/** What a pad button does on the panel: ▲ ▼ move the cursor, ◀ ▶ change LAPS and DIFFICULTY, A opens KEYS, waits for a key or puts DEFAULTS back, B goes back. */
export function optionsPress(view: OptionsView, options: KartOptions, action: Action): OptionsStep {
  if (view.screen === 'keys') return pressKeys(view, options, action);
  if (view.screen === 'kart') return pressKart(view, options, action);
  if (action === 'b') return step(view, options, true);
  if (vertical(action)) return step({ screen: 'menu', cursor: move(OPTION_LINES, view.cursor, action) }, options);
  if (action === 'a' || action === 'start') return pressLine(view, options);
  if (action === 'left' || action === 'right') return changeLine(view, options, action === 'right' ? 1 : -1);
  return step(view, options);
}

/** Whether the panel is waiting for a key: then the next key pressed is the answer, whatever it is (`optionsKey`). */
export const capturing = (view: OptionsView): boolean => view.screen === 'keys' && view.capture;

/** The key pressed while the panel waits for one: ESC cancels, a reserved key is refused, any other becomes the action's (a key another action holds swaps). */
export function optionsKey(view: OptionsView, options: KartOptions, key: string): OptionsStep {
  if (view.screen !== 'keys' || !view.capture) return step(view, options);
  if (key === 'Escape') return step({ ...view, capture: false, refused: false }, options);
  const bound = bindKey(options.keys, view.cursor, key);
  if ('refused' in bound) return step({ ...view, refused: true }, options);
  return step({ ...view, capture: false, refused: false }, { ...options, keys: bound.keys });
}
