import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { airborne, NO_FX, stepFx, type Kart } from './kart';
import { buildLine, crossings, inGapAt, pointAt } from './line';
import { groundAt } from './relief';
import { comeBack } from './rivals';
import { EIGHT, eightWith, withFloor } from './track.fake';
import { RULES } from './rules';
import { COMET_RING, FROST_EIGHT, PROP_KINDS, pastTreeLine, surfaceAt, cornersOf, LAPS, legHeight, LEVEL, locatePx, parseTrack, pointAtPx, RELIEF_SPAN, roadAt, roofAt, TILE, trackProblems, type TrackSource } from './track';

/** COMET RING with one row changed: `edit` gets the rows as arrays of characters. */
function altered(edit: (rows: string[][]) => void, change: Partial<TrackSource> = {}): TrackSource {
  const rows = COMET_RING.rows.map((r) => Array.from(r));
  edit(rows);
  return { ...COMET_RING, ...change, rows: rows.map((r) => r.join('')) };
}
const set = (rows: string[][], x: number, y: number, c: string) => { sure(rows[y], `row ${y}`)[x] = c; };
const track = parseTrack();
/** COMET RING with one optional field left out. */
const without = (key: 'props' | 'relief'): TrackSource => Object.fromEntries(Object.entries(COMET_RING).filter(([k]) => k !== key)) as unknown as TrackSource;
/** Whether the pixel x, y is void inside a gap: a kart flies over it. */
const inGap = (x: number, y: number) => track.gap?.[Math.floor(y) * track.size.w + Math.floor(x)] === 1;

describe('COMET RING', () => {
  it('passes every circuit check', () => {
    expect(trackProblems()).toEqual([]);
    expect(trackProblems(COMET_RING)).toEqual([]);
  });

  it('is a 72×72 map of equal rows, raced over 3 laps', () => {
    expect(COMET_RING.rows).toHaveLength(72);
    for (const row of COMET_RING.rows) expect(row).toHaveLength(72);
    expect(LAPS).toBe(3);
    expect(TILE).toBe(16);
    expect(track.size).toEqual({ w: 72 * TILE, h: 72 * TILE });
  });

  it('is 14 waypoints, each with the radius of its corner, and a road 5 tiles wide', () => {
    expect(COMET_RING.waypoints).toEqual([
      [62, 62, 8], [62, 46, 3], [49, 46, 3], [49, 34, 3], [64, 34, 3], [64, 10, 5], [41, 10, 6],
      [41, 26, 4], [23, 26, 4], [23, 10, 4], [8, 10, 6], [8, 46, 4], [21, 46, 3], [21, 62, 3],
    ]);
    expect(COMET_RING.width).toBe(5);
    expect(track.centre.width).toBe(5);
  });

  it('is a lap of about 249 tiles', () => {
    expect(track.length / TILE).toBeGreaterThan(245);
    expect(track.length / TILE).toBeLessThan(253);
  });

  it('holds the features only in its rows: lines, boxes, starts, pads and ramps on ground', () => {
    const chars = new Set(COMET_RING.rows.flatMap((row) => Array.from(row)));
    expect([...chars].sort()).toEqual(['+', '.', '=', '?', 'S', '^']);
  });

  it('counts 40 boxes, 6 starting places, 12 stands and 2 shortcuts, skipping 2 and 7', () => {
    expect(track.boxes).toHaveLength(40);
    expect(track.places).toHaveLength(6);
    expect(track.stands).toHaveLength(12);
    expect(track.shortcuts).toHaveLength(2);
    expect(COMET_RING.shortcuts?.map((s) => s.skips)).toEqual([2, 7]);
  });

  it('has a gate at the middle of every arc', () => {
    expect(track.gates).toHaveLength(14);
    track.gates.forEach((g, i) => { expect(g.index).toBe(i); });
  });
});

describe('the centre line, over the baked pixels (PRD 1829)', () => {
  const rel = (along: number) => along;
  const samples = Array.from({ length: Math.floor(track.length / 4) }, (_, i) => pointAtPx(track, rel(i * 4)));

  it('has road under every racing-line point sampled every 4 units, but the gap jump\'s gap', () => {
    const off = samples.filter((p) => !roadAt(track, p.x, p.y));
    expect(off.length).toBeGreaterThan(0);
    expect(off.filter((p) => !inGap(p.x, p.y)).map((p) => `${(p.x / TILE).toFixed(1)},${(p.y / TILE).toFixed(1)}`)).toEqual([]);
    // The gap is the one of the gap jump: on the leg north of waypoint 4, past the ramp of row 22.
    for (const p of off) {
      expect(p.x / TILE).toBeGreaterThan(62);
      expect(p.y / TILE).toBeGreaterThan(18);
      expect(p.y / TILE).toBeLessThan(22.5);
    }
  });

  it('brings a kart that fell anywhere on the racing line back onto the road', () => {
    const rels = track.gates.map((g) => (((g.along - track.startAlong) % track.length) + track.length) % track.length);
    for (const p of samples) {
      const at = (((p.along - track.startAlong) % track.length) + track.length) % track.length;
      const passed = rels.filter((r) => r <= at).length;
      const back = comeBack(track, { laps: 0, passed }, { x: p.x, y: p.y, angle: 0, speed: 0, steer: 0 }, NO_FX);
      expect(roadAt(track, back.kart.x, back.kart.y), `from ${(p.x / TILE).toFixed(1)},${(p.y / TILE).toFixed(1)}`).toBe(true);
    }
  });

  it('reads road at the pixel: the roof only where the tunnel is, void past the map\'s edge', () => {
    for (const [x, y] of [[-0.5, 40], [40, -0.5], [track.size.w, 40], [40, track.size.h], [-400, 2000]] as const) {
      expect(roadAt(track, x, y), `${x},${y}`).toBe(false);
      expect(roofAt(track, x, y), `${x},${y}`).toBe(false);
    }
    const roofed = samples.filter((p) => roofAt(track, p.x, p.y));
    expect(roofed.length).toBeGreaterThan(0);
    for (const p of roofed) expect(roadAt(track, p.x, p.y)).toBe(true);
  });

  it('runs the tunnel 13 tiles from where the curve of waypoint 5 starts', () => {
    const arc = sure(track.centre.segments.find((s) => s.kind === 'arc' && s.corner === 5), 'the arc of waypoint 5');
    expect(track.span?.start).toBeCloseTo(arc.start, 1);
    expect(track.span?.length).toBe(13);
    const at = (along: number) => pointAt(track.centre, along);
    const span = sure(track.span, 'the tunnel');
    const inside = at(span.start + 6), before = at(span.start - 2), after = at(span.start + span.length + 2);
    expect(roofAt(track, inside.x * TILE, inside.y * TILE)).toBe(true);
    expect(roofAt(track, before.x * TILE, before.y * TILE)).toBe(false);
    expect(roofAt(track, after.x * TILE, after.y * TILE)).toBe(false);
  });
});

