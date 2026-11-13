import { describe, expect, it } from 'vitest';
import { evalAccess } from './access.repository';

// The access the eval set reads a product's knowledge through (PRD omni-loop-8 s3): what the MCP's
// product_mcp_for_key() would answer, built from the tables. A fake client answers each table's rows.

type Rows = Record<string, unknown>;

function fake(rows: Rows, errors: Record<string, string> = {}) {
  const seen: string[] = [];
  const db = {
    from: (table: string) => {
      seen.push(table);
      const answer = () => {
        const message = errors[table];
        return message ? { data: null, error: { message } } : { data: rows[table] ?? [], error: null };
      };
      const chain: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'is', 'in']) chain[name] = () => chain;
      chain.maybeSingle = () => {
        const { data, error } = answer();
        const one: unknown = Array.isArray(data) ? (data[0] ?? null) : data;
        return Promise.resolve({ data: one, error });
      };
      chain.then = (resolve: (value: unknown) => void) => { resolve(answer()); };
      return chain;
    },
  };
  return { db: db as unknown as Parameters<typeof evalAccess>[0], seen };
}

const W = '00000000-0000-4000-8000-00000000ac01';
const P = '00000000-0000-4000-8000-00000000b001';
const PRODUCT = { id: P, key: 'quotes-app', name: 'Quotes', workspace_id: W, plan_repository: null };

describe('evalAccess', () => {
  it('answers null for a product that is not the workspace\'s, or archived', async () => {
    expect(await evalAccess(fake({ products: [] }).db, W, P)).toBeNull();
  });

  it('builds the repositories with their newest pack, the law home, the Legal entries and the Glossary', async () => {
    const w = fake({
      products: [PRODUCT],
      product_repositories: [{ repository: 'acme/web' }],
      knowledge_packs: [{ id: 'pk1', repository: 'acme/web', sha: 'abc', committed_at: '2027-01-01T00:00:00Z' }],
      product_legal: [{ code: 'GDPR', number: 2, statement: 'Keep it.', source: 'GDPR 5' }, { code: 'GDPR', number: 1, statement: 'Ask.', source: 'GDPR 6' }],
      product_glossary: [{ term: 'Quote', meaning: 'An offer.', avoid: ['bid'] }],
    });
    const access = await evalAccess(w.db, W, P);
    expect(access).toEqual({
      product: { id: P, key: 'quotes-app', name: 'Quotes', workspace_id: W },
      key_id: '',
      repositories: [{ repo: 'acme/web', pack_id: 'pk1', sha: 'abc', committed_at: '2027-01-01T00:00:00Z' }],
      law_home: { repo: 'acme/web', pack_id: 'pk1', sha: 'abc', committed_at: '2027-01-01T00:00:00Z' },
      knowledge: {
        legal: [
          { id: 'L-GDPR-1', statement: 'Ask.', source: 'GDPR 6', owner: null },
          { id: 'L-GDPR-2', statement: 'Keep it.', source: 'GDPR 5', owner: null },
        ],
        glossary: [{ term: 'Quote', meaning: 'An offer.', avoid: ['bid'] }],
      },
    });
  });

  it('names the plan repository as the law home, and reads a repository with no pack as none yet', async () => {
    const access = await evalAccess(fake({
      products: [{ ...PRODUCT, plan_repository: 'acme/plan' }],
      product_repositories: [{ repository: 'acme/web' }, { repository: 'acme/api' }],
    }).db, W, P);
    expect(access?.law_home).toEqual({ repo: 'acme/plan', pack_id: null, sha: null, committed_at: null });
    expect(access?.repositories.map((r) => r.repo)).toEqual(['acme/api', 'acme/web']);
  });

  it('has no law home for several repositories and no plan repository, and no repository at all reads no pack', async () => {
    expect((await evalAccess(fake({ products: [PRODUCT], product_repositories: [{ repository: 'a/x' }, { repository: 'a/y' }] }).db, W, P))?.law_home).toBeNull();
    const none = await evalAccess(fake({ products: [PRODUCT] }).db, W, P);
    expect(none).toMatchObject({ repositories: [], law_home: null });
  });

  it('throws with the database\'s reason when a read is refused', async () => {
    await expect(evalAccess(fake({ products: [PRODUCT] }, { product_legal: 'boom' }).db, W, P)).rejects.toThrow(/Legal entries.*boom/);
    await expect(evalAccess(fake({}, { products: 'down' }).db, W, P)).rejects.toThrow(/the product.*down/);
  });
});
