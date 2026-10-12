import type { Gantt, GanttRow } from '../gantt';

// A roadmap's Gantt (PRD 1162), drawn from its layout (../gantt.ts) as one SVG: the axis (wave columns,
// or dates), each wave's rows under its label, a bar per PRD coloured by its state (solid on real dates,
// dashed where projected), one lane per repository in a plan repository, the pull request a held PRD
// waits on under its bar, and an arrow from each blocker. Each row's name links to its PRD's page. The
// chart keeps its width and scrolls inside its own box on a narrow window.

const LABEL = 210;
const CHART = 630;
const WIDTH = LABEL + CHART + 10;
const AXIS = 22;
const WAVE = 20;
const LANE = 16;
const WAITS = 15;
const PAD = 6;

type Placed = { row: GanttRow; top: number; height: number; mid: number };

const laneCount = (row: GanttRow) => Math.max(1, row.lanes.length);
const heightOf = (row: GanttRow) => PAD * 2 + laneCount(row) * LANE + (row.waitsOn ? WAITS : 0);
const xOf = (at: number) => LABEL + at * CHART;
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function placed(gantt: Gantt): { rows: Placed[]; waves: Array<{ wave: number; y: number }>; height: number } {
  let y = AXIS;
  const rows: Placed[] = [];
  const waves: Array<{ wave: number; y: number }> = [];
  for (const group of gantt.groups) {
    waves.push({ wave: group.wave, y: y + WAVE - 6 });
    y += WAVE;
    for (const row of group.rows) {
      const height = heightOf(row);
      rows.push({ row, top: y, height, mid: y + PAD + (laneCount(row) * LANE) / 2 });
      y += height;
    }
  }
  return { rows, waves, height: y + PAD };
}

function Bars({ at }: { at: Placed }) {
  const { row, top } = at;
  const lanes = row.lanes.length > 0 ? row.lanes : [null];
  return (
    <>
      {lanes.map((lane, i) => {
        const y = top + PAD + i * LANE + 1;
        const first = row.segments[0];
        return (
          <g key={lane ?? 'bar'} className={`roadmap-bar is-${row.state}`}>
            {row.segments.map((s, j) => (
              <rect key={j} className={`roadmap-seg is-${s.kind}`} x={xOf(s.from)} y={y} width={Math.max(2, (s.to - s.from) * CHART)} height={LANE - 3} rx={3} />
            ))}
            {first ? (
              <text className="roadmap-bar-text" x={xOf(first.from) + 4} y={y + LANE - 6}>{lane === null ? row.stateLabel : `${lane} · ${row.stateLabel}`}</text>
            ) : null}
          </g>
        );
      })}
      {row.waitsOn ? (
        <text className="roadmap-waits" x={xOf(row.segments[0]?.from ?? 0) + 2} y={top + PAD + laneCount(row) * LANE + WAITS - 4}>
          {row.waitsOn.url ? <a href={row.waitsOn.url}>{clip(row.waitsOn.label, 90)}</a> : clip(row.waitsOn.label, 90)}
        </text>
      ) : null}
    </>
  );
}

export function GanttChart({ gantt }: { gantt: Gantt }) {
  if (gantt.rows.length === 0) return <p className="roadmap-muted">This roadmap has no PRD yet.</p>;
  const { rows, waves, height } = placed(gantt);
  const byId = new Map(rows.map((p) => [p.row.id, p]));
  return (
    <div className="roadmap-gantt-box">
      <svg className="roadmap-gantt" viewBox={`0 0 ${WIDTH} ${height}`} width={WIDTH} height={height} role="img" aria-label={`The roadmap's Gantt: ${gantt.rows.length} PRDs in ${gantt.groups.length} waves`}>
        <defs>
          <marker id="roadmap-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" className="roadmap-arrow-head" />
          </marker>
        </defs>
        {gantt.columns.map((c) => (
          <g key={`${c.label}@${c.at}`} className="roadmap-axis">
            <line x1={xOf(c.at)} x2={xOf(c.at)} y1={AXIS - 4} y2={height} />
            <text x={xOf(c.at) + 4} y={AXIS - 8}>{c.label}</text>
          </g>
        ))}
        {waves.map((w) => <text key={w.wave} className="roadmap-wave" x={4} y={w.y}>Wave {w.wave}</text>)}
        {rows.map((at) => (
          <g key={at.row.id} className="roadmap-row" data-row={at.row.id}>
            <a href={at.row.href}>
              <text className="roadmap-row-name" x={4} y={at.mid + 4}>{clip(`${at.row.id} ${at.row.title}`, 30)}<title>{`PRD ${at.row.prd}: ${at.row.title}`}</title></text>
            </a>
            <Bars at={at} />
          </g>
        ))}
        {gantt.arrows.map((a) => {
          const from = byId.get(a.from);
          const to = byId.get(a.to);
          if (!from || !to) return null;
          const [x1, x2] = [xOf(a.x1), xOf(a.x2)];
          const bend = Math.max(x1 + 6, x2 - 8);
          return <path key={`${a.from}-${a.to}`} className="roadmap-arrow" data-arrow={`${a.from}→${a.to}`} d={`M${x1},${from.mid} H${bend} V${to.mid} H${x2}`} markerEnd="url(#roadmap-arrow)" />;
        })}
      </svg>
    </div>
  );
}
