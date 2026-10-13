// The centre line's geometry (PRD 1829, slice 1), pure, in tiles: a closed line of waypoints, each corner a circular arc of its own
// radius tangent to its two legs; the road is every point within half the width of it, except the gaps declared on it; the pieces
// are straight lines of their own, added to the road; a span is a stretch of it. Nothing in the race reads this yet.

/** A waypoint of the line, in tiles, and the radius of the arc that rounds its corner (0 for a sharp corner). */
export type Waypoint = { x: number; y: number; radius: number };

/** A stretch of a line that is void across the road: from a distance along it, a length. */
export type Gap = { from: number; length: number };

/** A straight centre line of its own width and gaps, added to the road (a shortcut's spur, the walkway). Its ends are square. */
export type Piece = { from: { x: number; y: number }; to: { x: number; y: number }; width: number; gaps?: readonly Gap[] };

/** A stretch of the centre line, from a distance along it, a length; it wraps past the end of the closed line. */
export type Span = { start: number; length: number };

export type LineSpec = { points: readonly Waypoint[]; width: number; gaps?: readonly Gap[]; pieces?: readonly Piece[] };

type Straight = { kind: 'straight'; start: number; len: number; x: number; y: number; tx: number; ty: number };
type Arc = {
  kind: 'arc';
  start: number;
  len: number;
  cx: number;
  cy: number;
  r: number;
  a0: number; // the angle of the arc's start around its centre
  dir: 1 | -1; // 1 when the arc turns towards increasing angles
  corner: number; // the index of the waypoint it rounds
};
type Segment = Straight | Arc;

export type Line = {
  readonly width: number;
  readonly length: number;
  readonly gaps: readonly Gap[];
  readonly pieces: readonly Piece[];
  readonly segments: readonly Segment[];
};

/** Where a point sits against the line: the nearest point of the line, the distance along it, across it (positive on the clockwise side), and the tangent there. */
export type Located = { along: number; across: number; dist: number; x: number; y: number; tx: number; ty: number };

/** A sample of the racing line, or a gate's middle. */
export type Sample = { x: number; y: number; along: number; tx: number; ty: number };

/** The gate of a waypoint: the line normal to the centre line at the middle of its arc, as wide as the road, from `(ax, ay)` to `(bx, by)`. */
export type Gate = Sample & { index: number; ax: number; ay: number; bx: number; by: number };

/** The spacing of the racing line's samples, in tiles. */
const SAMPLE_STEP = 0.5;

const EPS = 1e-9;

/** An element the caller knows is there (the indexes are always wrapped into range). */
function nth<T>(xs: readonly T[], i: number): T {
  const x = xs[i];
  if (x === undefined) throw new Error(`no element at ${i}`);
  return x;
}

/** Compiles the waypoints into straights and arcs; refuses a corner whose arc does not fit its legs. */
export function buildLine(spec: LineSpec): Line {
  const pts = spec.points;
  const n = pts.length;
  if (n < 3) throw new Error('a line needs at least 3 waypoints');
  const unit = (from: Waypoint, to: Waypoint) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d < EPS) throw new Error('two waypoints on the same point');
    return { x: dx / d, y: dy / d, d };
  };
  // For each corner: the length of its tangent (how far from the waypoint the arc starts and ends), and its turn.
  const corners = pts.map((p, i) => {
    const before = unit(nth(pts, (i + n - 1) % n), p);
    const after = unit(p, nth(pts, (i + 1) % n));
    const cross = before.x * after.y - before.y * after.x;
    const dot = before.x * after.x + before.y * after.y;
    const turn = Math.atan2(cross, dot); // signed: positive turns towards increasing angles
    const tangent = p.radius > 0 ? p.radius * Math.tan(Math.abs(turn) / 2) : 0;
    return { p, before, after, turn, tangent };
  });
  corners.forEach((c, i) => {
    const leg = unit(c.p, nth(pts, (i + 1) % n)).d;
    if (c.tangent + nth(corners, (i + 1) % n).tangent > leg + EPS) throw new Error(`the arcs of waypoints ${i} and ${(i + 1) % n} overlap on their leg`);
  });

  const segments: Segment[] = [];
  let at = 0;
  // The line starts where the arc of corner 0 ends.
  for (let k = 0; k < n; k++) {
    const i = (k + n) % n;
    const c = nth(corners, i);
    const next = nth(corners, (i + 1) % n);
    const sx = c.p.x + c.after.x * c.tangent;
    const sy = c.p.y + c.after.y * c.tangent;
    const ex = next.p.x - next.before.x * next.tangent;
    const ey = next.p.y - next.before.y * next.tangent;
    const len = Math.hypot(ex - sx, ey - sy);
    if (len > EPS) {
      segments.push({ kind: 'straight', start: at, len, x: sx, y: sy, tx: c.after.x, ty: c.after.y });
      at += len;
    }
    if (next.tangent > 0) {
      const dir = next.turn > 0 ? 1 : -1;
      // The centre lies to the side the line turns towards, one radius from the arc's start.
      const ax = ex;
      const ay = ey;
      const nx = -next.before.y * dir;
      const ny = next.before.x * dir;
      const cx = ax + nx * next.p.radius;
      const cy = ay + ny * next.p.radius;
      const arcLen = Math.abs(next.turn) * next.p.radius;
      segments.push({ kind: 'arc', start: at, len: arcLen, cx, cy, r: next.p.radius, a0: Math.atan2(ay - cy, ax - cx), dir, corner: (i + 1) % n });
      at += arcLen;
    }
  }
  return { width: spec.width, length: at, gaps: spec.gaps ?? [], pieces: spec.pieces ?? [], segments };
}

