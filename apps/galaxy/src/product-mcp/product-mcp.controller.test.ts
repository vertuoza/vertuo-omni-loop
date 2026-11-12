import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { embedText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { describe, expect, it } from 'vitest';
import { hashApiKey } from '../public-api/keys/secret';
import { handleProductMcp, type ProductMcpDeps } from './product-mcp.controller';
import { GetAnswerSchema, KEY_REFUSED, NO_PACK_LINE, SearchAnswerSchema } from './product-mcp.contract';
import type { AccessRow, ProductMcpRepository } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';
import { MEANING_BUDGET_MS, type Meaning } from './search-meaning';

// `/api/products/<key>/mcp` (PRD 2707 s3) driven by the SDK's own client over the route's handler, against a
// stubbed repository that plays product_mcp_for_key() and api_key_of() as
// supabase/migrations/20270115090000_product_mcp.sql writes them, over a fictional product, Acme App:
// acme/widgets (the law home) and acme/api. Every request asks the stub again, so a change between two
// calls of one connected client shows on the second.

// The SDK's client transport, handed to its client as the Transport interface it implements (as
// agent-connect/mcp/server.test.ts does): a stateless server never has a session id.
const asTransport = (inner: StreamableHTTPClientTransport): Transport => ({
  start: () => inner.start(),
  send: (message, options) => inner.send(message, options),
  close: () => inner.close(),
  setProtocolVersion: (version) => { inner.setProtocolVersion(version); },
  set onclose(handler: NonNullable<Transport['onclose']>) { inner.onclose = handler; },
  set onerror(handler: NonNullable<Transport['onerror']>) { inner.onerror = handler; },
  set onmessage(handler: NonNullable<Transport['onmessage']>) { inner.onmessage = handler; },
});

const LIVE = 'oma_' + 'A'.repeat(43);
const NARROW = 'oma_' + 'N'.repeat(43);
const OTHER = 'oma_' + 'O'.repeat(43);
const REVOKED = 'oma_' + 'R'.repeat(43);

const CONFIG = 'kit: 1\nlaws:\n  owners: [anna]\n';
const lawsFile = (statement: string) => `## BL-QUOTES-1\n${statement}\nWhy: A customer who receives an empty quote stops trusting the contractor.\n`;
const WIDGETS = [
  { path: '.omni-loop/config.yml', content: CONFIG },
  { path: '.omni-loop/knowledge/adr/0067-a-bad-api-key-still-connects.md', content: '# ADR-0067 — A bad API key still connects\n\n**Status:** adopted\n\n## Decision\n\nThe client connects and lists the tools.' },
  { path: '.omni-loop/knowledge/product/rules.md', content: '## BR-PRODUCT-3\nAn API key is shown once.\nEnforced by: kit/key.test.ts\n' },
];
const API = [{ path: '.omni-loop/knowledge/adr/0012-keys-are-hashed.md', content: '# ADR-0012 — API keys are hashed\n\n**Status:** accepted' }];
// The product's knowledge as product_knowledge_for_agents() answers it inside product_mcp_for_key().
const KNOWLEDGE: AccessRow['knowledge'] = {
  legal: [{ id: 'L-GDPR-2', statement: 'Credentials are never stored in clear.', source: 'https://law.example/gdpr-32', owner: 'anna' }],
  glossary: [{ term: 'API key', meaning: 'A secret a program sends to read the workspace.', avoid: ['token'] }],
};
const NEVER = [{ seq: 6, body: 'Never locks a workspace in.' }];
const SHA = 'a'.repeat(40);

async function world({ database = true, failing = false }: { database?: boolean; failing?: boolean } = {}) {
  const hashes = { live: await hashApiKey(LIVE), narrow: await hashApiKey(NARROW), other: await hashApiKey(OTHER), revoked: await hashApiKey(REVOKED) };
  // What the store holds now; a test changes it between two calls.
  const state = {
    on: true,
    makerIsMember: true,
    laws: lawsFile('A quote can be sent only when its total is above zero.'),
    apiPack: true,
  };
  const calls: string[] = [];
  const ref = (repo: string, packId: string | null) => ({ repo, pack_id: packId, sha: packId ? SHA : null, committed_at: packId ? '2026-11-09T10:00:00Z' : null });
  const repository: ProductMcpRepository = {
    access: (hash, key) => {
      calls.push(`access ${key}`);
      if (failing) return Promise.reject(new Error('product_mcp_for_key: the database refused: boom'));
      const live = (hash === hashes.live || hash === hashes.narrow) && state.makerIsMember;
      if (!live || key !== 'acme-app' || !state.on) return Promise.resolve(null);
      const api = ref('acme/api', state.apiPack ? 'pack-api' : null);
      const widgets = ref('acme/widgets', 'pack-widgets');
      const access: AccessRow = {
        product: { id: 'p-acme', key: 'acme-app', name: 'Acme App', workspace_id: 'w-acme' },
        repositories: hash === hashes.narrow ? [api] : [api, widgets],
        law_home: widgets,
        knowledge: KNOWLEDGE,
      };
      return Promise.resolve(access);
    },
    keyLive: (hash) => {
      calls.push('keyLive');
      return Promise.resolve(hash === hashes.other || ((hash === hashes.live || hash === hashes.narrow) && state.makerIsMember));
    },
    packFiles: (id) => Promise.resolve(id === 'pack-api' ? API : [...WIDGETS, { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: state.laws }]),
    never: () => Promise.resolve(NEVER),
  };
  const logged: string[] = [];
  const deps: ProductMcpDeps = { service: database ? productMcpService(repository) : null, log: (line) => { logged.push(line); } };

  const post = (key: string, token: string | null, body: unknown) => handleProductMcp(new Request(`https://omni.example/api/products/${key}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), key, deps);

  const connect = async (token: string | null, key = 'acme-app') => {
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`https://omni.example/api/products/${key}/mcp`), {
      requestInit: token === null ? {} : { headers: { authorization: `Bearer ${token}` } },
      fetch: (url, init) => handleProductMcp(new Request(url, init), key, deps),
    });
    await client.connect(asTransport(transport));
    return client;
  };

  const ask = async (client: Client, name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as { type: string; text: string }[];
    return { isError: result.isError === true, text: content.map((c) => c.text).join('\n') };
  };

  const call = async (token: string | null, name: string, args: Record<string, unknown> = {}) => {
    const client = await connect(token);
    try {
      return await ask(client, name, args);
    } finally {
      await client.close();
    }
  };

  /** The entries the live key reads now, as the service builds them. */
  const entries = async () => {
    const access = await repository.access(hashes.live, 'acme-app');
    if (access === null) throw new Error('the live key reads nothing');
    return (await productMcpService(repository).read(access)).entries;
  };

  return { state, calls, logged, deps, post, connect, ask, call, entries };
}

