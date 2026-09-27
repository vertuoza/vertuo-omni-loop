// What the game room shows, as pure functions: the player's XP state, the level on their badge, the
// words for each state, and the cabinets. The numbers come from the player's player_xp row, and the
// curve and the unlock levels from the rulebook's `xp` block, through game/experience.mjs.
import { xpForLevel, XP_RULES, type XpRules } from '@omni/galaxy';
import type { SceneName } from '../scenes/common.ts';
import type { XpRead } from '../types';
import { GAMES, type Game } from './index';

/**
 * The player's XP as the room reads it: a visitor has none to show (GitHub is how XP is earned); XP
 * out of reach; no XP yet (no row, or a row stored at level 0, which is no level); or a level, with
 * the XP it starts at (`floor`) and the XP the next one needs (`next`, null at the cap).
 */
export type XpStatus =
  | { kind: 'visitor' }
  | { kind: 'unreadable' }
  | { kind: 'none' }
  | { kind: 'level'; xp: number; level: number; unlocked: readonly string[]; floor: number; next: number | null };

export function xpStatus(linked: boolean, xp: XpRead, rules: XpRules = XP_RULES): XpStatus {
  if (!linked) return { kind: 'visitor' };
  if (xp === 'unreadable') return { kind: 'unreadable' };
  if (!xp || xp.level < 1) return { kind: 'none' };
  const level = Math.min(xp.level, rules.cap);
  return {
    kind: 'level', xp: xp.xp, level, unlocked: xp.unlocked,
    floor: xpForLevel(level, rules), next: level < rules.cap ? xpForLevel(level + 1, rules) : null,
  };
}

/** The level a badge shows, `LV n`; null before the first point and whenever XP is not known. */
export const levelTag = (s: XpStatus): string | null => (s.kind === 'level' ? `LV ${s.level}` : null);

/** How far the XP bar is filled, 0 to 1: the XP inside the level. Full at the cap, empty without a level. */
export function barFill(s: XpStatus): number {
  if (s.kind !== 'level') return 0;
  if (s.next === null) return 1;
  return Math.min(1, Math.max(0, (s.xp - s.floor) / (s.next - s.floor)));
}

/** The room's line in place of the XP bar, for each state without a level. None of them names one. */
export const XP_LINE = {
  visitor: 'LINK GITHUB TO EARN XP',
  none: 'NO XP YET · SCORE YOUR FIRST POINT',
  unreadable: 'XP OUT OF REACH',
} as const;

/** GAMES's hint on the menu: the level and the games unlocked, or why there is no level. */
export function gamesHint(s: XpStatus): string {
  switch (s.kind) {
    case 'visitor': return 'Link GitHub to earn XP';
    case 'none': return 'No XP yet';
    case 'unreadable': return 'XP out of reach';
    case 'level': return `LV ${s.level} · ${s.unlocked.length} game${s.unlocked.length === 1 ? '' : 's'} unlocked`;
  }
}

/** A cabinet in the room: a registry game, lit or locked (with the level it unlocks at), or one still to come. */
export type Cabinet =
  | { kind: 'game'; game: Game; unlocked: boolean; level: number | null }
  | { kind: 'soon' };

/** The room stands at least three cabinets: the games, then SOON cabinets for the ones still to come. */
export const ROOM_CABINETS = 3;

export function cabinets(s: XpStatus, rules: XpRules = XP_RULES, games: readonly Game[] = GAMES): Cabinet[] {
  const lit = new Set(s.kind === 'level' ? s.unlocked : []);
  const room: Cabinet[] = games.map((game) => ({ kind: 'game', game, unlocked: lit.has(game.id), level: rules.unlocks[game.id] ?? null }));
  while (room.length < ROOM_CABINETS) room.push({ kind: 'soon' });
  return room;
}

/** Where A on a cabinet leads: its game's scene, or why it does not play. */
export function cabinetDoor(c: Cabinet, s: XpStatus): { scene: SceneName } | { refused: string } {
  if (c.kind === 'soon') return { refused: 'THIS CABINET ARRIVES SOON' };
  if (c.unlocked) return c.game.scene ? { scene: c.game.scene } : { refused: `${c.game.title} · COMING SOON` };
  if (s.kind === 'visitor' || s.kind === 'unreadable') return { refused: XP_LINE[s.kind] };
  return { refused: c.level ? `REACH LV ${c.level} TO PLAY` : 'LOCKED' };
}
