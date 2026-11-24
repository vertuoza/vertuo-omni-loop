import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { embedText } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { describe, expect, it } from 'vitest';
import { hashApiKey } from '../public-api/keys/secret';
import { handleProductMcp, type ProductMcpDeps } from './product-mcp.controller';
import type { TokenCheck } from '../ask/auth';
import { GetAnswerSchema, KEY_REFUSED, NO_PACK_LINE, SearchAnswerSchema, type SearchLogBy, type SearchLogRow } from './product-mcp.contract';
import type { AccessRow, MemberAccessRow, ProductMcpRepository } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';
import { MAX_DISTANCE } from './search';
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
// Kit sign-ins (PRD 3007 s1): access tokens of the shape the Auth server signs, header.payload.signature, built
// here so no file holds one whole. Max is a member of Acme; Hal is signed in, a member of no workspace Acme App
// is in; a stale one the Auth server refuses; a token it cannot judge while it is down.
const signInToken = (who: string): string => ['sign-in', who, 'sig'].join('.');
const MAX = signInToken('max');
const HAL = signInToken('hal');
const STALE = signInToken('stale');
const AUTH_DOWN = signInToken('down');

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

async function world({ database = true, failing = false, logFails = false, openFails = false }: { database?: boolean; failing?: boolean; logFails?: boolean; openFails?: boolean } = {}) {
  const hashes = { live: await hashApiKey(LIVE), narrow: await hashApiKey(NARROW), other: await hashApiKey(OTHER), revoked: await hashApiKey(REVOKED) };
  // What the store holds now; a test changes it between two calls.
  const state = {
    on: true,
    makerIsMember: true,
    laws: lawsFile('A quote can be sent only when its total is above zero.'),
    apiPack: true,
    // The id of acme/widgets' newest pack: a merge keeps a new one (bug #2954).
    widgetsPack: 'pack-widgets',
    // Whether Max is still a member of Acme's workspace (PRD 3007 s1).
    maxIsMember: true,
  };
  const calls: string[] = [];
  // Each token the Auth server was asked about (PRD 3007 s1).
  const authAsked: string[] = [];
  // The id of the key each live hash names, as api_key_of() answers it.
  const keyIdOf = (hash: string): string => (hash === hashes.narrow ? 'k-narrow' : 'k-live');
  const ref = (repo: string, packId: string | null) => ({ repo, pack_id: packId, sha: packId ? SHA : null, committed_at: packId ? '2026-11-09T10:00:00Z' : null });
  const repository: ProductMcpRepository = {
    access: (hash, key) => {
      calls.push(`access ${key}`);
      if (failing) return Promise.reject(new Error('product_mcp_for_key: the database refused: boom'));
      const live = (hash === hashes.live || hash === hashes.narrow) && state.makerIsMember;
      if (!live || key !== 'acme-app' || !state.on) return Promise.resolve(null);
      const api = ref('acme/api', state.apiPack ? 'pack-api' : null);
      const widgets = ref('acme/widgets', state.widgetsPack);
      const access: AccessRow = {
        product: { id: 'p-acme', key: 'acme-app', name: 'Acme App', workspace_id: 'w-acme' },
        key_id: keyIdOf(hash),
        repositories: hash === hashes.narrow ? [api] : [api, widgets],
        law_home: widgets,
        knowledge: KNOWLEDGE,
      };
      return Promise.resolve(access);
    },
    // product_mcp_for_member() as 20270126090000_product_mcp_member.sql writes it: what product_mcp_for_key()
    // answers a key with no allow-list, for a person who is a member of the product's workspace now.
    memberAccess: (userId, key) => {
      calls.push(`member ${key}`);
      if (failing) return Promise.reject(new Error('product_mcp_for_member: the database refused: boom'));
      if (userId !== 'u-max' || !state.maxIsMember || key !== 'acme-app' || !state.on) return Promise.resolve(null);
      const access: MemberAccessRow = {
        product: { id: 'p-acme', key: 'acme-app', name: 'Acme App', workspace_id: 'w-acme' },
        user_id: 'u-max',
        repositories: [ref('acme/api', state.apiPack ? 'pack-api' : null), ref('acme/widgets', state.widgetsPack)],
        law_home: ref('acme/widgets', state.widgetsPack),
        knowledge: KNOWLEDGE,
      };
      return Promise.resolve(access);
    },
    isMember: (userId, workspace) => {
      calls.push('isMember');
      return Promise.resolve(userId === 'u-max' && workspace === 'w-acme' && state.maxIsMember);
    },
    keyLive: (hash) => {
      calls.push('keyLive');
      return Promise.resolve(hash === hashes.other || ((hash === hashes.live || hash === hashes.narrow) && state.makerIsMember));
    },
    keyIdOf: (hash) => {
      calls.push('keyIdOf');
      if (hash === hashes.other) return Promise.resolve('k-other');
      return Promise.resolve((hash === hashes.live || hash === hashes.narrow) && state.makerIsMember ? keyIdOf(hash) : null);
    },
    productOpen: (productId) => {
      calls.push('productOpen');
      return Promise.resolve(productId === 'p-acme' && state.on);
    },
    newestPacks: (workspace, repos) => {
      calls.push('newestPacks');
      const newest = new Map<string, string>([['acme/widgets', state.widgetsPack], ...(state.apiPack ? [['acme/api', 'pack-api'] as const] : [])]);
      return Promise.resolve(new Map(workspace === 'w-acme' ? repos.flatMap((repo) => { const id = newest.get(repo); return id === undefined ? [] : [[repo, id] as const]; }) : []));
    },
    packFiles: (id) => Promise.resolve(id === 'pack-api' ? API : [...WIDGETS, { path: '.omni-loop/knowledge/domains/quotes/business-laws.md', content: state.laws }]),
    never: () => Promise.resolve(NEVER),
  };
  const logged: string[] = [];
  // The search log (PRD omni-loop-6 s1): the rows written, and the tasks left for after the answer, run by flush().
  const rows: SearchLogRow[] = [];
  const pending: (() => Promise<void>)[] = [];
  // The searches an opened rank can mark, as the table holds them, and what the log was asked to open.
  const opened: { by: SearchLogBy; productId: string; id: string; askedAt: string }[] = [];
  // The Auth server's verdict on a kit sign-in's access token, as auth.getUser() answers it (src/ask/auth.ts).
  const signIn = (token: string): TokenCheck => ({
    auth: {
      getUser: (jwt) => {
        authAsked.push(jwt);
        if (jwt !== token) throw new Error('the client was built for another token');
        if (jwt === MAX) return Promise.resolve({ data: { user: { id: 'u-max', email: null } }, error: null });
        if (jwt === HAL) return Promise.resolve({ data: { user: { id: 'u-hal', email: null } }, error: null });
        if (jwt === AUTH_DOWN) return Promise.resolve({ data: { user: null }, error: { status: 503, message: 'down' } });
        return Promise.resolve({ data: { user: null }, error: { status: 401, message: 'invalid JWT' } });
      },
    },
  });
  const deps: ProductMcpDeps = {
    service: database ? productMcpService(repository) : null,
    signIn: database ? signIn : null,
    log: (line) => { logged.push(line); },
    searchLog: {
      add: (row) => {
        if (logFails) return Promise.reject(new Error('mcp_search_log: the database refused: boom'));
        rows.push(row);
        return Promise.resolve();
      },
      open: (by, productId, id, askedAt) => {
        if (openFails) return Promise.reject(new Error('mcp_search_log: the database refused: no update'));
        opened.push({ by, productId, id, askedAt });
        return Promise.resolve();
      },
    },
    later: (task) => { pending.push(task); },
  };
  const flush = async () => {
    for (let task = pending.shift(); task !== undefined; task = pending.shift()) await task();
  };

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

  return { state, calls, authAsked, logged, deps, post, connect, ask, call, entries, rows, opened, pending, flush, hashes };
}