describe('trackProblems', () => {
  it('refuses an unknown character, with its row and column', () => {
    expect(trackProblems(altered((r) => { set(r, 10, 5, 'q'); }))).toEqual(["row 5, col 10: unknown character 'q'"]);
  });

  it('refuses a map that holds a wall `X` or the old road tiles: the legend is `. = ? S + ^`', () => {
    for (const c of ['X', '#', '~', 'r', 'T', 'w']) {
      expect(trackProblems(altered((r) => { set(r, 0, 0, c); })), c).toEqual([`row 0, col 0: unknown character '${c}'`]);
    }
  });

  it('refuses rows of unequal length, with the row and the column it stops at', () => {
    const src = altered(() => {});
    const short = { ...src, rows: src.rows.map((r, y) => (y === 7 ? r.slice(0, 60) : r)) };
    expect(trackProblems(short)).toEqual(['row 7, col 60: this row is 60 tiles long, the first is 72']);
  });

  it('refuses a corner whose arc does not fit its legs, naming it', () => {
    const waypoints = COMET_RING.waypoints.map((w, i) => (i === 3 ? [49, 34, 30] as const : w));
    expect(trackProblems(altered(() => {}, { waypoints })).join()).toContain('the centre line cannot be drawn');
  });

  it('refuses a seventh starting place, and a missing one', () => {
    expect(trackProblems(altered((r) => { set(r, 27, 60, 'S'); })).join()).toContain('6 starting places expected, 7 found');
    expect(trackProblems(altered((r) => { set(r, 29, 60, '.'); })).join()).toContain('6 starting places expected, 5 found');
  });

  it('refuses a starting place ahead of the line, and one off the road', () => {
    const ahead = trackProblems(altered((r) => { set(r, 29, 60, '.'); set(r, 36, 60, 'S'); }));
    expect(ahead).toEqual(['row 60, col 36: starting place is not behind the start line']);
    const off = trackProblems(altered((r) => { set(r, 29, 60, '.'); set(r, 29, 58, 'S'); }));
    expect(off).toContain('row 58, col 29: starting place off the road');
  });

  it('refuses a start line that stops short of the road\'s edge, and one with a gap, a crooked one, and none', () => {
    expect(trackProblems(altered((r) => { set(r, 34, 64, '.'); })).join()).toContain('row 64, col 34: the start line does not cross the road from wall to wall');
    expect(trackProblems(altered((r) => { set(r, 34, 62, '.'); }))).toEqual(['row 63, col 34: the start line has a gap']);
    expect(trackProblems(altered((r) => { set(r, 35, 60, '='); }))).toEqual(['row 60, col 34: the start line is not one straight run']);
    expect(trackProblems(altered((r) => { for (let y = 60; y <= 64; y++) set(r, 34, y, '.'); }))).toEqual(['row 0, col 0: no start line']);
  });

  it('refuses a start line off the road', () => {
    expect(trackProblems(altered((r) => { set(r, 34, 59, '='); })).join()).toContain('row 59, col 34: start line off the road');
  });

  it('refuses an item box, a boost pad and a ramp off the road', () => {
    expect(trackProblems(altered((r) => { set(r, 2, 2, '?'); }))).toEqual(['row 2, col 2: item box off the road']);
    expect(trackProblems(altered((r) => { set(r, 2, 2, '+'); }))).toEqual(['row 2, col 2: boost pad off the road']);
    expect(trackProblems(altered((r) => { set(r, 2, 2, '^'); }))).toEqual(['row 2, col 2: ramp off the road']);
  });

  it('accepts a pad, a ramp and a box on the road, wherever the road runs', () => {
    expect(trackProblems(altered((r) => { set(r, 44, 62, '+'); set(r, 45, 62, '^'); set(r, 46, 62, '?'); }))).toEqual([]);
  });

  it('refuses a feature on the round edge of a corner, where only half the tile is road', () => {
    // The outer edge of the curve of waypoint 0 (centre [62.5, 54.5], radius 8): a tile beyond the arc's outer edge.
    expect(trackProblems(altered((r) => { set(r, 68, 62, '?'); })).join()).toContain('item box off the road');
  });

  it('reports every problem it finds', () => {
    expect(trackProblems(altered((r) => { set(r, 2, 2, '?'); set(r, 3, 2, '?'); })).length).toBe(2);
  });
});

