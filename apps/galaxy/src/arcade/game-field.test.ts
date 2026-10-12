// BR-PRODUCT-33: when the phone turns during an invaders game, the game keeps the field it started on
// (wide: ten columns and four shields; tall: six and three), letterboxed, until it ends. The next game
// uses the field of the current screen.
import { describe, expect, it } from 'vitest';
import type { WoundKind } from '@omni/galaxy';
import type { Action } from './keys';
import { sceneGrid } from './ArcadeApp';
import { frameFor, gridFor, TALL, WIDE } from './grid';
import { FIELDS, hudOf, newGame, press, step, type Game } from './games/invaders';

const VALUES: Record<WoundKind, number> = {
  beacon: 5, 'fault-line': 4, 'unconfirmed-ground': 3, 'under-fire': 2, transmission: 1, aftershock: 0,
};
const NONE: ReadonlySet<Action> = new Set();

/** A game begun on the screen `form` shows, as the cabinet begins one, past its ready screen. */
function begun(form: 'handheld' | 'advance'): Game {
  return press(newGame({ layout: gridFor(form, 'invaders').name, values: VALUES, seed: 7 }), 'a').game;
}

/** The game played on for `n` frames. */
function played(g: Game, n: number): Game {
  for (let i = 0; i < n; i++) g = step(g, NONE, 1 / 60);
  return g;
}

describe('BR-PRODUCT-33: an invaders game keeps the field it started on when the phone turns', () => {
  it('lays a game out wide with ten columns and four shields, tall with six and three', () => {
    const wide = begun('advance');
    expect(wide.layout).toBe('wide');
    expect([wide.cols, wide.shields.length]).toEqual([10, 4]);
    const tall = begun('handheld');
    expect(tall.layout).toBe('tall');
    expect([tall.cols, tall.shields.length]).toEqual([6, 3]);
  });

  it('draws a game begun upright on its tall field, letterboxed, once the phone turns sideways', () => {
    const g = played(begun('handheld'), 120);
    expect(sceneGrid('invaders', 'advance', hudOf(g), null, null, null)).toBe(TALL);
    expect(frameFor('advance')).toBe(WIDE); // the screen is wide: the tall field is letterboxed in it
    expect([g.cols, g.shields.length, FIELDS[g.layout].cols]).toEqual([6, 3, 6]);
  });

  it('draws a game begun sideways on its wide field, letterboxed, once the phone turns upright', () => {
    const g = played(begun('advance'), 120);
    expect(sceneGrid('invaders', 'handheld', hudOf(g), null, null, null)).toBe(WIDE);
    expect(frameFor('handheld')).toBe(TALL); // the screen is tall: the wide field is letterboxed in it
    expect([g.cols, g.shields.length, FIELDS[g.layout].cols]).toEqual([10, 4, 10]);
  });

  it('keeps the field until the game ends, and the next game takes the field of the current screen', () => {
    const over = { ...played(begun('handheld'), 60), over: true };
    expect(sceneGrid('invaders', 'advance', hudOf(over), null, null, null)).toBe(TALL);
    const next = begun('advance');
    expect(next.layout).toBe('wide');
    expect(sceneGrid('invaders', 'advance', hudOf(next), null, null, null)).toBe(WIDE);
  });
});