/** Who a logged row names: the key's id, or the signed-in person's (PRD 3007 s1). */
const callerOf = (row: SearchLogRow): string => ('user_id' in row ? `user ${row.user_id}` : `key ${row.api_key_id}`);

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
    expect(tools.find((t) => t.name === 'search_knowledge')?.description).toContain('No hit means the knowledge holds no answer to the question');
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
    expect(w.authAsked).toEqual([]);
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
            return Promise.resolve(ranked.slice(0, k).map(({ h, d }) => ({ hash: h, distance: d })));
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
      expect(ids).toContain('L-GDPR-2');
      expect(ids).not.toContain('api/ADR-0012');
    });

    it('answers no hit, total 0, mode meaning, when no entry is near the question (PRD omni-loop-9 s1)', async () => {
      const w = await world();
      await withMeaning(w, { embedder: (texts) => Promise.resolve(texts.map(() => [1, -1, -1])) });
      const answer = await search(w, { query: 'pizza delivery refund policy' });
      expect(answer).toMatchObject({ hits: [], total: 0, mode: 'meaning' });
      await w.flush();
      expect(w.rows[0]).toMatchObject({ query: 'pizza delivery refund policy', mode: 'meaning', total: 0, hit_ids: [] });
      expect(w.rows[0]?.nearest_distance).toBeGreaterThan(MAX_DISTANCE);
    });

    it('logs the nearest distance of a search by meaning, the smallest among the entries ranked (PRD omni-loop-9 s2)', async () => {
      const w = await world();
      await withMeaning(w);
      // The quote's laws point the same way as the question: one of them is at distance 0, the nearest.
      await search(w, { query: 'may an offer go out empty? (quote)' });
      await w.flush();
      expect(w.rows).toEqual([expect.objectContaining({ mode: 'meaning' })]);
      expect(w.rows[0]?.nearest_distance).toBeCloseTo(0, 9);
    });

    it('logs no nearest distance when the search fell back to words', async () => {
      const w = await world();
      await withMeaning(w, { embedder: () => Promise.reject(new Error('embed: answered 503')) });
      await search(w, { query: 'api key' });
      await w.flush();
      expect(w.rows).toEqual([expect.objectContaining({ mode: 'words', nearest_distance: null })]);
    });

    it('answers a search by meaning exactly as before when the log\'s write fails, and says so in one line', async () => {
      const ok = await world();
      await withMeaning(ok);
      const before = await ok.call(LIVE, 'search_knowledge', { query: 'pizza delivery refund policy' });
      const w = await world({ logFails: true });
      await withMeaning(w);
      expect(await w.call(LIVE, 'search_knowledge', { query: 'pizza delivery refund policy' })).toEqual(before);
      await w.flush();
      expect(w.logged).toEqual(['product mcp: search log not written: mcp_search_log: the database refused: boom']);
    });

    it('still answers an exact id first when the model finds nothing near it', async () => {
      const w = await world();
      await withMeaning(w, { embedder: (texts) => Promise.resolve(texts.map(() => [1, -1, -1])) });
      const answer = await search(w, { query: 'BL-QUOTES-1' });
      expect(answer.hits.map((hit) => hit.id)).toEqual(['BL-QUOTES-1']);
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

describe('/api/products/<key>/mcp logs each search it answers (PRD omni-loop-6 s1)', () => {
  it('a search_knowledge adds exactly one row, after the answer: the query, the mode, the total, the hits, and the key\'s id', async () => {
    const w = await world();
    const { text } = await w.call(LIVE, 'search_knowledge', { query: 'api key', kind: 'adr' });
    const answer = SearchAnswerSchema.parse(JSON.parse(text));
    // The answer is back, and nothing is written yet: the row waits for after the answer.
    expect(w.rows).toEqual([]);
    expect(w.pending).toHaveLength(1);
    await w.flush();
    expect(w.rows).toHaveLength(1);
    const { asked_at: askedAt, ...row } = w.rows[0] ?? { asked_at: '' };
    expect(row).toEqual({
      product_id: 'p-acme', workspace_id: 'w-acme', api_key_id: 'k-live', tool: 'search_knowledge',
      query: 'api key', filters: { kind: 'adr' }, mode: 'words', total: answer.total, hit_ids: answer.hits.map((hit) => hit.id),
      nearest_distance: null,
    });
    expect(Date.parse(askedAt)).not.toBeNaN();
    expect(answer.hits.length).toBeGreaterThan(0);
  });

  it('holds no key: neither the key nor its hash is in the row (L-GDPR-2)', async () => {
    const w = await world();
    await w.call(LIVE, 'search_knowledge', { query: 'api key' });
    await w.call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' });
    await w.flush();
    const written = JSON.stringify(w.rows);
    expect(written).not.toContain(LIVE);
    expect(written).not.toContain(w.hashes.live);
  });

  it('a listing is logged with no query and no mode, its filters kept', async () => {
    const w = await world();
    await w.call(NARROW, 'search_knowledge', { kind: 'business-law', domain: 'quotes', repo: 'acme/widgets' });
    await w.flush();
    expect(w.rows).toEqual([expect.objectContaining({
      api_key_id: 'k-narrow', query: null, mode: null, filters: { kind: 'business-law', domain: 'quotes', repo: 'acme/widgets' },
      nearest_distance: null,
    })]);
  });

  it('a get_knowledge adds a row of its own, its query the id asked; one the product does not hold reads total 0', async () => {
    const w = await world();
    await w.call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' });
    await w.call(LIVE, 'get_knowledge', { id: 'widgets/ADR-9999' });
    await w.flush();
    expect(w.rows).toEqual([
      expect.objectContaining({ tool: 'get_knowledge', query: 'BL-QUOTES-1', filters: {}, mode: null, total: 1, hit_ids: ['BL-QUOTES-1'], nearest_distance: null }),
      expect.objectContaining({ tool: 'get_knowledge', query: 'widgets/ADR-9999', filters: {}, mode: null, total: 0, hit_ids: [], nearest_distance: null }),
    ]);
  });

  it('a call refused by the key check adds no row: a key whose maker left (BL-ACCESS-1), a revoked or a malformed key', async () => {
    const w = await world();
    w.state.makerIsMember = false;
    for (const token of [LIVE, REVOKED, 'oma_short', null]) {
      expect((await w.call(token, 'search_knowledge', { query: 'quote' })).text).toBe(KEY_REFUSED);
      expect((await w.call(token, 'get_knowledge', { id: 'BL-QUOTES-1' })).text).toBe(KEY_REFUSED);
    }
    await w.flush();
    expect(w.pending).toEqual([]);
    expect(w.rows).toEqual([]);
  });

  it('with the log\'s write failing, the search answers exactly as before, and the failure is logged as an error', async () => {
    const before = await (await world()).call(LIVE, 'search_knowledge', { query: 'api key' });
    const w = await world({ logFails: true });
    expect(await w.call(LIVE, 'search_knowledge', { query: 'api key' })).toEqual(before);
    expect(await w.call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' })).toEqual(await (await world()).call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' }));
    await w.flush();
    expect(w.logged).toEqual([
      'product mcp: search log not written: mcp_search_log: the database refused: boom',
      'product mcp: search log not written: mcp_search_log: the database refused: boom',
    ]);
  });

  it('with no search log here, every call answers as before and nothing waits', async () => {
    const before = await (await world()).call(LIVE, 'search_knowledge', { query: 'quote' });
    const w = await world();
    w.deps.searchLog = null;
    expect(await w.call(LIVE, 'search_knowledge', { query: 'quote' })).toEqual(before);
    expect(w.pending).toEqual([]);
  });
});

