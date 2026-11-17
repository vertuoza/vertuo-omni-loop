// `omni kb search` and `omni kb get` (PRD 3007, s2), seen from the outside: through `main()` on a fixture
// repository, against a fake `fetch` that answers the product's MCP route. No network, no GitHub.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import { KNOWLEDGE_OFF, keyOfName, NO_PRODUCT, NOT_SIGNED_IN, UNREACHABLE } from '../lib/knowledge/product-mcp-client.ts';
import { main } from './omni.ts';

const URL_BASE = 'https://omni.test';

type Seen = { url: string; method: string; auth: string | null; body: unknown };

const SEARCH = {
  hits: [
    { id: 'BL-ACCESS-1', kind: 'business-law', title: 'A person who leaves loses every access', repo: null, domain: 'access', snippet: 'tokens included' },
    { id: 'omni/ADR-0067', kind: 'adr', title: 'API keys', repo: 'acme/widgets', domain: null, snippet: 'a key is hashed' },
  ],
  total: 2,
  mode: 'words',
  repositories: [],
};

const tool = (payload: unknown, isError = false) => Response.json({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }], ...(isError ? { isError: true } : {}) } });

/** The JSON body a request carries, or null. */
const bodyOf = (init: RequestInit): unknown => (typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null);

type Route =(seen: Seen) => Response | Promise<Response>;

async function omni(args: string[], { route, tokens: stored = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } }, remembered = true }: {
  route: Route; tokens?: Record<string, Tokens>; remembered?: boolean;
}) {
  const { root } = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${URL_BASE}\n`,
      ...(remembered ? { '.omni-loop/local/product.json': JSON.stringify({ key: 'omni-loop', usedAt: '2026-11-17T10:00:00.000Z' }) } : {}),
    },
  });
  const store = { ...stored };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  const seen: Seen[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const headers = new Headers(init.headers);
    const entry = { url: url.replace(URL_BASE, ''), method: String(init.method), auth: headers.get('authorization'), body: bodyOf(init) };
    seen.push(entry);
    return route(entry);
  };
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['kb', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, fetch, env: {} });
  return { code, out: out.join(''), err: err.join(''), seen };
}

describe('omni kb search', () => {
  it('AC-8: prints the hits best first, each with its id, kind and repository', async () => {
    const run = await omni(['search', 'API', 'keys'], { route: () => tool(SEARCH) });
    expect(run.code).toBe(0);
    expect(run.out).toBe([
      'BL-ACCESS-1 · business-law · the product — A person who leaves loses every access',
      '  tokens included',
      'omni/ADR-0067 · adr · acme/widgets — API keys',
      '  a key is hashed',
      '',
    ].join('\n'));
    expect(run.seen).toHaveLength(1);
    expect(run.seen[0]).toMatchObject({ url: '/api/products/omni-loop/mcp', method: 'POST', auth: 'Bearer access-1' });
    expect(run.seen[0]?.body).toMatchObject({ method: 'tools/call', params: { name: 'search_knowledge', arguments: { query: 'API keys' } } });
  });

  it('sends the filters it is given', async () => {
    const run = await omni(['search', 'quote', '--kind', 'adr', '--domain', 'quotes', '--repo', 'acme/widgets'], { route: () => tool(SEARCH) });
    expect(run.seen[0]?.body).toMatchObject({ params: { arguments: { query: 'quote', kind: 'adr', domain: 'quotes', repo: 'acme/widgets' } } });
  });

  it('says so when nothing matches, never an empty list', async () => {
    const run = await omni(['search', 'zzz'], { route: () => tool({ hits: [], total: 0, repositories: [] }) });
    expect(run.out).toBe("No hit: the product's knowledge holds no answer to this search.\n");
  });

  it('prints the server\'s answer as it is under --json', async () => {
    const run = await omni(['search', 'x', '--json'], { route: () => tool(SEARCH) });
    expect(JSON.parse(run.out)).toEqual(SEARCH);
  });

  it('is a usage error with nothing to search', async () => {
    const run = await omni(['search'], { route: () => tool(SEARCH) });
    expect(run.code).toBe(2);
    expect(run.seen).toEqual([]);
  });

  it('renews the sign-in once on a 401 and sends the call again', async () => {
    let calls = 0;
    const run = await omni(['search', 'x'], {
      route: (seen) => {
        if (seen.url === '/api/ask/token') return Response.json({ access_token: 'access-2', refresh_token: 'refresh-2' });
        calls += 1;
        return calls === 1 ? new Response('{}', { status: 401 }) : tool(SEARCH);
      },
    });
    expect(run.code).toBe(0);
    expect(run.seen.filter((s) => s.url.endsWith('/mcp')).map((s) => s.auth)).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('reads the product from omni product which when the checkout remembers none', async () => {
    const run = await omni(['get', 'BL-ACCESS-1'], {
      remembered: false,
      route: (seen) => (seen.url.startsWith('/api/products/which') ? Response.json({ products: [{ name: 'Omni Loop' }] }) : tool({ entry: { id: 'BL-ACCESS-1', kind: 'business-law', title: 'T', repo: null, domain: 'access', body: 'The whole body.', file: null, status: null }, repositories: [] })),
    });
    expect(run.seen.map((s) => s.url)).toEqual(['/api/products/which?repo=acme%2Fwidgets', '/api/products/omni-loop/mcp']);
    expect(run.out).toBe('BL-ACCESS-1 · business-law · the product · domain access — T\n\nThe whole body.\n');
  });
});

describe('under OMNI_TOKEN', () => {
  it('trades the kit token for an access token and is served', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${URL_BASE}\n`, '.omni-loop/local/product.json': JSON.stringify({ key: 'omni-loop', usedAt: '2026-11-17T10:00:00.000Z' }) } });
    const held = new Map<string, Tokens>();
    const tokens = { omniToken: 'omni_secret', read: (host: string): Tokens => held.get(host) ?? { access_token: '', expires_at: 0 }, write: (host: string, entry: Tokens) => { held.set(host, entry); } };
    const seen: Seen[] = [];
    const fetch = (url: string, init: RequestInit): Promise<Response> => {
      const headers = new Headers(init.headers);
      seen.push({ url: url.replace(URL_BASE, ''), method: String(init.method), auth: headers.get('authorization'), body: bodyOf(init) });
      return Promise.resolve(url.endsWith('/api/ask/token') ? Response.json({ access_token: 'traded-1' }) : tool(SEARCH));
    };
    const out: string[] = [];
    const code = await main(['kb', 'search', 'x'], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => 0 }, tokens, fetch, env: {} });
    expect(code).toBe(0);
    expect(seen.map((s) => [s.url, s.auth])).toEqual([['/api/ask/token', null], ['/api/products/omni-loop/mcp', 'Bearer traded-1']]);
    expect(seen[0]?.body).toEqual({ omni_token: 'omni_secret' });
  });
});

