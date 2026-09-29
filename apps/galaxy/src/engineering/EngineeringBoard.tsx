import type { ReactNode } from 'react';
import { CouldNotLoad } from '../dashboard/Notes';
import { UNREADABLE, type Read } from '../dashboard/part';
import { axisTicks, columnLabels, dayName } from '../dashboard/board/chart';
import { hrefWith, periodHref, type Query } from '../dashboard/board/links';
import { PERIODS, type Period } from '../dashboard/board/period';
import { durationWords, SORTS, type EngineeringValue, type MergedDay, type Ranked, type SortKey } from './tally';
import '../dashboard/board/board.css';
import './engineering.css';

// The Engineering board (PRD 612 s3), drawn on the server, top to bottom: the period switch (the
// other boards' 7 days / 30 days / Season), the six tiles, the Omni Loop panel beside the chart of
// merged PRs per day, the per-repository table (each column heading a link that sorts by it, kept in
// the URL as `?sort=`), then the three top-5 people lists. Over tracked repositories only. With none,
// the empty state sends the person to Settings → Repositories. The chart is inline SVG with no
// script, hidden from a screen reader, which reads a list of the days instead.

export const ENGINEERING_PATH = '/app/engineering';
export const REPOSITORIES_PATH = '/app/settings/repositories';

const COUNT = new Intl.NumberFormat('en-US');
const n = (value: number) => COUNT.format(value);
const PERIOD_WORDS: Record<Period, string> = { '7d': 'last 7 days', '30d': 'last 30 days', season: 'this season' };

