import { describe, expect, it } from 'vitest';
import { XP_LINE } from '../arcade/games/room';
import { backFromGame, DOCK_KEY, DOCK_MIN_WIDTH, DOCK_TITLE, dockDoor, dockStart, dockView, pickerPress, readDock, readOpen, writeDock, writeOpen, type DockInput } from './dock';
import { sure } from '../arcade/test/sure';

const PLAYER = { linked: true, xp: { xp: 180, level: 3, unlocked: ['invaders'] } };
const BOTH = { linked: true, xp: { xp: 400, level: 2, unlocked: ['invaders', 'platformer'] } };
const base: DockInput = { state: 'working', door: { play: true, games: ['invaders'] }, open: false, game: false, width: 1280 };
const view = (patch: Partial<DockInput> = {}) => dockView({ ...base, ...patch });

describe('dockDoor: the arcade\'s own rule on who plays', () => {
  it('lets a player at LV 1 or more play Entropy Invaders, and only it below LV 2', () => {
    expect(dockDoor(PLAYER)).toEqual({ play: true, games: ['invaders'] });
    expect(dockDoor({ linked: true, xp: { xp: 1, level: 1, unlocked: ['invaders'] } })).toEqual({ play: true, games: ['invaders'] });
  });

  it('gives a player at LV 2 both games, Invaders first, as the room\'s cabinets stand', () => {
    expect(dockDoor(BOTH)).toEqual({ play: true, games: ['invaders', 'platformer'] });
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

describe('the picker, when more than one game is open', () => {
  it('goes straight into Invaders when it is the only game open', () => {
    expect(dockStart(['invaders'], null)).toEqual({ kind: 'game', game: 'invaders' });
    expect(dockStart(['invaders'], 'platformer')).toEqual({ kind: 'game', game: 'invaders' });
  });

  it('opens on the picker when both are open, on the game chosen last, or the first', () => {
    expect(dockStart(['invaders', 'platformer'], null)).toEqual({ kind: 'picker', sel: 0 });
    expect(dockStart(['invaders', 'platformer'], 'platformer')).toEqual({ kind: 'picker', sel: 1 });
    expect(dockStart(['invaders', 'platformer'], 'tetris')).toEqual({ kind: 'picker', sel: 0 });
  });

  it('names the games as the room\'s marquees do', () => {
    expect(DOCK_TITLE).toEqual({ invaders: 'ENTROPY INVADERS', platformer: 'SUPER OMNI WORLD' });
  });

  it('moves with up and down, wrapping, plays the chosen game on A, and folds on B', () => {
    const games = ['invaders', 'platformer'] as const;
    expect(pickerPress(games, 0, 'down')).toEqual({ sel: 1 });
    expect(pickerPress(games, 1, 'down')).toEqual({ sel: 0 });
    expect(pickerPress(games, 0, 'up')).toEqual({ sel: 1 });
    expect(pickerPress(games, 1, 'a')).toEqual({ play: 'platformer' });
    expect(pickerPress(games, 0, 'start')).toEqual({ play: 'invaders' });
    expect(pickerPress(games, 0, 'b')).toEqual({ fold: true });
    expect(pickerPress(games, 0, 'left')).toBeNull();
  });

  it('comes back to the picker from a game when there is one, on the game just left', () => {
    expect(backFromGame(['invaders', 'platformer'], 'platformer')).toEqual({ kind: 'picker', sel: 1 });
    expect(backFromGame(['invaders'], 'invaders')).toEqual({ kind: 'fold' });
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
    expect(JSON.parse(sure(s.getItem(DOCK_KEY), 's.getItem(DOCK_KEY)'))).toEqual({ open: true, game: null });
    expect(readOpen(() => s)).toBe(true);
    writeOpen(() => s, false);
    expect(readOpen(() => s)).toBe(false);
  });

  it('reads an entry kept before the picker, the bare word open', () => {
    const s = memory();
    s.setItem(DOCK_KEY, 'open');
    expect(readDock(() => s)).toEqual({ open: true, game: null });
    s.setItem(DOCK_KEY, '{broken');
    expect(readDock(() => s)).toEqual({ open: false, game: null });
  });

  it('keeps the game chosen last in the same entry, across a fold and a reopen', () => {
    const s = memory();
    writeOpen(() => s, true);
    writeDock(() => s, { game: 'platformer' });
    writeOpen(() => s, false);
    expect(readDock(() => s)).toEqual({ open: false, game: 'platformer' });
    writeOpen(() => s, true);
    expect(readDock(() => s)).toEqual({ open: true, game: 'platformer' });
    expect(dockStart(['invaders', 'platformer'], readDock(() => s).game)).toEqual({ kind: 'picker', sel: 1 });
  });

  it('is folded when the storage throws, and writing to it never throws', () => {
    const refusing = () => { throw new Error('SecurityError'); };
    expect(readOpen(refusing)).toBe(false);
    expect(() => { writeOpen(refusing, true); }).not.toThrow();
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(readOpen(() => broken)).toBe(false);
    expect(() => { writeOpen(() => broken, true); }).not.toThrow();
    expect(readDock(refusing)).toEqual({ open: false, game: null });
    expect(() => { writeDock(refusing, { game: 'platformer' }); }).not.toThrow();
    expect(() => { writeDock(() => broken, { game: 'platformer' }); }).not.toThrow();
  });
});
