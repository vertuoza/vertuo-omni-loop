import type { Metadata } from 'next';
import '../../src/product-filter/product-filter.css';
import { fixListRoute } from '../../src/fixes/FixListRoute';
import { WORK_PATHS } from '../../src/dossier/page/work';
import { productListScope } from '../../src/product-filter/ProductFilter';

// /bugs (PRD 627): every bug fix of the signed-in person's workspaces (src/fixes/FixListRoute.tsx).
// PRD 1364 s12: filtered by product, `product=<id>` or `product=none` (src/product-filter/).

export const metadata: Metadata = { title: 'Bug Fixes · OMNI LOOP' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function BugFixesRoute({ searchParams }: Props) {
  return fixListRoute('bug', searchParams, productListScope(WORK_PATHS.bug));
}
