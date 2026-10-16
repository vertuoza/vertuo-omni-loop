import Link from 'next/link';
import { constellationOf, SKY, type Edge, type Star } from './constellation';
import type { ProductHome as Home } from './product-home.service';
import { productHomeTabHref } from './tabs';
import { productHomeHref } from '../products/model';

// The Constellation tab, drawn (PRD 2129 s1): /app/products/<id>/constellation, read only. The product's
// repositories as stars (a link each, its name and role, ◆ or ◇ for its phase 0, `DOCKED` when its phase 0
// is a pull request, a dashed halo when it is also in another product) and its declared `consumes` as edges,
// consumer to provider, in the fixed layout constellation.ts gives. With no repository, or no `consumes`,
// it says so and links to Repositories & approvers. Server-rendered, no script, no GitHub call. Every colour
// is a token of src/ask/theme-tokens.ts (constellation.css).

export const NO_REPOSITORIES = 'No repository is in this product yet.';
export const NO_EDGES = 'No repository consumes another yet.';

/** The `as of` stamp: the time the request was rendered, in UTC. */
const stampOf = (now: Date) => now.toISOString().slice(11, 16);

const shortName = (repository: string) => repository.split('/').at(-1) ?? repository;

function EdgeLine({ edge, stars }: { edge: Edge; stars: readonly Star[] }) {
  const from = stars.find((s) => s.repository === edge.consumer);
  const to = stars.find((s) => s.repository === edge.provider);
  if (from === undefined || to === undefined) return null;
  return (
    <path
      className="constellation-edge"
      data-consumer={edge.consumer}
      data-provider={edge.provider}
      d={`M ${String(from.at.x)} ${String(from.at.y)} Q ${String(edge.bend.x)} ${String(edge.bend.y)} ${String(to.at.x)} ${String(to.at.y)}`}
    />
  );
}

function StarMark({ star, href }: { star: Star; href: string }) {
  const label = `${star.repository}, ${star.role ?? 'no role'}${star.docked ? ', docked' : ''}`;
  return (
    <Link className="constellation-star" href={`${href}?star=${star.repository}`} aria-label={label} data-star={star.repository} data-docked={star.docked || undefined}>
      <circle className="constellation-hit" cx={star.at.x} cy={star.at.y} r={32} />
      {star.alsoIn.length === 0 ? null : <circle className="constellation-halo" cx={star.at.x} cy={star.at.y} r={36} />}
      <circle className="constellation-body" cx={star.at.x} cy={star.at.y} r={26} />
      <text className="constellation-mark" x={star.at.x} y={star.at.y} textAnchor="middle" dominantBaseline="central">{star.phase0 === 'server' ? '◆' : '◇'}</text>
      <text className="constellation-name" x={star.at.x} y={star.at.y + 50} textAnchor="middle">{shortName(star.repository)}</text>
      <text className="constellation-role" x={star.at.x} y={star.at.y + 66} textAnchor="middle">{star.role ?? 'no role'}</text>
      {star.docked ? <text className="constellation-docked" x={star.at.x} y={star.at.y - 38} textAnchor="middle">DOCKED</text> : null}
    </Link>
  );
}

function Legend({ docked, alsoIn }: { docked: boolean; alsoIn: boolean }) {
  return (
    <ul className="constellation-legend" aria-label="Legend">
      <li><span className="constellation-key" data-key="server">◆</span> phase 0 approved on the PRD page</li>
      <li><span className="constellation-key" data-key="pr">◇</span> phase 0 by pull request{docked ? ' · DOCKED' : ''}</li>
      {alsoIn ? <li><span className="constellation-key" data-key="also-in" /> also in another product</li> : null}
    </ul>
  );
}

export function ConstellationTab({ home, now = new Date() }: { home: Home; now?: Date }) {
  const map = constellationOf(home.repositories);
  const repositoriesHref = `${productHomeHref(home.product.id)}/repositories`;
  if (map.kind === 'empty') {
    return (
      <section className="constellation" aria-label="Constellation">
        <p className="products-empty">{NO_REPOSITORIES}</p>
        <p><Link href={repositoriesHref}>Add one on Repositories &amp; approvers</Link></p>
      </section>
    );
  }
  const href = productHomeTabHref(home, 'constellation');
  const { stars, edges } = map;
  return (
    <section className="constellation" aria-label="Constellation">
      <div className="constellation-bar">
        <span className="products-chip">read only</span>
        <span className="ask-muted">as of {stampOf(now)} UTC</span>
      </div>
      <div className="constellation-frame">
        <svg
          className="constellation-sky"
          viewBox={`0 0 ${String(SKY.width)} ${String(SKY.height)}`}
          role="img"
          aria-label={`${home.product.name}: ${String(stars.length)} repositories, ${String(edges.length)} edges`}
        >
          {edges.map((e) => <EdgeLine key={`${e.consumer}>${e.provider}`} edge={e} stars={stars} />)}
          {stars.map((s) => <StarMark key={s.repository} star={s} href={href} />)}
        </svg>
      </div>
      <Legend docked={stars.some((s) => s.docked)} alsoIn={stars.some((s) => s.alsoIn.length > 0)} />
      {map.kind === 'stars' ? (
        <p className="ask-muted">{NO_EDGES} <Link href={repositoriesHref}>Declare edges on Repositories &amp; approvers</Link></p>
      ) : null}
    </section>
  );
}
