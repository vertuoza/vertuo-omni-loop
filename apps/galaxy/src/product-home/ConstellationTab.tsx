import Link from 'next/link';
import { workPath } from '../dossier/page/work';
import { constellationOf, type ConsumesLine, type Constellation, type Filter, type Flight, type PlanLine, type Star } from './constellation';
import type { PrChip, ProductHome as Home } from './product-home.service';
import { productHomeTabHref } from './tabs';
import { productHomeHref } from '../products/model';

// The Constellation tab, drawn (PRD 2129 s1, reworked by PRD 2174 s3): /app/products/<id>/constellation, read
// only. The product's repositories as stars (a link each, its name and role, ◆ or ◇ for its phase 0, `DOCKED`
// when its phase 0 is a pull request, a dashed halo when it is also in another product, a ring in its
// Ledger state) where constellation.ts places them, the plan lines its PRDs' targets draw (a link each,
// `?pair=`, moving dots when one of its PRDs is in flight) and its declared `consumes` lines, apart. The side
// card is *Now in <product>* with nothing selected, the star's card (`?star=`) or the line's (`?pair=`). There
// is no PRD filter. Server-rendered, no script, no GitHub call. Every colour is a token of
// src/ask/theme-tokens.ts (constellation.css); PRD 2174 s4 draws the night sky.

export const NO_REPOSITORIES = 'No repository is in this product yet.';
export const NO_EDGES = 'No PRD\'s plan names two repositories yet.';

/** The `as of` stamp: the time the request was rendered, in UTC. */
const stampOf = (now: Date) => now.toISOString().slice(11, 16);

const shortName = (repository: string) => repository.split('/').at(-1) ?? repository;

const lineTitle = (line: PlanLine) => `${shortName(line.a)} ↔ ${shortName(line.b)} · ${String(line.weight)} PRD${line.weight === 1 ? '' : 's'}`;

/** The repositories a PRD touches, as one line: their names, or how many past two. */
const starsLine = (stars: readonly string[]) => (stars.length > 2 ? `${String(stars.length)} repositories` : stars.map(shortName).join(', '));

/** A repository's name in an address: its slash kept. */
const nameIn = (repository: string) => encodeURIComponent(repository).replace(/%2F/g, '/');

const starHref = (base: string, star: Star) => `${base}?star=${nameIn(star.repository)}`;
const pairHref = (base: string, line: PlanLine) => `${base}?pair=${nameIn(line.a)},${nameIn(line.b)}`;

type Drawn = Extract<Constellation, { kind: 'stars' | 'map' }>;

/** The path from star `from` to star `to`, or null when either is not on the sky. */
function segmentOf(stars: readonly Star[], from: string, to: string): string | null {
  const start = stars.find((s) => s.repository === from)?.at;
  const end = stars.find((s) => s.repository === to)?.at;
  return start === undefined || end === undefined ? null : `M ${String(start.x)} ${String(start.y)} L ${String(end.x)} ${String(end.y)}`;
}

function PlanLink({ line, stars, base }: { line: PlanLine; stars: readonly Star[]; base: string }) {
  const d = segmentOf(stars, line.a, line.b);
  if (d === null) return null;
  return (
    <Link href={pairHref(base, line)} className="constellation-plan" data-pair={`${line.a},${line.b}`} data-weight={line.weight} data-in-flight={line.inFlight || undefined}>
      <title>{lineTitle(line)}</title>
      <path className="constellation-edge" d={d} strokeWidth={Math.min(5, 1.5 + line.weight * 0.5)} />
      {line.inFlight ? <path className="constellation-flow" pathLength={300} d={d} /> : null}
    </Link>
  );
}

function ConsumesPath({ line, stars }: { line: ConsumesLine; stars: readonly Star[] }) {
  const d = segmentOf(stars, line.consumer, line.provider);
  if (d === null) return null;
  return <path className="constellation-consumes" data-consumer={line.consumer} data-provider={line.provider} d={d} />;
}

/** A tether's words and its pull request on GitHub (PRD 2129 s3). */
const tetherWords = (t: PrChip) => `◇ ${shortName(t.repo)}#${String(t.pr)} · phase 0`;
const tetherHref = (t: PrChip) => `https://github.com/${t.repo}/pull/${String(t.pr)}`;

/** A docked star's dashed tether to each of its open phase-0 pull requests, drawn as a link below its role. */
function Tethers({ star }: { star: Star }) {
  const { x, y } = star.at;
  return (
    <>
      {star.tethers.map((t, i) => (
        <g key={`${t.repo}#${String(t.pr)}`} className="constellation-tether">
          <line className="constellation-tether-line" x1={x} y1={y + 26} x2={x} y2={y + 80 + 16 * i} />
          <a href={tetherHref(t)}>
            <text className="constellation-tether-label" x={x} y={y + 92 + 16 * i} textAnchor="middle">{tetherWords(t)}</text>
          </a>
        </g>
      ))}
    </>
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
      data-size={star.size}
    >
      <circle className="constellation-hit" cx={star.at.x} cy={star.at.y} r={32} />
      <StarRings star={star} />
      <circle className="constellation-body" cx={star.at.x} cy={star.at.y} r={26} />
      <StarWords star={star} />
    </Link>
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
      <li>a plan line: PRDs that changed both</li>
      <li>a consumes line</li>
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
      {map.moreNow === 0 ? null : <p><Link href={productHomeHref(home.product.id)}>+ {map.moreNow} more on the Ledger →</Link></p>}
      {map.stars.filter((s) => s.docked).map((s) => (
        <p key={s.repository} className="constellation-docked-line">
          {shortName(s.repository)} · docked:{' '}
          {s.tethers.length === 0 ? 'no open phase-0 pull request' : s.tethers.map((t, i) => (
            <span key={`${t.repo}#${String(t.pr)}`}>{i === 0 ? '' : ', '}<a href={tetherHref(t)}>{tetherWords(t)}</a></span>
          ))}
        </p>
      ))}
      <p>Read only. Links live on Repositories &amp; approvers.</p>
    </>
  );
}