describe('parseTrack', () => {
  it('puts the racing line, the boxes and the starting places at their tile centres, in game pixels', () => {
    expect(track.waypoints[0]).toEqual({ x: 62.5 * 16, y: 62.5 * 16 });
    expect(track.waypoints).toHaveLength(COMET_RING.waypoints.length);
    expect(track.boxes[0]).toEqual({ x: (sure(COMET_RING.rows.map((r, y) => [r.indexOf('?'), y] as const).find(([x]) => x >= 0), 'a box')[0] + 0.5) * 16, y: (COMET_RING.rows.findIndex((r) => r.includes('?')) + 0.5) * 16 });
  });

  it('points the karts down the start straight, towards the first waypoint', () => {
    expect(track.forward).toEqual([1, 0]);
    expect(track.heading).toBe(0);
  });

  it('stands six places behind the line, pole first and the last place farthest back', () => {
    expect(track.places).toHaveLength(6);
    const lineX = 34.5 * 16;
    const depths = track.places.map((p) => lineX - p.x);
    for (const d of depths) expect(d).toBeGreaterThan(0);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    for (const p of track.places) expect(roadAt(track, p.x, p.y)).toBe(true);
  });

  it('throws, naming what is wrong, on a circuit that is not drivable', () => {
    expect(() => parseTrack(altered((r) => { set(r, 10, 5, 'q'); }))).toThrow(/row 5, col 10: unknown character 'q'/);
  });

  it('puts the start line on the lap\'s start, and the gates of the waypoints in lap order', () => {
    const rels = track.gates.map((g) => (((g.along - track.startAlong) % track.length) + track.length) % track.length);
    expect(rels).toEqual([...rels].sort((a, b) => a - b));
  });
});

describe('cornersOf', () => {
  // The lap starts on the start straight, so the arc of waypoint 0 comes last.
  const corners = cornersOf(track).sort((a, b) => a.index - b.index);
  const L = 'left', R = 'right';

  it("lists COMET RING's corners: every arc, with its radius and the way it turns", () => {
    expect(cornersOf(track)).toHaveLength(14);
    expect(corners.map((c) => [c.index, c.radius, c.turn])).toEqual([
      [0, 8, L], [1, 3, L], [2, 3, R], [3, 3, R], [4, 3, L], [5, 5, L], [6, 6, L],
      [7, 4, R], [8, 4, R], [9, 4, L], [10, 6, L], [11, 4, L], [12, 3, R], [13, 3, L],
    ]);
  });

  it('gives the unit step of the line into each arc', () => {
    expect(sure(corners[0], 'the first corner').into[0]).toBeCloseTo(1, 6);
    expect(sure(corners[1], 'the second corner').into[1]).toBeCloseTo(-1, 6);
    expect(sure(corners[2], 'the third corner').into[0]).toBeCloseTo(-1, 6);
  });

  it('leaves out an arc that turns the line by 30° or less, and keeps one past it', () => {
    const a = Math.tan(Math.PI / 6);
    const ring = (y: number) => buildLine({ width: 5, points: [{ x: 0, y: 0, radius: 2 }, { x: 100, y: 0, radius: 2 }, { x: 200, y, radius: 2 }, { x: 100, y: 300, radius: 2 }, { x: 0, y: 300, radius: 2 }] });
    expect(cornersOf({ centre: ring(100 * a - 5) }).map((c) => c.index)).not.toContain(1);
    expect(cornersOf({ centre: ring(100 * a + 5) }).map((c) => c.index)).toContain(1);
  });
});

describe('the props (PRD 1427)', () => {
  const { props = [], rows } = COMET_RING;
  /** How far the tile x, y is from the centre line, in tiles. */
  const farFrom = (x: number, y: number) => locatePx(track, (x + 0.5) * TILE, (y + 0.5) * TILE).dist / TILE;
  const mean = (kinds: readonly string[]) => {
    const far = props.filter((p) => kinds.includes(p.kind)).map((p) => farFrom(p.x, p.y));
    return far.reduce((a, b) => a + b, 0) / far.length;
  };
  const withProp = (kind: (typeof PROP_KINDS)[number], x: number, y: number): TrackSource => ({ ...COMET_RING, props: [{ kind, x, y }] });

  it('stand on COMET RING and pass every check: the five original kinds and the station\'s four, each clear of the road', () => {
    expect(trackProblems(COMET_RING)).toEqual([]);
    for (const kind of PROP_KINDS) expect(props.some((p) => p.kind === kind), kind).toBe(true);
    for (const { x, y } of props) expect(roadAt(track, (x + 0.5) * TILE, (y + 0.5) * TILE), `${x},${y}`).toBe(false);
  });

  it('put pylons and beacons along the circuit\'s edge, and the asteroids, satellites and wrecks deeper in', () => {
    expect(mean(['pylon', 'beacon'])).toBeLessThan(6);
    expect(mean(['asteroid', 'satellite', 'wreck'])).toBeGreaterThan(7);
  });

  it('are refused on the road and within a tile of its edge, naming the tile with its row and column', () => {
    expect(trackProblems(withProp('pylon', 40, 62))).toEqual(['row 62, col 40: a pylon stands on the road or within a tile of its edge, props stand on void tiles only']);
    expect(trackProblems(withProp('crane', 40, 59)).join()).toContain('a crane stands on the road or within a tile of its edge');
  });

  it('are refused off the map and of a kind that does not exist', () => {
    expect(trackProblems(withProp('wreck', 80, 3))).toEqual(['row 3, col 80: a wreck stands off the map, props stand on void tiles only']);
    expect(trackProblems({ ...COMET_RING, props: [JSON.parse('{"kind":"tree","x":0,"y":0}')] })).toEqual(["row 0, col 0: unknown prop kind 'tree'"]);
  });

  it('are left out of a circuit that has none', () => {
    expect(trackProblems(without('props'))).toEqual([]);
    expect(parseTrack(without('props')).props).toEqual([]);
  });

  it('reach the parsed circuit at their tile centres, in game pixels', () => {
    expect(track.props).toHaveLength(props.length);
    const [first] = props, [placed] = track.props;
    expect(placed).toEqual({ kind: sure(first, 'a prop').kind, x: (sure(first, 'a prop').x + 0.5) * TILE, y: (sure(first, 'a prop').y + 0.5) * TILE });
    expect(rows).toHaveLength(72);
  });
});

