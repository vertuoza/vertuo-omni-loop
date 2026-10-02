import type { ReactNode } from 'react';
import { FleetChip } from '../../people/FleetChip';
import { PersonChip } from '../../people/PersonChip';
import { STAGE_LABELS, STAGES, type StageId } from '../../stages/stage';
import { CouldNotLoad } from '../Notes';
import { UNREADABLE, type Read } from '../part';
import { fleetTagOf, type FleetRank } from '../rankings/rank';
import { axisTicks, columnLabels, dayName } from './chart';
import { medalSvg } from './medal';
import type { Query } from './links';
import type { BoardValue } from './load';
import type { Period } from './period';
import { PeriodSwitch } from './PeriodSwitch';
import { EVENTS, GROUPS, type ChartDay, type EventDay, type PersonRow, type PrdEvent, type RepoRow, type StageTally } from './tally';
import './board.css';

// A board (PRD 572), drawn on the server, top to bottom: the period switch, the four tiles, the two
// per-day charts, the People table, the repositories involved and, where the page asks, the season's
// fleet ranking. Every dashboard page (Home, Fleet, Workspace) draws one for its scope. Each part draws
// itself from its own value, or says it could not load, alone. The charts are inline SVG with no
// script, hidden from a screen reader, which reads a list of the days and their counts instead.
// PRD 587: the PRDs tile counts the scope's PRDs at each of the seven stages now, each count opening
// /prd at that stage; People's PRDs read open · building · shipped now; the per-day chart keeps the
// period's events, named opened · started · shipped so nobody reads it as where PRDs are.
// PRD 652: each People row's name starts with the member's face (PersonChip), and its fleet is a
// FleetChip, its mascot in its colour; the row's text is the same as before. Each fleet of the season's
// ranking is a FleetChip too. Issue 958: its top three wear a pixel medal (medal.ts) in a narrow rank column.

const COUNT = new Intl.NumberFormat('en-US');
const n = (value: number) => COUNT.format(value);

const EVENT_LABEL: Record<PrdEvent, string> = { opened: 'opened', started: 'started', shipped: 'shipped' };
const PERIOD_WORDS: Record<Period, string> = { '7d': 'last 7 days', '30d': 'last 30 days', season: 'this season' };

