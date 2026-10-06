import Link from 'next/link';
import { lookLabel, lookOf, PITCH_LOOKS, productHref, PRODUCTS_HREF, type PitchLook, type ProductRow, type ProductState } from './model';

// Settings › Products drawn (PRD 859 s1). The list: one row per product of the workspace's business,
// first first, its name and its pitch look, each a link to its own page. A product's page: its name and
// one section for now, Pitch look, a dropdown (Arcade poster by default, or Clean keynote) for whoever
// may edit Settings › Business, the look as text for anyone else. Drawn on the server first;
// ProductPage.tsx wires the dropdown.

const BUSINESS_HREF = '/app/settings/business';
export const LOOK_HINT = 'The look its pitches are drawn in: the slide, the cards and the videos.';
export const READ_ONLY = 'Only someone who may edit the business changes it.';
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

export interface ProductViewProps {
  state: ProductState;
  editable: boolean;
  onLook?: (look: PitchLook) => void;
}

export function ProductView({ state, editable, onLook = () => {} }: ProductViewProps) {
  const { product } = state;
  return (
    <div className="ask-col products">
      <section className="ask-card products-head" aria-labelledby="product-title">
        <Link className="products-back" href={PRODUCTS_HREF}>← Products</Link>
        <h1 id="product-title">{product.name}</h1>
      </section>
      <section className="ask-card products-section" aria-labelledby="pitch-look-title">
        <h2 id="pitch-look-title">Pitch look</h2>
        <p className="ask-muted">{LOOK_HINT}</p>
        {editable
          ? (
            <select
              className="products-look-select"
              aria-label={`Pitch look of ${product.name}`}
              value={product.look}
              onChange={(e) => { onLook(lookOf(e.currentTarget.value)); }}
              disabled={state.busy}
            >
              {PITCH_LOOKS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          )
          : (
            <>
              <p className="products-look-value"><strong>{lookLabel(product.look)}</strong></p>
              <p className="ask-muted">{READ_ONLY}</p>
            </>
          )}
        {state.refusal && <p className="products-refusal" role="alert">{state.refusal}</p>}
      </section>
    </div>
  );
}
