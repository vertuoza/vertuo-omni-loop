import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { COMET_RING, PROP_KINDS, cornersOf, isRoad, LAPS, legHeight, LEVEL, parseTrack, RELIEF_SPAN, TILE, tileAt, trackProblems, type TrackSource } from './track';

/** COMET RING with one row changed: `edit` gets the rows as arrays of characters. */
function altered(edit: (rows: string[][]) => void, waypoints: TrackSource['waypoints'] = COMET_RING.waypoints): TrackSource {
  const rows = COMET_RING.rows.map((r) => Array.from(r));
  edit(rows);
  return { rows: rows.map((r) => r.join('')), waypoints };
}
const set = (rows: string[][], x: number, y: number, c: string) => { sure(rows[y], `row ${y}`)[x] = c; };

describe('COMET RING', () => {
  it('passes every circuit check', () => {
    expect(trackProblems()).toEqual([]);
    expect(trackProblems(COMET_RING)).toEqual([]);
  });

  it('is a 64×64 map of equal rows, raced over 3 laps', () => {
    expect(COMET_RING.rows).toHaveLength(64);
    for (const row of COMET_RING.rows) expect(row).toHaveLength(64);
    expect(LAPS).toBe(3);
    expect(TILE).toBe(16);
  });

  it('keeps its road four to six tiles wide, on every straight of the racing line', () => {
    const { rows, waypoints } = COMET_RING;
    waypoints.forEach(([x, y], i) => {
      const [nx, ny] = sure(waypoints[(i + 1) % waypoints.length], 'the next waypoint');
      const vertical = x === nx;
      const mid: [number, number] = [Math.round((x + nx) / 2), Math.round((y + ny) / 2)];
      let width = 0;
      for (let d = -8; d <= 8; d++) if (isRoad(vertical ? tileAt(rows, mid[0] + d, mid[1]) : tileAt(rows, mid[0], mid[1] + d))) width++;
      expect(width, `between waypoints ${i} and ${(i + 1) % waypoints.length}`).toBeGreaterThanOrEqual(4);
      expect(width).toBeLessThanOrEqual(6);
    });
  });
});

describe('the void (PRD 1447)', () => {
  const { rows, waypoints } = COMET_RING;

  it('holds only road tiles and void tiles on COMET RING: road, kerb, line, box, start and ~', () => {
    for (const [y, row] of rows.entries()) {
      for (const [x, c] of Array.from(row).entries()) expect(isRoad(c) || c === '~', `row ${y}, col ${x}: '${c}'`).toBe(true);
    }
    expect(rows.some((row) => row.includes('~'))).toBe(true);
  });

  it('reads the void past the map\'s edge', () => {
    for (const [x, y] of [[-1, 0], [0, -1], [64, 3], [3, 64], [-40, 200]] as const) expect(tileAt(rows, x, y), `${x},${y}`).toBe('~');
  });

  it('is a tile the map may hold: a void is not an unknown character', () => {
    expect(trackProblems(altered((r) => { set(r, 0, 0, '~'); }))).toEqual([]);
  });

  it('keeps every point of the racing line over road, sampled along each segment', () => {
    waypoints.forEach(([x, y], i) => {
      const [nx, ny] = sure(waypoints[(i + 1) % waypoints.length], 'the next waypoint');
      for (let s = 0; s <= 64; s++) {
        const px = (x + 0.5 + ((nx - x) * s) / 64) * TILE, py = (y + 0.5 + ((ny - y) * s) / 64) * TILE;
        expect(isRoad(tileAt(rows, Math.floor(px / TILE), Math.floor(py / TILE))), `segment ${i}, sample ${s}`).toBe(true);
      }
    });
  });
});