export const lengthOf = (line: Line): number => line.length;

const wrap = (line: Line, along: number): number => ((along % line.length) + line.length) % line.length;

const sampleOf = (seg: Segment, local: number): Sample => {
  if (seg.kind === 'straight') return { x: seg.x + seg.tx * local, y: seg.y + seg.ty * local, along: seg.start + local, tx: seg.tx, ty: seg.ty };
  const a = seg.a0 + (seg.dir * local) / seg.r;
  return {
    x: seg.cx + seg.r * Math.cos(a),
    y: seg.cy + seg.r * Math.sin(a),
    along: seg.start + local,
    tx: -Math.sin(a) * seg.dir,
    ty: Math.cos(a) * seg.dir,
  };
};

/** The point of the line at a distance along it (wrapping around the closed line) and its tangent. */
export function pointAt(line: Line, along: number): Sample {
  const d = wrap(line, along);
  let seg = nth(line.segments, line.segments.length - 1);
  for (const s of line.segments) {
    if (d < s.start + s.len) {
      seg = s;
      break;
    }
  }
  return { ...sampleOf(seg, Math.min(Math.max(d - seg.start, 0), seg.len)), along: d };
}

/** The distance along a segment of its nearest point to (x, y), clamped to the segment. */
function localOf(seg: Segment, x: number, y: number): number {
  if (seg.kind === 'straight') return Math.min(Math.max((x - seg.x) * seg.tx + (y - seg.y) * seg.ty, 0), seg.len);
  let d = (Math.atan2(y - seg.cy, x - seg.cx) - seg.a0) * seg.dir; // the angle swept from the arc's start, towards its end
  d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sweep = seg.len / seg.r;
  if (d <= sweep) return d * seg.r;
  // Beyond the arc's end: the nearer of its two ends, by the angle left either way round.
  return d - sweep < 2 * Math.PI - d ? seg.len : 0;
}

/** Where (x, y) sits against the centre line: its nearest point, the distance along, across (positive on the clockwise side: to the right of travel on a y-down map) and the tangent. */
export function locate(line: Line, x: number, y: number): Located {
  let best: Located | null = null;
  for (const seg of line.segments) {
    const p = sampleOf(seg, localOf(seg, x, y));
    const dist = Math.hypot(x - p.x, y - p.y);
    if (best === null || dist < best.dist) {
      const dx = x - p.x;
      const dy = y - p.y;
      best = { along: p.along, across: p.tx * dy - p.ty * dx, dist, x: p.x, y: p.y, tx: p.tx, ty: p.ty };
    }
  }
  if (best === null) throw new Error('a line has segments');
  return best;
}

const inGap = (gaps: readonly Gap[], along: number): boolean => gaps.some((g) => along >= g.from && along < g.from + g.length);

const onPiece = (piece: Piece, x: number, y: number): boolean => {
  const dx = piece.to.x - piece.from.x;
  const dy = piece.to.y - piece.from.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const along = (x - piece.from.x) * ux + (y - piece.from.y) * uy;
  const across = (x - piece.from.x) * -uy + (y - piece.from.y) * ux;
  if (along < 0 || along > len || Math.abs(across) > piece.width / 2) return false;
  return !inGap(piece.gaps ?? [], along);
};

/** Whether (x, y), in tiles, is road: within half the width of the centre line and outside its gaps, or on a piece. */
export function isRoad(line: Line, x: number, y: number): boolean {
  const at = locate(line, x, y);
  if (at.dist <= line.width / 2 && !inGap(line.gaps, at.along)) return true;
  return line.pieces.some((p) => onPiece(p, x, y));
}

/** Whether a distance along the line lies in the span. */
export function inSpan(line: Line, span: Span, along: number): boolean {
  const d = wrap(line, along - span.start);
  return d <= span.length;
}

/** Whether (x, y) is road of the centre line within the span (the tunnel's road), and nothing beyond it. */
export function roadInSpan(line: Line, span: Span, x: number, y: number): boolean {
  const at = locate(line, x, y);
  return at.dist <= line.width / 2 && inSpan(line, span, at.along) && !inGap(line.gaps, at.along);
}

/** The racing line: the centre line sampled every half tile, arcs included. */
export function racingLine(line: Line): Sample[] {
  const count = Math.floor(line.length / SAMPLE_STEP + EPS) + 1;
  return Array.from({ length: count }, (_, i) => pointAt(line, i * SAMPLE_STEP));
}

/** The gate of every rounded waypoint: normal to the centre line at the middle of its arc, as wide as the road. A sharp corner has none. */
export function gatesOf(line: Line): Gate[] {
  const half = line.width / 2;
  const gates = line.segments.flatMap((seg) => {
    if (seg.kind !== 'arc') return [];
    const m = sampleOf(seg, seg.len / 2);
    const nx = -m.ty;
    const ny = m.tx;
    return [{ ...m, index: seg.corner, ax: m.x - nx * half, ay: m.y - ny * half, bx: m.x + nx * half, by: m.y + ny * half }];
  });
  return gates.sort((p, q) => p.index - q.index);
}