describe('/api/products/<key>/mcp opens the search a get_knowledge follows (PRD omni-loop-6 s2)', () => {
  it('a get_knowledge that found its entry asks the log to open it, once the answer is sent, for its key, product and id', async () => {
    const w = await world();
    const { text } = await w.call(LIVE, 'get_knowledge', { id: 'bl-quotes-1' });
    expect(text).toContain('BL-QUOTES-1');
    expect(w.opened).toEqual([]);
    await w.flush();
    expect(w.opened).toEqual([{ by: { api_key_id: 'k-live' }, productId: 'p-acme', id: 'BL-QUOTES-1', askedAt: w.rows[0]?.asked_at }]);
  });

  it('a search, a listing, or a get_knowledge the product does not hold opens nothing', async () => {
    const w = await world();
    await w.call(LIVE, 'search_knowledge', { query: 'api key' });
    await w.call(LIVE, 'search_knowledge', {});
    await w.call(LIVE, 'get_knowledge', { id: 'widgets/ADR-9999' });
    await w.flush();
    expect(w.opened).toEqual([]);
  });

  it('a call refused by the key check opens nothing', async () => {
    const w = await world();
    await w.call(REVOKED, 'get_knowledge', { id: 'BL-QUOTES-1' });
    await w.flush();
    expect(w.opened).toEqual([]);
  });

  it('with the update failing, the get_knowledge answers exactly as before, and the failure is logged as an error', async () => {
    const before = await (await world()).call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' });
    const w = await world({ openFails: true });
    expect(await w.call(LIVE, 'get_knowledge', { id: 'BL-QUOTES-1' })).toEqual(before);
    await w.flush();
    expect(w.rows).toHaveLength(1);
    expect(w.logged).toEqual(['product mcp: opened rank not written: mcp_search_log: the database refused: no update']);
  });
});