describe('trackProblems', () => {
  it('refuses an unknown character, with its row and column', () => {
    expect(trackProblems(altered((r) => { set(r, 10, 5, 'q'); }))).toEqual(["row 5, col 10: unknown character 'q'"]);
  });

  it('refuses rows of unequal length, with the row and the column it stops at', () => {
    const src = altered(() => {});
    const short = { ...src, rows: src.rows.map((r, y) => (y === 7 ? r.slice(0, 60) : r)) };
    expect(trackProblems(short)).toEqual(['row 7, col 60: this row is 60 tiles long, the first is 64']);
  });

  it('refuses a waypoint off the road', () => {
    const waypoints = COMET_RING.waypoints.map((w, i) => (i === 3 ? [50, 34] as const : w));
    expect(trackProblems(altered(() => {}, waypoints))).toContain('row 34, col 50: waypoint 3 is off the road');
  });

  it('refuses two consecutive waypoints not joined by road, naming the first tile that is not road', () => {
    const problems = trackProblems(altered((r) => { set(r, 54, 48, '~'); }));
    expect(problems).toEqual(['row 48, col 54: waypoints 0 and 1 are not joined by road']);
  });

  it('refuses the last waypoint not joined to the first', () => {
    const problems = trackProblems(altered((r) => { set(r, 40, 56, '~'); }));
    expect(problems.some((p) => p.includes('waypoints 13 and 0 are not joined by road'))).toBe(true);
  });

  it('refuses a map that holds a verge `.` or a wall `X`: the legend has neither', () => {
    for (const c of ['.', 'X']) {
      expect(trackProblems(altered((r) => { set(r, 0, 0, c); })), c).toEqual([`row 0, col 0: unknown character '${c}'`]);
    }
  });

  it('refuses a seventh starting place, and a missing one', () => {
    expect(trackProblems(altered((r) => { set(r, 22, 58, 'S'); }))).toEqual(['row 58, col 28: 6 starting places expected, 7 found']);
    expect(trackProblems(altered((r) => { set(r, 25, 54, '#'); }))).toEqual(['row 58, col 28: 6 starting places expected, 5 found']);
  });

  it('refuses a starting place ahead of the line, and one off the road', () => {
    const ahead = trackProblems(altered((r) => { set(r, 25, 54, '#'); set(r, 33, 54, 'S'); }));
    expect(ahead).toEqual(['row 54, col 33: starting place is not behind the start line']);
    const off = trackProblems(altered((r) => { set(r, 25, 54, '#'); set(r, 25, 60, 'S'); }));
    expect(off).toContain('row 60, col 25: starting place off the road');
  });

  it('refuses a start line that stops short of a wall, with the tile that is still road', () => {
    expect(trackProblems(altered((r) => { set(r, 30, 58, '#'); }))).toEqual([
      'row 58, col 30: the start line does not cross the road from wall to wall',
    ]);
  });

  it('refuses a start line with a gap, and a line that is not one straight run, and no line at all', () => {
    expect(trackProblems(altered((r) => { set(r, 30, 56, '#'); }))).toEqual(['row 57, col 30: the start line has a gap']);
    expect(trackProblems(altered((r) => { set(r, 31, 56, '='); }))).toEqual(['row 54, col 30: the start line is not one straight run']);
    expect(trackProblems(altered((r) => { for (let y = 54; y <= 58; y++) set(r, 30, y, '#'); }))).toEqual(['row 0, col 0: no start line']);
  });

  it('refuses an item box off the road', () => {
    expect(trackProblems(altered((r) => { set(r, 30, 14, '?'); }))).toEqual(['row 14, col 30: item box off the road']);
    expect(trackProblems(altered((r) => { set(r, 30, 61, '?'); }))).toEqual(['row 61, col 30: item box off the road']);
  });

  it('reports every problem it finds', () => {
    expect(trackProblems(altered((r) => { set(r, 30, 14, '?'); set(r, 31, 14, '?'); })).length).toBe(2);
  });
});

