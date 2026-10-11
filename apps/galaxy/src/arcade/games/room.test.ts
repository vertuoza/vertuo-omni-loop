import { describe, expect, it } from 'vitest';
import { playerXp, XP_RULES, type XpRules } from '@omni/galaxy';
import { GAMES } from './index';
import { barFill, cabinetDoor, cabinets, gamesHint, levelTag, ROOM_CABINETS, roomWindow, WIDE_WINDOW, XP_LINE, xpStatus, type Cabinet } from './room';
import { sure } from '../test/sure';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';

const row = (xp: number, level: number, unlocked: string[] = level >= 1 ? ['invaders'] : []) => ({ xp, level, unlocked });

describe('the registry', () => {
  it('lists Entropy Invaders, Super Omni World, OMNI KART then OMNI DUET, each keyed as the rulebook unlocks it', () => {
    expect(GAMES.map((g) => [g.id, g.title])).toEqual([['invaders', 'ENTROPY INVADERS'], ['platformer', 'SUPER OMNI WORLD'], ['kart', 'OMNI KART'], ['duet', 'OMNI DUET']]);
    expect(GAMES[2]).toEqual({ id: 'kart', title: 'OMNI KART', scene: 'kart', measure: 'time' });
    expect(GAMES[3]).toEqual({ id: 'duet', title: 'OMNI DUET', scene: null, measure: 'points' });
    expect(XP_RULES.unlocks).toEqual({ invaders: 1, platformer: 2, kart: 3, duet: 4 });
    expect(GAMES.map((g) => [g.id, g.measure])).toEqual([['invaders', 'points'], ['platformer', 'points'], ['kart', 'time'], ['duet', 'points']]);
    for (const g of GAMES) expect(XP_RULES.unlocks[g.id], g.id).toBeGreaterThanOrEqual(1);
  });
});

describe('xpStatus', () => {
  it('gives a visitor, without GitHub linked, no XP to show, whatever was read', () => {
    expect(xpStatus(false, row(180, 3))).toEqual({ kind: 'visitor' });
    expect(xpStatus(false, 'unreadable')).toEqual({ kind: 'visitor' });
  });

  it('says XP is out of reach when it could not be read, and never guesses a level', () => {
    expect(xpStatus(true, 'unreadable')).toEqual({ kind: 'unreadable' });
  });

  it('reads no row, and a row stored at level 0, as no XP yet: level 0 is no level', () => {
    expect(xpStatus(true, null)).toEqual({ kind: 'none' });
    expect(xpStatus(true, row(0, 0))).toEqual({ kind: 'none' });
  });

  it('gives a player with a level their XP, the level\'s floor and the next level\'s', () => {
    expect(xpStatus(true, row(180, 3))).toEqual({ kind: 'level', xp: 180, level: 3, unlocked: ['invaders'], floor: 150, next: 300 });
    expect(xpStatus(true, row(1, 1))).toMatchObject({ level: 1, floor: 1, next: 50 });
  });

  it('has no next level at the cap', () => {
    const top = XP_RULES.curve.step * XP_RULES.cap * (XP_RULES.cap - 1);
    expect(xpStatus(true, row(top + 5, XP_RULES.cap))).toMatchObject({ level: XP_RULES.cap, next: null });
  });

  it('reads the rules it is given', () => {
    const rules: XpRules = { ...XP_RULES, curve: { first: 1, step: 10 } };
    expect(xpStatus(true, row(70, 3), rules)).toMatchObject({ floor: 60, next: 120 });
  });
});

describe('levelTag', () => {
  it('shows LV n only for a player with a level: never LV 0, never a level it could not read', () => {
    expect(levelTag(xpStatus(true, row(180, 3)))).toBe('LV 3');
    expect(levelTag(xpStatus(true, row(0, 0)))).toBeNull();
    expect(levelTag(xpStatus(true, null))).toBeNull();
    expect(levelTag(xpStatus(true, 'unreadable'))).toBeNull();
    expect(levelTag(xpStatus(false, row(180, 3)))).toBeNull();
  });
});

describe('barFill', () => {
  it('fills the bar with the XP inside the level', () => {
    expect(barFill(xpStatus(true, row(180, 3)))).toBeCloseTo(0.2);
    expect(barFill(xpStatus(true, row(150, 3)))).toBe(0);
  });

  it('is full at the cap, empty without a level, and stays between 0 and 1 on a stale row', () => {
    const top = XP_RULES.curve.step * XP_RULES.cap * (XP_RULES.cap - 1);
    expect(barFill(xpStatus(true, row(top, XP_RULES.cap)))).toBe(1);
    expect(barFill(xpStatus(true, null))).toBe(0);
    expect(barFill(xpStatus(true, row(400, 3)))).toBe(1);
    expect(barFill(xpStatus(true, row(100, 3)))).toBe(0);
  });
});

