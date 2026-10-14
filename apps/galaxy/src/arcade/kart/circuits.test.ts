import { describe, expect, it } from 'vitest';
import { GAMES } from '../games';
import { circuitOf, CIRCUITS, DEFAULT_CIRCUIT, isCircuitId } from './circuits';
import { FROST_EIGHT, trackProblems } from './track';

describe('the register of circuits', () => {
  it("holds the registry's kart boards, by board and name and in the same order", () => {
    const boards = GAMES.find((g) => g.id === 'kart')?.boards ?? [];
    expect(boards).toHaveLength(2);
    expect(CIRCUITS.map((c) => ({ board: c.board, name: c.name }))).toEqual(boards.map((b) => ({ board: b.id, name: b.title })));
  });

  it('lists COMET RING, then FROST EIGHT, each drivable', () => {
    expect(CIRCUITS.map((c) => c.name)).toEqual(['COMET RING', 'FROST EIGHT']);
    expect(CIRCUITS.every((c) => trackProblems(c.source).length === 0)).toBe(true);
    expect(circuitOf('frost-eight').source).toBe(FROST_EIGHT);
  });

  it('reads an unknown or missing id as COMET RING', () => {
    expect(isCircuitId('frost-eight')).toBe(true);
    expect(isCircuitId('nowhere')).toBe(false);
    expect(circuitOf(undefined)).toBe(DEFAULT_CIRCUIT);
    expect(circuitOf('nowhere')).toBe(DEFAULT_CIRCUIT);
  });
});
