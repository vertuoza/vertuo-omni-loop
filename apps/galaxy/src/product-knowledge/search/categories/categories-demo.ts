import { demoSearches } from '../search-demo';
import type { CategorizedRow, GroupHead } from './categories-stats';

// The demo's Categories view (PRD omni-loop-7 s4): the Search section's fictional questions, each with a category
// and a group as the categorize job would set them, and one question not categorized yet. Fictional, as every
// demo is.

const PLACED: Readonly<Record<string, { category: string | null; group: string }>> = {
  'when is an invoice number reused': { category: 'invoicing', group: 'demo-group-numbers' },
  'what is a credit note': { category: 'invoicing', group: 'demo-group-credit' },
  'refund a customer': { category: 'invoicing', group: 'demo-group-credit' },
  'vat rate on services': { category: 'invoicing', group: 'demo-group-vat' },
  'delete an invoice': { category: 'invoicing', group: 'demo-group-delete' },
  'who owns the glossary': { category: 'other', group: 'demo-group-glossary' },
  'gdpr export of a customer': { category: null, group: 'demo-group-export' },
};

/** The demo product's searches with their category and group, newest first, and its groups; null for any other product. */
export function demoCategories(product: string, now: number): { rows: CategorizedRow[]; groups: GroupHead[] } | null {
  const searches = demoSearches(product, now);
  if (searches === null) return null;
  const rows = searches.map((row) => {
    const placed = PLACED[row.query ?? ''];
    return { ...row, category: placed?.category ?? null, groupId: placed?.group ?? null };
  });
  const groups = new Map<string, string>();
  for (const row of [...rows].reverse()) if (row.groupId !== null && !groups.has(row.groupId)) groups.set(row.groupId, row.query ?? '');
  return { rows, groups: [...groups].map(([id, question]) => ({ id, question })) };
}
