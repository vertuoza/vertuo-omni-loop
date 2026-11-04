import { describe, expect, it, vi } from 'vitest';
import { readRepoLaws, type LawsReadDb } from './judge-route-live';


vi.mock('server-only', () => ({}));

// The judge route's reads on a fake service role: the product's business, then the newest pack of its law home.
// Nothing here calls a database; every repository is fictional.

type Rows = Record<string, unknown[]>;

/** A client whose `rpc` answers `business` and whose tables answer `rows` (each query chain answers the same rows). */
function fakeDb({ business, rows = {}, refuse = false }: { business: unknown; rows?: Rows; refuse?: boolean }): LawsReadDb {
  const query = (table: string) => {
    const answer = { data: refuse ? null : (rows[table] ?? []), error: refuse ? { message: 'no' } : null };
    const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve(answer) };
    for (const step of ['select', 'eq', 'order', 'limit', 'range']) chain[step] = () => chain;
    return chain;
  };
  return {
    rpc: () => Promise.resolve({ data: business, error: null }),
    from: (table: string) => query(table),
  } as unknown as LawsReadDb;
}

const PACK = { id: 'p-1', repository: 'acme/plan', sha: 'c'.repeat(40), committed_at: '2026-12-01T09:00:00Z', made_at: '2026-12-01T09:01:00Z' };
const FILE = { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', sha256: 'x', content: '## BL-QUOTES-1\nA.\nWhy: B.\n' };
const BUSINESS = { lawHome: 'Acme/Plan', glossary: [{ term: 'Quote', avoid: [], domains: ['quotes'] }], domains: [{ key: 'quotes', name: 'Quotes' }] };

describe('readRepoLaws', () => {
  it('reads the law home, glossary and domains, then the newest pack of the home', async () => {
    const read = await readRepoLaws(fakeDb({ business: BUSINESS, rows: { knowledge_packs: [PACK], knowledge_pack_files: [FILE] } }), 'acme/plan');
    expect(read.home).toBe('acme/plan');
    expect(read.glossary).toEqual(BUSINESS.glossary);
    expect(read.domains).toEqual(BUSINESS.domains);
    expect(read.pack).toEqual({ sha: PACK.sha, files: [{ path: FILE.path, content: FILE.content }] });
  });

  it('reads a repository of no product, or one with no law home, as no home and no pack', async () => {
    expect(await readRepoLaws(fakeDb({ business: null }), 'acme/x')).toEqual({ home: null, pack: null, glossary: [], domains: [] });
    expect(await readRepoLaws(fakeDb({ business: { lawHome: null } }), 'acme/x')).toMatchObject({ home: null, pack: null });
  });

  it('reads a law home with no pack yet as no pack', async () => {
    expect(await readRepoLaws(fakeDb({ business: BUSINESS }), 'acme/plan')).toMatchObject({ home: 'acme/plan', pack: null });
  });

  it('throws when the database refuses, a pack cannot be read or the business is out of shape', async () => {
    await expect(readRepoLaws(fakeDb({ business: BUSINESS, refuse: true }), 'acme/plan')).rejects.toThrow('could not be read');
    await expect(readRepoLaws(fakeDb({ business: { glossary: 7 } }), 'acme/plan')).rejects.toThrow('out of shape');
    const refusing = { ...fakeDb({ business: null }), rpc: () => Promise.resolve({ data: null, error: { message: 'denied' } }) } as unknown as LawsReadDb;
    await expect(readRepoLaws(refusing, 'acme/plan')).rejects.toThrow('the database refused: denied');
  });
});
