import { describe, expect, it } from 'vitest';
import { XP_RULES, type XpRules } from '@omni/galaxy';
import { GAMES, type Game } from './games';
import { xpStatus } from './games/room';
import { createSeen, eyebrowOf, fanfareOf, LEVEL_SEEN_PREFIX, levelSeenKey, levelUpFor, readSeen, saveSeen, xpLineOf, type Local } from './levelup';
import { sure } from './test/sure';

const row = (xp: number, level: number, unlocked: string[] = level >= 1 ? ['invaders'] : []) => ({ xp, level, unlocked });
/** A player whose GitHub is linked, with their player_xp row. */
const player = (xp: number, level: number, unlocked?: string[]) => xpStatus(true, row(xp, level, unlocked));

describe('when the level-up screen plays', () => {
  it('plays when the player\'s level is higher than the one this device last celebrated', () => {
    expect(levelUpFor(player(1, 1), null)?.xp.level).toBe(1);
    expect(levelUpFor(player(1, 1), 0)?.xp.level).toBe(1);
    expect(levelUpFor(player(180, 3), 2)?.xp).toMatchObject({ level: 3, xp: 180, floor: 150, next: 300 });
  });

  it('does not play again for a level already celebrated, nor for a lower one', () => {
    expect(levelUpFor(player(180, 3), 3)).toBeNull();
    expect(levelUpFor(player(180, 3), 7)).toBeNull();
  });

  it('never plays without readable XP: not for a visitor, XP out of reach, no row, or a row at level 0', () => {
    expect(levelUpFor(xpStatus(false, row(180, 3)), null)).toBeNull();
    expect(levelUpFor(xpStatus(true, 'unreadable'), null)).toBeNull();
    expect(levelUpFor(xpStatus(true, null), null)).toBeNull();
    expect(levelUpFor(xpStatus(true, row(0, 0)), null)).toBeNull();
  });
});

describe('NEW GAME UNLOCKED', () => {
  it('shows the game the level opened: the first point opens Entropy Invaders', () => {
    const invaders = GAMES.find((g) => g.id === 'invaders');
    expect(levelUpFor(player(1, 1), null)?.game).toBe(invaders);
    expect(levelUpFor(player(1, 1), 0)?.game).toBe(invaders);
  });

  it('shows no game when the level opened none', () => {
    expect(levelUpFor(player(60, 2), 1)).toMatchObject({ game: null });
    expect(levelUpFor(player(180, 3), 2)).toMatchObject({ game: null });
  });

  it('shows a game opened by any level climbed since the last one celebrated here', () => {
    expect(levelUpFor(player(230, 3), null)?.game?.id).toBe('invaders');
    expect(levelUpFor(player(230, 3), 1)?.game).toBeNull();
  });

  it('shows only a game the player\'s row holds unlocked: the database decides what is open', () => {
    expect(levelUpFor(player(1, 1, []), null)).toMatchObject({ game: null });
  });

  it('reads the unlock levels from the rules, and the games from the registry', () => {
    const rules: XpRules = { ...XP_RULES, unlocks: { invaders: 3, maze: 4 } };
    const maze: Game = { id: 'maze', title: 'ENTROPY MAZE', scene: null, measure: 'points' };
    const games = [...GAMES, maze];
    expect(levelUpFor(xpStatus(true, row(60, 2, []), rules), 1, rules, games)?.game).toBeNull();
    expect(levelUpFor(xpStatus(true, row(180, 3), rules), 2, rules, games)?.game?.id).toBe('invaders');
    expect(levelUpFor(xpStatus(true, row(310, 4, ['invaders', 'maze']), rules), 3, rules, games)?.game).toBe(maze);
    // Two games opened at once: the first in the room's order.
    expect(levelUpFor(xpStatus(true, row(310, 4, ['invaders', 'maze']), rules), 2, rules, games)?.game?.id).toBe('invaders');
  });
});

