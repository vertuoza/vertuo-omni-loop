import { describe, expect, it } from 'vitest';
import { demoKnowledgeTab } from './KnowledgeTab';
import type { ChangeWrite, KnowledgeTab } from './product-knowledge.contract';
import { knowledgeRepository, type KnowledgeDb } from './product-knowledge.repository';

// The Knowledge tab's storage (PRD 1795 s2), on a fake client: which database function each change calls,
// with which arguments, and how a refusal or an answer out of shape is told.

type Call = { fn: string; args: Record<string, unknown> };

function db(answer: { data?: unknown; error?: { code?: string; message: string } | null } = {}) {
  const calls: Call[] = [];
  const client = {
    rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }); },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: answer.data ?? [], error: answer.error ?? null }) }) }),
  } as unknown as KnowledgeDb;
  return { client, calls };
}

const change = (c: Omit<ChangeWrite, 'op' | 'fields'> & { fields?: ChangeWrite['fields'] }): ChangeWrite => ({ op: 'change', fields: {}, ...c });
const ENTRY = '33333333-3333-4333-8333-333333333331';

describe('a direct change', () => {
  it.each([
    [change({ kind: 'legal', action: 'add', fields: { code: 'INV', statement: 's', source: 'u' } }), 'product_legal_add', { p_code: 'INV', p_statement: 's', p_source: 'u' }],
    [change({ kind: 'legal', action: 'edit', entry: ENTRY, fields: { statement: 's' } }), 'product_legal_edit', { p_entry: ENTRY, p_statement: 's' }],
    [change({ kind: 'legal', action: 'retire', entry: ENTRY }), 'product_legal_retire', { p_entry: ENTRY }],
    [change({ kind: 'glossary', action: 'add', fields: { term: 't', meaning: 'm', avoid: ['x'] } }), 'product_glossary_add', { p_term: 't', p_meaning: 'm', p_avoid: ['x'] }],
    [change({ kind: 'glossary', action: 'edit', entry: ENTRY, fields: { term: 't' } }), 'product_glossary_edit', { p_entry: ENTRY, p_term: 't' }],
    [change({ kind: 'glossary', action: 'remove', entry: ENTRY }), 'product_glossary_remove', { p_entry: ENTRY }],
  ])('calls the kind\'s definer function', async (write, fn, args) => {
    const { client, calls } = db();
    expect(await knowledgeRepository(client).apply('w-1', 'p-1', write)).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.fn).toBe(fn);
    expect(calls[0]?.args).toMatchObject({ p_workspace: 'w-1', ...args });
  });

  it('answers the database\'s code and words when it refuses', async () => {
    const { client } = db({ error: { code: '42501', message: 'Not yours.' } });
    expect(await knowledgeRepository(client).apply('w-1', 'p-1', change({ kind: 'legal', action: 'retire', entry: ENTRY }))).toEqual({ ok: false, code: '42501', message: 'Not yours.' });
  });
});

describe('a proposal, a decision and a naming', () => {
  it('call their own functions', async () => {
    const { client, calls } = db();
    const store = knowledgeRepository(client);
    await store.propose('w-1', 'p-1', change({ kind: 'glossary', action: 'add', fields: { term: 't' } }));
    await store.decide('w-1', 'x-1', 'approve');
    await store.decide('w-1', 'x-1', 'reject');
    await store.name('w-1', 'p-1', 'legal', 'delegate', null);
    expect(calls.map((c) => c.fn)).toEqual(['product_knowledge_propose', 'product_knowledge_approve', 'product_knowledge_reject', 'product_knowledge_name']);
    expect(calls[0]?.args).toMatchObject({ p_kind: 'glossary', p_action: 'add', p_fields: { term: 't' } });
    expect(calls[3]?.args).toEqual({ p_workspace: 'w-1', p_product: 'p-1', p_kind: 'legal', p_role: 'delegate', p_user: null });
  });
});

