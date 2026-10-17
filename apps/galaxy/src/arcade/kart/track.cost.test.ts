// Bug 2148: OMNI KART's LOADING… reads every circuit, for the CIRCUIT step's cards, before the menu shows. Reading one
// measured each pixel of its map against every piece of its centre line, up to three times over: about two seconds for the
// two circuits on a laptop, with the screen frozen on LOADING….
import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { CIRCUITS } from './circuits';
import { locate, type Line, type Located } from './line';
import { parseTrack } from './track';

/** The time, in ms, to read every circuit afresh: a copy of its waypoints is a circuit not read yet, as the first LOADING… finds it. */
const readEvery = (): number => {
  const t = performance.now();
  for (const c of CIRCUITS) parseTrack({ ...c.source, waypoints: [...c.source.waypoints] });
  return performance.now() - t;
};

describe('bug 2148: OMNI KART\'s LOADING…', () => {
  it('reads every circuit within a second', () => {
    const ms = [readEvery(), readEvery(), readEvery()].sort((a, b) => a - b);
    expect(sure(ms[1], 'the middle time'), `${ms.map(Math.round).join(', ')} ms`).toBeLessThan(1000);
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