describe('the arch (PRD 1427)', () => {
  it('stands its legs on the first void tile beyond each end of the start line', () => {
    const tiles = (p: { x: number; y: number }): [number, number] => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
    const [top, bottom] = track.arch.map(tiles);
    const [col, topY] = sure(top, 'the first leg'), [botCol, botY] = sure(bottom, 'the second leg');
    const ys = COMET_RING.rows.flatMap((row, y) => (row[col] === '=' ? [y] : []));
    expect(botCol).toBe(col);
    expect(ys.length).toBeGreaterThan(0);
    expect(roadAt(track, (col + 0.5) * TILE, (topY + 0.5) * TILE)).toBe(false);
    expect(roadAt(track, (col + 0.5) * TILE, (botY + 0.5) * TILE)).toBe(false);
    // The first void: the road runs from the line's end to the leg.
    expect(topY).toBe(Math.min(...ys) - 1);
    expect(botY).toBe(Math.max(...ys) + 1);
  });
});

describe('the relief (PRD 1698)', () => {
  const n = COMET_RING.waypoints.length;
  const heights = COMET_RING.relief?.heights ?? [];
  const bumps = COMET_RING.relief?.bumps ?? [];
  const reliefed = (relief: unknown): TrackSource => ({ ...COMET_RING, relief: relief as NonNullable<TrackSource['relief']> });

  it('is one height a waypoint and one bump a leg, the road level in every corner', () => {
    expect(heights).toHaveLength(n);
    expect(bumps).toHaveLength(n);
    expect(track.relief).toEqual({ heights, bumps });
  });

  it('is a flat road for a circuit that has none', () => {
    const flat = parseTrack(without('relief'));
    expect(flat.relief.heights.every((h) => h === 0) && flat.relief.bumps.every((b) => b === 0)).toBe(true);
  });

  it('eases a leg from one height to the next with its bump at the middle, and no step anywhere', () => {
    const relief = { heights: [0, 10], bumps: [6, 0] };
    const length = 20 * TILE;
    expect(legHeight(relief, 0, 0, length)).toBeCloseTo(0, 9);
    expect(legHeight(relief, 0, length / 2, length)).toBeCloseTo(5 + 6, 9);
    expect(legHeight(relief, 0, length, length)).toBeCloseTo(10, 9);
    expect(legHeight(relief, 0, LEVEL, length, LEVEL)).toBeCloseTo(0, 9);
    expect(legHeight(relief, 0, length - LEVEL, length, LEVEL)).toBeCloseTo(10, 9);
  });

  it('passes the circuit\'s checks and spans 26 at most', () => {
    expect(trackProblems(reliefed({ heights, bumps }))).toEqual([]);
    expect(RELIEF_SPAN).toBe(26);
  });

  it('is refused when a height or a bump is missing, or one too many, naming why', () => {
    expect(trackProblems(reliefed({ heights: heights.slice(1), bumps }))).toEqual([expect.stringContaining(`needs ${n} heights and ${n} bumps`)]);
    expect(trackProblems(reliefed({ heights, bumps: [...bumps, 0] }))).toEqual([expect.stringContaining(`needs ${n} heights and ${n} bumps`)]);
  });

  it('is refused when a height or a bump is not a number', () => {
    expect(trackProblems(reliefed({ heights: heights.map((h, i) => (i === 3 ? Number.NaN : h)), bumps }))).toEqual([expect.stringContaining('not a number')]);
    expect(trackProblems(reliefed({ heights, bumps: bumps.map((b, i) => (i === 2 ? '5' : b)) }))).toEqual([expect.stringContaining('not a number')]);
    expect(trackProblems(reliefed({ heights, bumps: bumps.map((b, i) => (i === 2 ? Infinity : b)) }))).toEqual([expect.stringContaining('not a number')]);
  });

  it('is refused when it spans more than 26, naming how much', () => {
    const tall = heights.map((h, i) => (i === 3 ? 40 : h));
    expect(trackProblems(reliefed({ heights: tall, bumps }))).toEqual([expect.stringMatching(/rises \d+(\.\d)? over its lowest point, more than 26/)]);
    const deep = bumps.map((b, i) => (i === 0 ? -30 : b));
    expect(trackProblems(reliefed({ heights, bumps: deep }))).toEqual([expect.stringContaining('more than 26')]);
  });

  it('accepts a relief spanning exactly 26', () => {
    const zero = Array.from({ length: n }, () => 0);
    expect(trackProblems(reliefed({ heights: zero.map((h, i) => (i === 3 ? 26 : h)), bumps: zero }))).toEqual([]);
  });
});

