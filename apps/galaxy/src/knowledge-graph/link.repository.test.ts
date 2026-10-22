import { describe, expect, it } from 'vitest';
import { linkGraphRepository, type LinkGraphBundle } from './link.repository';

// The agent link's read of its product's graph (PRD 1798 s4): one call to knowledge_graph_for_token(),
// which checks the token in the database (supabase/migrations/20261216090000_knowledge_graph_for_token.sql),
// its answer parsed where it comes in. No test calls Supabase.

const HASH = 'a'.repeat(64);

const BUNDLE: LinkGraphBundle = {
  product: { id: 'p-omni', key: 'omni-loop', name: 'Omni Loop' },
  links: [{ repository: 'acme/widgets', knowledge: 'own' }],
  legal: [{ code: 'INVOICING', number: 1, statement: 'An invoice keeps its number.', retired_at: null }],
  glossary: [{ term: 'Credit note', meaning: 'A document that cancels an invoice.', removed_at: null }],
  never: [{ seq: 3, body: 'Never sell the data.', removed_at: '2026-10-03T00:00:00+00:00' }],
  graphs: [{
    repository: 'acme/widgets',
    sha: 'b'.repeat(40),
    graph: { version: 1, shape: 'repository', nodes: [{ id: 'BR-PRODUCT-3', kind: 'rule', label: 'A quote shows its total.', status: 'law', file: 'rules.md', origin: 'repository' }], edges: [] },
    pushed_at: '2026-10-13T14:02:00+00:00',
    pushed_by_login: 'pierrederval',
  }],
};

function store(answer: { data: unknown; error: unknown }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return { calls, db: { rpc: (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return Promise.resolve(answer); } } };
}

describe('linkGraphRepository', () => {
  it('asks knowledge_graph_for_token() with the token\'s hash and the repository, and parses its answer', async () => {
    const { calls, db } = store({ data: BUNDLE, error: null });
    expect(await linkGraphRepository(db).read(HASH, 'acme/widgets')).toEqual({ ok: true, bundle: BUNDLE });
    await linkGraphRepository(db).read(HASH, null);
    expect(calls).toEqual([
      { fn: 'knowledge_graph_for_token', args: { p_hash: HASH, p_repo: 'acme/widgets' } },
      { fn: 'knowledge_graph_for_token', args: { p_hash: HASH, p_repo: null } },
    ]);
  });

  it('answers the database\'s refusal as its code and its one line', async () => {
    const { db } = store({ data: null, error: { code: '28000', message: 'This link does not work: make a new one on Settings › Business.' } });
    expect(await linkGraphRepository(db).read(HASH, null)).toEqual({ ok: false, code: '28000', reason: 'This link does not work: make a new one on Settings › Business.' });
    const bare = store({ data: null, error: {} });
    expect(await linkGraphRepository(bare.db).read(HASH, null)).toEqual({ ok: false, code: undefined, reason: 'no answer' });
  });

  it('throws on an answer out of shape, a graph the kit\'s schema refuses among them', async () => {
    await expect(linkGraphRepository(store({ data: { ...BUNDLE, legal: null }, error: null }).db).read(HASH, null)).rejects.toThrow(/knowledge_graph_for_token/);
    const product = { ...BUNDLE, graphs: [{ ...BUNDLE.graphs[0], graph: { version: 1, shape: 'repository', nodes: [], edges: [], extra: 1 } }] };
    await expect(linkGraphRepository(store({ data: product, error: null }).db).read(HASH, null)).rejects.toThrow(/knowledge_graph_for_token/);
  });
});
