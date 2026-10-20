import { describe, expect, it } from 'vitest';
import type { KnowledgeRead } from './product-knowledge.contract';
import type { KnowledgeRepository } from './product-knowledge.repository';
import { knowledgeService } from './product-knowledge.service';

// Who added each Legal entry and glossary term, and when (PRD 2240 s1), as the Knowledge tab's rules hand
// them on, against a fake repository: the tab shows each entry's author and dates as read, and nobody for
// an entry whose author is gone.

const WORKSPACE = 'w-1';
const PRODUCT = 'p-1';
const owen = { user: 'u-owen', login: 'owen' };
const DATES = { createdAt: '2026-01-05T09:00:00+00:00', updatedAt: '2026-02-07T10:30:00+00:00' };
const LEGAL = { entry: 'l-1', id: 'L-VAT-1', code: 'VAT', number: 1, statement: 's', source: 'u', owner: null, retiredAt: null, createdBy: owen, ...DATES };
const TERM = { entry: 'g-1', term: 'Quote', meaning: 'm', avoid: [], removedAt: null, createdBy: null, ...DATES };
const section = { owner: null, delegate: null, decides: false, proposals: [] };
const READ: KnowledgeRead = {
  product: { id: PRODUCT, name: 'Widgets' }, canName: false, latestEventId: null,
  legal: { ...section, entries: [LEGAL] }, glossary: { ...section, entries: [TERM] },
};

const store = (read: KnowledgeRead): KnowledgeRepository => ({
  product: () => Promise.resolve({ id: PRODUCT, workspace_id: WORKSPACE, name: 'Widgets' }),
  read: () => Promise.resolve({ ok: true, read }),
  roster: () => Promise.resolve([]),
  apply: () => Promise.resolve({ ok: true }),
  propose: () => Promise.resolve({ ok: true }),
  decide: () => Promise.resolve({ ok: true }),
  name: () => Promise.resolve({ ok: true }),
});

describe('the tab, its authors and dates', () => {
  it('shows who added each entry and when, and nobody for an entry whose author is gone', async () => {
    const tab = await knowledgeService(store(READ)).tab(WORKSPACE, PRODUCT);
    expect(tab?.legal.entries).toEqual([LEGAL]);
    expect(tab?.glossary.entries).toEqual([TERM]);
    expect(tab?.glossary.entries[0]?.createdBy).toBeNull();
  });
});