describe('stands (PRD 1775)', () => {
  const withStands = (stands: [number, number][]): TrackSource => ({ ...COMET_RING, stands });

  it('accepts a stand on a void tile and gives it at its tile\'s centre', () => {
    expect(trackProblems(withStands([[2, 2], [30, 67]]))).toEqual([]);
    expect(parseTrack(withStands([[2, 3]])).stands).toEqual([{ x: 2.5 * TILE, y: 3.5 * TILE }]);
  });

  it('refuses a stand on the road, within a tile of its edge, or off the map', () => {
    expect(trackProblems(withStands([[40, 62]])).join()).toContain('row 62, col 40: a stand floats on the road or within a tile of its edge');
    expect(trackProblems(withStands([[40, 59]])).join()).toContain('a stand floats on the road or within a tile of its edge');
    expect(trackProblems(withStands([[80, 2]])).join()).toContain('off the map');
  });
});

describe('shortcuts (PRD 1775)', () => {
  const withShortcut = (sc: unknown): TrackSource => ({ ...COMET_RING, shortcuts: [sc as never] });
  const onRoad = { leg: [[62.5, 46.5], [62.5, 34.5]], gate: [[60, 36.5], [65, 36.5]], skips: 2 } as const;

  it('accepts a shortcut whose waypoints exist, whose leg ends are on road and whose gate crosses road', () => {
    expect(trackProblems(withShortcut(onRoad))).toEqual([]);
  });

  it('carries it in game pixels: the leg, the gate and the first waypoint it skips', () => {
    const [sc] = parseTrack(withShortcut(onRoad)).shortcuts;
    expect(sc).toEqual({
      from: { x: 62.5 * TILE, y: 46.5 * TILE }, to: { x: 62.5 * TILE, y: 34.5 * TILE },
      gate: [{ x: 60 * TILE, y: 36.5 * TILE }, { x: 65 * TILE, y: 36.5 * TILE }], skips: 2,
    });
  });

  it('refuses skipped waypoints that do not exist', () => {
    const n = COMET_RING.waypoints.length;
    expect(trackProblems(withShortcut({ ...onRoad, skips: n - 1 })).join()).toContain(`skips waypoints ${n - 1} and ${n}`);
    expect(trackProblems(withShortcut({ ...onRoad, skips: -1 })).join()).toContain('shortcut 0 skips');
    expect(trackProblems(withShortcut({ ...onRoad, skips: n - 2 }))).toEqual([]);
  });

  it('refuses a leg whose end is off the road', () => {
    expect(trackProblems(withShortcut({ ...onRoad, leg: [[1, 1], [62.5, 34.5]] })).join()).toContain('row 1, col 1: an end of shortcut 0\'s leg is off the road');
    expect(trackProblems(withShortcut({ ...onRoad, leg: [[62.5, 46.5], [1, 1]] })).join()).toContain('an end of shortcut 0');
  });

  it('refuses a gate that crosses no road', () => {
    expect(trackProblems(withShortcut({ ...onRoad, gate: [[1, 1], [3, 1]] })).join()).toContain('the gate of shortcut 0 crosses no road');
  });
});

