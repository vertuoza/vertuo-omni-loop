import type { Metadata } from 'next';
import '../../../../src/products/products.css';
import '../../../../src/product-home/product-home.css';
import { memberSession } from '../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../src/product-home/product-home.controller';
import { ProductHome } from '../../../../src/product-home/ProductHome';

// /app/products/<id> (PRD 1364 s9): the product home, opening on its Ledger, what waits on whom across the
// product's PRDs, under the app's shared top bar (app/app/layout.tsx). Rendered per request, as the
// signed-in person, so row-level security decides what the reads return. In development (or
// OMNI_LOOP_DEMO=1), the demo.

export const metadata: Metadata = { title: 'Product · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductHomeRoute({ params }: Props) {
  const { id } = await params;
  return <ProductHome tab="ledger" view={await productHomeViewOf(await memberSession(), id, LIVE_PRODUCT_HOME)} />;
}
