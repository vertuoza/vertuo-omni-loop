import { describe, expect, it } from 'vitest';
import { XP_RULES, type XpRules } from '@omni/galaxy';
import { GAMES } from './index';
import { barFill, cabinetDoor, cabinets, gamesHint, levelTag, ROOM_CABINETS, XP_LINE, xpStatus } from './room';

const row = (xp: number, level: number, unlocked: string[] = level >= 1 ? ['invaders'] : []) => ({ xp, level, unlocked });

describe('the registry', () => {
  it('lists Entropy Invaders, keyed as the rulebook unlocks it, not playable until its scene lands', () => {
    expect(GAMES.map((g) => [g.id, g.title])).toEqual([['invaders', 'ENTROPY INVADERS']]);
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
    const room = cabinets(xpStatus(true, row(180, 3)));
    expect(room).toHaveLength(ROOM_CABINETS);
    expect(room.map((c) => c.kind)).toEqual(['game', 'soon', 'soon']);
    expect(room[0]).toEqual({ kind: 'game', game: GAMES[0], unlocked: true, level: 1 });
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
    expect(room.filter((c) => c.kind === 'game' && c.unlocked)).toEqual([]);
  });

  it('reads each game\'s level from the rules, and stands no SOON cabinet once the games fill the room', () => {
    const rules: XpRules = { ...XP_RULES, unlocks: { invaders: 4 } };
    expect(cabinets(xpStatus(true, row(180, 3, [])), rules)[0]).toMatchObject({ unlocked: false, level: 4 });
    const many = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id.toUpperCase(), scene: null }));
    expect(cabinets(xpStatus(true, null), XP_RULES, many).map((c) => c.kind)).toEqual(['game', 'game', 'game', 'game']);
  });
});

describe('cabinetDoor', () => {
  const status = xpStatus(true, row(180, 3));
  const [game, soon] = cabinets(status);

  it('plays an unlocked game once it has its scene', () => {
    const playable = { ...game, game: { ...GAMES[0], scene: 'menu' as const } };
    expect(cabinetDoor(playable, status)).toEqual({ scene: 'menu' });
  });

  it('says why a cabinet does not play: not playable yet, locked, or still to come', () => {
    expect(cabinetDoor(game, status)).toEqual({ refused: 'ENTROPY INVADERS · COMING SOON' });
    expect(cabinetDoor(soon, status)).toEqual({ refused: 'THIS CABINET ARRIVES SOON' });
    const locked = cabinets(xpStatus(true, null))[0];
    expect(cabinetDoor(locked, xpStatus(true, null))).toEqual({ refused: 'REACH LV 1 TO PLAY' });
    expect(cabinetDoor(locked, xpStatus(false, null))).toEqual({ refused: 'LINK GITHUB TO EARN XP' });
    expect(cabinetDoor(locked, xpStatus(true, 'unreadable'))).toEqual({ refused: 'XP OUT OF REACH' });
  });
});
