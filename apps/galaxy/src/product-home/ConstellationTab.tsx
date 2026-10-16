import Link from 'next/link';
import { workPath } from '../dossier/page/work';
import { constellationOf, SKY, type Constellation, type Edge, type Filter, type Flight, type Star } from './constellation';
import type { ProductHome as Home } from './product-home.service';
import { productHomeTabHref } from './tabs';
import { productHomeHref } from '../products/model';

// The Constellation tab, drawn (PRD 2129 s1): /app/products/<id>/constellation, read only. The product's
// repositories as stars (a link each, its name and role, ◆ or ◇ for its phase 0, `DOCKED` when its phase 0
// is a pull request, a dashed halo when it is also in another product) and its declared `consumes` as edges,
// consumer to provider, in the fixed layout constellation.ts gives. With no repository, or no `consumes`,
// it says so and links to Repositories & approvers. Server-rendered, no script, no GitHub call. Every colour
// is a token of src/ask/theme-tokens.ts (constellation.css).
//
// Since s2, the Ledger's states on it: the filter row (`Everything`, then one chip per PRD in flight, a link
// setting `?prd=`), a ring per star in its state, each edge labelled with what crosses it now and carrying
// moving dots between two building stars, and the side card: *Now in <product>* with no star selected, the
// selected star's card (`?star=`) otherwise. A star's link keeps the PRD lit, a chip keeps the star selected.

export const NO_REPOSITORIES = 'No repository is in this product yet.';
export const NO_EDGES = 'No repository consumes another yet.';

/** The `as of` stamp: the time the request was rendered, in UTC. */
const stampOf = (now: Date) => now.toISOString().slice(11, 16);

const shortName = (repository: string) => repository.split('/').at(-1) ?? repository;

/** `· 2 PRDs in flight`, `· 1 PRD in flight`, or `· nothing in flight`. */
const inFlight = (k: number) => (k === 0 ? 'nothing in flight' : `${String(k)} PRD${k === 1 ? '' : 's'} in flight`);

const edgeLabel = (edge: Edge) => `${shortName(edge.consumer)} → ${shortName(edge.provider)} · ${inFlight(edge.crossing.length)}`;

/** The repositories a PRD touches, as one line: their names, or how many past two. */
const starsLine = (stars: readonly string[]) => (stars.length > 2 ? `${String(stars.length)} repositories` : stars.map(shortName).join(', '));

/** The tab's address with the filter and the selection given. */
function hrefOf(base: string, prd: string | null, star: string | null): string {
  const query = [
    ...(prd === null ? [] : [`prd=${encodeURIComponent(prd)}`]),
    ...(star === null ? [] : [`star=${encodeURIComponent(star).replace(/%2F/g, '/')}`]),
  ];
  return query.length === 0 ? base : `${base}?${query.join('&')}`;
}

type Drawn = Extract<Constellation, { kind: 'stars' | 'map' }>;

/** A point along the quadratic curve of `edge` from `from` to `to`, at its middle. */
const middleOf = (from: Star, to: Star, edge: Edge) => ({
  x: Math.round(0.25 * from.at.x + 0.5 * edge.bend.x + 0.25 * to.at.x),
  y: Math.round(0.25 * from.at.y + 0.5 * edge.bend.y + 0.25 * to.at.y),
});

function EdgeLine({ edge, stars }: { edge: Edge; stars: readonly Star[] }) {
  const from = stars.find((s) => s.repository === edge.consumer);
  const to = stars.find((s) => s.repository === edge.provider);
  if (from === undefined || to === undefined) return null;
  const d = `M ${String(from.at.x)} ${String(from.at.y)} Q ${String(edge.bend.x)} ${String(edge.bend.y)} ${String(to.at.x)} ${String(to.at.y)}`;
  const mid = middleOf(from, to, edge);
  return (
    <g data-faded={edge.lit ? undefined : true}>
      <path className="constellation-edge" data-consumer={edge.consumer} data-provider={edge.provider} d={d} />
      {edge.flowing ? <path className="constellation-flow" data-consumer={edge.consumer} pathLength={300} d={d} /> : null}
      <text className="constellation-edge-label" x={mid.x} y={mid.y} textAnchor="middle">{edgeLabel(edge)}</text>
    </g>
  );
}

