// Bug 2148: OMNI KART's LOADING… reads every circuit, for the CIRCUIT step's cards, before the menu shows. Reading one
// measured each pixel of its map against every piece of its centre line, up to three times over: about two seconds for the
// two circuits on a laptop, with the screen frozen on LOADING…, and four times that on a slower machine.
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { CIRCUITS } from './circuits';
import { locate, type Line, type Located } from './line';
import { parseTrack, TILE } from './track';

/** The time, in ms, to read every circuit afresh: a copy of its waypoints is a circuit not read yet, as the first LOADING… finds it. */
const readEvery = (): number => {
  const t = performance.now();
  for (const c of CIRCUITS) parseTrack({ ...c.source, waypoints: [...c.source.waypoints] });
  return performance.now() - t;
};

/** The yardstick, in ms: one distance from each pixel of every circuit's map to each piece of its centre line, the least a
 * reading that measured every pixel against every piece once would do. Timed beside the reading, on the same machine, it
 * keeps the budget the same on a fast laptop and a slow runner. */
const yardstick = (): number => {
  const t = performance.now();
  let sum = 0;
  for (const c of CIRCUITS) {
    const { size, centre } = parseTrack(c.source);
    const at = Float64Array.from(centre.segments.flatMap((s) => (s.kind === 'straight' ? [s.x, s.y] : [s.cx, s.cy])));
    for (let py = 0; py < size.h; py++) {
      for (let px = 0; px < size.w; px++) {
        for (let i = 0; i < at.length; i += 2) sum += Math.hypot((px + 0.5) / TILE - (at[i] ?? 0), (py + 0.5) / TILE - (at[i + 1] ?? 0));
      }
    }
  }
  expect(sum).toBeGreaterThan(0); // a sum read keeps the loop from being skipped
  return performance.now() - t;
};

const median = (ms: number[]) => sure([...ms].sort((a, b) => a - b)[Math.floor(ms.length / 2)], 'a time');

describe('bug 2148: OMNI KART\'s LOADING…', () => {
  it('reads every circuit in less time than measuring each of their pixels against every piece of their line once', () => {
    readEvery(); // the circuits as the menu reads them, and the code warmed up
    const reading: number[] = [], measuring: number[] = [];
    for (let round = 0; round < 3; round++) {
      reading.push(readEvery());
      measuring.push(yardstick());
    }
    const ratio = median(reading) / median(measuring);
    expect(ratio, `reading ${reading.map(Math.round).join(', ')} ms, measuring ${measuring.map(Math.round).join(', ')} ms`).toBeLessThan(1);
  });
});

// What the faster reading rests on: without a hint, `locate` measures only the pieces of the centre line a point can be
// nearest to. It must find what measuring every piece in order finds, to the last bit, or the road, the gaps, the roof
// and the ground's paint and relief would move.
describe('where a point sits against a circuit\'s centre line (bug 2148)', () => {
  /** `locate` measuring every piece in order and keeping the first nearest: each piece alone, as a line of its own. */
  const everyPiece = (line: Line) => {
    const alone = line.segments.map((s): Line => ({ ...line, segments: [s] }));
    return (x: number, y: number): Located => alone.map((l) => locate(l, x, y)).reduce((best, at) => (at.dist < best.dist ? at : best));
  };

  it.each(CIRCUITS.map((c) => [c.name, c] as const))('is what measuring every piece finds, all over %s and around it', (_, c) => {
    const track = parseTrack(c.source);
    const reference = everyPiece(track.centre);
    const far: [number, number][] = [[-5000, 3], [3000, 3000], [10, 2100], [-2048.5, -2048.5]];
    const points: [number, number][] = [...far];
    // A third of a tile apart, from 3 tiles beyond the map on every side: every third point on a square's edge.
    for (let i = -9; i <= (track.cols + 3) * 3; i++) for (let j = -9; j <= (track.rows + 3) * 3; j++) points.push([i / 3, j / 3]);
    const moved = points.filter(([x, y]) => JSON.stringify(locate(track.centre, x, y)) !== JSON.stringify(reference(x, y)));
    expect(moved.slice(0, 5), `${moved.length} of ${points.length} points`).toEqual([]);
  });
});
