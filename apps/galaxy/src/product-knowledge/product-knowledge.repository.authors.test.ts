import { describe, expect, it } from 'vitest';
import { demoKnowledgeTab } from './KnowledgeTab';
import type { KnowledgeTab } from './product-knowledge.contract';
import { knowledgeRepository, type KnowledgeDb } from './product-knowledge.repository';

// Who added each Legal entry and glossary term, and when (PRD 2240 s1), as the Knowledge tab's storage
// reads it from product_knowledge_of(), on a fake client: `createdBy` ({user, login}, or null when nobody
// is known), `createdAt` and `updatedAt` on every entry, and the demo's tab in the same shape.

const client = (data: unknown) => ({
  rpc: () => Promise.resolve({ data, error: null }),
  from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
}) as unknown as KnowledgeDb;

const SECTION = { owner: null, delegate: null, decides: false, entries: [], proposals: [] };
const READ = { product: { id: 'p-1', name: 'W' }, canName: false, latestEventId: null, legal: SECTION, glossary: SECTION };
const owen = { user: 'u-owen', login: 'owen' };
const DATES = { createdAt: '2026-01-05T09:00:00+00:00', updatedAt: '2026-02-07T10:30:00+00:00' };
const LEGAL = { entry: 'l-1', id: 'L-INVOICING-1', code: 'INVOICING', number: 1, statement: 's', source: 'u', owner: owen, retiredAt: null, createdBy: owen, ...DATES };
const TERM = { entry: 'g-1', term: 'Quote', meaning: 'm', avoid: [], removedAt: null, createdBy: null, ...DATES };

describe('the tab\'s read, its authors and dates', () => {
  it('reads who added each entry and when, an entry whose author is gone naming nobody', async () => {
    const data = {
      ...READ,
      legal: { ...SECTION, entries: [LEGAL, { ...LEGAL, entry: 'l-2', createdBy: null }] },
      glossary: { ...SECTION, entries: [TERM, { ...TERM, entry: 'g-2', createdBy: owen }] },
    };
    const got = await knowledgeRepository(client(data)).read('w-1', 'p-1');
    expect(got).toEqual({ ok: true, read: data });
    expect(got.ok && got.read.legal.entries.map((e) => e.createdBy)).toEqual([owen, null]);
    expect(got.ok && got.read.glossary.entries.map((e) => [e.createdBy, e.createdAt, e.updatedAt]))
      .toEqual([[null, DATES.createdAt, DATES.updatedAt], [owen, DATES.createdAt, DATES.updatedAt]]);
  });

  it.each([
    ['a Legal entry', { ...READ, legal: { ...SECTION, entries: [{ ...LEGAL, createdAt: undefined }] } }],
    ['a term', { ...READ, glossary: { ...SECTION, entries: [{ ...TERM, updatedAt: undefined }] } }],
    ['an author out of shape', { ...READ, glossary: { ...SECTION, entries: [{ ...TERM, createdBy: 'owen' }] } }],
  ])('throws on %s without its dates or author as the read carries them', async (_what, data) => {
    await expect(knowledgeRepository(client(data)).read('w-1', 'p-1')).rejects.toThrow();
  });

  it('parses the demo\'s tab as it would a live read, every entry with an author and its dates', async () => {
    const { members, ...demo } = demoKnowledgeTab('demo-product-1') as KnowledgeTab;
    expect(members).toEqual([]);
    expect(await knowledgeRepository(client(demo)).read('w-1', 'p-1')).toEqual({ ok: true, read: demo });
    const entries = [...demo.legal.entries, ...demo.glossary.entries];
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.createdBy?.login).toBeTruthy();
      expect(Date.parse(e.createdAt)).toBeLessThanOrEqual(Date.parse(e.updatedAt));
    }
  });
});