/** A star's label: its repository, its role, and whether it is docked. */
const starLabel = (star: Star) => `${star.repository}, ${star.role ?? 'no role'}${star.docked ? ', docked' : ''}`;

/** What a star wears around its body: the also-in halo, and its ring unless it is quiet. */
function StarRings({ star }: { star: Star }) {
  const { x, y } = star.at;
  return (
    <>
      {star.alsoIn.length === 0 ? null : <circle className="constellation-halo" cx={x} cy={y} r={36} />}
      {star.state === 'quiet' ? null : <circle className="constellation-ring" data-state={star.state} cx={x} cy={y} r={31} />}
    </>
  );
}

/** A star's words: its phase 0 mark, its name, its role, and `DOCKED`. */
function StarWords({ star }: { star: Star }) {
  const { x, y } = star.at;
  return (
    <>
      <text className="constellation-mark" x={x} y={y} textAnchor="middle" dominantBaseline="central">{star.phase0 === 'server' ? '◆' : '◇'}</text>
      <text className="constellation-name" x={x} y={y + 50} textAnchor="middle">{shortName(star.repository)}</text>
      <text className="constellation-role" x={x} y={y + 66} textAnchor="middle">{star.role ?? 'no role'}</text>
      {star.docked ? <text className="constellation-docked" x={x} y={y - 38} textAnchor="middle">DOCKED</text> : null}
    </>
  );
}

function StarMark({ star, href }: { star: Star; href: string }) {
  return (
    <Link
      className="constellation-star"
      href={href}
      aria-label={starLabel(star)}
      data-star={star.repository}
      data-docked={star.docked || undefined}
      data-state={star.state}
      data-faded={star.lit ? undefined : true}
    >
      <circle className="constellation-hit" cx={star.at.x} cy={star.at.y} r={32} />
      <StarRings star={star} />
      <circle className="constellation-body" cx={star.at.x} cy={star.at.y} r={26} />
      <StarWords star={star} />
    </Link>
  );
}

function Chips({ map, base }: { map: Drawn; base: string }) {
  const star = map.selected?.repository ?? null;
  return (
    <nav className="constellation-chips" aria-label="Filter by PRD">
      <Link className="constellation-chip" href={hrefOf(base, null, star)} aria-current={map.lit === null ? true : undefined}>Everything</Link>
      {map.flights.map((f) => (
        <Link key={f.dossier} className="constellation-chip" href={hrefOf(base, f.dossier, star)} aria-current={map.lit === f.dossier ? true : undefined} data-state={f.state}>
          <b>{f.prd}</b> {f.title}
        </Link>
      ))}
    </nav>
  );
}

function Legend({ docked, alsoIn }: { docked: boolean; alsoIn: boolean }) {
  return (
    <ul className="constellation-legend" aria-label="Legend">
      <li><span className="constellation-key" data-key="building" /> building</li>
      <li><span className="constellation-key" data-key="on-you" /> waits on you</li>
      <li><span className="constellation-key" data-key="drifted" /> drifted</li>
      <li><span className="constellation-key" data-key="server">◆</span> phase 0 approved on the PRD page</li>
      <li><span className="constellation-key" data-key="pr">◇</span> phase 0 by pull request{docked ? ' · DOCKED' : ''}</li>
      {alsoIn ? <li><span className="constellation-key" data-key="also-in" /> also in another product</li> : null}
    </ul>
  );
}

function FlightLine({ flight, tail }: { flight: Flight; tail: string | null }) {
  return (
    <li>
      <span className="constellation-dot" data-state={flight.state} />
      <span><Link href={workPath('prd', flight.dossier)}><b>{flight.prd}</b> {flight.word}</Link>{tail === null ? null : ` · ${tail}`}</span>
    </li>
  );
}

function NowCard({ home, map }: { home: Home; map: Drawn }) {
  return (
    <>
      <h2>Now in {home.product.name}</h2>
      {map.now.length === 0
        ? <p>Nothing in flight touches its repositories.</p>
        : <ul>{map.now.map((f) => <FlightLine key={f.dossier} flight={f} tail={starsLine(f.stars)} />)}</ul>}
      <p>Read only. Links live on Repositories &amp; approvers.</p>
    </>
  );
}