describe('the words for each state', () => {
  it('names the level and the games unlocked on the menu, and why there is no level otherwise', () => {
    expect(gamesHint(xpStatus(true, row(180, 3)))).toBe('LV 3 · 1 game unlocked');
    expect(gamesHint(xpStatus(true, row(900, 6, ['invaders', 'maze'])))).toBe('LV 6 · 2 games unlocked');
    expect(gamesHint(xpStatus(false, null))).toBe('Link GitHub to earn XP');
    expect(gamesHint(xpStatus(true, null))).toBe('No XP yet');
    expect(gamesHint(xpStatus(true, 'unreadable'))).toBe('XP out of reach');
  });

  it('gives the room a line for each state without a level, none of them a level', () => {
    expect(XP_LINE).toEqual({
      visitor: 'LINK GITHUB TO EARN XP', none: 'NO XP YET · SCORE YOUR FIRST POINT', unreadable: 'XP OUT OF REACH',
    });
    for (const line of Object.values(XP_LINE)) expect(line).not.toMatch(/LV \d/);
  });
});

describe('cabinets', () => {
  it('stands a cabinet per registry game, then SOON cabinets up to three', () => {
    const room = cabinets(xpStatus(true, row(180, 3)), XP_RULES, GAMES.slice(0, 2));
    expect(room).toHaveLength(ROOM_CABINETS);
    expect(room.map((c) => c.kind)).toEqual(['game', 'game', 'soon']);
    expect(cabinets(xpStatus(true, row(180, 3))).map((c) => c.kind)).toEqual(['game', 'game', 'game', 'game']);
    expect(room[0]).toEqual({ kind: 'game', game: GAMES[0], unlocked: true, level: 1 });
    expect(room[1]).toEqual({ kind: 'game', game: GAMES[1], unlocked: false, level: 2 });
  });

  it('lights a game only when the player\'s stored row unlocked it', () => {
    expect(cabinets(xpStatus(true, row(180, 3, [])))[0]).toMatchObject({ unlocked: false, level: 1 });
  });

  it.each([
    ['a visitor', xpStatus(false, row(180, 3))],
    ['a player with no XP yet', xpStatus(true, null)],
    ['a player whose XP could not be read', xpStatus(true, 'unreadable')],
  ])('keeps every cabinet locked for %s, the game showing its level', (_, status) => {
    const room = cabinets(status);
    expect(room[0]).toMatchObject({ kind: 'game', unlocked: false, level: 1 });
    expect(room[1]).toMatchObject({ kind: 'game', unlocked: false, level: 2 });
    expect(room.filter((c) => c.kind === 'game' && c.unlocked)).toEqual([]);
  });

  it('reads each game\'s level from the rules, and stands no SOON cabinet once the games fill the room', () => {
    const rules: XpRules = { ...XP_RULES, unlocks: { invaders: 4 } };
    expect(cabinets(xpStatus(true, row(180, 3, [])), rules)[0]).toMatchObject({ unlocked: false, level: 4 });
    const many = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id.toUpperCase(), scene: null, measure: 'points' as const }));
    expect(cabinets(xpStatus(true, null), XP_RULES, many).map((c) => c.kind)).toEqual(['game', 'game', 'game', 'game']);
  });
});

describe('cabinetDoor', () => {
  const status = xpStatus(true, row(180, 3));
  const [game] = cabinets(status);
  const soon = cabinets(status, XP_RULES, GAMES.slice(0, 2))[2];
  assertDefined(game, 'game');
  assertDefined(soon, 'soon');

  it('plays Entropy Invaders on its unlocked cabinet: A opens the invaders scene', () => {
    expect(GAMES[0]).toEqual({ id: 'invaders', title: 'ENTROPY INVADERS', scene: 'invaders', measure: 'points' });
    expect(cabinetDoor(game, status)).toEqual({ scene: 'invaders' });
  });

  it('says why a cabinet does not play: not playable yet, locked, or still to come', () => {
    const unplayable = { ...game, game: { ...sure(GAMES[0], 'GAMES[0]'), scene: null } } as Cabinet;
    expect(cabinetDoor(unplayable, status)).toEqual({ refused: 'ENTROPY INVADERS · COMING SOON' });
    expect(cabinetDoor(soon, status)).toEqual({ refused: 'THIS CABINET ARRIVES SOON' });
    const locked = cabinets(xpStatus(true, null))[0];
    assertDefined(locked, 'locked');
    expect(cabinetDoor(locked, xpStatus(true, null))).toEqual({ refused: 'REACH LV 1 TO PLAY' });
    expect(cabinetDoor(locked, xpStatus(false, null))).toEqual({ refused: 'LINK GITHUB TO EARN XP' });
    expect(cabinetDoor(locked, xpStatus(true, 'unreadable'))).toEqual({ refused: 'XP OUT OF REACH' });
  });

  it('refuses Super Omni World at LV 1 with REACH LV 2 TO PLAY, and opens its scene at LV 2', () => {
    const lv1 = xpStatus(true, row(10, 1, ['invaders']));
    const [, platformer1] = cabinets(lv1);
    assertDefined(platformer1, 'platformer1');
    expect(platformer1).toMatchObject({ kind: 'game', unlocked: false, level: 2 });
    expect(cabinetDoor(platformer1, lv1)).toEqual({ refused: 'REACH LV 2 TO PLAY' });
    const lv2 = xpStatus(true, row(60, 2, ['invaders', 'platformer']));
    const [, platformer2] = cabinets(lv2);
    assertDefined(platformer2, 'platformer2');
    expect(cabinetDoor(platformer2, lv2)).toEqual({ scene: 'platformer' });
  });
});

