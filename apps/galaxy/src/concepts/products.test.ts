import { describe, expect, it } from 'vitest';
import { parseIssue } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Db } from '../dossier/page/source';
import { conceptCards } from './list';
import { conceptRow } from './list.fixture';
import { withProducts } from './products';

// The Concepts list's product filter (PRD 2011 s16): the cards kept are the ones the product filter keeps,
// each with its product's name; what the filter draws is handed on.

describe('the Concepts product filter', () => {
  const cards = conceptCards([conceptRow('a', parseIssue(1), '2026-10-06T09:00:00Z'), conceptRow('b', parseIssue(2), '2026-10-05T09:00:00Z')], new Map());

  it('hands the filter each card as a dossier of its workspace, keeps the cards it keeps and names their product', async () => {
    const asked: unknown[] = [];
    const scope = (_db: unknown, rows: { id: string; workspace_id: string; kind: 'concept' }[], query: unknown) => {
      asked.push(rows, query);
      return Promise.resolve({ rows: rows.slice(0, 1), above: 'above', labels: new Map([['a', { product: 'Mobile', item: null }]]) });
    };
    const out = await withProducts(scope, { product: 'none' })({} as Db, cards);
    expect(asked).toEqual([[{ id: 'a', workspace_id: 'w-1', kind: 'concept' }, { id: 'b', workspace_id: 'w-1', kind: 'concept' }], { product: 'none' }]);
    expect(out.above).toBe('above');
    expect(out.cards.map((c) => [c.id, c.product])).toEqual([['a', 'Mobile']]);
  });
});
