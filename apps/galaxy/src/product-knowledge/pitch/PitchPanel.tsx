import { memberSession } from '../../data/member-session';
import { loadProduct } from '../../products/load';
import { ProductBody } from '../../products/ProductsScreen';
import { productViewOf } from '../../products/route-view';

// The Pitch section of the Knowledge home (PRD 2240 s5): the product's Pitch settings, read as the signed-in
// person so row-level security decides what the read returns, drawn by the form Settings › Products held
// (ProductPage.tsx) under the Knowledge frame's own header. In the demo, its in-memory product.

export async function PitchPanel({ id }: { id: string }) {
  const view = await productViewOf(await memberSession(), id, (session, product) => loadProduct(session.db, session.user, product));
  return <ProductBody view={view} framed={false} />;
}
