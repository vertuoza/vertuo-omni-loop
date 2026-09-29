import type { CSSProperties, ReactNode } from 'react';
import { CouldNotLoad } from '../Notes';
import { UNREADABLE, type Read } from '../part';
import type { FleetRank } from '../rankings/rank';
import { axisTicks, columnLabels, dayName } from './chart';
import { periodHref, type Query } from './links';
import type { BoardValue } from './load';
import { PERIODS, type Period } from './period';
import { SOLO, STAGES, type ChartDay, type PersonRow, type RepoRow, type Stage, type StageDay, type Stages } from './tally';
import './board.css';

// A board (PRD 572), drawn on the server, top to bottom: the period switch, the four tiles, the two
// per-day charts, the People table, the repositories involved and, where the page asks, the season's
// fleet ranking. Every dashboard page (Home, Fleet, Workspace) draws one for its scope. Each part draws
// itself from its own value, or says it could not load, alone. The charts are inline SVG with no
// script, hidden from a screen reader, which reads a list of the days and their counts instead.

const COUNT = new Intl.NumberFormat('en-US');
const n = (value: number) => COUNT.format(value);

export const STAGE_LABEL: Record<Stage, string> = { drafted: 'drafted', inProgress: 'in progress', shipped: 'shipped' };
const PERIOD_WORDS: Record<Period, string> = { '7d': 'last 7 days', '30d': 'last 30 days', season: 'this season' };

export interface BoardProps {
  board: BoardValue;
  /** The page's path and query: the period switch's links keep the rest of the query. */
  path: string;
  query: Query;
  /** The People table's heading: `People`, or `Your team` on Home. */
  peopleTitle?: string;
  /** A line under the People table (Home's link to Fleet, for a solo player). */
  peopleNote?: ReactNode;
  /** Whether to end with the season's fleet ranking (Workspace). */
  fleets?: boolean;
}

