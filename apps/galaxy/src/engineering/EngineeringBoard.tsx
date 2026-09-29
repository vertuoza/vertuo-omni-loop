import type { ReactNode } from 'react';
import { heroLook, spritePixels } from '@omni/design';
import { pixelSvg } from '../design/pixel-svg';
import { CouldNotLoad } from '../dashboard/Notes';
import { UNREADABLE, type Read } from '../dashboard/part';
import { Bars, type Column } from '../dashboard/board/Board';
import { dayName } from '../dashboard/board/chart';
import { hrefWith, periodHref, type Query } from '../dashboard/board/links';
import { PERIODS, type Period } from '../dashboard/board/period';
import { faceOf, type Face } from './faces';
import { durationWords, SORTS, type EngineeringValue, type MergedDay, type Ranked, type SortKey } from './tally';
import '../dashboard/board/board.css';
import './engineering.css';

// The Engineering board (PRD 612 s3), drawn on the server, top to bottom: the period switch (the
// other boards' 7 days / 30 days / Season), the six tiles, the Omni Loop panel beside the chart of
// merged PRs per day, the per-repository table (each column heading a link that sorts by it, kept in
// the URL as `?sort=`), then the three top-5 people lists: ranked rows, each with a face (a player's
// game hero, else the GitHub picture) and a bar scaled to the list's first count (PRD 645 s1). Over tracked repositories only. With none,
// the empty state sends the person to Settings → Repositories. The chart is inline SVG with no
// script, hidden from a screen reader, which reads a list of the days instead. Each repository name in
// the table opens that repository's page (PRD 645 s2): the same board over it alone, with no table,
// and a period switch that stays on the page.

export const ENGINEERING_PATH = '/app/engineering';

/** A repository's page: `/app/engineering/<owner>/<repo>`, each part escaped. */
export const repositoryPath = (repo: string) => `${ENGINEERING_PATH}/${repo.split('/').map(encodeURIComponent).join('/')}`;
const REPOSITORIES_PATH = '/app/settings/repositories';

const COUNT = new Intl.NumberFormat('en-US');
const n = (value: number) => COUNT.format(value);
const PERIOD_WORDS: Record<Period, string> = { '7d': 'last 7 days', '30d': 'last 30 days', season: 'this season' };

function PeriodSwitch({ path, period, query }: { path: string; period: Period; query: Query }) {
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
    <section className="board-chart eng-omni" aria-labelledby="eng-omni">
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

function dayWords(d: MergedDay, today: boolean) {
  const name = dayName(d.date);
  return `${name.weekday} ${name.date}${today ? ', today' : ''}: ${n(d.signed + d.rest)} merged, ${n(d.signed)} signed by Omni-man`;
}

function PerDay({ days, period }: { days: MergedDay[]; period: Period }) {
  const last = days.length - 1;
  const columns: Column[] = days.map((d, i) => ({
    date: d.date,
    said: dayWords(d, i === last),
    parts: (['signed', 'rest'] as const).map((part) => ({ key: part, count: d[part], className: `board-bar eng-bar-${part}` })),
  }));
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
      <Bars columns={columns} />
      <ul className="ask-sr">{days.map((d, i) => <li key={d.date}>{dayWords(d, i === last)}</li>)}</ul>
    </section>
  );
}

// ── Per repository ───────────────────────────────────────────────────────

function Repositories({ value, period, query }: { value: Extract<EngineeringValue, { kind: 'board' }>; period: Period; query: Query }) {
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
                <th scope="row" className="board-name"><a href={hrefWith(repositoryPath(r.repo), {}, { period })}>{r.repo}</a></th>
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

/** A person's face: their hero as a pixel SVG, drawn on the server as the hero block draws it, or their GitHub picture. */
function Avatar({ login, face }: { login: string; face: Face | undefined }) {
  const f = face ?? faceOf(login, []);
  if (f.kind === 'github') return <img className="eng-face" src={f.src} alt="" width={28} height={28} loading="lazy" />;
  const look = heroLook(f.hero, f.color);
  const svg = pixelSvg(spritePixels(look.sprite, { tint: look.tint }), { scale: 1, title: '' });
  return <span className="eng-face" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** A bar's length: the count as a share of the list's first count, in percent. */
const barWidth = (count: number, leader: number) => `${Math.round((count / leader) * 1000) / 10}%`;

type ListKind = 'opened' | 'merged' | 'reviews';

function TopFive({ kind, title, people }: { kind: ListKind; title: string; people: Ranked[] }) {
  const id = `eng-top-${kind}`;
  const leader = people[0]?.count ?? 0;
  return (
    <section className="board-chart eng-top" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {people.length === 0 ? <p className="dash-note">Nobody in this period</p> : (
        <ol className="eng-rows">
          {people.map((p, i) => (
            <li key={p.login} className="eng-row">
              <span className="eng-rank">{i + 1}</span>
              <Avatar login={p.login} face={p.face} />
              <span className="eng-login">{p.login}</span>
              <b className="eng-count">{n(p.count)}</b>
              <span className={`eng-meter eng-meter-${kind}`} aria-hidden="true"><span style={{ width: barWidth(p.count, leader) }} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── The board ────────────────────────────────────────────────────────────

function EmptyEngineering() {
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
  /** On a repository's page, that repository: the period switch stays on the page, and there is no table. */
  repo?: string;
}

export function EngineeringBoard({ board, period, query, repo }: EngineeringBoardProps) {
  return (
    <div className="board eng">
      <PeriodSwitch path={repo ? repositoryPath(repo) : ENGINEERING_PATH} period={period} query={query} />
      {board === UNREADABLE ? <CouldNotLoad /> : board.kind === 'empty' ? <EmptyEngineering /> : (
        <>
          <Tiles tiles={board.tiles} />
          <div className="board-charts">
            <OmniLoop omni={board.omni} />
            <PerDay days={board.perDay} period={period} />
          </div>
          {repo ? null : <Repositories value={board} period={period} query={query} />}
          <div className="eng-people">
            <TopFive kind="opened" title="Most opened" people={board.people.opened} />
            <TopFive kind="merged" title="Most merged" people={board.people.merged} />
            <TopFive kind="reviews" title="Most reviews" people={board.people.reviews} />
          </div>
        </>
      )}
    </div>
  );
}