describe('/api/products/<key>/mcp asks the database for a key\'s access once a minute, not on every call (#2954)', () => {
  it('one agent session asks product_mcp_for_key() once, however many calls it makes', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    expect((await w.ask(client, 'search_knowledge', { query: 'quote' })).isError).toBe(false);
    expect((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).isError).toBe(false);
    expect((await w.ask(client, 'search_knowledge', {})).isError).toBe(false);
    await client.close();
    expect(w.calls.filter((call) => call === 'access acme-app')).toHaveLength(1);
  });

  it('still asks the database on every call whether the kept access holds: the key, the switch and the newest packs', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    const before = w.calls.length;
    expect((await w.ask(client, 'search_knowledge', { query: 'quote' })).isError).toBe(false);
    expect((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).isError).toBe(false);
    await client.close();
    const asked = w.calls.slice(before);
    expect(asked.length).toBeGreaterThanOrEqual(6);
    expect(asked.length % 3).toBe(0);
    for (let at = 0; at < asked.length; at += 3) expect(asked.slice(at, at + 3)).toEqual(['keyIdOf', 'productOpen', 'newestPacks']);
  });

  it('logs every call it answers from a kept access, each under the key\'s id', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    await w.ask(client, 'search_knowledge', { query: 'quote' });
    await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' });
    await w.ask(client, 'search_knowledge', {});
    await client.close();
    await w.flush();
    expect(w.rows.map((row) => [row.tool, callerOf(row)])).toEqual([
      ['search_knowledge', 'key k-live'], ['get_knowledge', 'key k-live'], ['search_knowledge', 'key k-live'],
    ]);
  });

  it('never keeps a refusal: a server turned on serves the very next call', async () => {
    const w = await world();
    w.state.on = false;
    expect((await w.post('acme-app', LIVE, INITIALIZE)).status).toBe(404);
    w.state.on = true;
    expect((await w.post('acme-app', LIVE, INITIALIZE)).status).toBe(200);
    expect(w.calls.filter((call) => call === 'access acme-app')).toHaveLength(2);
  });

  it('a merge that keeps a new pack drops the kept access: the next call asks again and reads the new pack', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    expect((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).text).toContain('above zero');
    w.state.widgetsPack = 'pack-widgets-2';
    w.state.laws = lawsFile('A quote can be sent only once its customer has an address.');
    const after = GetAnswerSchema.parse(JSON.parse((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).text));
    await client.close();
    expect(after.entry.body).toContain('once its customer has an address');
    expect(w.calls.filter((call) => call === 'access acme-app')).toHaveLength(2);
  });

  it('a revoked key, or one whose maker left, drops the kept access and reads nothing on its next call (BL-ACCESS-1)', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    expect((await w.ask(client, 'search_knowledge', {})).isError).toBe(false);
    w.state.makerIsMember = false;
    expect(await w.ask(client, 'search_knowledge', {})).toEqual({ isError: true, text: KEY_REFUSED });
    w.state.makerIsMember = true;
    expect((await w.ask(client, 'search_knowledge', {})).isError).toBe(false);
    await client.close();
  });

  it('keeps one access per key: a narrower key of the same product reads only its own repositories', async () => {
    const w = await world();
    expect((await w.call(LIVE, 'search_knowledge', { kind: 'business-law' })).isError).toBe(false);
    const narrow = SearchAnswerSchema.parse(JSON.parse((await w.call(NARROW, 'search_knowledge', { query: 'api key' })).text));
    expect(narrow.repositories.map((r) => r.repo)).toEqual(['acme/api']);
  });
});

