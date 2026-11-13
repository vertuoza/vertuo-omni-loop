import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgeReader } from '../../constituents/knowledge-reader';
import { PERIODS } from '../search-stats';
import { demoCategories } from './categories-demo';
import { categorizedSearchesOf, groupHeadsOf } from './categories.repository';
import type { CategorizedRow, GroupHead } from './categories-stats';

// The Categories view's read (PRD omni-loop-7 s4), as the signed-in person, so row-level security decides what it
// returns (BR-PRODUCT-63): the product's searches of the longest period with their category and group, and the
// product's groups with their first question. In the demo, its in-memory rows. Null when they cannot be read:
// the view says so and the page still opens.

const LONGEST = Math.max(...PERIODS);

export interface Categorized {
  rows: CategorizedRow[];
  groups: GroupHead[];
}

/** The searches since `since` and the groups, read as the signed-in person; null when either cannot be read. */
async function fromDatabase(db: Parameters<typeof groupHeadsOf>[0], product: string, since: string): Promise<Categorized | null> {
  const [rows, groups] = await Promise.all([categorizedSearchesOf(db, product, since), groupHeadsOf(db, product)]);
  return rows === null || groups === null ? null : { rows, groups };
}

/** The product's searches of the last 90 days and its groups, or null when they cannot be read. */
export async function loadCategorized(product: string, now: number): Promise<Categorized | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return demoCategories(product, now);
  if (reader.kind !== 'database') return null;
  const read = await fromDatabase(reader.db, product, new Date(now - LONGEST * 86_400_000).toISOString());
  if (read === null) log.error({ event: 'product-knowledge-search-categories', outcome: 'failed', message: 'the search log or its groups could not be read' });
  return read;
}
