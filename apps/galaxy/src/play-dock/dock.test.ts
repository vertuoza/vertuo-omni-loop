import { describe, expect, it } from 'vitest';
import { XP_LINE } from '../arcade/games/room';
import { DOCK_KEY, DOCK_MIN_WIDTH, dockDoor, dockView, readOpen, writeOpen, type DockInput } from './dock';

const PLAYER = { linked: true, xp: { xp: 180, level: 3, unlocked: ['invaders'] } };
const base: DockInput = { state: 'working', door: { play: true }, open: false, game: false, width: 1280 };
const view = (patch: Partial<DockInput> = {}) => dockView({ ...base, ...patch });

describe('dockDoor: the arcade\'s own rule on who plays', () => {
  it('lets a player at LV 1 or more play', () => {
    expect(dockDoor(PLAYER)).toEqual({ play: true });
    expect(dockDoor({ linked: true, xp: { xp: 1, level: 1, unlocked: ['invaders'] } })).toEqual({ play: true });
  });

  it('refuses a visitor, with or without a row, with the room\'s line', () => {
    expect(dockDoor(null)).toEqual({ play: false, refused: XP_LINE.visitor });
    expect(dockDoor({ linked: false, xp: PLAYER.xp })).toEqual({ play: false, refused: 'LINK GITHUB TO EARN XP' });
  });

  it('refuses a player with no XP, and one stored below LV 1, until they reach it', () => {
    expect(dockDoor({ linked: true, xp: null })).toEqual({ play: false, refused: 'REACH LV 1 TO PLAY' });
    expect(dockDoor({ linked: true, xp: { xp: 0, level: 0, unlocked: [] } })).toEqual({ play: false, refused: 'REACH LV 1 TO PLAY' });
  });

  it('says XP is out of reach rather than guess', () => {
    expect(dockDoor({ linked: true, xp: 'unreadable' })).toEqual({ play: false, refused: XP_LINE.unreadable });
  });
});

describe('dockView', () => {
  it('is hidden while Claude is idle and no game is on, open or folded', () => {
    expect(view({ state: 'idle' })).toEqual({ kind: 'hidden' });
    expect(view({ state: 'idle', open: true })).toEqual({ kind: 'hidden' });
  });

  it('is the folded pill while Claude works, and only then', () => {
    expect(view()).toEqual({ kind: 'folded' });
    expect(view({ state: 'asking' })).toEqual({ kind: 'hidden' });
    expect(view({ state: 'idle', game: true })).toEqual({ kind: 'hidden' });
  });

  it('plays once opened while Claude works', () => {
    expect(view({ open: true })).toEqual({ kind: 'playing' });
    expect(view({ open: true, game: true })).toEqual({ kind: 'playing' });
  });

  it('pauses on a question, with or without a game on', () => {
    expect(view({ state: 'asking', open: true, game: true })).toEqual({ kind: 'asking' });
    expect(view({ state: 'asking', open: true })).toEqual({ kind: 'asking' });
  });

  it('says Claude is done when the page turns idle mid-game', () => {
    expect(view({ state: 'idle', open: true, game: true })).toEqual({ kind: 'done' });
  });

  it('shows the refusal to a visitor, a player with no XP and one below LV 1, never the game', () => {
    for (const p of [null, { linked: true, xp: null }, { linked: true, xp: { xp: 0, level: 0, unlocked: [] } }]) {
      const door = dockDoor(p);
      expect(view({ open: true, door })).toEqual({ kind: 'refused', line: door.play ? '' : door.refused });
      expect(view({ open: true, door, state: 'asking' }).kind).toBe('refused');
    }
    expect(view({ open: true, door: dockDoor(null) })).toEqual({ kind: 'refused', line: 'LINK GITHUB TO EARN XP' });
  });

  it('is hidden below 600 px wide, whatever else, and before the width is known', () => {
    for (const patch of [{}, { open: true }, { open: true, state: 'asking' as const }, { open: true, state: 'idle' as const, game: true }]) {
      expect(view({ ...patch, width: DOCK_MIN_WIDTH - 1 })).toEqual({ kind: 'hidden' });
      expect(view({ ...patch, width: 0 })).toEqual({ kind: 'hidden' });
    }
    expect(view({ width: DOCK_MIN_WIDTH })).toEqual({ kind: 'folded' });
  });
});

describe('the open or folded state, kept for the tab', () => {
  const memory = () => {
    const kept = new Map<string, string>();
    return { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
  };

  it('survives a remount through the tab\'s storage', () => {
    const s = memory();
    expect(readOpen(() => s)).toBe(false);
    writeOpen(() => s, true);
    expect(s.getItem(DOCK_KEY)).toBe('open');
    expect(readOpen(() => s)).toBe(true);
    writeOpen(() => s, false);
    expect(readOpen(() => s)).toBe(false);
  });

  it('is folded when the storage throws, and writing to it never throws', () => {
    const refusing = () => { throw new Error('SecurityError'); };
    expect(readOpen(refusing)).toBe(false);
    expect(() => writeOpen(refusing, true)).not.toThrow();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(readOpen(() => broken)).toBe(false);
    expect(() => writeOpen(() => broken, true)).not.toThrow();
  });
});
