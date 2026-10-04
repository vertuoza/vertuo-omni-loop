import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { describe, expect, it } from 'vitest';
import { readBusiness, type BusinessDeps } from '../../business-api/api';
import { hashToken } from '../tokens/token';
import { handleMcp, LINK_REFUSED, REPORTED, type McpDeps } from './server';
import { sure } from '../../arcade/test/sure';

// The MCP link (PRD 855 s2) driven by the SDK's own client, against a fake store that plays
// business_for_token() as supabase/migrations/20261028090000_agent_tokens.sql writes it: a live token's
// workspace's business, 28000 for a token that does not work (unknown, revoked, or its maker left),
// 22023 naming the tracked repositories when several products and no repository, 42501 another
// workspace's repository.

// The SDK's client transport, handed to its client as the Transport interface it implements: its
// class reads `sessionId` as `string | undefined`, which the interface's optional `sessionId` does not
// take under exactOptionalPropertyTypes. A stateless link never has a session id, so none is passed on.
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
const REVOKED = 'omb_' + 'R'.repeat(43);
const UNKNOWN = 'omb_' + 'U'.repeat(43);

const READ = {
  state: 'ok',
  business: { name: 'Acme' },
  product: null,
  claims: [
    { id: 'region#1', kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
    { id: 'region#2', kind: 'region', value: 'France', source: 'evidence', state: 'contradicted',
      receipt: 'acme/widgets:README.md — "offices in France"', lastSeen: '2026-09-28T22:00:00+00:00' },
    { id: 'size#3', kind: 'size', value: '2-50', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
    { id: 'never#4', kind: 'never', value: 'Build for groups of companies', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null },
  ],
  personas: [{ name: 'Marc', stance: 'skeptical', trade: 'plumber', who: 'Runs five plumbers', usage: 'Quotes' }],
};
const NONE = { state: 'none', business: null, product: null, claims: [], personas: [] };

type Call = { fn: string; args: Record<string, unknown> };

async function world({ read = READ, products = 1, database = true, reported = 0, judge = (): void => {} }: {
  read?: unknown; products?: number; database?: boolean; reported?: number; judge?: (id: string) => void;
} = {}) {
  const live = await hashToken(LIVE);
  const revoked = await hashToken(REVOKED);
  const calls: Call[] = [];
  // agent_question_report() (s3): stored, asked once more than before, or the limit's 54000.
  const report = () => (reported >= 30
    ? { data: null, error: { code: '54000', message: 'This link has sent 30 questions in 24 hours: tell your person this is not known yet, and do not guess.', hint: 'limit' } }
    : { data: { id: 'q-1', asked: reported + 1 }, error: null });
  const businessFor = (repo: string | null) => {
    if (repo && !repo.toLowerCase().startsWith('acme/')) {
      return { data: null, error: { code: '42501', message: `Repository: ${repo} is not one of this workspace's repositories.`, hint: 'repo' } };
    }
    if (!repo && products > 1) {
      return { data: null, error: { code: '22023', message: 'Repository: this workspace sells several products, so name the repository you work in: acme/app, acme/site.', hint: 'repo' } };
    }
    return { data: read, error: null };
  };
  const rpc = (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    if (args.p_hash !== live || args.p_hash === revoked) {
      return Promise.resolve({ data: null, error: { code: '28000', message: 'This link does not work: make a new one on Settings › Business.' } });
    }
    return Promise.resolve(fn === 'agent_question_report' ? report() : businessFor(args.p_repo as string | null));
  };
  // Jev's Unknown worth asking (s4): the questions handed to it once reported.
  const judged: string[] = [];
  const links: string[] = [];
  const deps: McpDeps = {
    connect: database ? () => ({ rpc }) : null,
    reported: (id, link) => {
      judged.push(id);
      links.push(link);
      judge(id);
    },
  };

  const connect = async (token: string | null) => {
    const client = new Client({ name: 'test-editor', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://omni.example/api/mcp'), {
      requestInit: token === null ? {} : { headers: { authorization: `Bearer ${token}` } },
      fetch: (url, init) => handleMcp(new Request(url, init), deps),
    });
    await client.connect(asTransport(transport));
    return client;
  };

  const call = async (token: string | null, name: string, args: Record<string, unknown> = {}) => {
    const client = await connect(token);
    try {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as Array<{ type: string; text: string }>;
      return { isError: result.isError === true, text: content.map((c) => c.text).join('\n') };
    } finally {
      await client.close();
    }
  };

  return { calls, connect, call, rpc, judged, links };
}

describe('/api/mcp, the MCP link', () => {
  it('lists three tools, whose descriptions say to cite claim ids and to report rather than guess', async () => {
    const w = await world();
    const client = await w.connect(LIVE);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_business', 'get_claims', 'report_unknown']);
    const business = sure(tools.find((t) => t.name === 'get_business'), 'tools.find((t) => t.name === \'get_business\')');
    expect(business.description).toMatch(/region#1/);
    expect(business.description).toMatch(/report_unknown/);
    expect(business.annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(business.inputSchema.properties ?? {})).toEqual(['repo']);
    const claims = sure(tools.find((t) => t.name === 'get_claims'), 'tools.find((t) => t.name === \'get_claims\')');
    expect(Object.keys(claims.inputSchema.properties ?? {}).sort()).toEqual(['kind', 'repo']);
    const report = sure(tools.find((t) => t.name === 'report_unknown'), 'tools.find((t) => t.name === \'report_unknown\')');
    expect(Object.keys(report.inputSchema.properties ?? {}).sort()).toEqual(['file', 'question', 'repo']);
  });

  it('get_business with a repository is byte-equal to GET /api/business on the same store answer', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'get_business', { repo: 'acme/widgets' });
    expect(isError).toBe(false);
    expect(w.calls).toEqual([{ fn: 'business_for_token', args: { p_hash: await hashToken(LIVE), p_repo: 'acme/widgets' } }]);

    const deps: BusinessDeps = {
      connect: (() => ({
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'ada', email: 'ada@acme.test' } }, error: null }) },
        rpc: () => Promise.resolve({ data: READ, error: null }),
      })) as unknown as NonNullable<BusinessDeps['connect']>,
    };
    const http = await readBusiness(new Request('https://omni.example/api/business?repo=acme/widgets', {
      headers: { authorization: 'Bearer ada-token' },
    }), deps);
    expect(text).toBe(await http.text());
  });

  it('get_business without a repository reads the only product', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'get_business');
    expect(isError).toBe(false);
    expect(JSON.parse(text)).toEqual(READ);
    expect(sure(w.calls[0], 'w.calls[0]').args).toEqual({ p_hash: await hashToken(LIVE), p_repo: null });
  });

  it('several products and no repository: an error naming the tracked repositories', async () => {
    const w = await world({ products: 2 });
    const { isError, text } = await w.call(LIVE, 'get_business');
    expect(isError).toBe(true);
    expect(text).toContain('acme/app, acme/site');
    expect(text).not.toMatch(/\n/);
  });

  it('an empty business answers state none, not an error', async () => {
    const w = await world({ read: NONE });
    const { isError, text } = await w.call(LIVE, 'get_business', { repo: 'acme/widgets' });
    expect(isError).toBe(false);
    expect(JSON.parse(text)).toEqual(NONE);
  });

  it('another workspace\'s repository is refused with the database\'s reason', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'get_business', { repo: 'other/thing' });
    expect(isError).toBe(true);
    expect(text).toBe('Repository: other/thing is not one of this workspace\'s repositories.');
  });

  it('a malformed repository is refused before the database is asked', async () => {
    const w = await world();
    const { isError } = await w.call(LIVE, 'get_business', { repo: 'widgets' });
    expect(isError).toBe(true);
    expect(w.calls).toEqual([]);
  });

  it('get_claims with a kind answers only that kind\'s claims; without, every claim', async () => {
    const w = await world();
    const region = await w.call(LIVE, 'get_claims', { kind: 'region', repo: 'acme/widgets' });
    expect(region.isError).toBe(false);
    expect(JSON.parse(region.text)).toEqual(READ.claims.filter((c) => c.kind === 'region'));
    const all = await w.call(LIVE, 'get_claims', { repo: 'acme/widgets' });
    expect(JSON.parse(all.text)).toEqual(READ.claims);
    const never = await w.call(LIVE, 'get_claims', { kind: 'never' });
    expect(JSON.parse(never.text)).toEqual([READ.claims[3]]);
  });

  it('no token, a malformed one, an unknown one and a revoked one each get the one line', async () => {
    for (const token of [null, 'not-a-token', 'omb_short', UNKNOWN, REVOKED]) {
      const w = await world();
      for (const tool of ['get_business', 'get_claims']) {
        const { isError, text } = await w.call(token, tool, { repo: 'acme/widgets' });
        expect(isError).toBe(true);
        expect(text).toBe(LINK_REFUSED);
      }
    }
    expect(LINK_REFUSED).toMatch(/Settings › Business/);
    expect(LINK_REFUSED).not.toMatch(/\n/);
  });

  it('a missing or malformed token never reaches the database', async () => {
    const w = await world();
    await w.call(null, 'get_business', { repo: 'acme/widgets' });
    await w.call('Basic xyz', 'get_business', { repo: 'acme/widgets' });
    expect(w.calls).toEqual([]);
  });

  it('report_unknown stores the question with its repository and file, and says it was sent to Settings › Business', async () => {
    const w = await world();
    const { isError, text } = await w.call(LIVE, 'report_unknown', {
      question: 'Do we sell in Luxembourg?', repo: 'acme/widgets', file: 'src/NewQuoteForm.tsx',
    });
    expect(isError).toBe(false);
    expect(text).toBe(REPORTED);
    expect(REPORTED).toMatch(/Settings › Business/);
    expect(w.calls).toEqual([{ fn: 'agent_question_report', args: {
      p_hash: await hashToken(LIVE), p_question: 'Do we sell in Luxembourg?', p_repo: 'acme/widgets', p_file: 'src/NewQuoteForm.tsx',
    } }]);
    const bare = await w.call(LIVE, 'report_unknown', { question: 'Who are our rivals?' });
    expect(bare.text).toBe(REPORTED);
    expect(sure(w.calls[1], 'w.calls[1]').args).toEqual({ p_hash: await hashToken(LIVE), p_question: 'Who are our rivals?', p_repo: null, p_file: null });
  });

  it('report_unknown says it was asked before when the same question came again', async () => {
    const w = await world({ reported: 1 });
    const { text } = await w.call(LIVE, 'report_unknown', { question: 'Do we sell in Luxembourg?' });
    expect(text).toMatch(/asked 2×/);
    expect(text).toMatch(/Settings › Business/);
  });

  it('a new question is handed to Jev\'s Unknown worth asking once stored; a repeat or a refusal is not (s4)', async () => {
    const w = await world();
    expect((await w.call(LIVE, 'report_unknown', { question: 'Is the sky blue?' })).text).toBe(REPORTED);
    expect(w.judged).toEqual(['q-1']);
    expect(w.links).toEqual([await hashToken(LIVE)]);
    const again = await world({ reported: 1 });
    await again.call(LIVE, 'report_unknown', { question: 'Is the sky blue?' });
    const limit = await world({ reported: 30 });
    await limit.call(LIVE, 'report_unknown', { question: 'Is the sky blue?' });
    expect([...again.judged, ...limit.judged]).toEqual([]);
  });

  it('a judge that throws never changes report_unknown\'s answer (s4)', async () => {
    const w = await world({ judge: () => { throw new Error('jev down'); } });
    const { isError, text } = await w.call(LIVE, 'report_unknown', { question: 'Is the sky blue?' });
    expect(isError).toBe(false);
    expect(text).toBe(REPORTED);
  });

  it('the 31st report of a link in 24 hours answers the limit\'s one line', async () => {
    const w = await world({ reported: 30 });
    const { isError, text } = await w.call(LIVE, 'report_unknown', { question: 'Do we sell in Luxembourg?' });
    expect(isError).toBe(true);
    expect(text).toBe('This link has sent 30 questions in 24 hours: tell your person this is not known yet, and do not guess.');
  });

  it('report_unknown with a link that does not work answers the one line, and a long question never reaches the database', async () => {
    const w = await world();
    for (const token of [null, UNKNOWN, REVOKED]) {
      const { isError, text } = await w.call(token, 'report_unknown', { question: 'Do we sell in Luxembourg?' });
      expect(isError).toBe(true);
      expect(text).toBe(LINK_REFUSED);
    }
    const long = await w.call(LIVE, 'report_unknown', { question: 'q'.repeat(301) });
    expect(long.isError).toBe(true);
    expect(w.calls.every((c) => c.args.p_hash !== undefined && (c.args.p_question as string).length <= 300)).toBe(true);
  });

  it('without a database, every tool says the business is not available here', async () => {
    const w = await world({ database: false });
    const { isError, text } = await w.call(LIVE, 'get_business');
    expect(isError).toBe(true);
    expect(text).toMatch(/not available here/);
  });

  it('a database failure answers one line, never the database\'s message', async () => {
    const deps: McpDeps = { connect: () => ({ rpc: () => Promise.resolve({ data: null, error: { code: 'XX000', message: 'secret internals' } }) }) };
    const client = new Client({ name: 't', version: '1' });
    await client.connect(asTransport(new StreamableHTTPClientTransport(new URL('https://omni.example/api/mcp'), {
      requestInit: { headers: { authorization: `Bearer ${LIVE}` } },
      fetch: (url, init) => handleMcp(new Request(url, init), deps),
    })));
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      const result = await client.callTool({ name: 'get_business', arguments: {} });
      const text = sure((result.content as Array<{ text: string }>)[0], 'the result\'s first content').text;
      expect(result.isError).toBe(true);
      expect(text).toBe('The business database could not answer. Try again.');
    } finally {
      console.error = original;
      await client.close();
    }
    expect(errors.length).toBe(1);
  });

  it('answers in JSON, never a session id (stateless)', async () => {
    const w = await world();
    const response = await handleMcp(new Request('https://omni.example/api/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${LIVE}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'curl', version: '1' } } }),
    }), { connect: () => ({ rpc: w.rpc }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    const body = (await response.json()) as { result: { serverInfo: { name: string }; instructions: string } };
    expect(body.result.serverInfo.name).toBe('omni-business');
    expect(body.result.instructions).toMatch(/report_unknown/);
  });
});