function EdgeList({ edges, end }: { edges: readonly Edge[]; end: 'consumer' | 'provider' }) {
  if (edges.length === 0) return <>none</>;
  return <ul>{edges.map((e) => <li key={`${e.consumer}>${e.provider}`}>{shortName(e[end])} · {inFlight(e.crossing.length)}</li>)}</ul>;
}

function StarCard({ home, map, star }: { home: Home; map: Drawn; star: Star }) {
  const now = map.now.filter((f) => f.stars.includes(star.repository));
  return (
    <>
      <h2>{star.repository}</h2>
      <dl className="constellation-facts">
        <dt>role</dt><dd>{star.role ?? 'no role'}</dd>
        <dt>phase 0</dt><dd>{star.phase0 === 'server' ? '◆ approved on the PRD page' : '◇ docs-only phase-0 pull request'}</dd>
        <dt>also in</dt><dd>{star.alsoIn.length === 0 ? 'no other product' : star.alsoIn.join(', ')}</dd>
        <dt>consumes</dt><dd><EdgeList edges={map.edges.filter((e) => e.consumer === star.repository)} end="provider" /></dd>
        <dt>consumed by</dt><dd><EdgeList edges={map.edges.filter((e) => e.provider === star.repository)} end="consumer" /></dd>
        <dt>now</dt><dd>{now.length === 0 ? 'nothing in flight' : <ul>{now.map((f) => <FlightLine key={f.dossier} flight={f} tail={null} />)}</ul>}</dd>
      </dl>
      <p className="constellation-links">
        <Link href={productHomeHref(home.product.id)}>Ledger rows →</Link>
        <Link href={`${productHomeHref(home.product.id)}/repositories`}>Its links →</Link>
      </p>
      <p>Read only.</p>
    </>
  );
}

export function ConstellationTab({ home, now = new Date(), query = {} }: { home: Home; now?: Date; query?: Filter }) {
  const map = constellationOf(home, query);
  const repositoriesHref = `${productHomeHref(home.product.id)}/repositories`;
  if (map.kind === 'empty') {
    return (
      <section className="constellation" aria-label="Constellation">
        <p className="products-empty">{NO_REPOSITORIES}</p>
        <p><Link href={repositoriesHref}>Add one on Repositories &amp; approvers</Link></p>
      </section>
    );
  }
  const base = productHomeTabHref(home, 'constellation');
  const { stars, edges } = map;
  return (
    <section className="constellation" aria-label="Constellation">
      <div className="constellation-bar">
        <span className="products-chip">read only</span>
        <span className="ask-muted">as of {stampOf(now)} UTC</span>
      </div>
      <Chips map={map} base={base} />
      <div className="constellation-body-grid">
        <div className="constellation-main">
          <div className="constellation-frame">
            <svg
              className="constellation-sky"
              viewBox={`0 0 ${String(SKY.width)} ${String(SKY.height)}`}
              role="img"
              aria-label={`${home.product.name}: ${String(stars.length)} repositories, ${String(edges.length)} edges`}
            >
              {edges.map((e) => <EdgeLine key={`${e.consumer}>${e.provider}`} edge={e} stars={stars} />)}
              {stars.map((s) => <StarMark key={s.repository} star={s} href={hrefOf(base, map.lit, s.repository)} />)}
            </svg>
          </div>
          <Legend docked={stars.some((s) => s.docked)} alsoIn={stars.some((s) => s.alsoIn.length > 0)} />
          {map.kind === 'stars' ? (
            <p className="ask-muted">{NO_EDGES} <Link href={repositoriesHref}>Declare edges on Repositories &amp; approvers</Link></p>
          ) : null}
        </div>
        <aside className="constellation-card" aria-label={map.selected === null ? `Now in ${home.product.name}` : map.selected.repository}>
          {map.selected === null ? <NowCard home={home} map={map} /> : <StarCard home={home} map={map} star={map.selected} />}
        </aside>
      </div>
    </section>
  );
}
