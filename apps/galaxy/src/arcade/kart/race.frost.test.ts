import { describe, expect, it } from 'vitest';
import type { Action } from '../keys';
import { newRace, press, step, type Race } from './race';
import { progressOf } from './rivals';
import { FROST_EIGHT, LAPS, parseTrack, TILE } from './track';

// FROST EIGHT (PRD 1923, slice 5): the five rivals on the real circuit, with its lake's ice, its powder and its tree line.
const NONE: ReadonlySet<Action> = new Set();
const started = (r: Race): Race => press(r, 'start').race;

describe('a race on FROST EIGHT', () => {
  const frost = parseTrack(FROST_EIGHT);
  const middle = { x: 36.5 * TILE, y: 36.5 * TILE };

  it.each([1, 7, 42])('lets the five rivals finish three laps on seed %i, at every level, never back along the line nor a lap counted twice', (seed) => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      let r = started(newRace({ seed, track: frost, difficulty }));
      const seen = r.rivals.map(() => ({ laps: 0, progress: -Infinity }));
      for (let t = 0; t < 400 && !r.rivals.every((x) => x.pace.laps >= LAPS); t += 0.05) {
        r = step(r, NONE, 0.05).race;
        r.rivals.forEach((rival, i) => {
          const was = seen[i];
          if (!was) return;
          const progress = progressOf(frost, rival.pace, rival.kart);
          expect(rival.pace.laps - was.laps, `${difficulty}: a lap counted twice`).toBeLessThanOrEqual(1);
          expect(rival.pace.laps).toBeGreaterThanOrEqual(was.laps);
          // Only a fall brings a kart back along the line, to behind the last gate, never to the other branch.
          expect(progress, `${difficulty}: progress back near ${Math.round(rival.kart.x / TILE)}, ${Math.round(rival.kart.y / TILE)}`).toBeGreaterThan(was.progress - 6 * TILE);
          seen[i] = { laps: rival.pace.laps, progress };
        });
      }
      expect(r.rivals.every((x) => x.pace.laps >= LAPS), `${difficulty}: three laps`).toBe(true);
    }
  });

  it('has the rivals cross the lake', () => {
    let r = started(newRace({ seed: 7, track: frost }));
    let crossed = 0;
    for (let t = 0; t < 100; t += 0.05) {
      r = step(r, NONE, 0.05).race;
      crossed += r.rivals.filter((x) => Math.hypot(x.kart.x - middle.x, x.kart.y - middle.y) < 3 * TILE).length;
    }
    expect(crossed).toBeGreaterThan(0);
  });
});
