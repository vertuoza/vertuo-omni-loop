import { describe, expect, it } from 'vitest';
import { sure } from '../test/sure';
import { COMET_RING, PROP_KINDS, cornersOf, isRoad, LAPS, parseTrack, TILE, tileAt, trackProblems, type TrackSource } from './track';

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
    const problems = trackProblems(altered((r) => { set(r, 54, 48, '.'); }));
    expect(problems).toEqual(['row 48, col 54: waypoints 0 and 1 are not joined by road']);
  });

  it('refuses the last waypoint not joined to the first', () => {
    const problems = trackProblems(altered((r) => { set(r, 40, 56, 'X'); }));
    expect(problems.some((p) => p.includes('waypoints 13 and 0 are not joined by road'))).toBe(true);
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
    expect(track.boxes).toHaveLength(8);
    expect(new Set(track.boxes.map((b) => b.x)).size).toBe(2);
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
  const nearVerge = (x: number, y: number) => ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([dx, dy]) => tileAt(rows, x + dx, y + dy) === '.');
  const withProp = (kind: (typeof PROP_KINDS)[number], x: number, y: number): TrackSource => ({ ...COMET_RING, props: [{ kind, x, y }] });

  it('stand on COMET RING and pass every check: all five kinds, each on a wall tile', () => {
    expect(trackProblems(COMET_RING)).toEqual([]);
    for (const kind of PROP_KINDS) expect(props.some((p) => p.kind === kind), kind).toBe(true);
    for (const { x, y } of props) expect(tileAt(rows, x, y)).toBe('X');
  });

  it('put pylons and beacons along the circuit\'s edge, and the rest deeper in', () => {
    for (const { kind, x, y } of props) expect(nearVerge(x, y), `${kind} at ${x},${y}`).toBe(kind === 'pylon' || kind === 'beacon');
  });

  it('are refused on a road, kerb, line, box, start or verge tile, naming the tile with its row and column', () => {
    const first = (c: string): [number, number] => {
      const y = rows.findIndex((r) => r.includes(c));
      return [sure(rows[y], 'a row').indexOf(c), y];
    };
    const cases = [['road', '#'], ['kerb', 'r'], ['line', '='], ['box', '?'], ['start', 'S'], ['verge', '.']] as const;
    for (const [what, c] of cases) {
      const [x, y] = first(c);
      expect(trackProblems(withProp('pylon', x, y)), what).toEqual([`row ${y}, col ${x}: a pylon stands on a ${what} tile, props stand on wall tiles only`]);
    }
  });

  it('are refused off the map and of a kind that does not exist', () => {
    expect(trackProblems(withProp('wreck', 70, 3))).toEqual(['row 3, col 70: a wreck stands off the map, props stand on wall tiles only']);
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
  it('stands its legs on the first wall tile beyond each end of the start line', () => {
    const tiles = (p: { x: number; y: number }): [number, number] => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
    const [top, bottom] = parseTrack().arch.map(tiles);
    const [col, topY] = sure(top, 'the first leg'), [botCol, botY] = sure(bottom, 'the second leg');
    const ys = COMET_RING.rows.flatMap((row, y) => (row[col] === '=' ? [y] : []));
    expect(botCol).toBe(col);
    expect(ys.length).toBeGreaterThan(0);
    expect(tileAt(COMET_RING.rows, col, topY)).toBe('X');
    expect(tileAt(COMET_RING.rows, col, botY)).toBe('X');
    // The first wall: nothing between a leg and the line's end is a wall.
    for (let y = topY + 1; y < Math.min(...ys); y++) expect(tileAt(COMET_RING.rows, col, y)).not.toBe('X');
    for (let y = Math.max(...ys) + 1; y < botY; y++) expect(tileAt(COMET_RING.rows, col, y)).not.toBe('X');
    expect(topY).toBeLessThan(Math.min(...ys));
    expect(botY).toBeGreaterThan(Math.max(...ys));
  });
});