describe('OMNI KART\'s cabinet (PRD 1359)', () => {
  it('is the third cabinet, in place of SOON: refused at LV 2 with REACH LV 3 TO PLAY, and open at LV 3', () => {
    const lv2 = xpStatus(true, row(60, 2, ['invaders', 'platformer']));
    const room2 = cabinets(lv2);
    expect(room2).toHaveLength(GAMES.length);
    expect(room2.some((c) => c.kind === 'soon')).toBe(false);
    const kart2 = room2[2];
    assertDefined(kart2, 'kart2');
    expect(kart2).toMatchObject({ kind: 'game', unlocked: false, level: 3 });
    expect(cabinetDoor(kart2, lv2)).toEqual({ refused: 'REACH LV 3 TO PLAY' });
    const lv3 = xpStatus(true, row(150, 3, ['invaders', 'platformer', 'kart']));
    const kart3 = cabinets(lv3)[2];
    assertDefined(kart3, 'kart3');
    expect(cabinetDoor(kart3, lv3)).toEqual({ scene: 'kart' });
  });
});

describe('OMNI DUET\'s cabinet (PRD 1633)', () => {
  it('is the fourth cabinet: refused at LV 3 with REACH LV 4 TO PLAY, and coming soon at LV 4 until its scene lands', () => {
    const lv3 = xpStatus(true, row(150, 3, ['invaders', 'platformer', 'kart']));
    const room3 = cabinets(lv3);
    expect(room3).toHaveLength(4);
    const duet3 = room3[3];
    assertDefined(duet3, 'duet3');
    expect(duet3).toMatchObject({ kind: 'game', game: { id: 'duet', title: 'OMNI DUET' }, unlocked: false, level: 4 });
    expect(cabinetDoor(duet3, lv3)).toEqual({ refused: 'REACH LV 4 TO PLAY' });
    const lv4 = xpStatus(true, row(300, 4, ['invaders', 'platformer', 'kart', 'duet']));
    const duet4 = cabinets(lv4)[3];
    assertDefined(duet4, 'duet4');
    expect(duet4).toMatchObject({ unlocked: true, level: 4 });
    expect(cabinetDoor(duet4, lv4)).toEqual({ refused: 'OMNI DUET · COMING SOON' });
  });
});

describe('roomWindow, the cabinets the wide grid shows', () => {
  it('shows three cabinets, today\'s room minimum', () => {
    expect(WIDE_WINDOW).toBe(3);
    expect(ROOM_CABINETS).toBe(3);
  });

  it.each([
    [0, [0, 1, 2]],
    [1, [0, 1, 2]],
    [2, [0, 1, 2]],
    [3, [1, 2, 3]],
  ])('holds the cabinet under the cursor in its window of four: cursor on %i shows %o', (at, shown) => {
    expect(roomWindow(at, 4)).toEqual(shown);
  });

  it('scrolls by one per cabinet past the third, and comes back to the start when the cursor does', () => {
    expect(roomWindow(4, 6)).toEqual([2, 3, 4]);
    expect(roomWindow(5, 6)).toEqual([3, 4, 5]);
    expect(roomWindow(0, 6)).toEqual([0, 1, 2]);
  });

  it('shows every cabinet when the room holds no more than the window, and keeps a cursor past the end on the last', () => {
    expect(roomWindow(1, 3)).toEqual([0, 1, 2]);
    expect(roomWindow(0, 2)).toEqual([0, 1]);
    expect(roomWindow(9, 4)).toEqual([1, 2, 3]);
    expect(roomWindow(-2, 4)).toEqual([0, 1, 2]);
  });
});

// Law N-PRODUCT-10 (.omni-loop/knowledge/product/invariants.md, #1545).
describe('a player with no level', () => {
  it('law N-PRODUCT-10: is stored with level 0, never an empty value, and every screen reads 0 as no level and shows none', () => {
    const [stored] = playerXp([], { now: new Date('2026-10-01T00:00:00Z'), logins: ['newcomer'] });
    assertDefined(stored, 'stored');
    expect(stored.level).toBe(0);
    expect(stored.xp).toBe(0);
    const status = xpStatus(true, stored);
    expect(status).toEqual({ kind: 'none' });
    expect(levelTag(status)).toBeNull();
    expect(gamesHint(status)).not.toMatch(/LV/);
    expect(barFill(status)).toBe(0);
    expect(Object.values(XP_LINE).join(' ')).not.toMatch(/LV/);
  });
});