const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' } } };

describe('/api/products/<key>/mcp', () => {
  it('lists two read-only tools, and its instructions say to search, read and cite', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    const { tools } = await client.listTools();
    const instructions = client.getInstructions();
    await client.close();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_knowledge', 'search_knowledge']);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
    expect(instructions).toMatch(/search_knowledge/);
    expect(instructions).toMatch(/get_knowledge/);
    expect(instructions).toMatch(/[Cc]ite the ids/);
  });

  it('search_knowledge for "api key" answers hits of several kinds, repository ids carrying the repository', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'search_knowledge', { query: 'api key' });
    expect(isError).toBe(false);
    const answer = SearchAnswerSchema.parse(JSON.parse(text));
    expect(new Set(answer.hits.map((hit) => hit.kind))).toEqual(new Set(['adr', 'rule', 'term']));
    expect(answer.hits.map((hit) => hit.id)).toContain('widgets/ADR-0067');
    expect(answer.hits.map((hit) => hit.id)).toContain('api/ADR-0012');
    expect(answer.total).toBe(answer.hits.length);
    expect(answer.repositories).toEqual([
      { repo: 'acme/api', pack: { sha: SHA, committedAt: '2026-11-09T10:00:00Z' } },
      { repo: 'acme/widgets', pack: { sha: SHA, committedAt: '2026-11-09T10:00:00Z' } },
    ]);
  });

  it('search_knowledge with kind business-law and no query lists the business laws in id order', async () => {
    const w = await world();
    const answer = SearchAnswerSchema.parse(JSON.parse((await w.call(LIVE, 'search_knowledge', { kind: 'business-law' })).text));
    expect(answer.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1']);
  });

  it('get_knowledge answers an ADR\'s whole text and a business law\'s statement, Why, domains and owner', async () => {
    const w = await world();
    const adr = GetAnswerSchema.parse(JSON.parse((await w.call(LIVE, 'get_knowledge', { id: 'widgets/ADR-0067' })).text));
    expect(adr.entry.body).toBe(WIDGETS[1]?.content);
    const law = GetAnswerSchema.parse(JSON.parse((await w.call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' })).text));
    expect(law.entry.body).toContain('A quote can be sent only when its total is above zero.');
    expect(law.entry.body).toContain('Why: A customer who receives an empty quote stops trusting the contractor.');
    expect(law.entry.body).toContain('Domains: quotes');
    expect(law.entry.body).toContain('Owner: anna');
    const legal = GetAnswerSchema.parse(JSON.parse((await w.call(LIVE, 'get_knowledge', { id: 'L-GDPR-2' })).text));
    expect(legal.entry.body).toContain('Owner: anna');
  });

  it('get_knowledge on an id the product does not hold answers its line', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'get_knowledge', { id: 'widgets/ADR-9999' });
    expect(isError).toBe(true);
    expect(text).toBe('No knowledge entry widgets/ADR-9999 in Acme App. Search for it with search_knowledge.');
  });

  it('a key whose allow-list names one repository reads repository entries from that one only, and the business laws', async () => {
    const w = await world();
    const answer = SearchAnswerSchema.parse(JSON.parse((await w.call(NARROW, 'search_knowledge', {})).text));
    const repos = new Set(answer.hits.flatMap((hit) => (hit.repo === null ? [] : [hit.repo])));
    expect(repos).toEqual(new Set(['acme/api']));
    expect(answer.hits.map((hit) => hit.id)).toContain('BL-QUOTES-1');
    expect(answer.repositories.map((r) => r.repo)).toEqual(['acme/api']);
  });

  it('a product that is off, unknown, of another workspace or out of the key\'s reach answers 404, the same each time', async () => {
    const w = await world();
    const unknown = await w.post('nope', LIVE, INITIALIZE);
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: 'No MCP server here.' });
    const other = await w.post('acme-app', OTHER, INITIALIZE);
    expect(other.status).toBe(404);
    w.state.on = false;
    const off = await w.post('acme-app', LIVE, INITIALIZE);
    expect(off.status).toBe(404);
    expect(await off.json()).toEqual({ error: 'No MCP server here.' });
  });

  it('a malformed or missing key connects, lists the tools and answers the one line, never reaching the database', async () => {
    const w = await world();
    for (const token of ['oma_short', 'omb_' + 'A'.repeat(43), null]) {
      const client = await w.connect(token);
      expect((await client.listTools()).tools).toHaveLength(2);
      expect(await w.ask(client, 'search_knowledge', { query: 'key' })).toEqual({ isError: true, text: KEY_REFUSED });
      expect(await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).toEqual({ isError: true, text: KEY_REFUSED });
      await client.close();
    }
    expect(w.calls).toEqual([]);
  });

  it('a revoked key connects and answers the one line on each call', async () => {
    const w = await world();
    const client = await w.connect(REVOKED);
    expect(await w.ask(client, 'search_knowledge', {})).toEqual({ isError: true, text: KEY_REFUSED });
    expect(await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).toEqual({ isError: true, text: KEY_REFUSED });
    await client.close();
  });

  it('once the key\'s maker leaves, the very next call of a client already connected reads nothing', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    expect((await w.ask(client, 'search_knowledge', { query: 'quote' })).isError).toBe(false);
    w.state.makerIsMember = false;
    expect(await w.ask(client, 'search_knowledge', { query: 'quote' })).toEqual({ isError: true, text: KEY_REFUSED });
    await client.close();
  });

  it('turned off, the next call of a client already connected answers 404', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    expect((await w.ask(client, 'search_knowledge', {})).isError).toBe(false);
    w.state.on = false;
    await expect(w.ask(client, 'search_knowledge', {})).rejects.toThrow(/No MCP server here\./);
    await client.close();
    expect((await w.post('acme-app', LIVE, INITIALIZE)).status).toBe(404);
  });

  it('after a merge keeps a new pack of the law home, the next call answers the new text', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    const before = GetAnswerSchema.parse(JSON.parse((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).text));
    expect(before.entry.body).toContain('above zero');
    w.state.laws = lawsFile('A quote can be sent only once its customer has an address.');
    const after = GetAnswerSchema.parse(JSON.parse((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).text));
    expect(after.entry.body).toContain('once its customer has an address');
    await client.close();
  });

  it('a repository with no pack yet reads pack null with its line, and the call still answers', async () => {
    const w = await world();
    w.state.apiPack = false;
    const { isError, text } = await w.call(LIVE, 'search_knowledge', { query: 'api key' });
    expect(isError).toBe(false);
    const answer = SearchAnswerSchema.parse(JSON.parse(text));
    expect(answer.repositories[0]).toEqual({ repo: 'acme/api', pack: null, note: NO_PACK_LINE });
    expect(answer.hits.map((hit) => hit.id)).not.toContain('api/ADR-0012');
  });

  it('answers 503 with no database, and 500 when the database fails, logged without the key', async () => {
    expect((await (await world({ database: false })).post('acme-app', LIVE, INITIALIZE)).status).toBe(503);
    const w = await world({ failing: true });
    const failed = await w.post('acme-app', LIVE, INITIALIZE);
    expect(failed.status).toBe(500);
    expect(w.logged).toEqual(['product mcp: product_mcp_for_key: the database refused: boom']);
    expect(w.logged.join('')).not.toContain(LIVE);
  });

  describe('search_knowledge by meaning (PRD 2728 s5)', () => {
    // A fake model: a text's vector says whether it speaks of quotes, of keys, of locking in. The fake store
    // holds the vectors of every entry but those a test leaves out, per workspace, and ranks by cosine.
    const AXES = [/quote/i, /key|credential|secret/i, /lock/i];
    const fakeVector = (text: string): number[] => AXES.map((axis) => (axis.test(text) ? 1 : 0.01));
    const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
    const cosine = (a: number[], b: number[]): number => {
      const dot = a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
      return dot / (Math.hypot(...a) * Math.hypot(...b));
    };

    async function withMeaning(w: Awaited<ReturnType<typeof world>>, {
      leaveOut = [], embedder = (texts: readonly string[]) => Promise.resolve(texts.map(fakeVector)), budgetMs,
    }: { leaveOut?: string[]; embedder?: Meaning['embedder']; budgetMs?: number } = {}) {
      const held = new Map<string, number[]>();
      for (const entry of await w.entries()) {
        if (!leaveOut.includes(entry.id)) held.set(sha(embedText(entry)), fakeVector(embedText(entry)));
      }
      const store = { workspaces: [] as string[], put: [] as string[], embedded: [] as string[] };
      const meaning: Meaning = {
        embedder: (texts, signal) => { store.embedded.push(...texts); return embedder(texts, signal); },
        vectors: {
          missing: (workspace, _model, hashes) => { store.workspaces.push(workspace); return Promise.resolve(hashes.filter((h) => !held.has(h))); },
          put: (workspace, _model, rows) => {
            store.workspaces.push(workspace);
            for (const row of rows) { held.set(row.sha256, [...row.vector]); store.put.push(row.sha256); }
            return Promise.resolve();
          },
          nearest: (workspace, _model, hashes, query, k) => {
            store.workspaces.push(workspace);
            const ranked = hashes.flatMap((h) => { const v = held.get(h); return v ? [{ h, d: 1 - cosine(v, [...query]) }] : []; })
              .sort((a, b) => a.d - b.d || (a.h < b.h ? -1 : 1));
            return Promise.resolve(ranked.slice(0, k).map(({ h }) => h));
          },
        },
        ...(budgetMs === undefined ? {} : { budgetMs }),
      };
      w.deps.meaning = meaning;
      return store;
    }

    const search = async (w: Awaited<ReturnType<typeof world>>, args: Record<string, unknown>) =>
      SearchAnswerSchema.parse(JSON.parse((await w.call(LIVE, 'search_knowledge', args)).text));

    it('answers by meaning, the nearest first, reading the served workspace\'s vectors alone', async () => {
      const w = await world();
      const store = await withMeaning(w);
      const answer = await search(w, { query: 'may an offer go out empty? (quote)' });
      expect(answer.mode).toBe('meaning');
      expect(answer.hits[0]?.id).toBe('BL-QUOTES-1');
      expect(new Set(store.workspaces)).toEqual(new Set(['w-acme']));
    });

    it('puts an exact id or term first', async () => {
      const w = await world();
      await withMeaning(w);
      expect((await search(w, { query: 'api/ADR-0012' })).hits[0]?.id).toBe('api/ADR-0012');
      expect((await search(w, { query: 'api key' })).hits[0]?.id).toBe('term:API key');
    });

    it('answers by words, with the same hits as today, when the model fails', async () => {
      const today = await search(await world(), { query: 'api key' });
      const w = await world();
      await withMeaning(w, { embedder: () => Promise.reject(new Error('embed: answered 503')) });
      const answer = await search(w, { query: 'api key' });
      expect(answer).toEqual({ ...today, mode: 'words' });
      expect(w.logged).toContain('product mcp: searched by words: embed: answered 503');
    });

    it('answers by words when the model passes the budget, which is 2 seconds', async () => {
      expect(MEANING_BUDGET_MS).toBe(2000);
      const today = await search(await world(), { query: 'quote' });
      const w = await world();
      await withMeaning(w, { embedder: () => new Promise<never>(() => undefined), budgetMs: 20 });
      expect(await search(w, { query: 'quote' })).toEqual({ ...today, mode: 'words' });
    });

    it('answers by words when no entry holds a vector yet', async () => {
      const w = await world();
      await withMeaning(w, { leaveOut: (await w.entries()).map((e) => e.id) });
      const answer = await search(w, { query: 'quote', kind: 'business-law' });
      expect(answer.mode).toBe('words');
      expect(answer.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1']);
    });

    it('embeds the product\'s own rows missing a vector during the search, and ranks them by meaning', async () => {
      const w = await world();
      const store = await withMeaning(w, { leaveOut: ['L-GDPR-2', 'api/ADR-0012'] });
      const answer = await search(w, { query: 'secret' });
      expect(answer.mode).toBe('meaning');
      const legal = (await w.entries()).find((e) => e.id === 'L-GDPR-2');
      expect(store.put).toEqual([sha(embedText(legal ?? { title: '', body: '' }))]);
      expect(store.embedded.join('\n')).not.toMatch(/Owner:/);
      // The Legal entry now has a vector and ranks by meaning; the ADR, a pack's, waits for the job, by words.
      const ids = answer.hits.map((hit) => hit.id);
      expect(ids.indexOf('L-GDPR-2')).toBeLessThan(ids.length - 1);
      expect(ids).not.toContain('api/ADR-0012');
    });

    it('with no query, lists as today, with no mode', async () => {
      const today = await search(await world(), { kind: 'business-law' });
      const w = await world();
      const store = await withMeaning(w);
      const answer = await search(w, { kind: 'business-law' });
      expect(answer).toEqual(today);
      expect(answer.mode).toBeUndefined();
      expect(store.workspaces).toEqual([]);
    });
  });
});
