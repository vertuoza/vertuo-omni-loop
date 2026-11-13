import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgeReader } from '../constituents/knowledge-reader';
import { demoSearches } from './search-demo';
import { searchesOf } from './search-log.repository';
import { PERIODS, type SearchRow } from './search-stats';

// The Search section's read (PRD omni-loop-6 s3), as the signed-in person, so row-level security decides what it
// returns (BR-PRODUCT-63): the product's searches of the longest period, from which every period is counted. In
// the demo, its in-memory rows. Null when they cannot be read: the section says so and the page still opens.

const LONGEST = Math.max(...PERIODS);

/** The product's searches of the last 90 days, newest first, or null when they cannot be read. */
export async function loadSearches(product: string, now: number): Promise<SearchRow[] | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return demoSearches(product, now);
  if (reader.kind !== 'database') return null;
  const rows = await searchesOf(reader.db, product, new Date(now - LONGEST * 86_400_000).toISOString());
  if (rows === null) log.error({ event: 'product-knowledge-search', outcome: 'failed', message: 'the search log could not be read' });
  return rows;
}
