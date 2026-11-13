import type { SearchRow } from './search-stats';

// The demo's Search section (PRD omni-loop-6 s3): a few weeks of fictional questions asked of the demo product's
// MCP server, counted back from `now` so the demo always has a recent week. Fictional, as every demo is.

const DEMO_PRODUCT = 'demo-product-1';
const DAY = 86_400_000;

const QUESTIONS: readonly { query: string; mode: 'meaning' | 'words'; hits: readonly string[]; opened: number | null }[] = [
  { query: 'when is an invoice number reused', mode: 'meaning', hits: ['L-INVOICING-1', 'credit-note', 'invoicing'], opened: 1 },
  { query: 'what is a credit note', mode: 'meaning', hits: ['credit-note', 'L-INVOICING-1'], opened: 1 },
  { query: 'refund a customer', mode: 'meaning', hits: ['credit-note', 'invoicing', 'L-INVOICING-1'], opened: 2 },
  { query: 'vat rate on services', mode: 'words', hits: ['L-INVOICING-1'], opened: null },
  { query: 'delete an invoice', mode: 'meaning', hits: [], opened: null },
  { query: 'who owns the glossary', mode: 'meaning', hits: ['invoicing', 'credit-note', 'L-INVOICING-1', 'x1', 'x2', 'x3'], opened: 6 },
  { query: 'gdpr export of a customer', mode: 'words', hits: [], opened: null },
];

/** The demo product's searches, newest first; null for any other product. */
export function demoSearches(product: string, now: number): SearchRow[] | null {
  if (product !== DEMO_PRODUCT) return null;
  return Array.from({ length: 24 }, (_, i) => {
    const q = QUESTIONS[i % QUESTIONS.length] as (typeof QUESTIONS)[number];
    return {
      id: `demo-search-${i}`, query: q.query, mode: q.mode, total: q.hits.length, hitIds: q.hits, openedRank: q.opened,
      askedAt: new Date(now - (i * 0.9 + 0.2) * DAY).toISOString(),
    };
  });
}