describe('parseTrack', () => {
  const track = parseTrack();

  it('puts the racing line, the boxes and the starting places at their tile centres, in game pixels', () => {
    expect(track.size).toEqual({ w: 1024, h: 1024 });
    expect(track.waypoints[0]).toEqual({ x: 54.5 * 16, y: 56.5 * 16 });
    expect(track.waypoints).toHaveLength(COMET_RING.waypoints.length);
    expect(track.boxes).toHaveLength(40);
  });

  it('stands the boxes in ten lines of four across the road, each line on a row or a column of tiles', () => {
    // A line is a group of boxes within three tiles of one another; across the road, it shares one row or one column.
    const tiles = track.boxes.map((b) => [Math.floor(b.x / 16), Math.floor(b.y / 16)] as const);
    const lines: (readonly (readonly [number, number])[])[] = [];
    for (const t of tiles) {
      const line = lines.find((l) => l.some((o) => Math.abs(o[0] - t[0]) + Math.abs(o[1] - t[1]) <= 3));
      if (line) (line as (readonly [number, number])[]).push(t); else lines.push([t]);
    }
    expect(lines).toHaveLength(10);
    for (const l of lines) expect(new Set(l.map((t) => t[0])).size === 1 || new Set(l.map((t) => t[1])).size === 1).toBe(true);
    expect(lines.every((l) => l.length === 4)).toBe(true);
  });

  it('points the karts down the start straight, towards the first waypoint', () => {
    expect(track.forward).toEqual([1, 0]);
    expect(track.heading).toBe(0);
  });

  it('stands six places behind the line, pole first and the last place farthest back', () => {
    expect(track.places).toHaveLength(6);
    const lineX = 30.5 * 16;
    const depths = track.places.map((p) => lineX - p.x);
    for (const d of depths) expect(d).toBeGreaterThan(0);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
    expect(sure(track.places[5], 'the last place')).toEqual({ x: 25.5 * 16, y: 58.5 * 16 });
  });

  it('throws, naming what is wrong, on a circuit that is not drivable', () => {
    expect(() => parseTrack(altered((r) => { set(r, 10, 5, 'q'); }))).toThrow(/row 5, col 10: unknown character 'q'/);
  });
});

describe('cornersOf', () => {
  const corners = cornersOf(parseTrack());
  const L = 'left', R = 'right';

  it("lists COMET RING's corners: every waypoint, the line turning 90° at each, and the way it turns", () => {
    expect(corners.map((c) => [c.x, c.y, c.turn])).toEqual([
      [54, 56, L], [54, 40, L], [44, 40, R], [44, 28, R], [56, 28, L], [56, 8, L], [36, 8, L],
      [36, 20, R], [20, 20, R], [20, 8, L], [8, 8, L], [8, 40, L], [18, 40, R], [18, 56, L],
    ]);
  });

  it('gives the step of the leg into each corner, the last waypoint joining the first', () => {
    expect(sure(corners[0], 'the first corner').into).toEqual([1, 0]);
    expect(sure(corners[1], 'the second corner').into).toEqual([0, -1]);
  });

  it('leaves out a waypoint where the line turns under 30°, and keeps one past it', () => {
    const pt = (x: number, y: number) => ({ x, y });
    const a = Math.tan(Math.PI / 6);
    const ring = (y: number) => [pt(0, 0), pt(100, 0), pt(200, y), pt(100, 300), pt(0, 300)];
    expect(cornersOf({ waypoints: ring(100 * a - 5) }).map((c) => c.index)).not.toContain(1);
    expect(cornersOf({ waypoints: ring(100 * a + 5) }).map((c) => c.index)).toContain(1);
  });
});

describe('the props (PRD 1427)', () => {
  const { props = [], rows } = COMET_RING;
  /** Whether a tile beside x, y has road within two tiles: it hangs at the road's edge, not deeper in the void. */
  const nearRoad = (x: number, y: number) => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => {
    for (let ox = -2; ox <= 2; ox++) for (let oy = -2; oy <= 2; oy++) if (isRoad(tileAt(rows, x + dx + ox, y + dy + oy))) return true;
    return false;
  });
  const withProp = (kind: (typeof PROP_KINDS)[number], x: number, y: number): TrackSource => ({ ...COMET_RING, props: [{ kind, x, y }] });

  it('stand on COMET RING and pass every check: all five kinds, each on a void tile', () => {
    expect(trackProblems(COMET_RING)).toEqual([]);
    for (const kind of PROP_KINDS) expect(props.some((p) => p.kind === kind), kind).toBe(true);
    for (const { x, y } of props) expect(tileAt(rows, x, y)).toBe('~');
  });

  it('put pylons and beacons along the circuit\'s edge, and the rest deeper in', () => {
    for (const { kind, x, y } of props) expect(nearRoad(x, y), `${kind} at ${x},${y}`).toBe(kind === 'pylon' || kind === 'beacon');
  });

  it('are refused on a road, kerb, line, box or start tile, naming the tile with its row and column', () => {
    const first = (c: string): [number, number] => {
      const y = rows.findIndex((r) => r.includes(c));
      return [sure(rows[y], 'a row').indexOf(c), y];
    };
    const cases = [['road', '#'], ['kerb', 'r'], ['line', '='], ['box', '?'], ['start', 'S']] as const;
    for (const [what, c] of cases) {
      const [x, y] = first(c);
      expect(trackProblems(withProp('pylon', x, y)), what).toEqual([`row ${y}, col ${x}: a pylon stands on a ${what} tile, props stand on void tiles only`]);
    }
  });

  it('are refused on a road tile, a tile that is not void', () => {
    const src = { ...altered((r) => { set(r, 0, 0, '#'); }), props: [{ kind: 'pylon' as const, x: 0, y: 0 }] };
    expect(trackProblems(src)).toEqual(['row 0, col 0: a pylon stands on a road tile, props stand on void tiles only']);
  });

  it('are refused off the map and of a kind that does not exist', () => {
    expect(trackProblems(withProp('wreck', 70, 3))).toEqual(['row 3, col 70: a wreck stands off the map, props stand on void tiles only']);
    expect(trackProblems({ ...COMET_RING, props: [JSON.parse('{"kind":"tree","x":0,"y":0}')] })).toEqual(["row 0, col 0: unknown prop kind 'tree'"]);
  });

  it('are left out of a circuit that has none', () => {
    expect(trackProblems({ rows: COMET_RING.rows, waypoints: COMET_RING.waypoints })).toEqual([]);
    expect(parseTrack({ rows: COMET_RING.rows, waypoints: COMET_RING.waypoints }).props).toEqual([]);
  });

  it('reach the parsed circuit at their tile centres, in game pixels', () => {
    const track = parseTrack();
    expect(track.props).toHaveLength(props.length);
    const [first] = props, [placed] = track.props;
    expect(placed).toEqual({ kind: sure(first, 'a prop').kind, x: (sure(first, 'a prop').x + 0.5) * TILE, y: (sure(first, 'a prop').y + 0.5) * TILE });
  });
});

