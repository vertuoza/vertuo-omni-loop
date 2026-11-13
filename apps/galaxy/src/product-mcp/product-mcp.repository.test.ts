import { describe, expect, it } from 'vitest';
import { knowledgeVectorsRepository, productMcpRepository, searchLogRepository, type ProductMcpDb } from './product-mcp.repository';

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
  key_id: 'k-live',
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

describe('knowledgeVectorsRepository', () => {
  const SHA = 'b'.repeat(64);

  it('asks knowledge_vectors_missing() with the workspace, the model and the hashes', async () => {
    const { db, lines } = fakeDb([{ data: [SHA], error: null }]);
    expect(await knowledgeVectorsRepository(db).missing('w-acme', 'gte-small', [SHA, HASH])).toEqual([SHA]);
    expect(lines).toEqual([`rpc("knowledge_vectors_missing",{"p_workspace":"w-acme","p_model":"gte-small","p_hashes":["${SHA}","${HASH}"]})`]);
  });

  it('keeps vectors through knowledge_vectors_put(), and throws on its refusal', async () => {
    const { db, lines } = fakeDb([{ data: 1, error: null }, { data: null, error: { code: '22023', message: 'Each vector: 384 numbers.' } }]);
    const vectors = knowledgeVectorsRepository(db);
    await vectors.put('w-acme', 'gte-small', [{ sha256: SHA, vector: [0.5, 0.5] }]);
    expect(lines[0]).toBe(`rpc("knowledge_vectors_put",{"p_workspace":"w-acme","p_model":"gte-small","p_rows":[{"sha256":"${SHA}","vector":[0.5,0.5]}]})`);
    await expect(vectors.put('w-acme', 'gte-small', [])).rejects.toThrow('knowledge_vectors_put: the database refused: Each vector: 384 numbers.');
  });

  it('asks knowledge_nearest() with the query in pgvector\'s text form, and answers the hashes nearest first', async () => {
    const { db, lines } = fakeDb([{ data: [{ text_sha256: SHA, distance: 0.1 }, { text_sha256: HASH, distance: 0.4 }], error: null }]);
    expect(await knowledgeVectorsRepository(db).nearest('w-acme', 'gte-small', [HASH, SHA], [1, 0], 2)).toEqual([SHA, HASH]);
    expect(lines).toEqual([`rpc("knowledge_nearest",{"p_workspace":"w-acme","p_model":"gte-small","p_hashes":["${HASH}","${SHA}"],"p_query":"[1,0]","p_k":2})`]);
  });

  it('throws, naming the call, on an answer out of shape', async () => {
    await expect(knowledgeVectorsRepository(fakeDb([{ data: [{ sha: 1 }], error: null }]).db).nearest('w', 'gte-small', [SHA], [1], 1))
      .rejects.toThrow('knowledge_nearest answered out of shape');
  });
});

describe('searchLogRepository (PRD omni-loop-6 s1)', () => {
  const ROW = {
    product_id: 'p-acme', workspace_id: 'w-acme', api_key_id: 'k-live', tool: 'search_knowledge' as const,
    query: 'api key', filters: { kind: 'adr' }, mode: 'meaning' as const, total: 2, hit_ids: ['api/ADR-0012', 'widgets/ADR-0067'],
    asked_at: '2026-11-13T10:00:00.000Z',
  };

  it('adds one row to mcp_search_log, as it is given', async () => {
    const { db, lines } = fakeDb([{ data: null, error: null }]);
    await searchLogRepository(db).add(ROW);
    expect(lines).toEqual([`from("mcp_search_log").insert(${JSON.stringify(ROW)})`]);
  });

  it('throws, naming the table, when the database refuses the row', async () => {
    await expect(searchLogRepository(fakeDb([{ data: null, error: { code: '42501', message: 'permission denied' } }]).db).add(ROW))
      .rejects.toThrow('mcp_search_log: the database refused: permission denied');
  });
});

describe('searchLogRepository.open (PRD omni-loop-6 s2)', () => {
  const ASKED = '2026-11-13T10:30:00.000Z';
  const search = (id: string, hits: string[]) => ({ id, hit_ids: hits });

  it('reads the key\'s searches of the product from the 10 minutes before, and sets the opened id and rank on the latest that returned the id', async () => {
    const { db, lines } = fakeDb([
      { data: [search('s-2', ['x', 'y']), search('s-1', ['a', 'b', 'c'])], error: null },
      { data: null, error: null },
    ]);
    await searchLogRepository(db).open('k-live', 'p-acme', 'c', ASKED);
    expect(lines).toEqual([
      'from("mcp_search_log").select("id, hit_ids").eq("api_key_id","k-live").eq("product_id","p-acme").eq("tool","search_knowledge")'
        + '.is("opened_id",null).gte("asked_at","2026-11-13T10:20:00.000Z").lte("asked_at","2026-11-13T10:30:00.000Z")'
        + '.order("asked_at",{"ascending":false}).limit(50)',
      'from("mcp_search_log").update({"opened_id":"c","opened_rank":3}).eq("id","s-1")',
    ]);
  });

  it('sets nothing when no search of the window returned the id', async () => {
    const { db, lines } = fakeDb([{ data: [search('s-1', ['a'])], error: null }]);
    await searchLogRepository(db).open('k-live', 'p-acme', 'z', ASKED);
    expect(lines).toHaveLength(1);
  });

  it('throws, naming the table, when the read or the update is refused', async () => {
    await expect(searchLogRepository(fakeDb([{ data: null, error: { message: 'boom' } }]).db).open('k', 'p', 'a', ASKED))
      .rejects.toThrow('mcp_search_log: the database refused: boom');
    await expect(searchLogRepository(fakeDb([{ data: [search('s-1', ['a'])], error: null }, { data: null, error: { message: 'nope' } }]).db).open('k', 'p', 'a', ASKED))
      .rejects.toThrow('mcp_search_log: the database refused: nope');
  });
});
