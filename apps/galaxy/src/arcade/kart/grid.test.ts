import { describe, expect, it } from 'vitest';
import { byArrival, placesOf, rowsOf, starterOf, startingOrder } from './grid';
import type { GridPlayer } from './net';

// The grid's rules (PRD 1572, slice 3): the starting order, the four places and who starts.

const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
const p = (id: string, arrival: number, best: number | null = null): GridPlayer => ({ id, name: id, hero, fleet: null, best, arrival });
const ids = (players: readonly GridPlayer[]) => players.map((x) => x.id);

describe('the starting order', () => {
  it('puts the fastest best time on pole, then the others by best time', () => {
    expect(ids(startingOrder([p('a', 1, 700), p('b', 2, 600), p('c', 3, 650)]))).toEqual(['b', 'c', 'a']);
  });

  it('puts a player with no time behind every timed player, whoever arrived first', () => {
    expect(ids(startingOrder([p('a', 1), p('b', 2, 900), p('c', 3)]))).toEqual(['b', 'a', 'c']);
  });

  it('breaks a tie, and two players with no time, by arrival', () => {
    expect(ids(startingOrder([p('a', 3, 600), p('b', 1, 600), p('c', 2, 600)]))).toEqual(['b', 'c', 'a']);
    expect(ids(startingOrder([p('a', 2), p('b', 1)]))).toEqual(['b', 'a']);
  });

  it('goes by id when two arrived at the same instant, so every browser reads the same order', () => {
    expect(ids(byArrival([p('b', 1), p('a', 1), p('c', 0)]))).toEqual(['c', 'a', 'b']);
  });

  it('leaves the list it was given as it was', () => {
    const given = [p('a', 2), p('b', 1)];
    startingOrder(given);
    expect(ids(given)).toEqual(['a', 'b']);
  });
});

describe('the four places', () => {
  const five = [p('e', 5), p('a', 1), p('d', 4), p('b', 2), p('c', 3)];

  it('goes to the first four by arrival; a fifth waits', () => {
    const { seated, waiting } = placesOf(five);
    expect(ids(seated)).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(waiting)).toEqual(['e']);
  });

  it('gives a waiting player the first place that frees, in arrival order among those waiting', () => {
    const six = [...five, p('f', 6)];
    expect(ids(placesOf(six.filter((x) => x.id !== 'b')).seated)).toEqual(['a', 'c', 'd', 'e']);
    expect(ids(placesOf(six.filter((x) => x.id !== 'b' && x.id !== 'a')).seated)).toEqual(['c', 'd', 'e', 'f']);
  });

  it('holds everyone when there are fewer than four', () => {
    expect(placesOf([p('a', 1)])).toEqual({ seated: [p('a', 1)], waiting: [] });
    expect(placesOf([])).toEqual({ seated: [], waiting: [] });
  });
});

describe('who starts', () => {
  it('is the first to arrive among those holding a place, and the next takes over when they leave', () => {
    const grid = [p('b', 2), p('a', 1), p('c', 3)];
    expect(starterOf(grid)?.id).toBe('a');
    expect(starterOf(grid.filter((x) => x.id !== 'a'))?.id).toBe('b');
  });

  it('is nobody on an empty grid', () => {
    expect(starterOf([])).toBeNull();
  });

  it('is never a waiting player', () => {
    expect(starterOf([p('e', 5), p('a', 1), p('b', 2), p('c', 3), p('d', 4)])?.id).toBe('a');
  });
});

describe('what the grid lists', () => {
  it('lists those holding a place in their starting order, then those who wait in arrival order', () => {
    const rows = rowsOf([p('a', 1, 900), p('b', 2, 600), p('c', 3), p('d', 4, 700), p('f', 6, 100), p('e', 5, 50)]);
    expect(rows.map((r) => `${r.player.id}${r.seat ? '' : '~'}`)).toEqual(['b', 'd', 'a', 'c', 'e~', 'f~']);
  });

  it('a player who arrives during a race waits: the race is the next slices\'s', () => {
    expect(rowsOf([])).toEqual([]);
  });
});
