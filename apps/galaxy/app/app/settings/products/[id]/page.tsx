import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import { memberSession } from '../../../../../src/data/member-session';
import { loadProduct } from '../../../../../src/products/load';
import { DEMO_PRODUCTS, ProductScreen, type ProductScreenView } from '../../../../../src/products/ProductsScreen';

// /app/settings/products/<id> (PRD 859 s1): one product's page, with one section for now, Pitch look:
// a dropdown for whoever may edit Settings › Business, stored through set_pitch_look() as the
// signed-in person; the look as text for anyone else. Rendered per request, so row-level security
// decides what the read returns. In development (or OMNI_LOOP_DEMO=1), the demo's product, whose
// change stays in the page.

export const metadata: Metadata = { title: 'Product · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

async function viewOf(id: string): Promise<ProductScreenView> {
  const session = await memberSession();
  if (session.kind === 'demo') {
    const product = DEMO_PRODUCTS.find((p) => p.id === id);
    return product ? { kind: 'product', source: { kind: 'demo' }, editable: true, product } : { kind: 'not-found' };
  }
  if (session.kind !== 'signed-in') return session;
  const load = await loadProduct(session.db, session.user, id);
  if (load.kind !== 'product') return load;
  return {
    kind: 'product',
    source: { kind: 'database', ...session.env, workspace: load.workspace.id },
    editable: load.editable,
    product: load.product,
  };
}

export default async function ProductRoute({ params }: Props) {
  const { id } = await params;
  return <ProductScreen view={await viewOf(id)} />;
}
