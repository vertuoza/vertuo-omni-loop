import { CouldNotLoad, LinkGithub } from '../Notes';
import { UNREADABLE, type PartProps } from '../part';
import { axisTicks, dayName, weekTotal, type ChartDay } from './chart';
import type { WeekValue } from './load';
import { at } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The week of merges' view (PRD 328): the pull requests you got into main on each of the last seven
// Brussels days, as a bar chart drawn on the server in inline SVG, with no chart library and no
// script. Seven columns, today last, each under its weekday; a y-axis of whole numbers from 0 to the
// highest bar; the week's total at the top right. The drawing is hidden from a screen reader, which
// reads in its place a list of the seven days and their counts. With no GitHub login, or when its
// read failed, the heading stays and one line says why, in place of the chart.
//
// The chart takes the column's width at any size without scaling its text: across, every position is
// a percentage of the drawing's width; down, and the bars' own width, are pixels. A bar is drawn in a
// box of its own width placed at its column's centre, then shifted back by half its width.

const TITLE = 'PRs merged into main · last 7 days';
const EMPTY = 'No PRs merged into main in the last 7 days';

/** The drawing's geometry, in pixels down (and the bar's width), in percent across. */
export const CHART = {
  /** Above the top grid line: room for its mark. */
  top: 16,
  /** The plot's height: the highest bar's. */
  plot: 120,
  /** The baseline, where every bar stands. */
  base: 136,
  /** The whole drawing, the weekdays under the baseline included. */
  height: 160,
  /** A bar's width: thin, however wide its column. */
  bar: 24,
  /** A bar's rounded end. */
  radius: 4,
  /** Across: the left part of the width the axis's marks sit in, then seven equal columns. */
  left: 7,
} as const;

const COLUMN = (100 - CHART.left) / 7;
const pct = (n: number) => `${Number(n.toFixed(3))}%`;
const centre = (i: number) => CHART.left + COLUMN * (i + 0.5);

/** A bar's height for a count, on an axis whose top mark is `top`: in proportion, and never too thin
 * to see when there is at least one. */
export function barHeight(count: number, top: number): number {
  if (count <= 0) return 0;
  return Math.max(2, (count / top) * CHART.plot);
}

/** A bar standing on the baseline: square at its foot, its top corners rounded. */
function barPath(height: number): string {
  const { base, bar } = CHART;
  const r = Math.min(CHART.radius, height, bar / 2);
  const y = Number((base - height).toFixed(2));
  return `M0 ${base}V${y + r}A${r} ${r} 0 0 1 ${r} ${y}H${bar - r}A${r} ${r} 0 0 1 ${bar} ${y + r}V${base}Z`;
}

/** A day and its count, in words: the list a screen reader reads, and each column's tooltip. */
function said(day: ChartDay, today: boolean): string {
  const name = dayName(day.date);
  return `${name.long} ${name.date}${today ? ', today' : ''}: ${day.count} ${day.count === 1 ? 'PR' : 'PRs'}`;
}

function Chart({ days }: { days: ChartDay[] }) {
  const ticks = axisTicks(Math.max(...days.map((d) => d.count)));
  const top = at(ticks, -1, "the axis's top mark");
  const last = days.length - 1;
  return (
    <>
      <svg className="dash-week-chart" width="100%" height={CHART.height} aria-hidden="true" focusable="false">
        {ticks.map((tick) => {
          const y = CHART.base - (tick / top) * CHART.plot;
          return (
            <g key={tick}>
              <line className="dash-week-grid" x1="0" x2="100%" y1={y + 0.5} y2={y + 0.5} />
              <text className="dash-week-tick" x="0" y={y - 4}>{tick}</text>
            </g>
          );
        })}
        {days.map((day, i) => (
          <g key={day.date} className="dash-week-day">
            <title>{said(day, i === last)}</title>
            <rect className="dash-week-hit" x={pct(CHART.left + COLUMN * i)} y="0" width={pct(COLUMN)} height={CHART.height} />
            {day.count > 0 && (
              <g transform={`translate(${-CHART.bar / 2} 0)`}>
                <svg x={pct(centre(i))} y="0" width={CHART.bar} height={CHART.height} overflow="visible">
                  <path className="dash-week-bar" d={barPath(barHeight(day.count, top))} />
                </svg>
              </g>
            )}
            <text className={i === last ? 'dash-week-name is-today' : 'dash-week-name'} x={pct(centre(i))} y={CHART.base + 18} textAnchor="middle">
              {dayName(day.date).short}
            </text>
          </g>
        ))}
      </svg>
      <ul className="ask-sr">
        {days.map((day, i) => <li key={day.date}>{said(day, i === last)}</li>)}
      </ul>
    </>
  );
}

export function Week({ part }: PartProps<WeekValue>) {
  const heading = <h2 id="dash-week-title" className="dash-week-title">{TITLE}</h2>;
  if (part === UNREADABLE || part.kind === 'no-github') {
    return (
      <section className="dash-week" aria-labelledby="dash-week-title">
        <header className="dash-week-head">{heading}</header>
        {part === UNREADABLE ? <CouldNotLoad /> : <LinkGithub />}
      </section>
    );
  }
  const total = weekTotal(part.days);
  return (
    <section className="dash-week" aria-labelledby="dash-week-title">
      <header className="dash-week-head">
        {heading}
        <p className="dash-week-total"><b>{total}</b> total</p>
      </header>
      {total === 0 && <p className="dash-note">{EMPTY}</p>}
      <Chart days={part.days} />
    </section>
  );
}
