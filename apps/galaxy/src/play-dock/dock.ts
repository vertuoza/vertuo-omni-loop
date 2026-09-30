// The play dock, as pure functions (PRD 757): whether the page's corner shows nothing, the folded
// pill, or the mini Game Boy, and what the device shows — the game, the game paused on a question,
// CLAUDE IS DONE, or the arcade's own refusal. Who plays is the arcade's rule, through its game room's
// door (games/room.ts): the dock never has a rule of its own on levels or XP.
import { cabinetDoor, cabinets, xpStatus } from '../arcade/games/room';
import type { XpRead } from '../arcade/types';

/** What the page says Claude is doing: the one rule the app keeps for it (`workingState`). */
export type DockState = 'working' | 'asking' | 'idle';

/** The narrowest window the dock shows on: below it, a phone, it is never drawn. */
export const DOCK_MIN_WIDTH = 600;

/** The game the dock plays: Entropy Invaders, the room's key for it. */
export const DOCK_GAME = 'invaders';

/** Who is at the page, as the dock needs it: whether GitHub is linked, and their XP. None: a visitor. */
export interface DockPlayer { linked: boolean; xp: XpRead }

/** The arcade's door for the dock's game: play, or the line the room says in its place. */
export type DockDoor = { play: true } | { play: false; refused: string };

export function dockDoor(player: DockPlayer | null): DockDoor {
  const status = xpStatus(Boolean(player?.linked), player?.xp ?? null);
  const cabinet = cabinets(status).find((c) => c.kind === 'game' && c.game.id === DOCK_GAME);
  if (!cabinet) return { play: false, refused: 'LOCKED' };
  const door = cabinetDoor(cabinet, status);
  return 'scene' in door ? { play: true } : { play: false, refused: door.refused };
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

/** The key the dock's open or folded state is kept under, for the tab. */
export const DOCK_KEY = 'omni-loop:play-dock';

/** Whether the dock was left open in this tab: folded when nothing was kept, or when storage throws. */
export function readOpen(storage: () => Pick<Storage, 'getItem'>): boolean {
  try {
    return storage().getItem(DOCK_KEY) === 'open';
  } catch {
    return false;
  }
}

/** Keeps the dock's open or folded state for the tab; storage refused, it is only not kept. */
export function writeOpen(storage: () => Pick<Storage, 'setItem'>, open: boolean): void {
  try {
    storage().setItem(DOCK_KEY, open ? 'open' : 'folded');
  } catch { /* the dock still opens; it only folds on the next page */ }
}
