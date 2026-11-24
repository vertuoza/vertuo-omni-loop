import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { describe, expect, it } from 'vitest';
import type { TokenCheck } from '../ask/auth';
import { handleProductMcp, type ProductMcpDeps } from './product-mcp.controller';
import type { ProductMcpRepository } from './product-mcp.repository';
import { productMcpService } from './product-mcp.service';

// `/api/products/<key>/mcp` answers GET and DELETE 405, before any sign-in check or database read (#3250).
// A stateless server offers no event stream and no session to end: the MCP spec's answer is 405, which a
// client reads as "no stream here" and stops asking. A 200 whose stream closed made every client reconnect
// every few seconds, each time running the key check and the product's reads. The repository and the Auth
// server here only record that they were asked.

const LIVE = 'oma_' + 'A'.repeat(43);
const SIGN_IN = ['sign-in', 'max', 'sig'].join('.');

// The SDK's client transport, handed to its client as the Transport interface it implements.
const asTransport = (inner: StreamableHTTPClientTransport): Transport => ({
  start: () => inner.start(),
  send: (message, options) => inner.send(message, options),
  close: () => inner.close(),
  setProtocolVersion: (version) => { inner.setProtocolVersion(version); },
  set onclose(handler: NonNullable<Transport['onclose']>) { inner.onclose = handler; },
  set onerror(handler: NonNullable<Transport['onerror']>) { inner.onerror = handler; },
  set onmessage(handler: NonNullable<Transport['onmessage']>) { inner.onmessage = handler; },
});

function world({ database = true }: { database?: boolean } = {}) {
  const asked: string[] = [];
  // Every read of the store records its name and answers nothing.
  const repository = new Proxy({}, {
    get: (_, name) => () => { asked.push(`db ${String(name)}`); return Promise.resolve(null); },
  }) as ProductMcpRepository;
  const signIn = (): TokenCheck => ({
    auth: { getUser: () => { asked.push('auth'); return Promise.resolve({ data: { user: null }, error: { status: 401, message: 'invalid JWT' } }); } },
  });
  const deps: ProductMcpDeps = {
    service: database ? productMcpService(repository) : null,
    signIn: database ? signIn : null,
    log: () => undefined,
  };
  const request = (method: 'GET' | 'DELETE', token: string | null) => handleProductMcp(new Request('https://omni.example/api/products/acme-app/mcp', {
    method,
    headers: { accept: 'text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  }), 'acme-app', deps);
  return { asked, deps, request };
}

describe('/api/products/<key>/mcp answers GET and DELETE 405, before any sign-in or database read (#3250)', () => {
  it('a GET with a key, a sign-in or no key answers 405, allowing POST, and asks nobody', async () => {
    const w = world();
    for (const token of [LIVE, SIGN_IN, null]) {
      const answer = await w.request('GET', token);
      expect(answer.status).toBe(405);
      expect(answer.headers.get('allow')).toBe('POST');
    }
    expect(w.asked).toEqual([]);
  });

  it('a DELETE answers 405 too, and asks nobody', async () => {
    const w = world();
    for (const token of [LIVE, SIGN_IN]) expect((await w.request('DELETE', token)).status).toBe(405);
    expect(w.asked).toEqual([]);
  });

  it('answers 405 with no database too: the method is refused before anything else', async () => {
    expect((await world({ database: false }).request('GET', LIVE)).status).toBe(405);
  });

  it('a connected client still lists the tools, and its one GET is the 405', async () => {
    const w = world();
    const methods: string[] = [];
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://omni.example/api/products/acme-app/mcp'), {
      fetch: async (url, init) => {
        const answer = await handleProductMcp(new Request(url, init), 'acme-app', w.deps);
        methods.push(`${init?.method ?? 'GET'} ${String(answer.status)}`);
        return answer;
      },
    });
    await client.connect(asTransport(transport));
    expect((await client.listTools()).tools).toHaveLength(2);
    await client.close();
    expect(methods.filter((m) => m.startsWith('GET'))).toEqual(['GET 405']);
  });
});