function ConsumesList({ lines, end }: { lines: readonly ConsumesLine[]; end: 'consumer' | 'provider' }) {
  if (lines.length === 0) return <>none</>;
  return <ul>{lines.map((l) => <li key={`${l.consumer}>${l.provider}`}>{shortName(l[end])}</li>)}</ul>;
}

function StarCard({ home, map, star, base }: { home: Home; map: Drawn; star: Star; base: string }) {
  const now = map.now.filter((f) => f.stars.includes(star.repository));
  const lines = map.lines.filter((l) => l.a === star.repository || l.b === star.repository);
  return (
    <>
      <h2>{star.repository}</h2>
      <dl className="constellation-facts">
        <dt>role</dt><dd>{star.role ?? 'no role'}</dd>
        <dt>phase 0</dt><dd>{star.phase0 === 'server' ? '◆ approved on the PRD page' : '◇ docs-only phase-0 pull request'}</dd>
        <dt>also in</dt><dd>{star.alsoIn.length === 0 ? 'no other product' : star.alsoIn.join(', ')}</dd>
        <dt>PRDs</dt><dd>{star.weight}</dd>
        <dt>lines</dt>
        <dd>
          {lines.length === 0 ? 'none' : (
            <ul>{lines.map((l) => <li key={`${l.a}|${l.b}`}><Link href={pairHref(base, l)}>{lineTitle(l)}</Link></li>)}</ul>
          )}
        </dd>
        <dt>consumes</dt><dd><ConsumesList lines={map.consumes.filter((c) => c.consumer === star.repository)} end="provider" /></dd>
        <dt>consumed by</dt><dd><ConsumesList lines={map.consumes.filter((c) => c.provider === star.repository)} end="consumer" /></dd>
        <dt>now</dt><dd>{now.length === 0 ? 'nothing in flight' : <ul>{now.map((f) => <FlightLine key={f.dossier} flight={f} tail={null} />)}</ul>}</dd>
      </dl>
      {star.outside === 0 ? null : <p>{star.outside} target{star.outside === 1 ? '' : 's'} outside the product</p>}
      <p className="constellation-links">
        <Link href={productHomeHref(home.product.id)}>Ledger rows →</Link>
        <Link href={`${productHomeHref(home.product.id)}/repositories`}>Its links →</Link>
      </p>
      <p>Read only.</p>
    </>
  );
}

function LineCard({ line }: { line: PlanLine }) {
  return (
    <>
      <h2>{shortName(line.a)} ↔ {shortName(line.b)}</h2>
      <p>{line.a} and {line.b}: {line.weight} PRD{line.weight === 1 ? '' : 's'} changed both, newest first.</p>
      <ul>
        {line.prds.map((p) => (
          <li key={p.dossier}><Link href={workPath('prd', p.dossier)}><b>{p.prd}</b> {p.title}</Link>{p.inFlight ? ' · in flight' : ''}</li>
        ))}
      </ul>
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
  const { stars, lines, consumes } = map;
  const label = map.selected?.repository ?? (map.selectedLine === null ? `Now in ${home.product.name}` : lineTitle(map.selectedLine));
  return (
    <section className="constellation" aria-label="Constellation">
      <div className="constellation-bar">
        <span className="products-chip">read only</span>
        <span>{stars.length} repositories · {lines.length + consumes.length} lines</span>
        <span className="ask-muted">as of {stampOf(now)} UTC</span>
      </div>
      <div className="constellation-body-grid">
        <div className="constellation-main">
          <div className="constellation-frame">
            <svg
              className="constellation-sky"
              viewBox={`0 0 ${String(map.sky.width)} ${String(map.sky.height)}`}
              role="img"
              aria-label={`${home.product.name}: ${String(stars.length)} repositories, ${String(lines.length)} plan lines`}
            >
              {consumes.map((c) => <ConsumesPath key={`${c.consumer}>${c.provider}`} line={c} stars={stars} />)}
              {lines.map((l) => <PlanLink key={`${l.a}|${l.b}`} line={l} stars={stars} base={base} />)}
              {stars.map((s) => <StarMark key={s.repository} star={s} href={starHref(base, s)} />)}
              {stars.map((s) => <Tethers key={s.repository} star={s} />)}
            </svg>
          </div>
          <Legend docked={stars.some((s) => s.docked)} alsoIn={stars.some((s) => s.alsoIn.length > 0)} />
          {map.kind === 'stars' ? <p className="ask-muted">{NO_EDGES}</p> : null}
        </div>
        <aside className="constellation-card" aria-label={label}>
          {map.selected !== null
            ? <StarCard home={home} map={map} star={map.selected} base={base} />
            : map.selectedLine === null ? <NowCard home={home} map={map} /> : <LineCard line={map.selectedLine} />}
        </aside>
      </div>
    </section>
  );
}