describe('COMET RING laid out (PRD 1829)', () => {
  const { rows } = COMET_RING;
  const tiles = (c: string) => rows.flatMap((row, y) => Array.from(row).flatMap((t, x) => (t === c ? [[x, y] as const] : [])));
  const px = (x: number, y: number) => [x * TILE, y * TILE] as const;

  it('holds every stand and every prop clear of the road', () => {
    for (const [x, y] of COMET_RING.stands ?? []) expect(roadAt(track, (x + 0.5) * TILE, (y + 0.5) * TILE), `stand ${x},${y}`).toBe(false);
    for (const { x, y } of COMET_RING.props ?? []) expect(roadAt(track, (x + 0.5) * TILE, (y + 0.5) * TILE), `prop ${x},${y}`).toBe(false);
  });

  it('lays eight stands along the start straight, four on each side, and four beside the gap jump', () => {
    const stands = COMET_RING.stands ?? [];
    expect(stands.filter(([, y]) => y < 60 && y > 50)).toHaveLength(4);
    expect(stands.filter(([, y]) => y > 65)).toHaveLength(4);
    expect(stands.filter(([x, y]) => x > 55 && y < 30)).toHaveLength(4);
  });

  it('carries a walkway one tile wide, from the middle of the curve of waypoint 6 west over the void, about 1.8 tiles off the top straight\'s axis', () => {
    const walk = sure(track.centre.pieces.find((p) => p.surface === 'grating'), 'the walkway');
    expect(walk.width).toBe(1);
    expect(walk.from.y).toBeCloseTo(walk.to.y, 9);
    expect(walk.from.x).toBeGreaterThan(walk.to.x);
    const topAxis = sure(COMET_RING.waypoints[6], 'waypoint 6')[1] + 0.5;
    expect(walk.from.y - topAxis).toBeGreaterThan(1.6);
    expect(walk.from.y - topAxis).toBeLessThan(2.1);
    // It opens from the arc, and no rail stands beside it.
    expect(roadAt(track, (walk.from.x + 2) * TILE, walk.from.y * TILE)).toBe(true);
    // Over the void between the two curves it joins, one tile wide, but the gap.
    for (const x of [26.5, 27.5, 28.5, 34.5, 36]) {
      expect(roadAt(track, x * TILE, walk.from.y * TILE), `x ${x}`).toBe(true);
      expect(roadAt(track, x * TILE, (walk.from.y + 0.7) * TILE), `x ${x} beside it`).toBe(false);
      expect(roadAt(track, x * TILE, (walk.from.y - 0.7) * TILE), `x ${x} beside it, north`).toBe(false);
    }
  });

  it('puts a ramp on the walkway, then a gap across its middle', () => {
    expect(tiles('^').some(([x, y]) => x === 33 && y === 12)).toBe(true);
    const walkY = sure(track.centre.pieces.find((p) => p.surface === 'grating'), 'the walkway').from.y * TILE;
    expect(roadAt(track, 32.5 * TILE, walkY)).toBe(false);
    expect(roadAt(track, 31 * TILE, walkY)).toBe(false);
    expect(roadAt(track, 28.5 * TILE, walkY)).toBe(true);
    expect(inGapAt(track.centre, 31, 12.5)).toBe(true);
  });

  it('roofs 13 tiles of the road from where the curve of waypoint 5 starts', () => {
    const span = sure(track.span, 'the tunnel');
    expect(span.length).toBe(13);
    let roofed = 0;
    for (let a = span.start; a < span.start + span.length; a += 0.5) {
      const p = pointAt(track.centre, a);
      if (roofAt(track, p.x * TILE, p.y * TILE)) roofed++;
    }
    expect(roofed).toBeGreaterThanOrEqual(24);
    expect(roofed).toBeLessThanOrEqual(26);
  });

  it('puts a pad before each jump, and a ramp on each jump', () => {
    const pads = tiles('+');
    for (const [x, y] of [[64, 26], [8, 25], [13, 46], [55, 34], [25, 62]] as const) expect(pads.some(([px2, py]) => px2 === x && py === y), `pad ${x},${y}`).toBe(true);
    const ramps = tiles('^');
    for (const [x, y] of [[64, 22], [8, 28], [62, 42]] as const) expect(ramps.some(([rx, ry]) => rx === x && ry === y), `ramp ${x},${y}`).toBe(true);
    // The spur's ramp has no pad before it.
    expect(pads.some(([x, y]) => x >= 60 && x <= 64 && y >= 43 && y <= 48)).toBe(false);
  });

  it('opens a gap of 3 tiles across the whole road after the gap jump\'s ramp and 5 tiles after the spur\'s', () => {
    for (const x of [62.5, 63.5, 64.5, 65.5, 66.5]) {
      const col = px(x, 0)[0];
      expect([22.5, 21.5, 20.5, 19.5, 18.5].map((y) => roadAt(track, col, y * TILE))).toEqual([true, false, false, false, true]);
      expect(inGap(col, 20.5 * TILE)).toBe(true);
    }
    for (const x of [60.5, 61.5, 62.5, 63.5, 64.5]) {
      const col = px(x, 0)[0];
      expect([42.5, 41.5, 40.5, 39.5, 38.5, 37.5, 36.5].map((y) => roadAt(track, col, y * TILE))).toEqual([true, false, false, false, false, false, true]);
    }
    expect(inGapAt(track.centre, 64.5, 20.5)).toBe(true);
  });
});

