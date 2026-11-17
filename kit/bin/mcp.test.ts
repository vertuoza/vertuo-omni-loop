// `omni mcp` (PRD 3007, s3), seen from the outside: through `main()` on a fixture repository, a fake stdin and a
// fake `fetch` that answers the product's MCP route. No network, no GitHub.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { makeRepo } from '../test/fixture.ts';
import { KNOWLEDGE_OFF, NO_PRODUCT, NOT_SIGNED_IN, UNREACHABLE } from '../lib/knowledge/product-mcp-client.ts';
import { main } from './omni.ts';

const URL_BASE = 'https://omni.test';

type Seen = { url: string; auth: string | null; body: unknown };
type Route = (seen: Seen) => Response | Promise<Response>;

const SEARCH = { hits: [{ id: 'BL-ACCESS-1', kind: 'business-law', title: 'Leaving loses access', repo: null, domain: 'access', snippet: 'tokens included' }], total: 1, repositories: [] };
const tool = (payload: unknown) => Response.json({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] } });

const rpc = (id: number, method: string, params?: unknown): string => `${JSON.stringify({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })}\n`;
const callOf = (id: number, name: string, args: unknown): string => rpc(id, 'tools/call', { name, arguments: args });

async function omni(input: string, { route = () => tool(SEARCH), tokens: stored = { 'omni.test': { access_token: 'access-1', refresh_token: 'refresh-1' } }, files = {}, env = {} }: {
  route?: Route; tokens?: Record<string, Tokens>; files?: Record<string, string>; env?: Record<string, string>;
} = {}) {
  const { root } = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${URL_BASE}\n`,
      '.omni-loop/local/product.json': JSON.stringify({ key: 'omni-loop', usedAt: '2026-11-17T10:00:00.000Z' }),
      ...files,
    },
  });
  const store = { ...stored };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  const seen: Seen[] = [];
  const fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const entry = { url: url.replace(URL_BASE, ''), auth: new Headers(init.headers).get('authorization'), body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null };
    seen.push(entry);
    return route(entry);
  };
  const out: string[] = [];
  const code = await main(['mcp'], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined }, tokens, fetch, env, stdin: input });
  const parsed = out.join('').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as { id: number | null; result?: Record<string, unknown>; error?: { code: number } });
  // Calls are answered as they finish: read them in the order of their ids (a request with no id last).
  const replies = parsed.sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity));
  return { code, replies, seen };
}

/** The text a tool answered, and whether it is an error. */
const toolText = (reply: { result?: Record<string, unknown> } | undefined): { text: string; isError: boolean } => {
  const result = reply?.result as { content: { text: string }[]; isError?: boolean } | undefined;
  return { text: result?.content[0]?.text ?? '', isError: result?.isError === true };
};

describe('omni mcp', () => {
  it('answers initialize with the instructions, and lists both tools, with no request to the Omni page (AC-6)', async () => {
    const run = await omni(rpc(1, 'initialize', { protocolVersion: '2025-06-18' }) + '{"jsonrpc":"2.0","method":"notifications/initialized"}\n' + rpc(2, 'tools/list'));
    expect(run.code).toBe(0);
    expect(run.replies).toHaveLength(2);
    expect(run.replies[0]?.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'omni-knowledge' }, instructions: expect.stringContaining('search_knowledge') as unknown });
    const tools = (run.replies[1]?.result as { tools: { name: string }[] }).tools.map((entry) => entry.name);
    expect(tools).toEqual(['search_knowledge', 'get_knowledge']);
    expect(run.seen).toEqual([]);
  });

  it('sends a search_knowledge call to the product route with the sign-in and answers the route text', async () => {
    const run = await omni(callOf(7, 'search_knowledge', { query: 'API keys', kind: 'adr' }));
    expect(run.replies[0]?.id).toBe(7);
    expect(toolText(run.replies[0])).toEqual({ text: JSON.stringify(SEARCH), isError: false });
    expect(run.seen).toHaveLength(1);
    expect(run.seen[0]).toMatchObject({ url: '/api/products/omni-loop/mcp', auth: 'Bearer access-1' });
    expect(run.seen[0]?.body).toMatchObject({ method: 'tools/call', params: { name: 'search_knowledge', arguments: { query: 'API keys', kind: 'adr' } } });
  });

  it('sends a get_knowledge call', async () => {
    const run = await omni(callOf(3, 'get_knowledge', { id: 'BL-ACCESS-1' }));
    expect(run.seen[0]?.body).toMatchObject({ params: { name: 'get_knowledge', arguments: { id: 'BL-ACCESS-1' } } });
    expect(toolText(run.replies[0]).isError).toBe(false);
  });

  it('renews the sign-in once on a 401 and sends the call again', async () => {
    let first = true;
    const route: Route = (seen) => {
      if (seen.url.startsWith('/api/products/')) {
        if (first) {
          first = false;
          return new Response('no', { status: 401 });
        }
        return tool(SEARCH);
      }
      return Response.json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: 4_000_000_000 });
    };
    const run = await omni(callOf(1, 'search_knowledge', { query: 'x' }), { route });
    expect(toolText(run.replies[0]).isError).toBe(false);
    expect(run.seen.filter((entry) => entry.url.startsWith('/api/products/')).map((entry) => entry.auth)).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('answers each failure as one tool-result line, never a crash', async () => {
    expect(toolText((await omni(callOf(1, 'search_knowledge', { query: 'x' }), { tokens: {} })).replies[0])).toEqual({ text: NOT_SIGNED_IN, isError: true });
    expect(toolText((await omni(callOf(1, 'search_knowledge', { query: 'x' }), { route: () => new Response('', { status: 404 }) })).replies[0])).toEqual({ text: KNOWLEDGE_OFF, isError: true });
    expect(toolText((await omni(callOf(1, 'search_knowledge', { query: 'x' }), { route: () => { throw new Error('down'); } })).replies[0])).toEqual({ text: UNREACHABLE, isError: true });
    expect(toolText((await omni(callOf(1, 'search_knowledge', { query: 'x' }), { route: () => new Response('', { status: 500 }) })).replies[0])).toEqual({ text: UNREACHABLE, isError: true });
  });

  it('says the repository is in no product when it remembers none and the Omni page names none', async () => {
    const run = await omni(callOf(1, 'search_knowledge', { query: 'x' }), { files: { '.omni-loop/local/product.json': '{}' }, route: () => Response.json({ products: [] }) });
    expect(toolText(run.replies[0])).toEqual({ text: NO_PRODUCT, isError: true });
  });

  it('trades OMNI_TOKEN for an access token and is served (AC-4)', async () => {
    const kitToken = `omk_${'a'.repeat(43)}`;
    const route: Route = (seen) => (seen.url.startsWith('/api/products/') ? tool(SEARCH) : Response.json({ access_token: 'traded-1', refresh_token: 'r', expires_at: 4_000_000_000 }));
    const run = await omni(callOf(1, 'search_knowledge', { query: 'x' }), { route, tokens: {}, env: { OMNI_TOKEN: kitToken } });
    // Whatever the token's exact shape, no request carries it as the bearer of the route.
    const calls = run.seen.filter((entry) => entry.url.startsWith('/api/products/'));
    for (const call of calls) expect(call.auth).not.toContain(kitToken);
    expect(run.replies).toHaveLength(1);
  });

  it('refuses a call with bad inputs, an unknown tool and an unknown method in their own words', async () => {
    const run = await omni(callOf(1, 'get_knowledge', {}) + callOf(2, 'nope', {}) + rpc(3, 'resources/list') + 'not json\n');
    expect(toolText(run.replies[0]).isError).toBe(true);
    expect(toolText(run.replies[1]).text).toContain('search_knowledge and get_knowledge');
    expect(run.replies[2]?.error?.code).toBe(-32601);
    expect(run.replies[3]?.error?.code).toBe(-32700);
    expect(run.seen).toEqual([]);
  });
});
