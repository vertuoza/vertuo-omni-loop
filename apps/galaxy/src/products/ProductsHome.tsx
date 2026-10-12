import Link from 'next/link';
import { repositoriesTabHref } from '../product-repositories/repositories-tab.contract';
import { PRODUCTS_HREF, productHomeHref } from './model';
import { firstToOpen, homeTotals, tileRepositories } from './products-home.model';
import type { ProductCard, ProductsList } from './products.service';
import { SituationNotice, type Situation } from './ProductsScreen';

// Products in the sidebar, drawn (PRD 1364 s8; drawn again by #1598, pick D): /app/products opens on four
// totals (products, repositories, PRDs, what waits on the person reading), then one tile per product, all
// of one height: its name and its Open link to its product home (s9), one line of its PRDs and
// repositories, its repositories by name (their shared owner said once, one another product links too
// marked shared, the rest counted), and what waits on the reader. The Open of the product waiting most
// leads in yellow. Under the tiles, the repositories in no product, plain, each with Add to a product,
// which opens a product home's Repositories & approvers tab with that repository picked (PRD 1364 s11):
// the only product's straight away, or one of the products, chosen from a list; with no product yet,
// Settings › Products, where one is made. Products are optional: a workspace with none says so and still
// lists its repositories.

/** The Repositories & approvers tab of `product`, Add a repository starting on `repo`. */
const addHref = (product: string, repo: string) => `${repositoriesTabHref(product)}?add=${encodeURIComponent(repo)}`;

export const NO_PRODUCTS_YET = 'No products yet. Products are optional: the loop works without one.';
export const ALL_IN_A_PRODUCT = 'Every repository is in a product.';

export type ProductsHomeView = Situation | { kind: 'products'; list: ProductsList };

/** The demo's products: one repository shared between them, one in no product. */
export const DEMO_PRODUCTS_LIST: ProductsList = {
  products: [
    { id: 'demo-product-1', name: 'Widgets', repositories: [{ repo: 'acme/api', shared: true }, { repo: 'acme/widgets', shared: false }], prds: 4, waiting: 1 },
    { id: 'demo-product-2', name: 'Legacy', repositories: [{ repo: 'acme/api', shared: true }], prds: 1, waiting: 0 },
  ],
  unlinked: ['acme/scripts'],
};

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

function TileRepositoryList({ product }: { product: ProductCard }) {
  const repos = tileRepositories(product.repositories);
  if (repos.shown.length === 0) return <span className="products-tile-repos" />;
  return (
    <p className="products-tile-repos" aria-label={`${product.name}'s repositories`}>
      {repos.owner === null ? null : <span className="products-owner">{repos.owner} / </span>}
      {repos.shown.map((r, i) => (
        <span key={r.repo}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <span className="products-chip" data-shared={r.shared || undefined} title={r.repo}>{r.name}</span>
          {r.shared ? <em className="products-shared"> shared</em> : null}
        </span>
      ))}
      {repos.more > 0 ? <span className="products-more"> +{repos.more}</span> : null}
    </p>
  );
}

/** What waits on the reader in a product, or, with no repository yet, the way to add one. */
function TileStatus({ product }: { product: ProductCard }) {
  if (product.repositories.length === 0) return <Link href={repositoriesTabHref(product.id)}>Add a repository</Link>;
  const waiting = product.waiting > 0;
  return <span className="products-waiting" data-waiting={waiting || undefined}>{waiting ? `${String(product.waiting)} waiting on you` : 'Nothing waiting'}</span>;
}

const tileLine = (product: ProductCard) =>
  `${plural(product.prds, 'PRD', 'PRDs')} · ${product.repositories.length === 0 ? 'No repository yet' : plural(product.repositories.length, 'repository', 'repositories')}`;

function Tile({ product, first }: { product: ProductCard; first: boolean }) {
  const home = productHomeHref(product.id);
  return (
    <li className="products-tile" data-waiting={product.waiting > 0 || undefined} data-product={product.id}>
      <Link className="products-tile-name" href={home}>{product.name}</Link>
      <span className="products-tile-line">{tileLine(product)}</span>
      <TileRepositoryList product={product} />
      <span className="products-tile-foot">
        <TileStatus product={product} />
        <Link className={first ? 'products-open products-open-first' : 'products-open'} href={home} aria-label={`Open ${product.name}`}>Open</Link>
      </span>
    </li>
  );
}

function Totals({ list }: { list: ProductsList }) {
  const totals = homeTotals(list);
  return (
    <dl className="products-sum" aria-label="Totals">
      <div><dt>products</dt><dd>{totals.products}</dd></div>
      <div><dt>repositories</dt><dd>{totals.repositories}</dd></div>
      <div><dt>PRDs</dt><dd>{totals.prds}</dd></div>
      <div data-waiting={totals.waiting > 0 || undefined}><dt>waiting on you</dt><dd>{totals.waiting}</dd></div>
    </dl>
  );
}

/** A repository's way into a product: the only one's tab, a list of them, or making one first. */
function AddToProduct({ repo, products }: { repo: string; products: readonly ProductCard[] }) {
  const [only, ...more] = products;
  if (!only) return <Link className="products-add" href={PRODUCTS_HREF}>Add to a product</Link>;
  if (more.length === 0) return <Link className="products-add" href={addHref(only.id, repo)}>Add to {only.name}</Link>;
  return (
    <details className="products-add">
      <summary>Add to a product</summary>
      <ul className="products-add-list" aria-label={`Products to add ${repo} to`}>
        {products.map((p) => <li key={p.id}><Link href={addHref(p.id, repo)}>{p.name}</Link></li>)}
      </ul>
    </details>
  );
}

function ProductsHomeList({ list }: { list: ProductsList }) {
  const leading = firstToOpen(list.products);
  return (
    <div className="ask-col products">
      <header className="products-head">
        <h1 id="products-home-title">Products</h1>
      </header>
      <section className="products-list" aria-labelledby="products-home-title">
        {list.products.length === 0
          ? <p className="products-empty">{NO_PRODUCTS_YET} <Link href={PRODUCTS_HREF}>Open Settings › Products →</Link></p>
          : (
            <>
              <Totals list={list} />
              <ul className="products-tiles">
                {list.products.map((p) => <Tile key={p.id} product={p} first={p.id === leading} />)}
              </ul>
            </>
          )}
      </section>
      <section className="products-list products-unlinked" aria-labelledby="products-unlinked-title">
        <h2 id="products-unlinked-title">Repositories in no product</h2>
        {list.unlinked.length === 0
          ? <p className="products-empty">{ALL_IN_A_PRODUCT}</p>
          : (
            <ul>
              {list.unlinked.map((repo) => (
                <li key={repo} className="products-repo" data-repo={repo}>
                  <span className="products-repo-name">{repo}</span>
                  <AddToProduct repo={repo} products={list.products} />
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

export function ProductsHome({ view }: { view: ProductsHomeView }) {
  return view.kind === 'products' ? <ProductsHomeList list={view.list} /> : <SituationNotice view={view} />;
}