describe('/api/products/<key>/mcp serves a member\'s kit sign-in as it serves an API key (PRD 3007 s1)', () => {
  it('AC-1: a member\'s sign-in lists the same tools and gets the same hits and entries a key of the workspace gets', async () => {
    const w = await world();
    const client = await w.connect(MAX);
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(['get_knowledge', 'search_knowledge']);
    await client.close();
    for (const [tool, args] of [['search_knowledge', { query: 'api key' }], ['search_knowledge', { kind: 'business-law' }], ['get_knowledge', { id: 'BL-QUOTES-1' }]] as const) {
      const member = await w.call(MAX, tool, args);
      expect(member.isError).toBe(false);
      expect(member).toEqual(await w.call(LIVE, tool, args));
    }
  });

  it('checks the token at the Auth server, and never asks it about an API key', async () => {
    const w = await world();
    await w.call(LIVE, 'search_knowledge', {});
    expect(w.authAsked).toEqual([]);
    await w.call(MAX, 'search_knowledge', {});
    expect(w.authAsked.length).toBeGreaterThan(0);
    expect(new Set(w.authAsked)).toEqual(new Set([MAX]));
  });

  it('a sign-in the Auth server refuses answers 401, so the kit renews it, and never reaches the database (AC-2)', async () => {
    const w = await world();
    const stale = await w.post('acme-app', STALE, INITIALIZE);
    expect(stale.status).toBe(401);
    expect(await stale.json()).toEqual({ error: 'This sign-in is not valid any more. Sign in again.' });
    expect(w.calls).toEqual([]);
  });

  it('a sign-in the Auth server cannot judge answers 503, never reaching the database', async () => {
    const w = await world();
    const down = await w.post('acme-app', AUTH_DOWN, INITIALIZE);
    expect(down.status).toBe(503);
    expect(await down.json()).toEqual({ error: 'The sign-in service could not be reached. Try again.' });
    expect(w.calls).toEqual([]);
  });

  it('a person of no workspace the product is in, a product off, archived or unknown answers 404, as a working key\'s cases do (AC-2)', async () => {
    const w = await world();
    for (const [key, token] of [['acme-app', HAL], ['nope', MAX]] as const) {
      const refused = await w.post(key, token, INITIALIZE);
      expect(refused.status).toBe(404);
      expect(await refused.json()).toEqual({ error: 'No MCP server here.' });
    }
    w.state.on = false;
    expect((await w.post('acme-app', MAX, INITIALIZE)).status).toBe(404);
  });

  it('AC-2: once the person leaves the workspace, the very next call of a client already connected reads nothing (BL-ACCESS-1)', async () => {
    const w = await world();
    const client = await w.connect(MAX);
    expect((await w.ask(client, 'search_knowledge', { query: 'quote' })).isError).toBe(false);
    w.state.maxIsMember = false;
    await expect(w.ask(client, 'search_knowledge', { query: 'quote' })).rejects.toThrow(/No MCP server here\./);
    await client.close();
    expect((await w.post('acme-app', MAX, INITIALIZE)).status).toBe(404);
  });

  it('turned off, the next call of a member\'s client already connected answers 404', async () => {
    const w = await world();
    const client = await w.connect(MAX);
    expect((await w.ask(client, 'search_knowledge', {})).isError).toBe(false);
    w.state.on = false;
    await expect(w.ask(client, 'search_knowledge', {})).rejects.toThrow(/No MCP server here\./);
    await client.close();
  });

  it('answers 503 with no database, and 500 when the database fails, logged without the token', async () => {
    expect((await (await world({ database: false })).post('acme-app', MAX, INITIALIZE)).status).toBe(503);
    const w = await world({ failing: true });
    const failed = await w.post('acme-app', MAX, INITIALIZE);
    expect(failed.status).toBe(500);
    expect(w.logged).toEqual(['product mcp: product_mcp_for_member: the database refused: boom']);
    expect(w.logged.join('')).not.toContain(MAX);
  });

  it('AC-9: logs a member\'s search under the person and no key, and opens the search a get_knowledge follows for that person', async () => {
    const w = await world();
    const { text } = await w.call(MAX, 'search_knowledge', { query: 'api key' });
    const answer = SearchAnswerSchema.parse(JSON.parse(text));
    await w.call(MAX, 'get_knowledge', { id: 'BL-QUOTES-1' });
    await w.flush();
    expect(w.rows).toHaveLength(2);
    const [search, get] = w.rows;
    const { asked_at: askedAt, ...row } = search ?? { asked_at: '' };
    expect(row).toEqual({
      product_id: 'p-acme', workspace_id: 'w-acme', user_id: 'u-max', tool: 'search_knowledge',
      query: 'api key', filters: {}, mode: 'words', total: answer.total, hit_ids: answer.hits.map((hit) => hit.id), nearest_distance: null,
    });
    expect(Date.parse(askedAt)).not.toBeNaN();
    expect(get).not.toHaveProperty('api_key_id');
    expect(JSON.stringify(w.rows)).not.toContain(MAX);
    expect(w.opened).toEqual([{ by: { user_id: 'u-max' }, productId: 'p-acme', id: 'BL-QUOTES-1', askedAt: get?.asked_at }]);
  });

  it('a key\'s row is unchanged: its key\'s id and no person', async () => {
    const w = await world();
    await w.call(LIVE, 'search_knowledge', { query: 'quote' });
    await w.flush();
    expect(w.rows[0]).toHaveProperty('api_key_id', 'k-live');
    expect(w.rows[0]).not.toHaveProperty('user_id');
  });

  it('a call refused at the sign-in or by membership adds no row', async () => {
    const w = await world();
    await w.post('acme-app', STALE, INITIALIZE);
    await w.post('acme-app', HAL, INITIALIZE);
    w.state.maxIsMember = false;
    await w.post('acme-app', MAX, INITIALIZE);
    await w.flush();
    expect(w.rows).toEqual([]);
  });

  it('keeps a member\'s access a minute by the person, and asks on every call whether they are still a member, the switch and the newest packs (#2954)', async () => {
    const w = await world();
    const client = await w.connect(MAX);
    const before = w.calls.length;
    expect((await w.ask(client, 'search_knowledge', { query: 'quote' })).isError).toBe(false);
    expect((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).isError).toBe(false);
    await client.close();
    expect(w.calls.filter((call) => call === 'member acme-app')).toHaveLength(1);
    const asked = w.calls.slice(before);
    expect(asked.length).toBeGreaterThanOrEqual(6);
    expect(asked.length % 3).toBe(0);
    for (let at = 0; at < asked.length; at += 3) expect(asked.slice(at, at + 3)).toEqual(['isMember', 'productOpen', 'newestPacks']);
  });

  it('a member\'s kept access is never a key\'s: a key and a sign-in of the same product each ask the database once', async () => {
    const w = await world();
    await w.call(LIVE, 'search_knowledge', {});
    await w.call(MAX, 'search_knowledge', {});
    expect(w.calls.filter((call) => call === 'access acme-app')).toHaveLength(1);
    expect(w.calls.filter((call) => call === 'member acme-app')).toHaveLength(1);
  });
});

