import { spritePixels } from '@omni/design';
import { Fragment } from 'react';
import { pixelSvg } from '../../design/pixel-svg';
import { LINGO } from '../lingo';
import { Svg } from '../poster/Poster';
import './StrategyGuide.css';

// The strategy guide is the loop (PRD 971, s2; was a grid of levels in PRD 261 and 285): IDEA → PRD →
// INBOX → OUTBOX → SHIPPED → RETRO, with KNOWLEDGE flowing back from RETRO to the next IDEA, drawn
// after the docs' loop (docs/guide/diagrams/loop.svg) in HOME's arcade look. Each arrow is coloured by
// who moves the work on. The map is drawn twice from LOOP, wide and as one column (CSS shows one), and
// LOOP is listed once more for screen readers. OmniMan runs it in CSS; LOOP LINGO sits beside it.

/** OmniMan's pose on the loop. */
export const RUN_POSE = 'omni-run' as const;

/** Who moves the work on, in the legend's order. */
export const MOVERS = ['YOU', 'AGENTS', 'OMNI APP'] as const;
export type Mover = (typeof MOVERS)[number];

export interface LoopStage {
  level: string;
  name: string;
  line: string;
  /** Who moves the work along the arrow leaving this stage; RETRO's arrow is KNOWLEDGE, moved by no one. */
  mover: Mover | null;
}

/** The loop's six stages, in order. */
export const LOOP: readonly LoopStage[] = [
  { level: '1-1', name: 'IDEA', line: 'You talk an idea through with Claude. Nothing is written yet.', mover: 'YOU' },
  { level: '1-2', name: 'PRD', line: 'The idea becomes a brief and a before/after page. A person approves it before any code exists.', mover: 'YOU' },
  { level: '1-3', name: 'INBOX', line: 'Approved and ready to build.', mover: 'AGENTS' },
  { level: '1-4', name: 'OUTBOX', line: 'Agents build it in slices, test-first. Every decision they took without asking waits for your answer.', mover: 'YOU' },
  { level: '1-5', name: 'SHIPPED', line: 'A person reviews and merges the feature, never an agent.', mover: 'OMNI APP' },
  { level: '1-6', name: 'RETRO', line: 'How the delivery went, and what it taught.', mover: null },
];

/** The arrow that closes the loop: what RETRO taught, back to the next IDEA. */
export const KNOWLEDGE = {
  from: 'RETRO',
  to: 'IDEA',
  name: 'KNOWLEDGE',
  level: '★ BONUS',
  line: 'What you settled becomes the rules the next idea starts from.',
} as const;

const LEGEND: Record<Mover, string> = {
  YOU: 'a person decides, with Claude for the idea',
  AGENTS: 'coding agents build every slice',
  'OMNI APP': 'opens the retro on GitHub',
};

const MOVER_CLASS: Record<Mover, string> = { YOU: 'home-loop-you', AGENTS: 'home-loop-agents', 'OMNI APP': 'home-loop-app' };

/** A line cut into rows of at most `width` characters, at spaces. */
function wrap(line: string, width: number): string[] {
  const rows: string[] = [];
  for (const word of line.split(' ')) {
    const last = rows.at(-1);
    if (last !== undefined && last.length + 1 + word.length <= width) rows[rows.length - 1] = `${last} ${word}`;
    else rows.push(word);
  }
  return rows;
}

type Point = readonly [number, number];

interface Layout {
  id: string;
  className: string;
  width: number;
  height: number;
  box: { w: number; h: number; wrap: number };
  /** Each stage's box, top-left corner. */
  at: readonly Point[];
  /** Each arrow handing on, as a polyline, its head at the last point; the tag sits at `tag`. */
  arrows: readonly { path: readonly Point[]; tag: Point; anchor: 'start' | 'middle' | 'end' }[];
  knowledge: { path: readonly Point[]; text: Point; wrap: number; vertical?: true };
}

// The wide map, after loop.svg: IDEA → PRD → INBOX on top, down to OUTBOX, back along the bottom.
const WIDE: Layout = {
  id: 'home-loop-title-wide',
  className: 'home-loop-map home-loop-wide',
  width: 800,
  height: 460,
  box: { w: 200, h: 150, wrap: 26 },
  at: [[20, 20], [300, 20], [580, 20], [580, 290], [300, 290], [20, 290]],
  arrows: [
    { path: [[226, 95], [294, 95]], tag: [260, 85], anchor: 'middle' },
    { path: [[506, 95], [574, 95]], tag: [540, 85], anchor: 'middle' },
    { path: [[680, 176], [680, 284]], tag: [668, 234], anchor: 'end' },
    { path: [[574, 365], [506, 365]], tag: [540, 355], anchor: 'middle' },
    { path: [[294, 365], [226, 365]], tag: [260, 355], anchor: 'middle' },
  ],
  knowledge: { path: [[120, 284], [120, 176]], text: [136, 204], wrap: 34 },
};

// One column, for a phone: the six boxes top to bottom, KNOWLEDGE back up the left edge.
const TALL: Layout = {
  id: 'home-loop-title-tall',
  className: 'home-loop-map home-loop-tall',
  width: 360,
  height: 1100,
  box: { w: 290, h: 130, wrap: 38 },
  at: [0, 1, 2, 3, 4, 5].map((i) => [56, 20 + i * 170] as const),
  arrows: [0, 1, 2, 3, 4].map((i) => ({
    path: [[150, 156 + i * 170], [150, 184 + i * 170]] as const,
    tag: [162, 174 + i * 170] as const,
    anchor: 'start' as const,
  })),
  knowledge: { path: [[50, 935], [24, 935], [24, 85], [50, 85]], text: [24, 1034], wrap: 50 },
};

