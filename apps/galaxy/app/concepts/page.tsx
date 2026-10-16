import 'server-only';
import type { Metadata } from 'next';
import { ConceptListScreen } from '../../src/concepts/ConceptList';
import { conceptListState } from '../../src/concepts/list';
import { dossierSession } from '../../src/dossier/page/route-gate';
import { serverEnv } from '../../src/env';
import '../../src/product-filter/product-filter.css';
import { productListScope } from '../../src/product-filter/ProductFilter';
import { WORK_PATHS } from '../../src/dossier/page/work';
import { withProducts } from '../../src/concepts/products';

// /concepts (PRD 1272, s2): every concept of the signed-in person's workspaces, newest first
// (src/concepts/list.ts), read per request as the signed-in person, so row-level security decides.
// Without a database it plays the demo, which holds no concept: the page shows how to start one.

export const metadata: Metadata = { title: 'Concepts · OMNI LOOP' };

// PRD 2011 (s16): `product=<id>` or `product=none` narrows the cards, as /prd's filter does (src/product-filter/).
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConceptsRoute({ searchParams }: Props) {
  const query = await searchParams;
  const scope = withProducts(productListScope(WORK_PATHS.concept), query);
  return <ConceptListScreen state={await conceptListState(serverEnv().mode, dossierSession, undefined, scope)} />;
}