describe('the jumps, flown over COMET RING (PRD 1775)', () => {
  /** A kart on a ramp's far edge, facing `angle`, at `speed` (with `boost` seconds of BOOST on it): flown until it lands or falls. Where it ends, and whether it fell. */
  function fly(at: { x: number; y: number }, angle: number, speed: number, boost = 0) {
    const hands = { left: false, right: false, accel: true, brake: false };
    let kart: Kart = { x: at.x, y: at.y, angle, speed, steer: 0 };
    let fx = { ...NO_FX, boost };
    let flown = false;
    for (let i = 0; i < 1200; i++) {
      ({ kart, fx } = stepFx(track, kart, hands, 1 / 120, 1, fx));
      flown ||= (kart.height ?? 0) > 0;
      if (fx.fall > 0 || (flown && !airborne(kart))) return { fell: fx.fall > 0, x: kart.x, y: kart.y };
    }
    throw new Error('the kart never landed');
  }
  const north = -Math.PI / 2;
  const gapJump = { x: 64.5 * TILE, y: 22 * TILE + 1 };
  const hiddenRamp = { x: 62.5 * TILE, y: 42 * TILE + 1 };
  const rowOf = (y: number) => Math.floor(y / TILE);

  it('clears the gap jump from the pad, and at top speed without a BOOST', () => {
    const run = fly({ x: 64.5 * TILE, y: 26.5 * TILE }, north, RULES.topSpeed);
    expect(run.fell).toBe(false);
    expect(roadAt(track, run.x, run.y)).toBe(true);
    const top = fly(gapJump, north, RULES.topSpeed);
    expect(top.fell).toBe(false);
    expect(rowOf(top.y)).toBeLessThanOrEqual(18);
  });

  it('falls into the gap jump at 0.8 of the top speed', () => {
    expect(fly(gapJump, north, 0.8 * RULES.topSpeed).fell).toBe(true);
  });

  it('does not clear the hidden ramp at top speed without a BOOST, and lands back on the road with the item\'s BOOST', () => {
    expect(fly(hiddenRamp, north, RULES.topSpeed).fell).toBe(true);
    const boosted = fly(hiddenRamp, north, RULES.topSpeed * RULES.boostFactor, RULES.boostTime);
    expect(boosted.fell).toBe(false);
    expect(rowOf(boosted.y)).toBeGreaterThanOrEqual(31);
    expect(rowOf(boosted.y)).toBeLessThanOrEqual(36);
    expect(roadAt(track, boosted.x, boosted.y)).toBe(true);
  });

  const west = Math.PI;
  const walkRamp = { x: 33 * TILE + 1, y: 12.5 * TILE };

  it('clears the walkway\'s gap from the ramp at the top speed without a BOOST, and lands on the walkway', () => {
    const top = fly(walkRamp, west, RULES.topSpeed);
    expect(top.fell).toBe(false);
    expect(roadAt(track, top.x, top.y)).toBe(true);
    expect(top.x / TILE).toBeLessThan(29.65);
  });

  it('falls into the walkway\'s gap at 0.9 of the top speed', () => {
    expect(fly(walkRamp, west, 0.9 * RULES.topSpeed).fell).toBe(true);
    expect(fly(walkRamp, west, 0.8 * RULES.topSpeed).fell).toBe(true);
  });

  it('runs the walkway on its centre line at the top speed: it clears the gap and lands on it, and half a tile off it a kart tips over', () => {
    const run = (share: number, dy = 0) => {
      const hands = { left: false, right: false, accel: true, brake: false };
      let kart: Kart = { x: 42 * TILE, y: 12.5 * TILE + dy, angle: west, speed: share * RULES.topSpeed, steer: 0 };
      let fx = { ...NO_FX };
      let flown = false;
      for (let i = 0; i < 2400; i++) {
        ({ kart, fx } = stepFx(track, kart, hands, 1 / 120, 1, fx));
        flown ||= (kart.height ?? 0) > 0;
        if (fx.fall > 0) return { fell: true, x: kart.x, y: kart.y };
        if (flown && !airborne(kart) && kart.x < 29 * TILE) return { fell: false, x: kart.x, y: kart.y };
      }
      throw new Error('the kart neither fell nor landed');
    };
    const top = run(1);
    expect(top.fell).toBe(false);
    expect(roadAt(track, top.x, top.y)).toBe(true);
    // Half a tile off the centre line, a wheel is over the void: it tips over.
    expect(run(1, TILE / 2).fell).toBe(true);
  });

  it('brings a kart that fell from the walkway back on the racing line, in the U-loop', () => {
    const back = comeBack(track, { laps: 0, passed: 7 }, { x: 31 * TILE, y: 12.5 * TILE, angle: west, speed: 0, steer: 0 }, NO_FX);
    expect(roadAt(track, back.kart.x, back.kart.y)).toBe(true);
    expect(back.kart.x / TILE).toBeGreaterThan(22);
    expect(back.kart.x / TILE).toBeLessThan(42);
    expect(back.kart.y / TILE).toBeGreaterThan(14);
    expect(back.kart.y / TILE).toBeLessThan(28);
  });

  it('flies the bump jump over road all the way: no fall at any speed from 0.5 to 1.4 of the top speed', () => {
    for (const share of [0.5, 0.8, 1, 1.4]) {
      const run = fly({ x: 8.5 * TILE, y: 28 * TILE + 15 }, Math.PI / 2, share * RULES.topSpeed);
      expect(run.fell, `${share}`).toBe(false);
    }
  });
});

describe('a line that crosses itself (PRD 1923)', () => {
  it('is drivable on level ground, a crossing at about 62 degrees, with the start line and the gates far from it', () => {
    expect(trackProblems(EIGHT)).toEqual([]);
    expect(parseTrack(EIGHT).length).toBeGreaterThan(0);
  });

  it('is refused when its two branches are not at one height at the crossing', () => {
    const heights = [0, 0, 0, 0, 0, 0, 0, 0];
    const problems = trackProblems(eightWith({ relief: { heights: [0, 10, 0, 0, 0, 0, 0, 0], bumps: heights } }));
    expect(problems.join()).toContain('the ground is not level');
    expect(trackProblems(eightWith({ relief: { heights, bumps: [0, 0, 0, 0, 0, 0, 0, 0] } }))).toEqual([]);
    expect(trackProblems(eightWith({ relief: { heights: [0, 8, 8, 0, 0, 0, 0, 0], bumps: heights } })).join()).toContain('the ground is not level');
  });

  it('is refused when a gate stands within 8 tiles of the crossing', () => {
    const near = eightWith({ waypoints: [[56, 64, 5], [56, 48, 4], [42, 40, 3], [16, 24, 4], [16, 8, 5], [56, 8, 5], [56, 24, 4], [16, 48, 4], [16, 64, 5]] });
    expect(trackProblems(near).join()).toContain('the gate of waypoint 2 is within 8 tiles');
  });

  it('is refused when the start line stands within 8 tiles of the crossing', () => {
    const rows = EIGHT.rows.map((r, y) => (y === 36 ? `${r.slice(0, 40)}=${r.slice(41)}` : r));
    expect(trackProblems(eightWith({ rows })).join()).toContain('the start line is within 8 tiles');
  });

  it('is refused when the branches cross at under 60 degrees', () => {
    const narrow = eightWith({ waypoints: [[56, 64, 5], [56, 44, 4], [16, 28, 4], [16, 8, 5], [56, 8, 5], [56, 28, 4], [16, 44, 4], [16, 64, 5]] });
    expect(trackProblems(narrow).join()).toContain('degrees, at least 60 are needed');
  });

  it('is never refused on COMET RING, whose line does not cross itself', () => {
    expect(trackProblems(COMET_RING)).toEqual([]);
  });
});

