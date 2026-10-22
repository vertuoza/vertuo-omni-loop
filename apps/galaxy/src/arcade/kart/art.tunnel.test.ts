// Bug 2146: from inside COMET RING's tunnel, the item boxes past its far portal are seen through it. The tunnel's roof is
// nearer than a thing down the road and covers the top of its screen box: it hides the part of the thing it covers from
// above, never the whole thing.
import { describe, expect, it } from 'vitest';
import { TALL, WIDE } from '../scenes/common';
import { sure } from '../test/sure';
import { BOX_WORLD, coverOf, viewFor } from './art';
import { CIRCUITS } from './circuits';
import { renderTerrain, roofedOf, spritesInView, type Projected, type View } from './mode7';
import { groundAt, heightsOf, reliefRange } from './relief';
import { deckOf, paintTrack } from './texture';
import { locatePx, parseTrack, pointAtPx, TILE, type Track } from './track';

const GRIDS = [['wide', WIDE], ['tall', TALL]] as const;

/** A circuit's tunnel and its drawn ground, baked once. */
function tunnelOf(track: Track) {
  const span = sure(track.span, 'the tunnel');
  const texture = paintTrack(track);
  return { track, span, texture, heights: heightsOf(track, texture), range: reliefRange(track), deck: deckOf(), roofed: roofedOf(track, texture) };
}

/** The camera's view and the floor's depth from a kart on the centre line, `along` tiles into the tunnel, facing down the line. */
function inTunnel(t: ReturnType<typeof tunnelOf>, grid: { w: number; h: number }, along: number): { v: View; depth: Float32Array } {
  const p = pointAtPx(t.track, (t.span.start + along) * TILE);
  const v = viewFor(grid, t.track, { x: p.x, y: p.y, angle: Math.atan2(p.ty, p.tx), speed: 0, steer: 0 });
  const depth = new Float32Array(v.w * v.h);
  renderTerrain(v, t.texture, t.heights, t.range, t.deck, new Uint32Array(v.w * v.h), depth, t.roofed);
  return { v, depth };
}

/** The screen point at the middle of an item box at `at`. */
const middleOf = (at: Projected) => ({ x: Math.round(at.sx), y: Math.round(at.sy - BOX_WORLD * at.scale * 0.6) });

/** Whether the race draws the middle of an item box at `at`: the row there lies between what covers its column from above and from below (`coverOf`), as the draw clips it. */
function drawsMiddle(v: View, depth: Float32Array, at: Projected): boolean {
  const reach = at.scale * 40;
  const box = { left: at.sx - reach, right: at.sx + reach, top: at.sy - reach * 1.5, bottom: at.sy + 2 };
  const { x, y } = middleOf(at), col = x - Math.max(0, Math.floor(box.left));
  const above = coverOf(depth, v.w, v.h, box, at.z, 'above'), below = coverOf(depth, v.w, v.h, box, at.z, 'below');
  return y >= (above?.[col] ?? -Infinity) && y < (below?.[col] ?? Infinity);
}

/** Whether nothing nearer than the box is drawn at its middle: the tunnel's opening, not its roof or a wall. */
function openAt(v: View, depth: Float32Array, at: Projected): boolean {
  const { x, y } = middleOf(at);
  return x >= 0 && x < v.w && y >= 0 && y < v.h && (depth[y * v.w + x] ?? Infinity) >= at.z;
}

/** The things of `things` that the opening shows from `along` tiles into the tunnel and the draw hides, each named by `name`. */
function hiddenFrom<T extends { x: number; y: number }>(t: ReturnType<typeof tunnelOf>, grid: { w: number; h: number }, along: number, things: readonly T[], name: (thing: T) => string): { seen: number; hidden: string[] } {
  const { v, depth } = inTunnel(t, grid, along);
  let seen = 0;
  const hidden: string[] = [];
  for (const { sprite, at } of spritesInView(v, things, (s) => groundAt(t.track, s.x, s.y))) {
    if (!openAt(v, depth, at)) continue;
    seen++;
    if (!drawsMiddle(v, depth, at)) hidden.push(`${along} tiles in, ${name(sprite)}`);
  }
  return { seen, hidden };
}

describe('bug 2146: the item boxes past COMET RING\'s tunnel are seen from inside it', () => {
  const t = tunnelOf(parseTrack());
  const exit = (t.span.start + t.span.length) * TILE;
  const past = t.track.boxes.filter((b) => { const along = locatePx(t.track, b.x, b.y).along; return along > exit && along < exit + 6 * TILE; });

  it('stands a row of boxes just past the far portal', () => {
    expect(past.length).toBeGreaterThan(0);
  });

  for (const [name, grid] of GRIDS) {
    it(`draws every box past the portal that the opening shows, from 5 to 12.5 tiles into the tunnel, on the ${name} grid`, () => {
      const runs = [5, 7, 9, 11, 12.5].map((along) => hiddenFrom(t, grid, along, past, (b) => `the box at (${b.x}, ${b.y})`));
      expect(runs.reduce((n, r) => n + r.seen, 0)).toBeGreaterThan(8);
      expect(runs.flatMap((r) => r.hidden)).toEqual([]);
    });
  }
});

// The guard: on every circuit of the register with a tunnel, from every tile of it, a thing on the road 2 to 8 tiles
// ahead, under the roof or past a portal, is drawn wherever nothing nearer is.
describe('every circuit\'s tunnel lets the road ahead be seen from inside it (bug 2146)', () => {
  for (const circuit of CIRCUITS) {
    const track = parseTrack(circuit.source);
    if (!track.span) continue;
    const t = tunnelOf(track);
    for (const [name, grid] of GRIDS) {
      it(`${circuit.name}: draws a thing on the road ahead from every tile of the tunnel, on the ${name} grid`, () => {
        const runs = Array.from({ length: Math.floor(t.span.length) }, (_, i) => i + 0.5).map((along) => {
          const ahead = [2, 4, 6, 8].map((n) => ({ ...pointAtPx(track, (t.span.start + along + n) * TILE), n }));
          return hiddenFrom(t, grid, along, ahead, (p) => `the thing ${p.n} tiles ahead`);
        });
        expect(runs.reduce((n, r) => n + r.seen, 0)).toBeGreaterThan(t.span.length);
        expect(runs.flatMap((r) => r.hidden)).toEqual([]);
      });
    }
  }
});