describe('the arch (PRD 1427)', () => {
  it('stands its legs on the first void tile beyond each end of the start line', () => {
    const tiles = (p: { x: number; y: number }): [number, number] => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
    const [top, bottom] = parseTrack().arch.map(tiles);
    const [col, topY] = sure(top, 'the first leg'), [botCol, botY] = sure(bottom, 'the second leg');
    const ys = COMET_RING.rows.flatMap((row, y) => (row[col] === '=' ? [y] : []));
    expect(botCol).toBe(col);
    expect(ys.length).toBeGreaterThan(0);
    expect(tileAt(COMET_RING.rows, col, topY)).toBe('~');
    expect(tileAt(COMET_RING.rows, col, botY)).toBe('~');
    // The first void: nothing between a leg and the line's end is void.
    for (let y = topY + 1; y < Math.min(...ys); y++) expect(tileAt(COMET_RING.rows, col, y)).not.toBe('~');
    for (let y = Math.max(...ys) + 1; y < botY; y++) expect(tileAt(COMET_RING.rows, col, y)).not.toBe('~');
    expect(topY).toBeLessThan(Math.min(...ys));
    expect(botY).toBeGreaterThan(Math.max(...ys));
  });
});

describe('the relief (PRD 1698)', () => {
  const n = COMET_RING.waypoints.length;
  const heights = COMET_RING.relief?.heights ?? [];
  const bumps = COMET_RING.relief?.bumps ?? [];
  const reliefed = (relief: unknown): TrackSource => ({ rows: COMET_RING.rows, waypoints: COMET_RING.waypoints, relief: relief as NonNullable<TrackSource['relief']> });

  it('is one height a waypoint and one bump a leg, the road level in every corner', () => {
    expect(heights).toHaveLength(n);
    expect(bumps).toHaveLength(n);
    expect(parseTrack().relief).toEqual({ heights, bumps });
  });

  it('is a flat road for a circuit that has none', () => {
    const track = parseTrack({ rows: COMET_RING.rows, waypoints: COMET_RING.waypoints });
    expect(track.relief.heights.every((h) => h === 0) && track.relief.bumps.every((b) => b === 0)).toBe(true);
  });

  it('eases a leg from one height to the next with its bump at the middle, and no step anywhere', () => {
    const relief = { heights: [0, 10], bumps: [6, 0] };
    const length = 20 * TILE;
    expect(legHeight(relief, 0, 0, length)).toBeCloseTo(0, 9);
    expect(legHeight(relief, 0, LEVEL, length)).toBeCloseTo(0, 9);
    expect(legHeight(relief, 0, length / 2, length)).toBeCloseTo(5 + 6, 9);
    expect(legHeight(relief, 0, length - LEVEL, length)).toBeCloseTo(10, 9);
    expect(legHeight(relief, 0, length, length)).toBeCloseTo(10, 9);
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

describe('the station tiles (PRD 1775)', () => {
  it('reads a pad, a ramp, roofed road and a walkway as road to the wheels', () => {
    for (const c of ['+', '^', 'T', 'w']) expect(isRoad(c), c).toBe(true);
    expect(isRoad('~')).toBe(false);
    expect(isRoad('x')).toBe(false);
  });

  it('accepts them in the map: the circuit\'s checks pass', () => {
    expect(trackProblems(altered((r) => { set(r, 54, 52, '+'); set(r, 54, 51, '^'); set(r, 54, 50, 'T'); set(r, 54, 49, 'w'); }))).toEqual([]);
  });

  it('keeps COMET RING itself as it was: no stand, no shortcut', () => {
    expect(COMET_RING.stands).toBeUndefined();
    expect(COMET_RING.shortcuts).toBeUndefined();
    const track = parseTrack();
    expect(track.stands).toEqual([]);
    expect(track.shortcuts).toEqual([]);
  });
});

describe('stands (PRD 1775)', () => {
  const withStands = (stands: [number, number][]): TrackSource => ({ ...COMET_RING, stands });

  it('accepts a stand on a void tile and gives it at its tile\'s centre', () => {
    expect(trackProblems(withStands([[2, 2], [30, 60]]))).toEqual([]);
    expect(parseTrack(withStands([[2, 3]])).stands).toEqual([{ x: 2.5 * TILE, y: 3.5 * TILE }]);
  });

  it('refuses a stand on the road, on a pad, or off the map', () => {
    expect(trackProblems(withStands([[7, 7]])).join()).toContain('row 7, col 7: a stand floats on a road tile');
    expect(trackProblems({ ...altered((r) => { set(r, 2, 2, '+'); }), stands: [[2, 2]] }).join()).toContain('on a boost pad tile');
    expect(trackProblems(withStands([[70, 2]])).join()).toContain('off the map');
  });
});

describe('shortcuts (PRD 1775)', () => {
  const good = { leg: [[54, 40], [44, 28]], gate: [[50, 36], [50, 36]], skips: 2 } as const;
  const withShortcut = (sc: unknown): TrackSource => ({ ...COMET_RING, shortcuts: [sc as never] });
  // A gate on road: the road tile [54, 50], a leg between two waypoints.
  const onRoad = { leg: [[54, 56], [54, 40]], gate: [[52, 48], [56, 48]], skips: 2 } as const;

  it('accepts a shortcut whose waypoints exist, whose leg ends are on road and whose gate crosses road', () => {
    expect(trackProblems(withShortcut(onRoad))).toEqual([]);
  });

  it('carries it in tile centres: the leg, the gate and the first waypoint it skips', () => {
    const [sc] = parseTrack(withShortcut(onRoad)).shortcuts;
    expect(sc).toEqual({
      from: { x: 54.5 * TILE, y: 56.5 * TILE }, to: { x: 54.5 * TILE, y: 40.5 * TILE },
      gate: [{ x: 52.5 * TILE, y: 48.5 * TILE }, { x: 56.5 * TILE, y: 48.5 * TILE }], skips: 2,
    });
  });

  it('refuses skipped waypoints that do not exist', () => {
    const n = COMET_RING.waypoints.length;
    expect(trackProblems(withShortcut({ ...onRoad, skips: n - 1 })).join()).toContain(`skips waypoints ${n - 1} and ${n}`);
    expect(trackProblems(withShortcut({ ...onRoad, skips: -1 })).join()).toContain('shortcut 0 skips');
    expect(trackProblems(withShortcut({ ...onRoad, skips: n - 2 }))).toEqual([]);
  });

  it('refuses a leg whose end is off the road', () => {
    expect(trackProblems(withShortcut({ ...onRoad, leg: [[1, 1], [54, 40]] })).join()).toContain('row 1, col 1: an end of shortcut 0\'s leg is off the road');
    expect(trackProblems(withShortcut({ ...onRoad, leg: [[54, 56], [1, 1]] })).join()).toContain('an end of shortcut 0');
  });

  it('refuses a gate that crosses no road', () => {
    expect(trackProblems(withShortcut({ ...good, gate: [[1, 1], [3, 1]] })).join()).toContain('the gate of shortcut 0 crosses no road');
  });
});
