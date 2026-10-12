import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import '../../../../../src/product-home/product-home.css';
import { memberSession } from '../../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../../src/product-home/product-home.controller';
import { ProductHome, productHomeTabs } from '../../../../../src/product-home/ProductHome';
import { LIVE_REPOSITORIES_TAB, repositoriesTabViewOf } from '../../../../../src/product-repositories/repositories-tab.controller';
import { RepositoriesTabScreen } from '../../../../../src/product-repositories/RepositoriesTab';

// /app/products/<id>/repositories (PRD 1364 s11): the product home's Repositories & approvers tab, the
// product's repositories, which a workspace owner adds, edits and removes, and under them its Approvers
// list, moved here from Settings › Products. Rendered per request, as the signed-in person, so row-level
// security decides what the reads return; the product home is read beside it for its tabs. `?add=` names
// the repository Add a repository starts on (Products' Add to a product). In development (or
// OMNI_LOOP_DEMO=1), the demo, whose changes stay in the page.

export const metadata: Metadata = { title: 'Product repositories · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductRepositoriesRoute({ params, searchParams }: Props) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, memberSession()]);
  const [home, view] = await Promise.all([
    productHomeViewOf(session, id, LIVE_PRODUCT_HOME),
    repositoriesTabViewOf(session, id, LIVE_REPOSITORIES_TAB),
  ]);
  if (home.kind !== 'home') return <ProductHome tab="ledger" view={home} />;
  const add = typeof query.add === 'string' ? query.add.toLowerCase() : null;
  return <RepositoriesTabScreen view={view} tabs={productHomeTabs(home.home)} add={add} />;
}