// The surface at a pixel (PRD 1923, slice 3).
describe('the surface at a pixel', () => {
  it('is road wherever roadAt is true and void elsewhere on COMET RING', () => {
    const track = parseTrack();
    for (let y = 0; y < track.size.h; y += 5) {
      for (let x = 0; x < track.size.w; x += 5) expect(surfaceAt(track, x, y)).toBe(roadAt(track, x, y) ? 'road' : 'void');
    }
    expect(track.floor).toBeUndefined();
    expect(surfaceAt(track, -1, -1)).toBe('void');
  });

  it('reads ice, road and powder from a floor, and has a tree line one tile inside the edge only with one', () => {
    const eight = withFloor(parseTrack(EIGHT));
    expect(surfaceAt(eight, 36 * TILE, 36 * TILE)).toBe('ice');
    expect(surfaceAt(eight, 2 * TILE, 2 * TILE)).toBe('powder');
    expect(surfaceAt(eight, 56 * TILE, 56 * TILE)).toBe('road');
    expect(pastTreeLine(eight, 5, 300)).toBe(true);
    expect(pastTreeLine(eight, TILE + 1, TILE + 1)).toBe(false);
    expect(pastTreeLine(eight, eight.size.w - 1, 300)).toBe(true);
    expect(pastTreeLine(parseTrack(), 5, 5)).toBe(false);
  });
});

// FROST EIGHT (PRD 1923, slice 5).
describe('FROST EIGHT', () => {
  const frost = parseTrack(FROST_EIGHT);
  const crossing = { x: 36.5 * TILE, y: 36.5 * TILE };

  it('is drivable, and its 8 waypoints and radii are those of the spec', () => {
    expect(trackProblems(FROST_EIGHT)).toEqual([]);
    expect(FROST_EIGHT.waypoints).toEqual([[56, 64, 5], [56, 48, 4], [16, 24, 4], [16, 8, 5], [56, 8, 5], [56, 24, 4], [16, 48, 4], [16, 64, 5]]);
    expect(FROST_EIGHT.width).toBe(5);
    expect([frost.size.w, frost.size.h]).toEqual([72 * TILE, 72 * TILE]);
  });

  it('starts at x = 32 heading east, with six places behind the line', () => {
    expect(frost.heading).toBe(0);
    expect(frost.line.x).toBe(32.5 * TILE);
    expect(frost.places).toHaveLength(6);
    expect(frost.places.every((p) => p.x < frost.line.x)).toBe(true);
  });

  it('crosses itself at 60 degrees or more, on a lake 12 tiles across, the ground level over it', () => {
    const [c] = crossings(frost.centre);
    expect(crossings(frost.centre)).toHaveLength(1);
    expect(c?.angle).toBeGreaterThanOrEqual(60);
    expect(c?.angle).toBeLessThan(64);
    expect(Math.hypot((c?.x ?? 0) * TILE - crossing.x, (c?.y ?? 0) * TILE - crossing.y)).toBeLessThan(TILE);
    expect(FROST_EIGHT.ice?.[0]).toEqual({ at: [36, 36], radius: 6 });
    const heights = [-6, -3, 0, 3, 6].map((d) => groundAt(frost, crossing.x + d * TILE * 0.857, crossing.y + d * TILE * 0.514));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.05);
  });

  it('is ice across the lake, road on the rest of the road, powder everywhere else, and never void', () => {
    let ice = 0, road = 0, powder = 0;
    for (let y = 0; y < frost.size.h; y++) {
      for (let x = 0; x < frost.size.w; x++) {
        const s = surfaceAt(frost, x, y);
        const frozen = [[36, 36, 6], [16, 8, 3], [16, 64, 3]].some(([cx = 0, cy = 0, r = 0]) => Math.hypot(x + 0.5 - (cx + 0.5) * TILE, y + 0.5 - (cy + 0.5) * TILE) < r * TILE);
        expect(s, `${x}, ${y}`).toBe(frozen ? 'ice' : roadAt(frost, x, y) ? 'road' : 'powder');
        if (s === 'ice') ice++; else if (s === 'road') road++; else powder++;
      }
    }
    expect(ice).toBeGreaterThan(0);
    expect(road).toBeGreaterThan(0);
    expect(powder).toBeGreaterThan(0);
    expect(surfaceAt(frost, 36.5 * TILE, 36.5 * TILE)).toBe('ice');
    expect(pastTreeLine(frost, 3, 300)).toBe(true);
  });

  it('freezes two patches 6 tiles across on the middle of bend 4 and bend 8, across the road, after the lake', () => {
    expect(FROST_EIGHT.ice).toEqual([{ at: [36, 36], radius: 6 }, { at: [16, 8], radius: 3 }, { at: [16, 64], radius: 3 }]);
    for (const [bx, by] of [[16, 8], [16, 64]] as const) {
      for (const d of [-2, -1, 0, 1, 2]) {
        expect(surfaceAt(frost, (bx + 0.5 + d * 0.9) * TILE, (by + 0.5) * TILE)).toBe('ice');
        expect(surfaceAt(frost, (bx + 0.5) * TILE, (by + 0.5 + d * 0.9) * TILE)).toBe('ice');
      }
      expect(surfaceAt(frost, (bx + 4) * TILE, (by + 0.5) * TILE)).not.toBe('ice');
    }
  });

  it('has boxes and boost pads on the road, and a pass on the top straight', () => {
    expect(frost.boxes.length).toBeGreaterThan(0);
    expect(frost.boxes.every((b) => roadAt(frost, b.x, b.y))).toBe(true);
    expect(frost.relief.heights[3]).toBeGreaterThan(frost.relief.heights[0] ?? 0);
    expect(FROST_EIGHT.props).toBeUndefined();
  });
});
