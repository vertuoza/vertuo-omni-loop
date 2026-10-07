import type { Metadata } from 'next';
import '../../../../src/products/products.css';
import { memberSession } from '../../../../src/data/member-session';
import { loadProducts } from '../../../../src/products/load';
import { DEMO_PRODUCTS, ProductsScreen, type ProductsScreenView } from '../../../../src/products/ProductsScreen';

// /app/settings/products (PRD 859 s1): the workspace's products, the ones Settings › Business holds,
// under the app's shared top bar (app/app/layout.tsx), each a link to its own page. Rendered per
// request, as the signed-in person, so row-level security decides what the read returns. In
// development (or OMNI_LOOP_DEMO=1), the demo: two products, one in each look.

export const metadata: Metadata = { title: 'Products · OMNI LOOP' };

async function viewOf(): Promise<ProductsScreenView> {
  const session = await memberSession();
  if (session.kind === 'demo') return { kind: 'products', products: DEMO_PRODUCTS };
  if (session.kind !== 'signed-in') return session;
  const load = await loadProducts(session.db, session.user);
  if (load.kind !== 'products') return load;
  return { kind: 'products', products: load.products };
}

export default async function ProductsRoute() {
  return <ProductsScreen view={await viewOf()} />;
}
