import type { Metadata } from 'next';
import '../../../src/products/products.css';
import { memberSession } from '../../../src/data/member-session';
import { LIVE_PRODUCTS_HOME, productsHomeViewOf } from '../../../src/products/products.controller';
import { ProductsHome } from '../../../src/products/ProductsHome';

// /app/products (PRD 1364 s8): Products in the sidebar, the workspace's products as cards with their
// repositories, PRD counts and what waits on the reader, and the repositories in no product below,
// under the app's shared top bar (app/app/layout.tsx). Rendered per request, as the signed-in person,
// so row-level security decides what the reads return. In development (or OMNI_LOOP_DEMO=1), the demo.

export const metadata: Metadata = { title: 'Products · OMNI LOOP' };

export default async function ProductsHomeRoute() {
  return <ProductsHome view={await productsHomeViewOf(await memberSession(), LIVE_PRODUCTS_HOME)} />;
}
