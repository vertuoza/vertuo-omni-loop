import { describe, expect, it } from 'vitest';
import { podiumOf } from './podium';
import type { KartResults, KartRow } from '../scenes/kart.ts';

const row = (place: number, name: string, tenths: number | null, extra: Partial<KartRow> = {}): KartRow => ({ place, name, tenths, you: false, ...extra });
const results = (rows: KartRow[], live?: true): KartResults => ({ rows, place: rows.findIndex((r) => r.you) + 1, tenths: 0, threeLap: 0, ...(live ? { live } : {}) });

describe('the podium (PRD 1762)', () => {
  it('stands the first three as second, first, third from a SINGLE race', () => {
    const p = podiumOf(results([row(1, 'ADA', 900), row(2, 'BOB', 950, { you: true }), row(3, 'CY', null), row(4, 'DI', null)]));
    expect(p.steps.map((s) => [s.place, s.name])).toEqual([[2, 'BOB'], [1, 'ADA'], [3, 'CY']]);
    expect(p.steps.find((s) => s.you)?.place).toBe(2);
    expect(p.place).toBeNull();
  });

  it('names the player\'s place under the steps when they are off the podium', () => {
    const rows = [row(1, 'A', 1), row(2, 'B', 2), row(3, 'C', 3), row(4, 'D', 4), row(5, 'YOU', 5, { you: true })];
    expect(podiumOf(results(rows)).place).toBe('YOU 5TH');
  });

  it('keeps a MULTI step empty until its driver crosses, then fills it', () => {
    const waiting = podiumOf(results([row(1, 'YOU', 800, { you: true }), row(2, 'BOB', null), row(3, 'CY', null)], true));
    expect(waiting.steps.map((s) => [s.name, s.filled])).toEqual([['…', false], ['YOU', true], ['…', false]]);
    const filled = podiumOf(results([row(1, 'YOU', 800, { you: true }), row(2, 'BOB', 900), row(3, 'CY', null)], true));
    expect(filled.steps.map((s) => s.name)).toEqual(['BOB', 'YOU', '…']);
  });

  it('never stands a player who is OUT on a step', () => {
    const p = podiumOf(results([row(1, 'YOU', 800, { you: true }), row(2, 'GONE', null, { out: true }), row(3, 'ZED', null, { out: true })], true));
    expect(p.steps.map((s) => s.name)).toEqual(['…', 'YOU', '…']);
  });

  it('carries each driver\'s kart look to its step', () => {
    const look = { color: 'RED', design: 'ROCKET' };
    const p = podiumOf(results([row(1, 'ADA', 900, { look, tint: null })]));
    expect(p.steps.find((s) => s.place === 1)?.look).toEqual(look);
  });
});
