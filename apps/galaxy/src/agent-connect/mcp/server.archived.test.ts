import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { describe, expect, it } from 'vitest';
import { hashToken } from '../tokens/token';
import { handleMcp } from './server';

// The MCP link for an archived product (PRD 2232 s3), against a fake store playing what
// supabase/migrations/20261217100000_archive_product.sql answers: business_for_token() reads
// `{state: 'archived', product: {name}}` with empty lists, knowledge_graph_for_token() refuses with P0002.
// These sit beside server.test.ts, which proves BR-PRODUCT-66 and stays untouched.

const asTransport = (inner: StreamableHTTPClientTransport): Transport => ({
  start: () => inner.start(),
  send: (message, options) => inner.send(message, options),
  close: () => inner.close(),
  setProtocolVersion: (version) => { inner.setProtocolVersion(version); },
  set onclose(handler: NonNullable<Transport['onclose']>) { inner.onclose = handler; },
  set onerror(handler: NonNullable<Transport['onerror']>) { inner.onerror = handler; },
  set onmessage(handler: NonNullable<Transport['onmessage']>) { inner.onmessage = handler; },
});

const LIVE = 'omb_' + 'A'.repeat(43);
const SENTENCE = 'product Omni Loop is archived: an owner restores it on its page';
const ARCHIVED = { state: 'archived', business: { name: 'Acme' }, product: { name: 'Omni Loop' }, claims: [], personas: [], legal: [], glossary: [] };

async function call(name: string, args: Record<string, unknown>) {
  const hash = await hashToken(LIVE);
  const rpc = (fn: string, given: Record<string, unknown>) => Promise.resolve(
    given.p_hash !== hash
      ? { data: null, error: { code: '28000', message: 'no' } }
      : fn === 'knowledge_graph_for_token'
        ? { data: null, error: { code: 'P0002', message: 'Product Omni Loop is archived: an owner restores it on its page.' } }
        : { data: ARCHIVED, error: null },
  );
  const client = new Client({ name: 'test-editor', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://omni.example/api/mcp'), {
    requestInit: { headers: { authorization: `Bearer ${LIVE}` } },
    fetch: (url, init) => handleMcp(new Request(url, init), { connect: () => ({ rpc }) }),
  });
  await client.connect(asTransport(transport));
  try {
    const result = await client.callTool({ name, arguments: args });
    const content = result.content as Array<{ type: string; text: string }>;
    return { isError: result.isError === true, text: content.map((part) => part.text).join('\n') };
  } finally {
    await client.close();
  }
}

describe('the MCP link, for an archived product', () => {
  it.each(['get_business', 'get_claims'])('%s says the product is archived, as a tool error', async (name) => {
    expect(await call(name, { repo: 'acme/widgets' })).toEqual({ isError: true, text: SENTENCE });
  });

  it('get_knowledge_graph answers the same sentence', async () => {
    expect(await call('get_knowledge_graph', { id: 'L-INVOICING-1', repo: 'acme/widgets' })).toEqual({ isError: true, text: SENTENCE });
  });
});