describe('the reads', () => {
  const SECTION = { owner: null, delegate: null, decides: false, entries: [], proposals: [] };
  const READ = { product: { id: 'p-1', name: 'W' }, canName: false, latestEventId: null, legal: SECTION, glossary: SECTION };

  it('parses the tab\'s read, and throws on an answer out of shape', async () => {
    expect(await knowledgeRepository(db({ data: READ }).client).read('w-1', 'p-1')).toEqual({ ok: true, read: READ });
    await expect(knowledgeRepository(db({ data: { product: 1 } }).client).read('w-1', 'p-1')).rejects.toThrow();
  });

  it('reads who added each entry and when, an entry whose author is gone naming nobody (PRD 2240 s1)', async () => {
    const owen = { user: 'u-owen', login: 'owen' };
    const dates = { createdAt: '2026-01-05T09:00:00+00:00', updatedAt: '2026-02-07T10:30:00+00:00' };
    const legal = {
      entry: 'l-1', id: 'L-INVOICING-1', code: 'INVOICING', number: 1, statement: 's', source: 'u', owner: owen, retiredAt: null, createdBy: owen, ...dates,
    };
    const term = { entry: 'g-1', term: 'Quote', meaning: 'm', avoid: [], removedAt: null, createdBy: null, ...dates };
    const data = { ...READ, legal: { ...SECTION, entries: [legal, { ...legal, entry: 'l-2', createdBy: null }] }, glossary: { ...SECTION, entries: [term, { ...term, entry: 'g-2', createdBy: owen }] } };
    const got = await knowledgeRepository(db({ data }).client).read('w-1', 'p-1');
    expect(got).toEqual({ ok: true, read: data });
    expect(got.ok && got.read.legal.entries.map((e) => e.createdBy)).toEqual([owen, null]);
    expect(got.ok && got.read.glossary.entries.map((e) => [e.createdBy, e.createdAt, e.updatedAt])).toEqual([[null, dates.createdAt, dates.updatedAt], [owen, dates.createdAt, dates.updatedAt]]);
  });

  it('parses the demo\'s tab as it would a live read, its entries with authors and dates', async () => {
    const { members: _members, ...demo } = demoKnowledgeTab('demo-product-1') as KnowledgeTab;
    expect(await knowledgeRepository(db({ data: demo }).client).read('w-1', 'p-1')).toEqual({ ok: true, read: demo });
    const entries = [...demo.legal.entries, ...demo.glossary.entries];
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.createdBy?.login).toBeTruthy();
      expect(Date.parse(e.createdAt)).toBeLessThanOrEqual(Date.parse(e.updatedAt));
    }
  });

  it('throws on an entry with no dates: the read carries them', async () => {
    const term = { entry: 'g-1', term: 'Quote', meaning: 'm', avoid: [], removedAt: null, createdBy: null };
    await expect(knowledgeRepository(db({ data: { ...READ, glossary: { ...SECTION, entries: [term] } } }).client).read('w-1', 'p-1')).rejects.toThrow();
  });

  it('answers a refused read with the database\'s code', async () => {
    expect(await knowledgeRepository(db({ error: { code: 'P0002', message: 'No product.' } }).client).read('w-1', 'p-1')).toEqual({ ok: false, code: 'P0002', message: 'No product.' });
  });

  it('reads the product by its id, none when it is not there, and throws on a failed read', async () => {
    expect(await knowledgeRepository(db({ data: [{ id: 'p-1', workspace_id: 'w-1', name: 'W' }] }).client).product('p-1')).toEqual({ id: 'p-1', workspace_id: 'w-1', name: 'W' });
    expect(await knowledgeRepository(db({ data: [] }).client).product('p-1')).toBeNull();
    await expect(knowledgeRepository(db({ error: { message: 'down' } }).client).product('p-1')).rejects.toThrow('down');
  });

  it('reads the members, and throws on a failed read', async () => {
    const row = { user_id: 'u-1', name: 'Anna', github_login: 'anna', avatar_url: null, fleet: null };
    expect(await knowledgeRepository(db({ data: [row] }).client).roster('w-1')).toMatchObject([{ user_id: 'u-1' }]);
    await expect(knowledgeRepository(db({ error: { message: 'down' } }).client).roster('w-1')).rejects.toThrow('down');
  });
});
