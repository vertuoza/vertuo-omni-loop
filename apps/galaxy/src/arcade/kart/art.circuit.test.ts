import { describe, expect, it } from 'vitest';
import { createKart } from './art';
import { circuitCards } from './art.circuit';
import { SNOW } from './art.snow';
import { CIRCUITS } from './circuits';
import { createHub } from './hub.fake';
import { openGrid } from './hub';
import type { GridPlayer } from './net';

// What the CIRCUIT step reads of the register (PRD 1923): the cards, the board each race sends its time to, and the circuit the grid shows.

describe('the circuit cards', () => {
  it('holds one card per circuit of the register, in its order, with its name and board', () => {
    expect(circuitCards().map(({ id, name, board }) => ({ id, name, board }))).toEqual(CIRCUITS.map(({ id, name, board }) => ({ id, name, board })));
  });

  it('draws FROST EIGHT\'s lake in ice over powder, and COMET RING over the void', () => {
    const [comet, frost] = circuitCards();
    expect(frost?.ground).toBe('#eef4fa');
    expect(frost?.runs.some((r) => [SNOW.lake, SNOW.lakeRoad].some((c) => c === r.colour))).toBe(true);
    expect(comet?.ground).toBe('#07061c');
    expect(comet?.runs.some((r) => [SNOW.lake, SNOW.lakeRoad].some((c) => c === r.colour))).toBe(false);
  });

  it('keeps every run inside the circuit and the start line white', () => {
    for (const card of circuitCards()) {
      expect(card.runs.length).toBeGreaterThan(0);
      for (const r of card.runs) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(card.cols);
        expect(r.y).toBeLessThan(card.rows);
      }
      expect(card.runs.some((r) => r.colour === '#ffffff')).toBe(true);
    }
  });
});

describe('the board of a race', () => {
  it('is COMET RING\'s when no circuit is named, or one that names none', () => {
    expect(createKart().board).toBe('kart');
    expect(createKart({ seed: 1, circuit: 'nowhere' }).board).toBe('kart');
  });

  it('is the board of the circuit raced', () => {
    expect(createKart({ seed: 1, circuit: 'frost-eight' }).board).toBe('kart-frost-eight');
    expect(createKart({ seed: 1, circuit: 'comet-ring' }).board).toBe('kart');
  });
});

describe('the grid\'s circuit', () => {
  const hero = { v: 1, body: 'girl', skin: 0, hair: 0, suit: 0, cape: 0 } as const;
  const who = (id: string, arrival: number, best: number | null, track?: string): GridPlayer => ({ id, name: id, hero, fleet: null, best, arrival, ...(track ? { track } : {}) });

  it('is the first arrival\'s, named in the view, with COMET RING for an entry without one', () => {
    const hub = createHub();
    const frost = openGrid(hub.link('a'), who('a', 1, 983, 'frost-eight'), () => undefined);
    const plain = openGrid(hub.link('b'), who('b', 2, 700), () => undefined);
    expect(frost.view().track).toBe('frost-eight');
    expect(plain.view().track).toBe('frost-eight');
    const alone = openGrid(createHub().link('c'), who('c', 1, null), () => undefined);
    expect(alone.view().track).toBe('comet-ring');
  });

  it('shows each player\'s best on the grid\'s circuit only', () => {
    const hub = createHub();
    const first = openGrid(hub.link('a'), who('a', 1, 983, 'frost-eight'), () => undefined);
    openGrid(hub.link('b'), who('b', 2, 700, 'comet-ring'), () => undefined);
    openGrid(hub.link('c'), who('c', 3, 800, 'frost-eight'), () => undefined);
    const bests = Object.fromEntries(first.view().rows.map((r) => [r.id, r.best]));
    expect(bests).toEqual({ a: 983, b: null, c: 800 });
  });
});
