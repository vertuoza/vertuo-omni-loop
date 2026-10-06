// The level-up moment, as pure functions: whether the level-up screen plays on arriving at the menu,
// the game it names under NEW GAME UNLOCKED, its words and its fanfare, and the level this device
// last celebrated, kept in browser storage under `omni-loop:level-seen:<login>` (a per-device
// courtesy: losing it only replays a fanfare). The unlock levels come from the rulebook's `xp`
// block, through game/experience.ts, and the games from the room's registry.
import { XP_RULES, type XpRules } from '@omni/galaxy';
import { GAMES, type Game } from './games/index';
import type { XpStatus } from './games/room';
import type { SongName } from './score';

/** The player's XP at a level: the only state a level-up is ever played on. */
export type LevelStatus = Extract<XpStatus, { kind: 'level' }>;

/** What the level-up screen celebrates: the level reached with its XP bar, and the game it opened, if one did. */
export interface LevelUp {
  xp: LevelStatus;
  /** The game NEW GAME UNLOCKED names, which A plays at once; null when no level climbed opened one. */
  game: Game | null;
}

/**
 * The level-up to play on arriving at the menu, or null: only on readable XP at a level (never for
 * a visitor, XP out of reach, or no XP yet), and only when that level is higher than `seen`, the
 * one this device last celebrated (null: none). NEW GAME UNLOCKED names the first game, in the
 * room's order, whose unlock level lies above `seen` and at or below the level, and which the
 * player's row holds unlocked.
 */
export function levelUpFor(xp: XpStatus, seen: number | null, rules: XpRules = XP_RULES, games: readonly Game[] = GAMES): LevelUp | null {
  if (xp.kind !== 'level') return null;
  const from = Math.max(0, seen ?? 0);
  if (xp.level <= from) return null;
  const game = games.find((g) => {
    const at = rules.unlocks[g.id];
    return at !== undefined && at > from && at <= xp.level && xp.unlocked.includes(g.id);
  }) ?? null;
  return { xp, game };
}

/** The line over LEVEL UP!: the first point at LV 1, the XP earned above it. */
export const eyebrowOf = (l: LevelUp): string => (l.xp.level === 1 ? 'FIRST POINT EARNED' : `${l.xp.xp} XP EARNED`);

/** The numbers under the XP bar, counted from the new level: what the next one needs, or the cap. */
export const xpLineOf = ({ xp }: LevelUp): string =>
  (xp.next === null ? `${xp.xp} XP · MAX LEVEL` : `${xp.xp} / ${xp.next} XP · NEXT LV ${xp.level + 1}`);

/** The fanfare it plays: the unlock fanfare when a game opened, the level-up fanfare otherwise. */
export const fanfareOf = (l: LevelUp): SongName => (l.game ? 'unlock' : 'levelup');

// ── The level this device last celebrated ──

export const LEVEL_SEEN_PREFIX = 'omni-loop:level-seen:';

/** The storage key of a login's celebrated level; the login lower-cased, as player_xp keeps it. */
export const levelSeenKey = (login: string) => `${LEVEL_SEEN_PREFIX}${login.toLowerCase()}`;

/** The browser's storage, reached through a function: reaching it can throw (a sandboxed frame), and so can reading it. */
export type Local = () => Pick<Storage, 'getItem' | 'setItem'> | null;

/** The level stored for `login`, or null: nothing stored, anything but a level, or storage refused. */
export function readSeen(local: Local, login: string): number | null {
  try {
    const raw = local()?.getItem(levelSeenKey(login)) ?? null;
    if (raw === null || !/^\d+$/.test(raw)) return null;
    return Number(raw);
  } catch {
    return null;
  }
}

/** Stores `level` as celebrated for `login`; false when storage refused it. */
export function saveSeen(local: Local, login: string, level: number): boolean {
  try {
    const store = local();
    if (!store) return false;
    store.setItem(levelSeenKey(login), String(level));
    return true;
  } catch {
    return false;
  }
}

export interface Seen {
  /** The level last celebrated for `login`, on this device or in this page: the higher of the two. */
  get(login: string): number | null;
  /** Saves `level` as celebrated for `login`: in storage when it allows it, and in this page always. */
  set(login: string, level: number): void;
}

/**
 * The levels celebrated, read from storage and kept in the page as well, so storage that refuses
 * (a private or sandboxed frame) still plays each level-up once a page, not at every visit to the menu.
 */
export function createSeen(local: Local): Seen {
  const page = new Map<string, number>();
  return {
    get(login) {
      const stored = readSeen(local, login), here = page.get(login.toLowerCase()) ?? null;
      return stored === null ? here : here === null ? stored : Math.max(stored, here);
    },
    set(login, level) {
      page.set(login.toLowerCase(), level);
      saveSeen(local, login, level);
    },
  };
}