function PeriodSwitch({ period, query }: { period: Period; query: Query }) {
  return (
    <nav className="board-period" aria-label="Period">
      <ul>
        {PERIODS.map((p) => (
          <li key={p.id}>
            <a href={periodHref(ENGINEERING_PATH, query, p.id)} aria-current={p.id === period ? 'page' : undefined}>{p.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Tiles ────────────────────────────────────────────────────────────────

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="board-tile">
      <p className="board-tile-label">{label}</p>
      <p className="board-tile-figure">{children}</p>
    </li>
  );
}

function Tiles({ tiles }: { tiles: Extract<EngineeringValue, { kind: 'board' }>['tiles'] }) {
  return (
    <ul className="board-tiles eng-tiles" aria-label="Totals">
      <Tile label="PRs opened"><b>{n(tiles.opened)}</b></Tile>
      <Tile label="PRs merged"><b>{n(tiles.merged)}</b></Tile>
      <Tile label="Open now"><b>{n(tiles.openNow)}</b></Tile>
      <Tile label="Median time to merge"><b>{durationWords(tiles.medianToMerge)}</b></Tile>
      <Tile label="Commits"><b>{n(tiles.commits)}</b></Tile>
      <Tile label="Lines +/−"><b>{`+${n(tiles.additions)}`}</b>{' '}<b>{`−${n(tiles.deletions)}`}</b></Tile>
    </ul>
  );
}

// ── Omni Loop ────────────────────────────────────────────────────────────

function OmniLoop({ omni }: { omni: Extract<EngineeringValue, { kind: 'board' }>['omni'] }) {
  return (
    <section className="eng-omni" aria-labelledby="eng-omni">
      <h2 id="eng-omni">Omni Loop</h2>
      {omni.of === 0 ? <p className="dash-note">No PR merged in this period</p> : (
        <>
          <p className="eng-omni-share">
            <b>{`${n(omni.merged)} of ${n(omni.of)}`}</b> merged PRs signed by Omni-man <b>{`(${omni.share}%)`}</b>
          </p>
          <p className="eng-omni-times">
            Median time to merge: <b>{durationWords(omni.medianSigned)}</b> signed vs <b>{durationWords(omni.medianRest)}</b> the rest
          </p>
          <p className="eng-omni-lines">Lines signed: <b>{`+${n(omni.additions)}`}</b> <b>{`−${n(omni.deletions)}`}</b></p>
        </>
      )}
    </section>
  );
}

// ── Merged per day ───────────────────────────────────────────────────────

const CHART = { plot: 120, base: 136, height: 160, left: 7 } as const;
const pct = (v: number) => `${Number(v.toFixed(3))}%`;

function dayWords(d: MergedDay, today: boolean) {
  const name = dayName(d.date);
  return `${name.weekday} ${name.date}${today ? ', today' : ''}: ${n(d.signed + d.rest)} merged, ${n(d.signed)} signed by Omni-man`;
}

function PerDay({ days, period }: { days: MergedDay[]; period: Period }) {
  const ticks = axisTicks(Math.max(0, ...days.map((d) => d.signed + d.rest)));
  const top = ticks.at(-1)!;
  const width = (100 - CHART.left) / days.length;
  const bar = width * 0.6;
  const labels = columnLabels(days.map((d) => d.date));
  const last = days.length - 1;
  const total = days.reduce((s, d) => s + d.signed + d.rest, 0);
  return (
    <section className="board-chart" aria-labelledby="eng-per-day">
      <header className="board-chart-head">
        <h2 id="eng-per-day">{`PRs merged per day · ${PERIOD_WORDS[period]}`}</h2>
        <p className="board-chart-total"><b>{n(total)}</b> total</p>
      </header>
      <ul className="board-legend" aria-hidden="true">
        <li><span className="board-key eng-bar-signed" />signed by Omni-man</li>
        <li><span className="board-key eng-bar-rest" />the rest</li>
      </ul>
      <svg className="board-chart-svg" width="100%" height={CHART.height} aria-hidden="true" focusable="false">
        {ticks.map((tick) => {
          const y = CHART.base - (tick / top) * CHART.plot;
          return (
            <g key={tick}>
              <line className="board-grid" x1="0" x2="100%" y1={y + 0.5} y2={y + 0.5} />
              <text className="board-tick" x="0" y={y - 4}>{tick}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const x = CHART.left + width * i;
          let y = CHART.base;
          return (
            <g key={d.date} className="board-day">
              <title>{dayWords(d, i === last)}</title>
              {([['signed', d.signed], ['rest', d.rest]] as const).filter(([, count]) => count > 0).map(([part, count]) => {
                const h = Math.max(2, (count / top) * CHART.plot);
                y -= h;
                return <rect key={part} className={`board-bar eng-bar-${part}`} x={pct(x + (width - bar) / 2)} y={Number(y.toFixed(2))} width={pct(bar)} height={Number(h.toFixed(2))} rx="2" />;
              })}
              {labels[i] && (
                <text className={i === last ? 'board-day-name is-today' : 'board-day-name'} x={pct(x + width / 2)} y={CHART.base + 18} textAnchor="middle">{labels[i]}</text>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="ask-sr">{days.map((d, i) => <li key={d.date}>{dayWords(d, i === last)}</li>)}</ul>
    </section>
  );
}

// ── Per repository ───────────────────────────────────────────────────────

function Repositories({ value, query }: { value: Extract<EngineeringValue, { kind: 'board' }>; query: Query }) {
  const head = (id: SortKey, label: string) => (
    <th key={id} scope="col" className={id === 'repo' ? undefined : 'is-num'} aria-sort={id === value.sort ? (id === 'repo' || id === 'time' ? 'ascending' : 'descending') : undefined}>
      <a className="eng-sort" href={hrefWith(ENGINEERING_PATH, query, { sort: id })}>{label}</a>
    </th>
  );
  return (
    <section className="board-repos" aria-labelledby="eng-repos">
      <h2 id="eng-repos">Repositories</h2>
      <div className="board-scroll">
        <table className="board-table">
          <thead><tr>{SORTS.map((s) => head(s.id, s.label))}</tr></thead>
          <tbody>
            {value.repositories.map((r) => (
              <tr key={r.repo}>
                <th scope="row" className="board-name">{r.repo}</th>
                <td className="is-num">{n(r.opened)}</td>
                <td className="is-num">{n(r.merged)}</td>
                <td className="is-num">{n(r.openNow)}</td>
                <td className="is-num">{durationWords(r.medianToMerge)}</td>
                <td className="is-num">{n(r.commits)}</td>
                <td className="is-num">{n(r.lines)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── People ───────────────────────────────────────────────────────────────

function TopFive({ id, title, people }: { id: string; title: string; people: Ranked[] }) {
  return (
    <section className="eng-top" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {people.length === 0 ? <p className="dash-note">Nobody in this period</p> : (
        <ol>
          {people.map((p) => <li key={p.login}><span className="board-name">{p.login}</span> <b>{n(p.count)}</b></li>)}
        </ol>
      )}
    </section>
  );
}

// ── The board ────────────────────────────────────────────────────────────

export function EmptyEngineering() {
  return (
    <section className="eng-empty">
      <p>No tracked repositories yet → <a href={REPOSITORIES_PATH}>Settings → Repositories</a></p>
    </section>
  );
}

export interface EngineeringBoardProps {
  board: Read<EngineeringValue>;
  period: Period;
  query: Query;
}

export function EngineeringBoard({ board, period, query }: EngineeringBoardProps) {
  return (
    <div className="board eng">
      <PeriodSwitch period={period} query={query} />
      {board === UNREADABLE ? <CouldNotLoad /> : board.kind === 'empty' ? <EmptyEngineering /> : (
        <>
          <Tiles tiles={board.tiles} />
          <div className="board-charts">
            <OmniLoop omni={board.omni} />
            <PerDay days={board.perDay} period={period} />
          </div>
          <Repositories value={board} query={query} />
          <div className="eng-people">
            <TopFive id="eng-top-opened" title="Most opened" people={board.people.opened} />
            <TopFive id="eng-top-merged" title="Most merged" people={board.people.merged} />
            <TopFive id="eng-top-reviews" title="Most reviews" people={board.people.reviews} />
          </div>
        </>
      )}
    </div>
  );
}
