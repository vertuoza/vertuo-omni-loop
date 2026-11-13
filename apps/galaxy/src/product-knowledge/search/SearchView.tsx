import Link from 'next/link';
import { Section } from '../KnowledgeLists';
import { NONE, dayOf, excerpt, sectionHref } from '../knowledge-sections';
import {
  NO_SEARCH, PERIODS, concernOf, dailyOf, inPeriod, latestOf, lookFirstOf, noSearchIn, percent, statsOf, topHitOf,
  type Day, type Period, type SearchRow,
} from './search-stats';

// The Search section of the Knowledge home, drawn (PRD omni-loop-6 s3): over 7, 30 or 90 days the searches, the
// zero-hit rate, the words-fallback rate, opened@1 and opened@5; a daily chart; the questions to look at first
// (no hit, then fell back to words); the latest questions. With no row yet it says so in one line and draws no
// chart. Drawn from search-stats.ts; SearchSection.tsx reads the rows as the signed-in person.

export const TITLE = 'Search';
export const LEDE = 'What agents ask this product’s MCP server, and how well it answers. The opened rank is a proxy: an agent can open a wrong entry.';

const periodHref = (product: string, days: Period) => `${sectionHref(product, 'search')}?days=${days}`;

function Periods({ product, days }: { product: string; days: Period }) {
  return (
    <nav className="kn-filters" aria-label="Period">
      {PERIODS.map((p) => <Link key={p} href={periodHref(product, p)} aria-current={p === days ? 'true' : undefined}>Last {p} days</Link>)}
    </nav>
  );
}

function Numbers({ rows }: { rows: readonly SearchRow[] }) {
  const stats = statsOf(rows);
  const figures: [string, string, string, string?][] = [
    ['searches', 'Searches', String(stats.searches)],
    ['zero-hit', 'Zero-hit rate', percent(stats.zeroHit), 'searches that found nothing'],
    ['words', 'Words fallback', percent(stats.words), 'meaning search fell back to words'],
    ['opened-1', 'Opened@1', percent(stats.openedAt1), `of ${stats.opened} searches an entry was opened from`],
    ['opened-5', 'Opened@5', percent(stats.openedAt5), `of ${stats.opened} searches an entry was opened from`],
  ];
  return (
    <dl className="kn-figures">
      {figures.map(([key, label, value, note]) => (
        <div key={key} data-figure={key}>
          <dt>{label}</dt>
          <dd>{value}</dd>
          {note === undefined ? null : <dd className="ask-muted">{note}</dd>}
        </div>
      ))}
    </dl>
  );
}

const W = 600;
const H = 100;

/** The x of day `i` of `n`, at the middle of its column. */
const xOf = (i: number, n: number) => ((i + 0.5) * W) / n;

function Chart({ days }: { days: readonly Day[] }) {
  const most = Math.max(1, ...days.map((d) => d.searches));
  const n = days.length;
  const line = (pick: (d: Day) => number | null) => {
    const points = days.flatMap((d, i) => {
      const v = pick(d);
      return v === null ? [] : [`${xOf(i, n).toFixed(1)},${(H - v * H).toFixed(1)}`];
    });
    return points.join(' ');
  };
  const first = days[0]?.day ?? NONE;
  const last = days[n - 1]?.day ?? NONE;
  return (
    <figure className="kn-chart" data-chart="daily">
      <figcaption>Per day, {first} to {last}: bars are searches (most {most}), lines are the zero-hit and words-fallback rates (0 to 100%).</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Searches and rates per day, ${first} to ${last}`} preserveAspectRatio="none">
        {days.map((d, i) => {
          const h = (d.searches / most) * H;
          return <rect key={d.day} className="kn-bar" x={xOf(i, n) - (W / n) * 0.4} y={H - h} width={(W / n) * 0.8} height={h}><title>{`${d.day}: ${d.searches} ${d.searches === 1 ? 'search' : 'searches'}`}</title></rect>;
        })}
        <polyline className="kn-line" data-line="zero-hit" fill="none" points={line((d) => d.zeroHit)} />
        <polyline className="kn-line" data-line="words" fill="none" points={line((d) => d.words)} />
      </svg>
      <p className="kn-legend ask-muted"><span data-key="bar">Searches</span> <span data-key="zero-hit">Zero-hit rate</span> <span data-key="words">Words fallback</span></p>
    </figure>
  );
}

const heads = (why: boolean): string[] => ['Question', 'Mode', 'Total', 'Top hit', 'Opened rank', ...(why ? ['Why'] : []), 'Asked'];

function Questions({ title, id, rows, why }: { title: string; id: string; rows: readonly SearchRow[]; why: boolean }) {
  if (rows.length === 0) return null;
  return (
    <div data-region={id}>
      <h3>{title}</h3>
      <div className="kn-scroll">
        <table className="kn-table">
          <thead><tr>{heads(why).map((head) => <th key={head} scope="col">{head}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-search={row.id}>
                <td className="kn-text" title={row.query ?? ''}>{row.query === null ? NONE : excerpt(row.query, 60)}</td>
                <td>{row.mode ?? NONE}</td>
                <td>{row.total}</td>
                <td><code>{topHitOf(row)}</code></td>
                <td>{row.openedRank ?? NONE}</td>
                {why ? <td>{concernOf(row) ?? NONE}</td> : null}
                <td>{dayOf(row.askedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchView({ product, rows, days, now }: { product: string; rows: readonly SearchRow[]; days: Period; now: number }) {
  if (rows.length === 0) return <Section id="search-title" title={TITLE} lede={LEDE}><p className="products-empty">{NO_SEARCH}</p></Section>;
  const shown = inPeriod(rows, days, now);
  return (
    <Section id="search-title" title={TITLE} lede={LEDE}>
      <Periods product={product} days={days} />
      {shown.length === 0 ? <p className="products-empty">{noSearchIn(days)}</p> : (
        <>
          <Numbers rows={shown} />
          <Chart days={dailyOf(shown, days, now)} />
          <Questions title="To look at first" id="look-first" rows={lookFirstOf(shown)} why />
          <Questions title="Latest questions" id="latest" rows={latestOf(shown)} why={false} />
        </>
      )}
    </Section>
  );
}
