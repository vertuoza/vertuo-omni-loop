import Link from 'next/link';
import { lookLabel, productHref, type ProductRow } from './model';

// Settings › Products drawn (PRD 859 s1). The list: one row per product of the workspace's business,
// first first, its name and its pitch look, each a link to its own page. A product's page, with its
// Pitch section (PRD 1108 s2), is ProductPage.tsx's.

const BUSINESS_HREF = '/app/settings/business';
export const NO_PRODUCTS = 'No products yet. Name what your business sells in Settings › Business.';

export function ProductsView({ products }: { products: readonly ProductRow[] }) {
  return (
    <div className="ask-col products">
      <section className="ask-card products-head" aria-labelledby="products-title">
        <h1 id="products-title">Products</h1>
        <p className="ask-muted">What your business sells, one page each. A product’s page holds how its pitches look.</p>
      </section>
      <section className="products-list" aria-label="The workspace’s products">
        {products.length === 0
          ? <p className="products-empty">{NO_PRODUCTS} <Link href={BUSINESS_HREF}>Open Business →</Link></p>
          : (
            <ul>
              {products.map((p) => (
                <li key={p.id} data-product={p.id}>
                  <Link className="products-row" href={productHref(p.id)}>
                    <strong>{p.name}</strong>
                    <span className="ask-muted products-look">{lookLabel(p.look)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