describe('what the screen says', () => {
  it('opens on the first point at LV 1, and on the XP earned above it', () => {
    expect(eyebrowOf(sure(levelUpFor(player(1, 1), null), 'levelUpFor(player(1, 1), null)'))).toBe('FIRST POINT EARNED');
    expect(eyebrowOf(sure(levelUpFor(player(230, 3), null), 'levelUpFor(player(230, 3), null)'))).toBe('230 XP EARNED');
  });

  it('shows the XP bar\'s numbers from the new level, and the cap as the last', () => {
    expect(xpLineOf(sure(levelUpFor(player(1, 1), null), 'levelUpFor(player(1, 1), null)'))).toBe('1 / 50 XP · NEXT LV 2');
    const top = XP_RULES.curve.step * XP_RULES.cap * (XP_RULES.cap - 1);
    expect(xpLineOf(sure(levelUpFor(player(top, XP_RULES.cap), 98), 'levelUpFor(player(top, XP_RULES.cap), 98)'))).toBe(`${top} XP · MAX LEVEL`);
  });

  it('plays the unlock fanfare when a game opened, the level-up fanfare otherwise', () => {
    expect(fanfareOf(sure(levelUpFor(player(1, 1), null), 'levelUpFor(player(1, 1), null)'))).toBe('unlock');
    expect(fanfareOf(sure(levelUpFor(player(60, 2), 1), 'levelUpFor(player(60, 2), 1)'))).toBe('levelup');
  });
});

describe('the level this device last celebrated', () => {
  /** Browser storage, in memory. */
  function storage() {
    const m = new Map<string, string>();
    return { m, local: (() => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } })) as Local };
  }
  /** Browser storage that refuses every access, as a sandboxed frame's does. */
  const refused: Local = () => { throw new Error('SecurityError: storage is disabled'); };
  const refusing: Local = () => ({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } });

  it('is kept in browser storage under omni-loop:level-seen:<login>, the login lower-cased as player_xp keeps it', () => {
    expect(LEVEL_SEEN_PREFIX).toBe('omni-loop:level-seen:');
    expect(levelSeenKey('Ada-GH')).toBe('omni-loop:level-seen:ada-gh');
    const { m, local } = storage();
    expect(saveSeen(local, 'Ada-GH', 3)).toBe(true);
    expect([...m]).toEqual([['omni-loop:level-seen:ada-gh', '3']]);
    expect(readSeen(local, 'ada-gh')).toBe(3);
  });

  it('reads nothing stored, or anything but a level, as none celebrated', () => {
    const { m, local } = storage();
    expect(readSeen(local, 'ada-gh')).toBeNull();
    for (const bad of ['', 'x', '-1', '2.5', 'NaN']) {
      m.set(levelSeenKey('ada-gh'), bad);
      expect(readSeen(local, 'ada-gh'), bad).toBeNull();
    }
  });

  it('reads and writes nothing, and never throws, when storage refuses', () => {
    for (const local of [refused, refusing, (() => null) as Local]) {
      expect(readSeen(local, 'ada-gh')).toBeNull();
      expect(saveSeen(local, 'ada-gh', 3)).toBe(false);
    }
  });

  it('remembers a level celebrated in this page even when storage refuses, so it plays once a page there', () => {
    const seen = createSeen(refused);
    expect(seen.get('ada-gh')).toBeNull();
    seen.set('ada-gh', 3);
    expect(seen.get('ada-gh')).toBe(3);
    expect(levelUpFor(player(180, 3), seen.get('ada-gh'))).toBeNull();
    expect(createSeen(refused).get('ada-gh')).toBeNull(); // a new page: storage kept nothing
  });

  it('keeps each login apart, and the higher of what storage and the page hold', () => {
    const { m, local } = storage();
    const seen = createSeen(local);
    seen.set('ada-gh', 2);
    expect(seen.get('ADA-GH')).toBe(2);
    expect(seen.get('bea-gh')).toBeNull();
    m.set(levelSeenKey('ada-gh'), '5'); // another tab celebrated a higher level meanwhile
    expect(seen.get('ada-gh')).toBe(5);
    expect(createSeen(local).get('ada-gh')).toBe(5);
  });
});
