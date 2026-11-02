import { describe, expect, it } from 'vitest';
import type { ChangeWrite, DomainEntry, KnowledgeTab } from '../product-knowledge/product-knowledge.contract';
import { NO_DOMAIN_SECTION } from '../product-knowledge/product-knowledge.contract';
import { CHANGES, ChangeHeadSchema } from './knowledge-api.contract';
import type { KnowledgeApiRepository } from './knowledge-api.repository';
import { knowledgeApiService } from './knowledge-api.service';

// A terminal's change to a product's domains and to a term's domains (PRD 2583 s4): the contract reads
// them, and the service makes them through the Knowledge tab's own service, finding a domain by its key.
// The tab and the store are small fakes in memory; no test calls Supabase. Every name is fictional.

const PRODUCT = '00000000-0000-4000-8000-0000000000e1';
const STOCK = '00000000-0000-4000-8000-00000000f001';
const RETIRED = '00000000-0000-4000-8000-00000000f002';

const domain = (entry: string, key: string, retiredAt: string | null = null): DomainEntry => ({
  entry, key, name: key, meaning: 'Shelves.', retiredAt, createdBy: null, createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z',
});

function service({ decides, domains }: { decides: boolean; domains: DomainEntry[] }) {
  const writes: ChangeWrite[] = [];
  const tab = {
    legal: { owner: null, delegate: null, decides: false, entries: [], proposals: [] },
    glossary: { owner: null, delegate: null, decides: false, entries: [], proposals: [] },
    domains: { ...NO_DOMAIN_SECTION, owner: { user: 'u-jane', login: 'jane' }, decides, entries: domains },
  } as unknown as KnowledgeTab;
  const knowledge = {
    tab: () => Promise.resolve(tab),
    change: (_: string, write: ChangeWrite) => {
      writes.push(write);
      return Promise.resolve({ ok: true as const, value: { done: decides ? ('applied' as const) : ('proposed' as const) } });
    },
  };
  const store = { productFor: () => Promise.resolve({ ok: true, value: { id: PRODUCT, workspace: 'w', name: 'Widgets' } }) } as unknown as KnowledgeApiRepository;
  return { writes, api: knowledgeApiService(store, knowledge as never) };
}

const add = (key: string) => CHANGES.domains.add.parse({ repo: 'acme/widgets', kind: 'domains', action: 'add', fields: { key, name: 'Stock', meaning: 'Shelves.' } });
const edit = (entry: string, fields: Record<string, string>) => CHANGES.domains.edit.parse({ repo: 'acme/widgets', kind: 'domains', action: 'edit', entry, fields });

describe('the contract of a domain change', () => {
  it('knows the domains kind, and a term\'s domains', () => {
    expect(ChangeHeadSchema.safeParse({ kind: 'domains', action: 'add' }).success).toBe(true);
    const fields = { term: 'Quote', meaning: 'A priced offer.', domains: ['stock'] };
    expect(CHANGES.glossary.add.safeParse({ repo: 'acme/widgets', kind: 'glossary', action: 'add', fields }).success).toBe(true);
    expect(CHANGES.glossary.edit.safeParse({ repo: 'acme/widgets', kind: 'glossary', action: 'edit', entry: 'Quote', fields: { domains: [] } }).success).toBe(true);
  });

  it('refuses a domain edit that changes the key or names no field', () => {
    expect(CHANGES.domains.edit.safeParse({ repo: 'acme/widgets', kind: 'domains', action: 'edit', entry: 'stock', fields: { key: 'other' } }).success).toBe(false);
    expect(CHANGES.domains.edit.safeParse({ repo: 'acme/widgets', kind: 'domains', action: 'edit', entry: 'stock', fields: {} }).success).toBe(false);
  });
});

describe('the service and a domain', () => {
  it('adds a domain for whoever decides, and answers with its page', async () => {
    const { api, writes } = service({ decides: true, domains: [domain(STOCK, 'stock')] });
    expect(await api.change(add('stock'))).toEqual({ ok: true, value: { done: 'applied', id: 'stock', path: `/app/products/${PRODUCT}/knowledge/domains/stock`, waitsFor: null } });
    expect(writes).toEqual([{ op: 'change', kind: 'domains', action: 'add', fields: { key: 'stock', name: 'Stock', meaning: 'Shelves.' } }]);
  });

  it('proposes for any other member, naming who it waits for', async () => {
    const { api } = service({ decides: false, domains: [] });
    expect(await api.change(add('stock'))).toEqual({ ok: true, value: { done: 'proposed', id: null, path: `/app/products/${PRODUCT}/knowledge/domains`, waitsFor: 'jane' } });
  });

  it('edits a live domain by its key, without case, sending only the fields given', async () => {
    const { api, writes } = service({ decides: true, domains: [domain(STOCK, 'stock')] });
    const done = await api.change(edit('STOCK', { meaning: 'Goods.' }));
    expect(done).toMatchObject({ ok: true, value: { done: 'applied', id: 'stock' } });
    expect(writes).toEqual([{ op: 'change', kind: 'domains', action: 'edit', entry: STOCK, fields: { meaning: 'Goods.' } }]);
  });

  it('finds no domain that is retired or unknown', async () => {
    const { api, writes } = service({ decides: true, domains: [domain(RETIRED, 'old', '2026-10-02T09:00:00Z')] });
    expect(await api.change(edit('old', { name: 'Old' }))).toEqual({ ok: false, kind: 'missing', error: 'No domain old in Widgets.', cause: null });
    expect(await api.change(edit('nothing', { name: 'Nothing' }))).toMatchObject({ ok: false, kind: 'missing' });
    expect(writes).toEqual([]);
  });
});