function PeriodSwitch({ period, path, query }: { period: Period; path: string; query: Query }) {
  return (
    <nav className="board-period" aria-label="Period">
      <ul>
        {PERIODS.map((p) => (
          <li key={p.id}>
            <a href={periodHref(path, query, p.id)} aria-current={p.id === period ? 'page' : undefined}>{p.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Tiles ────────────────────────────────────────────────────────────────

function Tile({ label, value, children }: { label: string; value: Read<unknown>; children: ReactNode }) {
  return (
    <li className="board-tile">
      <p className="board-tile-label">{label}</p>
      {value === UNREADABLE ? <CouldNotLoad /> : children}
    </li>
  );
}

const Figure = ({ value }: { value: number }) => <p className="board-tile-figure"><b>{n(value)}</b></p>;

function StagesFigure({ stages }: { stages: Stages }) {
  return (
    <p className="board-tile-figure board-tile-stages">
      {STAGES.map((s, i) => (
        <span key={s}>
          {i > 0 && <span className="board-dot" aria-hidden="true"> · </span>}
          <b>{n(stages[s])}</b> <span className="board-stage-word">{STAGE_LABEL[s]}</span>
        </span>
      ))}
    </p>
  );
}

function Tiles({ tiles }: { tiles: BoardValue['tiles'] }) {
  return (
    <ul className="board-tiles" aria-label="Totals">
      <Tile label="PRs merged" value={tiles.prs}>{tiles.prs !== UNREADABLE && <Figure value={tiles.prs} />}</Tile>
      <Tile label="PRDs" value={tiles.prds}>{tiles.prds !== UNREADABLE && <StagesFigure stages={tiles.prds} />}</Tile>
      <Tile label="Repositories" value={tiles.repositories}>{tiles.repositories !== UNREADABLE && <Figure value={tiles.repositories} />}</Tile>
      <Tile label="Questions answered" value={tiles.answered}>{tiles.answered !== UNREADABLE && <Figure value={tiles.answered} />}</Tile>
    </ul>
  );
}

// ── Charts ───────────────────────────────────────────────────────────────

/** The drawing's geometry: pixels down, percent across. */
const CHART = { top: 16, plot: 120, base: 136, height: 160, left: 7 } as const;
const pct = (v: number) => `${Number(v.toFixed(3))}%`;

type Column = { date: string; parts: { key: string; count: number; className: string }[]; said: string };

function Bars({ columns }: { columns: Column[] }) {
  const totals = columns.map((c) => c.parts.reduce((s, p) => s + p.count, 0));
  const ticks = axisTicks(Math.max(0, ...totals));
  const top = ticks.at(-1)!;
  const width = (100 - CHART.left) / columns.length;
  const bar = width * 0.6;
  const labels = columnLabels(columns.map((c) => c.date));
  const last = columns.length - 1;
  return (
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
      {columns.map((c, i) => {
        const x = CHART.left + width * i;
        let y = CHART.base;
        return (
          <g key={c.date} className="board-day">
            <title>{c.said}</title>
            <rect className="board-hit" x={pct(x)} y="0" width={pct(width)} height={CHART.height} />
            {c.parts.filter((p) => p.count > 0).map((p) => {
              const h = Math.max(2, (p.count / top) * CHART.plot);
              y -= h;
              return <rect key={p.key} className={p.className} x={pct(x + (width - bar) / 2)} y={Number(y.toFixed(2))} width={pct(bar)} height={Number(h.toFixed(2))} rx="2" />;
            })}
            {labels[i] && (
              <text className={i === last ? 'board-day-name is-today' : 'board-day-name'} x={pct(x + width / 2)} y={CHART.base + 18} textAnchor="middle">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const plural = (count: number, one: string, many: string) => `${n(count)} ${count === 1 ? one : many}`;
const dayWords = (date: string, today: boolean) => {
  const d = dayName(date);
  return `${d.weekday} ${d.date}${today ? ', today' : ''}`;
};

function ChartPart({ id, title, total, children }: { id: string; title: string; total: ReactNode; children: ReactNode }) {
  return (
    <section className="board-chart" aria-labelledby={id}>
      <header className="board-chart-head">
        <h2 id={id}>{title}</h2>
        {total}
      </header>
      {children}
    </section>
  );
}

function MergesChart({ days, period }: { days: Read<ChartDay[]>; period: Period }) {
  const title = `PRs merged per day · ${PERIOD_WORDS[period]}`;
  if (days === UNREADABLE) return <ChartPart id="board-merges" title={title} total={null}><CouldNotLoad /></ChartPart>;
  const last = days.length - 1;
  const said = (d: ChartDay, i: number) => `${dayWords(d.date, i === last)}: ${plural(d.count, 'PR', 'PRs')}`;
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <ChartPart id="board-merges" title={title} total={<p className="board-chart-total"><b>{n(total)}</b> total</p>}>
      <Bars columns={days.map((d, i) => ({ date: d.date, said: said(d, i), parts: [{ key: 'pr', count: d.count, className: 'board-bar' }] }))} />
      <ul className="ask-sr">{days.map((d, i) => <li key={d.date}>{said(d, i)}</li>)}</ul>
    </ChartPart>
  );
}

function PrdChart({ days, period }: { days: Read<StageDay[]>; period: Period }) {
  const title = `PRD events per day · ${PERIOD_WORDS[period]}`;
  if (days === UNREADABLE) return <ChartPart id="board-prds" title={title} total={null}><CouldNotLoad /></ChartPart>;
  const last = days.length - 1;
  const said = (d: StageDay, i: number) =>
    `${dayWords(d.date, i === last)}: ${STAGES.map((s) => `${n(d[s])} ${STAGE_LABEL[s]}`).join(', ')}`;
  const total = days.reduce((s, d) => s + d.drafted + d.inProgress + d.shipped, 0);
  return (
    <ChartPart id="board-prds" title={title} total={<p className="board-chart-total"><b>{n(total)}</b> total</p>}>
      <ul className="board-legend" aria-hidden="true">
        {STAGES.map((s) => <li key={s}><span className={`board-key board-bar-${s}`} />{STAGE_LABEL[s]}</li>)}
      </ul>
      <Bars columns={days.map((d, i) => ({
        date: d.date, said: said(d, i),
        parts: STAGES.map((s) => ({ key: s, count: d[s], className: `board-bar board-bar-${s}` })),
      }))} />
      <ul className="ask-sr">{days.map((d, i) => <li key={d.date}>{said(d, i)}</li>)}</ul>
    </ChartPart>
  );
}

// ── People ───────────────────────────────────────────────────────────────

const DASH = '–';
const cell = (value: number | null | typeof UNREADABLE) =>
  (value === null ? <span aria-label="no GitHub login">{DASH}</span> : value === UNREADABLE ? <span aria-label="could not load">?</span> : n(value));

function Fleet({ fleet }: { fleet: PersonRow['fleet'] }) {
  if (fleet === SOLO) return <span className="board-fleet is-solo">SOLO</span>;
  const style = fleet.color ? ({ '--dash-fleet': fleet.color } as CSSProperties) : undefined;
  return <span className="board-fleet" style={style}><span className="dash-fleet-pip" aria-hidden="true" />{fleet.label}</span>;
}

function PrdsCell({ prds }: { prds: PersonRow['prds'] }) {
  if (prds === null || prds === UNREADABLE) return cell(prds);
  return <span aria-label={STAGES.map((s) => `${prds[s]} ${STAGE_LABEL[s]}`).join(', ')}>{STAGES.map((s) => n(prds[s])).join(' · ')}</span>;
}

/** Which of the table's columns could not be read, for the line under it. */
function failed(rows: PersonRow[]): string[] {
  const first = rows[0];
  if (!first) return [];
  return [
    rows.some((r) => r.points === UNREADABLE) && 'points',
    rows.some((r) => r.prs === UNREADABLE) && 'PRs and PRDs',
    first.answered === UNREADABLE && 'questions',
  ].filter((x): x is string => Boolean(x));
}

function People({ people, title, note }: { people: Read<PersonRow[]>; title: string; note?: ReactNode }) {
  return (
    <section className="board-people" aria-labelledby="board-people">
      <h2 id="board-people">{title}</h2>
      {people === UNREADABLE ? <CouldNotLoad /> : (
        <>
          <div className="board-scroll">
            <table className="board-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Fleet</th>
                  <th scope="col" className="is-num">Points</th>
                  <th scope="col" className="is-num">PRs</th>
                  <th scope="col" className="is-num">PRDs <span className="board-th-note">drafted · in progress · shipped</span></th>
                  <th scope="col" className="is-num">Questions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} aria-current={p.you ? 'true' : undefined}>
                    <th scope="row" className="board-name">
                      {p.name}
                      {p.you && <span className="board-you"><span aria-hidden="true"> ◀</span><span className="ask-sr"> (you)</span></span>}
                    </th>
                    <td><Fleet fleet={p.fleet} /></td>
                    <td className="is-num">{cell(p.points)}</td>
                    <td className="is-num">{cell(p.prs)}</td>
                    <td className="is-num"><PrdsCell prds={p.prds} /></td>
                    <td className="is-num">{cell(p.answered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {failed(people).length > 0 && <p className="dash-note">{`Couldn’t load the ${failed(people).join(', ')}. Reload in a moment.`}</p>}
        </>
      )}
      {note}
    </section>
  );
}

// ── Repositories and fleets ──────────────────────────────────────────────

function Repositories({ repos }: { repos: Read<RepoRow[]> }) {
  return (
    <section className="board-repos" aria-labelledby="board-repos">
      <h2 id="board-repos">Repositories involved</h2>
      {repos === UNREADABLE ? <CouldNotLoad /> : repos.length === 0 ? <p className="dash-note">No merged PR or PRD event in this period</p> : (
        <table className="board-table">
          <thead>
            <tr><th scope="col">Repository</th><th scope="col" className="is-num">PRs merged</th><th scope="col" className="is-num">PRD events</th></tr>
          </thead>
          <tbody>
            {repos.map((r) => (
              <tr key={r.repo}><th scope="row" className="board-name">{r.repo}</th><td className="is-num">{n(r.prs)}</td><td className="is-num">{n(r.prdEvents)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function FleetRanking({ fleets, season }: { fleets: Read<FleetRank[]>; season: string }) {
  return (
    <section className="board-fleets" aria-labelledby="board-fleets">
      <h2 id="board-fleets">{`Fleets · ${season}`}</h2>
      {fleets === UNREADABLE ? <CouldNotLoad /> : fleets.length === 0 ? <p className="dash-note">This workspace has no fleet yet</p> : (
        <table className="board-table">
          <thead>
            <tr><th scope="col" className="is-num">Rank</th><th scope="col">Fleet</th><th scope="col" className="is-num">Points</th></tr>
          </thead>
          <tbody>
            {fleets.map((f) => (
              <tr key={f.name} aria-current={f.yours ? 'true' : undefined}>
                <td className="is-num">{f.rank}</td>
                <th scope="row" className="board-name">
                  {f.label}
                  {f.yours && <span className="board-you"><span aria-hidden="true"> ◀</span><span className="ask-sr"> (your fleet)</span></span>}
                </th>
                <td className="is-num">{n(f.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function Board({ board, path, query, peopleTitle = 'People', peopleNote, fleets = false }: BoardProps) {
  const period = board.window.period;
  return (
    <div className="board">
      <PeriodSwitch period={period} path={path} query={query} />
      <Tiles tiles={board.tiles} />
      <div className="board-charts">
        <MergesChart days={board.merges} period={period} />
        <PrdChart days={board.prdEvents} period={period} />
      </div>
      <People people={board.people} title={peopleTitle} note={peopleNote} />
      <Repositories repos={board.repositories} />
      {fleets && <FleetRanking fleets={board.fleets} season={board.season.name} />}
    </div>
  );
}
