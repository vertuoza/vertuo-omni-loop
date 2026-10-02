// The play dock, as pure functions (PRD 757): whether the page's corner shows nothing, the folded
// pill, or the mini Game Boy, and what the device shows — the game, the game paused on a question,
// CLAUDE IS DONE, or the arcade's own refusal. Who plays is the arcade's rule, through its game room's
// door (games/room.ts): the dock never has a rule of its own on levels or XP. With more than one game
// open (PRD 817: SUPER OMNI WORLD from LV 2), the device opens on a picker between them.
import { GAMES } from '../arcade/games/index';
import { cabinetDoor, cabinets, xpStatus } from '../arcade/games/room';
import type { Action } from '../arcade/keys';
import type { XpRead } from '../arcade/types';

/** What the page says Claude is doing: the one rule the app keeps for it (`workingState`). */
export type DockState = 'working' | 'asking' | 'idle';

/** The narrowest window the dock shows on: below it, a phone, it is never drawn. */
export const DOCK_MIN_WIDTH = 600;

/** The games the dock plays, in the order the picker lists them: the room's keys for them. */
const DOCK_GAMES = ['invaders', 'platformer'] as const;
export type DockGameId = (typeof DOCK_GAMES)[number];

/** Each game's name in the picker: its cabinet's marquee. */
export const DOCK_TITLE = Object.fromEntries(
  DOCK_GAMES.map((id) => [id, GAMES.find((g) => g.id === id)?.title ?? id.toUpperCase()]),
) as Record<DockGameId, string>; // ts-allow: Object.fromEntries over every game builds one property per game

/** Who is at the page, as the dock needs it: whether GitHub is linked, and their XP. None: a visitor. */
export interface DockPlayer { linked: boolean; xp: XpRead }

/** The arcade's door for the dock: the games this player may play, or the line the room says in their place. */
export type DockDoor = { play: true; games: readonly DockGameId[] } | { play: false; refused: string };

/** The dock's games whose cabinet opens for the player; none open, the first game's refusal. */
export function dockDoor(player: DockPlayer | null): DockDoor {
  const status = xpStatus(Boolean(player?.linked), player?.xp ?? null);
  const room = cabinets(status);
  const games: DockGameId[] = [];
  let refused: string | null = null;
  for (const id of DOCK_GAMES) {
    const cabinet = room.find((c) => c.kind === 'game' && c.game.id === id);
    if (!cabinet) continue;
    const door = cabinetDoor(cabinet, status);
    if ('scene' in door) games.push(id);
    else refused ??= door.refused;
  }
  return games.length ? { play: true, games } : { play: false, refused: refused ?? 'LOCKED' };
}

/** What the device shows once open: the picker (its cursor), or a game. */
export type DockScreen = { kind: 'picker'; sel: number } | { kind: 'game'; game: DockGameId };

/** Where the device opens: straight into the one game open, or the picker on the game chosen last. */
export function dockStart(games: readonly DockGameId[], chosen: string | null): DockScreen {
  if (games.length === 1) return { kind: 'game', game: games[0]! };
  return { kind: 'picker', sel: Math.max(0, games.findIndex((g) => g === chosen)) };
}

/** A press on the picker: up and down move (wrapping), A or START plays, B folds; the rest does nothing. */
export function pickerPress(games: readonly DockGameId[], sel: number, action: Action): { sel: number } | { play: DockGameId } | { fold: true } | null {
  const n = games.length;
  if (action === 'up') return { sel: (sel + n - 1) % n };
  if (action === 'down') return { sel: (sel + 1) % n };
  if (action === 'a' || action === 'start') return { play: games[sel]! };
  if (action === 'b') return { fold: true };
  return null;
}

/** B out of a game: back to the picker on that game when there is one, else the dock folds. */
export function backFromGame(games: readonly DockGameId[], game: DockGameId): { kind: 'picker'; sel: number } | { kind: 'fold' } {
  return games.length > 1 ? { kind: 'picker', sel: Math.max(0, games.indexOf(game)) } : { kind: 'fold' };
}

