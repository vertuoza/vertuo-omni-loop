import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { describe, expect, it } from 'vitest';
import { handleMcp, type McpDeps } from './server';

// `/api/mcp` answers GET and DELETE 405, before anything else is read (#3260, the follow-up of #3250).
// A stateless server offers no event stream and no session to end: the MCP spec's answer is 405, which a
// client reads as "no stream here" and stops asking. A 200 whose stream closed at once would make every
// client reconnect every few seconds. The database here only records that it was asked.

const LIVE = 'omb_' + 'A'.repeat(43);

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
  const deps: McpDeps = {
    connect: database
      ? () => ({ rpc: (fn: string) => { asked.push(`db ${fn}`); return Promise.resolve({ data: null, error: null }); } })
      : null,
  };
  const request = (method: 'GET' | 'DELETE', token: string | null) => handleMcp(new Request('https://omni.example/api/mcp', {
    method,
    headers: { accept: 'text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  }), deps);
  return { asked, deps, request };
}

describe('/api/mcp answers GET and DELETE 405, before anything is read (#3260)', () => {
  it('a GET with a link or with none answers 405, allowing POST, and asks nobody', async () => {
    const w = world();
    for (const token of [LIVE, null]) {
      const answer = await w.request('GET', token);
      expect(answer.status).toBe(405);
      expect(answer.headers.get('allow')).toBe('POST');
    }
    expect(w.asked).toEqual([]);
  });

  it('a DELETE answers 405 too, and asks nobody', async () => {
    const w = world();
    const answer = await w.request('DELETE', LIVE);
    expect(answer.status).toBe(405);
    expect(answer.headers.get('allow')).toBe('POST');
    expect(w.asked).toEqual([]);
  });

  it('answers 405 with no database too: the method is refused before anything else', async () => {
    expect((await world({ database: false }).request('GET', LIVE)).status).toBe(405);
  });

  it('a connected client still lists the tools, and its one GET is the 405', async () => {
    const w = world();
    const methods: string[] = [];
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://omni.example/api/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${LIVE}` } },
      fetch: async (url, init) => {
        const answer = await handleMcp(new Request(url, init), w.deps);
        methods.push(`${init?.method ?? 'GET'} ${String(answer.status)}`);
        return answer;
      },
    });
    await client.connect(asTransport(transport));
    expect((await client.listTools()).tools).toHaveLength(4);
    await client.close();
    expect(methods.filter((m) => m.startsWith('GET'))).toEqual(['GET 405']);
  });
});
