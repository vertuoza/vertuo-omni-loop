import Link from 'next/link';
import { workPath } from '../dossier/page/work';
import { constellationOf, fieldOf, type ConsumesLine, type Constellation, type Filter, type Flight, type PlanLine, type Star, type StarSize } from './constellation';
import { ConstellationMotion } from './ConstellationMotion';
import type { PrChip, ProductHome as Home } from './product-home.service';
import { productHomeTabHref } from './tabs';
import { productHomeHref } from '../products/model';

// The Constellation tab, drawn (PRD 2129 s1, reworked by PRD 2174 s3): /app/products/<id>/constellation, read
// only. The product's repositories as stars (a link each, its name and role, ◆ or ◇ for its phase 0, `DOCKED`
// when its phase 0 is a pull request, a dashed halo when it is also in another product, a ring in its
// Ledger state) where constellation.ts places them, the plan lines its PRDs' targets draw (a link each,
// `?pair=`, moving dots when one of its PRDs is in flight) and its declared `consumes` lines, apart. The side
// card is *Now in <product>* with nothing selected, the star's card (`?star=`) or the line's (`?pair=`). There
// is no PRD filter. Server-rendered, no GitHub call (its one script only pauses the motion while the page is
// hidden). PRD 2174 s4 draws it as the tour's night sky: a gradient, a nebula and a seeded field of stars,
// glowing cores in three sizes, every colour a token of @omni/design (constellation.css), dark in every theme.

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

/** A core's radius by the star's weight: light, medium, heavy. */
const CORE: Readonly<Record<StarSize, number>> = { light: 11, medium: 16, heavy: 22 };
const coreOf = (star: Star) => CORE[star.size];

const round = (n: number) => Math.round(n * 10) / 10;

/** The curve from star `from` to star `to` (a gentle bend, always to the same side), or null when either is not
 * on the sky. With `stop`, it ends that far short of `to`: where an arrowhead sits clear of the core. */
function curveOf(stars: readonly Star[], from: string, to: string, stop = 0): string | null {
  const start = stars.find((s) => s.repository === from);
  const end = stars.find((s) => s.repository === to);
  if (start === undefined || end === undefined) return null;
  const dx = end.at.x - start.at.x;
  const dy = end.at.y - start.at.y;
  const length = Math.hypot(dx, dy) || 1;
  const cut = Math.min(stop, length / 2) / length;
  const bend = Math.min(40, length * 0.12);
  const cx = (start.at.x + end.at.x) / 2 - (dy / length) * bend;
  const cy = (start.at.y + end.at.y) / 2 + (dx / length) * bend;
  const ex = end.at.x - dx * cut;
  const ey = end.at.y - dy * cut;
  return `M ${String(round(start.at.x))} ${String(round(start.at.y))} Q ${String(round(cx))} ${String(round(cy))} ${String(round(ex))} ${String(round(ey))}`;
}

function PlanLink({ line, stars, base }: { line: PlanLine; stars: readonly Star[]; base: string }) {
  const d = curveOf(stars, line.a, line.b);
  if (d === null) return null;
  return (
    <Link href={pairHref(base, line)} className="constellation-plan" data-pair={`${line.a},${line.b}`} data-weight={line.weight} data-in-flight={line.inFlight || undefined}>
      <title>{lineTitle(line)}</title>
      <path className="constellation-hit-line" d={d} />
      <path className="constellation-edge" d={d} strokeWidth={Math.min(5, 1.5 + line.weight * 0.5)} />
      {line.inFlight ? <path className="constellation-flow" pathLength={300} d={d} /> : null}
    </Link>
  );
}

function ConsumesPath({ line, stars }: { line: ConsumesLine; stars: readonly Star[] }) {
  const provider = stars.find((s) => s.repository === line.provider);
  const d = curveOf(stars, line.consumer, line.provider, provider === undefined ? 0 : coreOf(provider) + 8);
  if (d === null) return null;
  return <path className="constellation-consumes" data-consumer={line.consumer} data-provider={line.provider} d={d} markerEnd="url(#constellation-arrow)" />;
}

