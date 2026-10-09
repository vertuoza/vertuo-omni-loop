import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import { memberSession } from '../../../../../src/data/member-session';
import { loadProductPage } from '../../../../../src/products/load';
import { ProductScreen } from '../../../../../src/products/ProductsScreen';
import { productViewOf } from '../../../../../src/products/route-view';

// /app/settings/products/<id> (PRD 859 s1, PRD 1108 s2): one product's page, with its Pitch section:
// the controls for whoever may edit Settings › Business, saved through set_pitch_settings() and its
// files uploaded into the `pitch-assets` bucket as the signed-in person; every value as text for
// anyone else; and its Approvers list (PRD 1322 s1), edited by a workspace owner through
// product_approver_set() and product_approver_remove(), read by every member. Rendered per request, so row-level security decides what the read returns. In
// development (or OMNI_LOOP_DEMO=1), the demo's product, whose changes stay in the page.

export const metadata: Metadata = { title: 'Product · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductRoute({ params }: Props) {
  const { id } = await params;
  const view = await productViewOf(await memberSession(), id, (session, product) => loadProductPage(session.db, session.user, product));
  return <ProductScreen view={view} />;
}