describe('/api/products/<key>/mcp answers GET and DELETE 405, before any sign-in or database read (#3250)', () => {
  // A stateless server offers no event stream and no session to end: the MCP spec's answer is 405, which a
  // client reads as "no stream here" and stops asking. A 200 whose stream closes made every client reconnect
  // every few seconds, each time running the key check and the product's reads.
  const request = (w: Awaited<ReturnType<typeof world>>, method: 'GET' | 'DELETE', token: string | null) => handleProductMcp(new Request('https://omni.example/api/products/acme-app/mcp', {
    method,
    headers: { accept: 'text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  }), 'acme-app', w.deps);

  it('a GET with a working key, a member\'s sign-in or no key answers 405, allowing POST, and asks nobody', async () => {
    const w = await world();
    for (const token of [LIVE, MAX, null]) {
      const answer = await request(w, 'GET', token);
      expect(answer.status).toBe(405);
      expect(answer.headers.get('allow')).toBe('POST');
    }
    expect(w.calls).toEqual([]);
    expect(w.authAsked).toEqual([]);
  });

  it('a DELETE answers 405 too, and asks nobody', async () => {
    const w = await world();
    for (const token of [LIVE, MAX]) expect((await request(w, 'DELETE', token)).status).toBe(405);
    expect(w.calls).toEqual([]);
    expect(w.authAsked).toEqual([]);
  });

  it('answers 405 with no database too: the method is refused before anything else', async () => {
    const w = await world({ database: false });
    expect((await request(w, 'GET', LIVE)).status).toBe(405);
  });

  it('a connected client still lists the tools and answers, and its one GET is the 405', async () => {
    const w = await world();
    const methods: string[] = [];
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://omni.example/api/products/acme-app/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${LIVE}` } },
      fetch: async (url, init) => {
        const answer = await handleProductMcp(new Request(url, init), 'acme-app', w.deps);
        methods.push(`${init?.method ?? 'GET'} ${String(answer.status)}`);
        return answer;
      },
    });
    await client.connect(asTransport(transport));
    expect((await client.listTools()).tools).toHaveLength(2);
    expect((await w.ask(client, 'get_knowledge', { id: 'BL-QUOTES-1' })).isError).toBe(false);
    await client.close();
    expect(methods.filter((m) => m.startsWith('GET'))).toEqual(['GET 405']);
  });
});