/** The sky's layers: the gradient is the svg's own background, then the nebula, then the seeded field. */
function SkyBackdrop({ productId, width, height }: { productId: string; width: number; height: number }) {
  const field = fieldOf(productId, width, height);
  return (
    <>
      <defs>
        {(['plasma', 'cyan', 'magenta'] as const).map((hue) => (
          <radialGradient key={hue} id={`constellation-nebula-${hue}`}>
            <stop className="constellation-nebula-stop" data-hue={hue} offset="0" />
            <stop className="constellation-nebula-stop" data-hue={hue} offset="1" stopOpacity="0" />
          </radialGradient>
        ))}
        <radialGradient id="constellation-core">
          <stop className="constellation-core-stop" offset="0" data-end="in" />
          <stop className="constellation-core-stop" offset="1" data-end="out" />
        </radialGradient>
        <marker id="constellation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path className="constellation-arrow" d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <g className="constellation-nebula" aria-hidden="true">
        <ellipse cx={width * 0.22} cy={height * 0.3} rx={width * 0.3} ry={height * 0.38} fill="url(#constellation-nebula-plasma)" />
        <ellipse cx={width * 0.78} cy={height * 0.65} rx={width * 0.28} ry={height * 0.4} fill="url(#constellation-nebula-cyan)" />
        <ellipse cx={width * 0.55} cy={height * 0.1} rx={width * 0.22} ry={height * 0.25} fill="url(#constellation-nebula-magenta)" />
      </g>
      <g className="constellation-field" aria-hidden="true">
        {field.map((s) => (
          <circle
            key={`${String(s.x)},${String(s.y)}`}
            className={s.twinkle ? 'constellation-speck constellation-twinkle' : 'constellation-speck'}
            cx={s.x}
            cy={s.y}
            r={s.r}
            style={s.twinkle ? { animationDelay: `${String(s.delay)}s` } : undefined}
          />
        ))}
      </g>
    </>
  );
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
          <line className="constellation-tether-line" x1={x} y1={y + 50} x2={x} y2={y + 80 + 16 * i} />
          <a href={tetherHref(t)}>
            <text className="constellation-tether-label" x={x} y={y + 92 + 16 * i} textAnchor="middle">{tetherWords(t)}</text>
          </a>
        </g>
      ))}
    </>
  );
}

/** A star's label: its repository, its role when it has one, and whether it is docked. */
const starLabel = (star: Star) => `${star.repository}${star.role === null ? '' : `, ${star.role}`}${star.docked ? ', docked' : ''}`;

/** A star's title: its name, how many PRDs touch it, and its phase 0 mark. */
const starTitle = (star: Star) => `${shortName(star.repository)} · ${String(star.weight)} PRD${star.weight === 1 ? '' : 's'} · ${star.phase0 === 'server' ? '◆' : '◇'}`;

/** What a star wears around its core: the also-in halo, and its ring unless it is quiet. */
function StarRings({ star }: { star: Star }) {
  const { x, y } = star.at;
  const r = coreOf(star);
  return (
    <>
      {star.alsoIn.length === 0 ? null : <circle className="constellation-halo" cx={x} cy={y} r={r + 13} />}
      {star.state === 'quiet' ? null : <circle className="constellation-ring" data-state={star.state} cx={x} cy={y} r={r + 6} />}
    </>
  );
}

/** A star's words: its name, and its role only when it has one. */
function StarWords({ star }: { star: Star }) {
  const { x, y } = star.at;
  const r = coreOf(star);
  return (
    <>
      <text className="constellation-name" x={x} y={y + r + 18} textAnchor="middle">{shortName(star.repository)}</text>
      {star.role === null ? null : <text className="constellation-role" x={x} y={y + r + 34} textAnchor="middle">{star.role}</text>}
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
      <title>{starTitle(star)}</title>
      <circle className="constellation-hit" cx={star.at.x} cy={star.at.y} r={32} />
      <StarRings star={star} />
      <circle className="constellation-body" cx={star.at.x} cy={star.at.y} r={coreOf(star)} />
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
      <li><span className="constellation-key" data-key="pr">◇</span> phase 0 by pull request{docked ? ' · docked' : ''}</li>
      {alsoIn ? <li><span className="constellation-key" data-key="also-in" /> also in another product</li> : null}
      <li><span className="constellation-key" data-key="plan" /> a plan line: PRDs that changed both</li>
      <li><span className="constellation-key" data-key="consumes" /> a consumes line</li>
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
      <ConstellationMotion />
      <p className="constellation-lede">How the product looks now.</p>
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
              <SkyBackdrop productId={home.product.id} width={map.sky.width} height={map.sky.height} />
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
