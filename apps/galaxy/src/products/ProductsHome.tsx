import Link from 'next/link';
import { repositoriesTabHref } from '../product-repositories/repositories-tab.contract';
import { PRODUCTS_HREF, productHomeHref } from './model';
import type { ProductCard, ProductsList } from './products.service';
import { SituationNotice, type Situation } from './ProductsScreen';

// Products in the sidebar, drawn (PRD 1364 s8): /app/products, the workspace's products as cards, as the
// concept's first screen draws them, each a link to its product home (s9): its name, its repositories
// (one another product links too marked shared), its PRD count and how many of its items wait on the
// person reading. Under the cards, the repositories in no product, plain, each with Add to a product,
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

function Card({ product }: { product: ProductCard }) {
  return (
    <li data-product={product.id}>
      <Link className="products-card" href={productHomeHref(product.id)}>
        <strong className="products-card-name">{product.name}</strong>
        {product.repositories.length === 0
          ? <span className="ask-muted products-card-repos">No repository yet</span>
          : (
            <span className="products-card-repos" aria-label={`${product.name}'s repositories`}>
              {product.repositories.map((r) => (
                <span key={r.repo} className="products-chip" data-shared={r.shared || undefined}>
                  {r.repo}{r.shared ? <em className="products-shared"> · shared</em> : null}
                </span>
              ))}
            </span>
          )}
        <span className="products-card-counts">
          <span className="products-count">{plural(product.prds, 'PRD', 'PRDs')}</span>
          <span className="products-count products-waiting" data-waiting={product.waiting > 0 || undefined}>{product.waiting} waiting on you</span>
        </span>
      </Link>
    </li>
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
  return (
    <div className="ask-col products">
      <section className="ask-card products-head" aria-labelledby="products-home-title">
        <h1 id="products-home-title">Products</h1>
        <p className="ask-muted">What your workspace builds, each with its repositories, its PRDs and what waits on you.</p>
      </section>
      <section className="products-list" aria-label="The workspace’s products">
        {list.products.length === 0
          ? <p className="products-empty">{NO_PRODUCTS_YET} <Link href={PRODUCTS_HREF}>Open Settings › Products →</Link></p>
          : <ul className="products-cards">{list.products.map((p) => <Card key={p.id} product={p} />)}</ul>}
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