/**
 * What the corner shows:
 * - `hidden`: nothing, below the dock's width, or while Claude is not working and no game is on;
 * - `folded`: the pill, while Claude works;
 * - `playing`: the device, playing;
 * - `asking`: the device, its game paused, pointing at the question;
 * - `done`: the device, Claude done over a game still on, which goes on to its end;
 * - `refused`: the device with the arcade's refusal line and a way to the arcade.
 */
export type DockView =
  | { kind: 'hidden' }
  | { kind: 'folded' }
  | { kind: 'playing' }
  | { kind: 'asking' }
  | { kind: 'done' }
  | { kind: 'refused'; line: string };

export interface DockInput {
  /** What Claude is doing, as the page reads it. */
  state: DockState;
  /** The arcade's door for this player. */
  door: DockDoor;
  /** The device is open (the pill was pressed, and not folded since). */
  open: boolean;
  /** A game has started in the device (over or not): an idle page lets it go on to its end. */
  game: boolean;
  /** The window's width, in CSS pixels; 0 before it is known (the server's render). */
  width: number;
}

export function dockView({ state, door, open, game, width }: DockInput): DockView {
  if (width < DOCK_MIN_WIDTH) return { kind: 'hidden' };
  if (!open) return state === 'working' ? { kind: 'folded' } : { kind: 'hidden' };
  if (state === 'idle') return game ? { kind: 'done' } : { kind: 'hidden' };
  if (!door.play) return { kind: 'refused', line: door.refused };
  return state === 'asking' ? { kind: 'asking' } : { kind: 'playing' };
}

/** The words the device shows over the game, by view. */
export const DOCK_LINE = {
  pill: '▶ Play while Claude works',
  asking: '⏸ CLAUDE ASKED · ANSWER',
  done: 'CLAUDE IS DONE',
  arcade: 'OPEN THE ARCADE',
} as const;

/** Where a refused player is sent: the arcade, whose game room says how to earn the level. */
export const ARCADE_PATH = '/play';

/** The key the dock's open or folded state, and the game chosen last, are kept under, for the tab. */
export const DOCK_KEY = 'omni-loop:play-dock';

/** What the tab keeps of the dock: open or folded, and the game the picker chose last. */
export interface DockKept { open: boolean; game: string | null }

const NOTHING_KEPT: DockKept = { open: false, game: null };

/** What this tab kept: nothing when it kept nothing, kept something else, or when storage throws. */
export function readDock(storage: () => Pick<Storage, 'getItem'>): DockKept {
  let raw: string | null;
  try {
    raw = storage().getItem(DOCK_KEY);
  } catch {
    return NOTHING_KEPT;
  }
  if (raw === 'open' || raw === 'folded') return { open: raw === 'open', game: null }; // kept before the picker
  try {
    const kept = JSON.parse(raw ?? 'null') as Partial<DockKept> | null; // ts-allow: whatever the tab kept is read for two fields, each checked on the next line
    return { open: kept?.open === true, game: typeof kept?.game === 'string' ? kept.game : null };
  } catch {
    return NOTHING_KEPT;
  }
}

/** Keeps `patch` over what the tab kept; storage refused, it is only not kept. */
export function writeDock(storage: () => Pick<Storage, 'getItem' | 'setItem'>, patch: Partial<DockKept>): void {
  try {
    storage().setItem(DOCK_KEY, JSON.stringify({ ...readDock(storage), ...patch }));
  } catch { /* the dock still opens; it only forgets on the next page */ }
}

/** Whether the dock was left open in this tab: folded when nothing was kept, or when storage throws. */
export const readOpen = (storage: () => Pick<Storage, 'getItem'>): boolean => readDock(storage).open;

/** Keeps the dock's open or folded state for the tab, and the game chosen last with it. */
export const writeOpen = (storage: () => Pick<Storage, 'getItem' | 'setItem'>, open: boolean): void => writeDock(storage, { open });