export interface BoardProps {
  board: BoardValue;
  /** The page's path and query: the period switch's links keep the rest of the query. */
  path: string;
  query: Query;
  /** The People table's heading: `People`, or on Home `Your fleet` and the viewer's fleet chip. */
  peopleTitle?: ReactNode;
  /** A line under the People table (Home's link to Fleet, for a solo player). */
  peopleNote?: ReactNode;
  /** Whether to end with the season's fleet ranking (Workspace). */
  fleets?: boolean;
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

function StagesFigure({ stages, links }: { stages: StageTally; links: Record<StageId, string> }) {
  return (
    <p className="board-tile-figure board-tile-stages">
      {STAGES.map((s, i) => (
        <span key={s}>
          {i > 0 && <span className="board-dot" aria-hidden="true"> · </span>}
          <a className="board-stage" href={links[s]}><b>{n(stages[s])}</b> <span className="board-stage-word">{STAGE_LABELS[s]}</span></a>
        </span>
      ))}
    </p>
  );
}

function Tiles({ tiles, links }: { tiles: BoardValue['tiles']; links: BoardValue['stageLinks'] }) {
  return (
    <ul className="board-tiles" aria-label="Totals">
      <Tile label="PRs merged" value={tiles.prs}>{tiles.prs !== UNREADABLE && <Figure value={tiles.prs} />}</Tile>
      <Tile label="PRDs" value={tiles.prds}>{tiles.prds !== UNREADABLE && <StagesFigure stages={tiles.prds} links={links} />}</Tile>
      <Tile label="Repositories" value={tiles.repositories}>{tiles.repositories !== UNREADABLE && <Figure value={tiles.repositories} />}</Tile>
      <Tile label="Questions answered" value={tiles.answered}>{tiles.answered !== UNREADABLE && <Figure value={tiles.answered} />}</Tile>
    </ul>
  );
}

// ── Charts ───────────────────────────────────────────────────────────────

/** The drawing's geometry: pixels down, percent across. */
const CHART = { top: 16, plot: 120, base: 136, height: 160, left: 7 } as const;
const pct = (v: number) => `${Number(v.toFixed(3))}%`;

export type Column = { date: string; parts: { key: string; count: number; className: string }[]; said: string };

export function Bars({ columns }: { columns: Column[] }) {
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

function PrdChart({ days, period }: { days: Read<EventDay[]>; period: Period }) {
  const title = `PRD events per day · ${PERIOD_WORDS[period]}`;
  if (days === UNREADABLE) return <ChartPart id="board-prds" title={title} total={null}><CouldNotLoad /></ChartPart>;
  const last = days.length - 1;
  const said = (d: EventDay, i: number) =>
    `${dayWords(d.date, i === last)}: ${EVENTS.map((e) => `${n(d[e])} ${EVENT_LABEL[e]}`).join(', ')}`;
  const total = days.reduce((s, d) => s + d.opened + d.started + d.shipped, 0);
  return (
    <ChartPart id="board-prds" title={title} total={<p className="board-chart-total"><b>{n(total)}</b> total</p>}>
      <ul className="board-legend" aria-hidden="true">
        {EVENTS.map((e) => <li key={e}><span className={`board-key board-bar-${e}`} />{EVENT_LABEL[e]}</li>)}
      </ul>
      <Bars columns={days.map((d, i) => ({
        date: d.date, said: said(d, i),
        parts: EVENTS.map((e) => ({ key: e, count: d[e], className: `board-bar board-bar-${e}` })),
      }))} />
      <ul className="ask-sr">{days.map((d, i) => <li key={d.date}>{said(d, i)}</li>)}</ul>
    </ChartPart>
  );
}

// ── People ───────────────────────────────────────────────────────────────

const DASH = '–';
const cell = (value: number | null | typeof UNREADABLE) =>
  (value === null ? <span aria-label="no GitHub login">{DASH}</span> : value === UNREADABLE ? <span aria-label="could not load">?</span> : n(value));

function PrdsCell({ prds }: { prds: PersonRow['prds'] }) {
  if (prds === UNREADABLE) return cell(prds);
  return <span aria-label={GROUPS.map((g) => `${prds[g]} ${g}`).join(', ')}>{GROUPS.map((g) => n(prds[g])).join(' · ')}</span>;
}

/** Which of the table's columns could not be read, for the line under it. */
function failed(rows: PersonRow[]): string[] {
  const first = rows[0];
  if (!first) return [];
  return [
    rows.some((r) => r.points === UNREADABLE) && 'points',
    rows.some((r) => r.prs === UNREADABLE) && 'PRs',
    first.prds === UNREADABLE && 'PRDs',
    first.answered === UNREADABLE && 'questions',
  ].filter((x): x is string => Boolean(x));
}

function People({ people, title, note }: { people: Read<PersonRow[]>; title: ReactNode; note?: ReactNode }) {
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
                  <th scope="col" className="is-num">PRDs <span className="board-th-note">{GROUPS.join(' · ')}</span></th>
                  <th scope="col" className="is-num">Questions</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} aria-current={p.you ? 'true' : undefined}>
                    <th scope="row" className="board-name">
                      <PersonChip person={p} />
                      {p.you && <span className="board-you"><span aria-hidden="true"> ◀</span><span className="ask-sr"> (you)</span></span>}
                    </th>
                    <td><FleetChip fleet={p.fleet} /></td>
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

/** A rank of the fleet ranking: a pixel medal for the top three, the number read aloud beside it. */
function Medal({ rank }: { rank: number }) {
  const svg = medalSvg(rank);
  if (!svg) return <>{rank}</>;
  return <><span className="board-medal" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} /><span className="ask-sr">{rank}</span></>;
}

function FleetRanking({ fleets, season }: { fleets: Read<FleetRank[]>; season: string }) {
  return (
    <section className="board-fleets" aria-labelledby="board-fleets">
      <h2 id="board-fleets">{`Fleets · ${season}`}</h2>
      {fleets === UNREADABLE ? <CouldNotLoad /> : fleets.length === 0 ? <p className="dash-note">This workspace has no fleet yet</p> : (
        <table className="board-table">
          <thead>
            <tr><th scope="col" className="board-rank">Rank</th><th scope="col">Fleet</th><th scope="col" className="is-num">Points</th></tr>
          </thead>
          <tbody>
            {fleets.map((f) => (
              <tr key={f.name} aria-current={f.yours ? 'true' : undefined}>
                <td className="board-rank"><Medal rank={f.rank} /></td>
                <th scope="row" className="board-name">
                  <FleetChip fleet={fleetTagOf(f)} />
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
      <Tiles tiles={board.tiles} links={board.stageLinks} />
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