const points = (path: readonly Point[]) => path.map(([x, y]) => `${x},${y}`).join(' ');

/** The arrow's head: a triangle on the last point, pointing along the last leg. */
function head(path: readonly Point[]): string {
  const [x, y] = path.at(-1)!;
  const [px, py] = path.at(-2)!;
  const dx = Math.sign(x - px), dy = Math.sign(y - py);
  const back: Point = [x - dx * 9, y - dy * 9];
  return points([[x, y], [back[0] - dy * 5.5, back[1] + dx * 5.5], [back[0] + dy * 5.5, back[1] - dx * 5.5]]);
}

function LoopMap({ layout }: { layout: Layout }) {
  const { box, knowledge } = layout;
  return (
    <svg
      className={layout.className}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={layout.id}
      shapeRendering="crispEdges"
    >
      <title id={layout.id}>The Omni Loop</title>
      {LOOP.map((s, i) => {
        const [x, y] = layout.at[i]!;
        return (
          <g key={s.name} className="home-loop-box" data-stage={s.name}>
            <rect x={x + 4} y={y + 4} width={box.w} height={box.h} className="home-loop-shadow" />
            <rect x={x} y={y} width={box.w} height={box.h} className="home-loop-frame" />
            <text x={x + 14} y={y + 24} className="home-loop-lv">{s.level}</text>
            <text x={x + 14} y={y + 48} className="home-loop-name">{s.name}</text>
            <text x={x + 14} y={y + 72} className="home-loop-line">
              {wrap(s.line, box.wrap).map((row, r) => <tspan key={r} x={x + 14} dy={r === 0 ? 0 : 16}>{row}</tspan>)}
            </text>
          </g>
        );
      })}
      {LOOP.slice(0, -1).map((s, i) => {
        const arrow = layout.arrows[i]!;
        const cls = MOVER_CLASS[s.mover!];
        return (
          <g key={s.name} className={`home-loop-arrow ${cls}`} data-from={s.name} data-to={LOOP[i + 1]!.name}>
            <polyline points={points(arrow.path)} className="home-loop-line-path" />
            <polygon points={head(arrow.path)} className="home-loop-head" />
            <text x={arrow.tag[0]} y={arrow.tag[1]} textAnchor={arrow.anchor} className="home-loop-tag">{s.mover}</text>
          </g>
        );
      })}
      <g className="home-loop-arrow home-loop-knowledge" data-from={KNOWLEDGE.from} data-to={KNOWLEDGE.to}>
        <polyline points={points(knowledge.path)} className="home-loop-line-path" />
        <polygon points={head(knowledge.path)} className="home-loop-head" />
        <text x={knowledge.text[0]} y={knowledge.text[1]} className="home-loop-tag">
          <tspan className="home-glyph">★</tspan> BONUS: {KNOWLEDGE.name}
        </text>
        <text x={knowledge.text[0]} y={knowledge.text[1] + 20} className="home-loop-line">
          {wrap(KNOWLEDGE.line, knowledge.wrap).map((row, r) => <tspan key={r} x={knowledge.text[0]} dy={r === 0 ? 0 : 16}>{row}</tspan>)}
        </text>
      </g>
    </svg>
  );
}

const level = (lv: string) => (lv.startsWith('★') ? <><span className="home-glyph">★</span>{lv.slice(1)}</> : lv);

export function StrategyGuide() {
  return (
    <section className="home-spread" aria-labelledby="home-guide">
      <h2 id="home-guide" className="home-spread-head">Strategy guide: <em>the loop</em></h2>
      <div className="home-guide">
        <div className="home-loop">
          <div className="home-loop-board">
            <LoopMap layout={WIDE} />
            <LoopMap layout={TALL} />
            <div className="home-loop-runner" data-pose={RUN_POSE} aria-hidden="true">
              <Svg svg={pixelSvg(spritePixels(RUN_POSE, { frame: 0 }), { scale: 2, title: 'OmniMan running the loop' })} />
            </div>
          </div>
          <ol className="home-loop-list">
            {[...LOOP, KNOWLEDGE].map((s) => (
              <li key={s.name}>{level(s.level)} {s.name}: {s.line}</li>
            ))}
          </ol>
          <ul className="home-loop-legend" aria-label="Who moves the work on">
            {MOVERS.map((m) => (
              <li key={m} className={MOVER_CLASS[m]}><b>{m}</b>: {LEGEND[m]}</li>
            ))}
          </ul>
        </div>
        <aside className="home-lingo" aria-labelledby="home-lingo">
          <h3 id="home-lingo" className="home-lingo-head">Loop lingo</h3>
          <dl>
            {LINGO.map((e) => (
              <Fragment key={e.term}>
                <dt>{e.term}</dt>
                <dd>{e.gloss}</dd>
              </Fragment>
            ))}
          </dl>
        </aside>
      </div>
      <div className="home-walker">
        <span>OMNIMAN RUNS THE LOOP, ONE LEVEL AT A TIME</span>
      </div>
    </section>
  );
}
