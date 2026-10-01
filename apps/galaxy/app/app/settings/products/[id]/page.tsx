import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import { memberSession } from '../../../../../src/data/member-session';
import { loadProduct } from '../../../../../src/products/load';
import { ProductScreen } from '../../../../../src/products/ProductsScreen';
import { productViewOf } from '../../../../../src/products/route-view';

// /app/settings/products/<id> (PRD 859 s1): one product's page, with one section for now, Pitch look:
// a dropdown for whoever may edit Settings › Business, stored through set_pitch_look() as the
// signed-in person; the look as text for anyone else. Rendered per request, so row-level security
// decides what the read returns. In development (or OMNI_LOOP_DEMO=1), the demo's product, whose
// change stays in the page.

export const metadata: Metadata = { title: 'Product · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductRoute({ params }: Props) {
  const { id } = await params;
  const view = await productViewOf(await memberSession(), id, (session, product) => loadProduct(session.db, session.user, product));
  return <ProductScreen view={view} />;
}