describe('omni kb get', () => {
  it('prints one entry whole (AC-8)', async () => {
    const run = await omni(['get', 'term:API key'], {
      route: () => tool({ entry: { id: 'term:API key', kind: 'term', title: 'API key', repo: 'acme/widgets', domain: null, body: 'A secret.', file: 'glossary.md', status: null }, repositories: [] }),
    });
    expect(run.code).toBe(0);
    expect(run.out).toBe('term:API key · term · acme/widgets — API key\n\nA secret.\n');
    expect(run.seen[0]?.body).toMatchObject({ params: { name: 'get_knowledge', arguments: { id: 'term:API key' } } });
  });

  it('prints the server\'s one line for an id it does not hold, and exits 1', async () => {
    const run = await omni(['get', 'X-1'], { route: () => tool('No knowledge entry X-1 in omni-loop. Search for it with search_knowledge.', true) });
    expect(run).toMatchObject({ code: 1, out: 'No knowledge entry X-1 in omni-loop. Search for it with search_knowledge.\n' });
  });
});

describe('the one-line failures', () => {
  const line = async (args: string[], options: Parameters<typeof omni>[1]) => {
    const run = await omni(args, options);
    return { code: run.code, out: run.out, calls: run.seen.length };
  };

  it('AC-5: no sign-in: says to sign in, calling nothing', async () => {
    expect(await line(['search', 'x'], { route: () => tool(SEARCH), tokens: {} })).toEqual({ code: 1, out: 'Not signed in to the Omni page: run omni signin.\n', calls: 0 });
  });

  it('a sign-in the page refuses after a renewal: says to sign in', async () => {
    const run = await line(['search', 'x'], { route: (seen) => (seen.url === '/api/ask/token' ? new Response('{}', { status: 401 }) : new Response('{}', { status: 401 })) });
    expect(run).toMatchObject({ code: 1, out: 'Not signed in to the Omni page: run omni signin.\n' });
  });

  it('AC-3: knowledge off (a 404): says a workspace owner turns it on', async () => {
    expect(await line(['search', 'x'], { route: () => Response.json({ error: 'No MCP server here.' }, { status: 404 }) })).toMatchObject({
      code: 1, out: "This product's knowledge is off: a workspace owner turns it on in Product settings.\n",
    });
  });

  it('a repository in no product: says its knowledge is in omni kb show', async () => {
    expect(await line(['search', 'x'], { remembered: false, route: () => Response.json({ products: [] }) })).toMatchObject({
      code: 1, out: 'This repository is in no product: its knowledge is in omni kb show.\n',
    });
  });

  it('the page unreachable: says to carry on with omni kb show', async () => {
    expect(await line(['search', 'x'], { route: () => Promise.reject(new Error('offline')) })).toMatchObject({
      code: 1, out: 'The Omni page is unreachable: carry on with omni kb show.\n',
    });
  });

  it('a timeout is the same line, never a wait', async () => {
    const timeout = () => Promise.reject(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    expect(await line(['get', 'X-1'], { route: timeout })).toMatchObject({ code: 1, out: 'The Omni page is unreachable: carry on with omni kb show.\n' });
  });

  it('a server error is the unreachable line', async () => {
    expect(await line(['search', 'x'], { route: () => new Response('boom', { status: 500 }) })).toMatchObject({ out: 'The Omni page is unreachable: carry on with omni kb show.\n' });
  });
});

describe('the lines and the key', () => {
  it('are the spec\'s, word for word', () => {
    expect([NOT_SIGNED_IN, KNOWLEDGE_OFF, NO_PRODUCT, UNREACHABLE]).toEqual([
      'Not signed in to the Omni page: run omni signin.',
      "This product's knowledge is off: a workspace owner turns it on in Product settings.",
      'This repository is in no product: its knowledge is in omni kb show.',
      'The Omni page is unreachable: carry on with omni kb show.',
    ]);
  });

  it('read a product name as a key', () => {
    expect([keyOfName('Omni Loop'), keyOfName(' Field  App! '), keyOfName('42'), keyOfName('')]).toEqual(['omni-loop', 'field-app', null, null]);
  });
});
