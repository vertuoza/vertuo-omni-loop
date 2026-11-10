import { describe, expect, it } from 'vitest';
import { productMcpRepository, type ProductMcpDb } from './product-mcp.repository';

// A product's MCP server's storage (PRD 2707 s3): the calls it sends on the service role's client, each
// answer parsed where it comes in. A fake client records each call as one line and answers in order.

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const next = () => answers.shift() ?? { data: null, error: { message: 'no answer left' } };
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = next();
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = {
    from: (table: string) => chain([`from(${JSON.stringify(table)})`]),
    rpc: (fn: string, args: unknown) => chain([`rpc(${JSON.stringify(fn)},${JSON.stringify(args)})`]),
  } as unknown as ProductMcpDb;
  return { db, lines };
}

const HASH = 'a'.repeat(64);
const ACCESS = {
  product: { id: 'p-acme', key: 'acme-app', name: 'Acme App', workspace_id: 'w-acme' },
  repositories: [{ repo: 'acme/api', pack_id: null, sha: null, committed_at: null }],
  law_home: { repo: 'acme/widgets', pack_id: 'k-1', sha: 'c'.repeat(40), committed_at: '2026-11-09T10:00:00Z' },
  knowledge: {
    legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never stored in clear.', source: 'GDPR art. 32', owner: 'anna' }],
    glossary: [{ term: 'API key', meaning: 'A secret.', avoid: ['token'] }],
  },
};

describe('productMcpRepository', () => {
  it('asks product_mcp_for_key() with the hash and the product\'s key, and reads its answer or none', async () => {
    const { db, lines } = fakeDb([{ data: ACCESS, error: null }, { data: null, error: null }]);
    const repository = productMcpRepository(db);
    expect(await repository.access(HASH, 'acme-app')).toEqual(ACCESS);
    expect(await repository.access(HASH, 'acme-app')).toBeNull();
    expect(lines[0]).toBe(`rpc("product_mcp_for_key",{"p_hash":"${HASH}","p_key":"acme-app"})`);
  });

  it('throws, naming the call, on a refusal or an answer out of shape', async () => {
    await expect(productMcpRepository(fakeDb([{ data: null, error: { message: 'down' } }]).db).access(HASH, 'acme-app'))
      .rejects.toThrow('product_mcp_for_key: the database refused: down');
    await expect(productMcpRepository(fakeDb([{ data: { product: 1 }, error: null }]).db).access(HASH, 'acme-app'))
      .rejects.toThrow('product_mcp_for_key answered out of shape');
  });

  it('reads whether a key is live from api_key_of()', async () => {
    const { db, lines } = fakeDb([{ data: { key_id: 'k' }, error: null }, { data: null, error: null }]);
    const repository = productMcpRepository(db);
    expect(await repository.keyLive(HASH)).toBe(true);
    expect(await repository.keyLive(HASH)).toBe(false);
    expect(lines[0]).toBe(`rpc("api_key_of",{"p_hash":"${HASH}"})`);
  });

  it('reads a pack\'s files in path order, a thousand at a time', async () => {
    const page = (count: number) => Array.from({ length: count }, (_, at) => ({ path: `k/${String(at)}.md`, content: 'x' }));
    const { db, lines } = fakeDb([{ data: page(1000), error: null }, { data: page(3), error: null }]);
    expect(await productMcpRepository(db).packFiles('k-1')).toHaveLength(1003);
    expect(lines).toEqual([
      'from("knowledge_pack_files").select("path, content").eq("pack_id","k-1").order("path").range(0,999)',
      'from("knowledge_pack_files").select("path, content").eq("pack_id","k-1").order("path").range(1000,1999)',
    ]);
  });

  it('reads the product\'s knowledge from product_mcp_for_key()\'s answer, leaving out the keys it does not use', async () => {
    const answer = { ...ACCESS, knowledge: { ...ACCESS.knowledge, domains: [], lawHome: 'acme/widgets' } };
    const { db, lines } = fakeDb([{ data: answer, error: null }]);
    expect(await productMcpRepository(db).access(HASH, 'acme-app')).toEqual(ACCESS);
    expect(lines).toHaveLength(1);
  });

  it('reads the product\'s live Never lines', async () => {
    const { db, lines } = fakeDb([{ data: [{ seq: 6, body: 'Never locks a workspace in.' }], error: null }]);
    expect(await productMcpRepository(db).never('p-acme')).toEqual([{ seq: 6, body: 'Never locks a workspace in.' }]);
    expect(lines).toEqual(['from("constituents").select("seq, body").eq("product_id","p-acme").eq("kind","never").is("removed_at",null)']);
  });
});
