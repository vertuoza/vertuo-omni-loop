import { describe, expect, it } from 'vitest';
import type { AgentToken } from './model';
import { COULD_NOT, DEMO_NAME_RULE, demoTokensPort, httpTokensPort } from './port';
import { initialTokensState, tokensReducer } from './state';

const containing = (text: string): unknown => expect.stringContaining(text);

// Connect an agent's calls and state (PRD 855 s1): the routes as the signed-in person, the demo's rules
// in memory, and a token shown once: Done forgets it.

const link = (over: Partial<AgentToken> = {}): AgentToken => ({
  id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-10-01T08:00:00Z', lastUsedAt: null,
  maker: { id: 'u-1', login: 'tom', name: 'Tom' }, mine: true, canRevoke: true, working: true, ...over,
});

function fetcher(status: number, body: unknown) {
  const sent: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = ((url: string, init: RequestInit) => {
    sent.push({ url, method: String(init.method), body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}

describe('httpTokensPort', () => {
  it('makes and revokes through /api/agent-tokens', async () => {
    const made = fetcher(201, { token: 'omb_x', url: 'https://g.test/api/mcp', listed: link() });
    expect(await httpTokensPort('ws-1', made.fetch).make('Tom’s editor')).toEqual({ ok: true, token: 'omb_x', url: 'https://g.test/api/mcp', listed: link() });
    expect(made.sent).toEqual([{ url: '/api/agent-tokens', method: 'POST', body: { workspace: 'ws-1', name: 'Tom’s editor' } }]);
    const gone = fetcher(200, { revoked: link() });
    expect(await httpTokensPort('ws-1', gone.fetch).revoke(link())).toEqual({ ok: true, revoked: link() });
    expect(gone.sent).toEqual([{ url: '/api/agent-tokens', method: 'DELETE', body: { workspace: 'ws-1', token: 't-1' } }]);
  });

  it('says the route’s refusal, or that it could not', async () => {
    expect(await httpTokensPort('ws-1', fetcher(429, { error: 'You hold 20 links already: revoke one to make another.' }).fetch).make('x'))
      .toEqual({ ok: false, message: 'You hold 20 links already: revoke one to make another.' });
    expect(await httpTokensPort('ws-1', fetcher(201, { token: 'omb_x' }).fetch).make('x')).toEqual({ ok: false, message: COULD_NOT });
    const down = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await httpTokensPort('ws-1', down).revoke(link())).toEqual({ ok: false, message: COULD_NOT });
  });
});

describe('demoTokensPort', () => {
  const origin = () => 'https://demo.test';

  it('makes a link of the viewer’s, with a real-looking token, and revokes it', async () => {
    const port = demoTokensPort([], origin);
    const made = await port.make(' My laptop ');
    if (!made.ok) throw new Error(made.message);
    expect(made.token).toMatch(/^omb_[A-Za-z0-9_-]{43}$/);
    expect(made.url).toBe('https://demo.test/api/mcp');
    expect(made.listed).toMatchObject({ name: 'My laptop', lastFour: made.token.slice(-4), mine: true, canRevoke: true, lastUsedAt: null });
    expect(await port.revoke(made.listed)).toEqual({ ok: true, revoked: made.listed });
    expect((await port.revoke(made.listed)).ok).toBe(false);
  });

  it('refuses a bad name, a name taken and the 21st link', async () => {
    const port = demoTokensPort([], origin);
    expect(await port.make('')).toEqual({ ok: false, message: DEMO_NAME_RULE });
    for (let i = 1; i <= 20; i++) expect((await port.make(`Link ${i}`)).ok).toBe(true);
    expect(await port.make('link 1')).toMatchObject({ ok: false, message: containing('already have a link named') });
    expect(await port.make('One more')).toEqual({ ok: false, message: 'You hold 20 links already: revoke one to make another.' });
  });
});

describe('tokensReducer', () => {
  it('shows a made token once, on top of the list, and forgets it on Done', () => {
    let s = initialTokensState([link({ id: 't-0', name: 'Old' })]);
    s = tokensReducer(s, { type: 'name', name: 'New' });
    s = tokensReducer(s, { type: 'busy' });
    s = tokensReducer(s, { type: 'made', token: 'omb_new', url: 'https://g/api/mcp', listed: link({ id: 't-1', name: 'New' }) });
    expect(s).toMatchObject({ busy: false, name: '', shown: { name: 'New', token: 'omb_new', url: 'https://g/api/mcp' } });
    expect(s.tokens.map((t) => t.id)).toEqual(['t-1', 't-0']);
    s = tokensReducer(s, { type: 'copied', label: 'Cursor' });
    expect(s.copied).toBe('Cursor');
    s = tokensReducer(s, { type: 'done' });
    expect(s.shown).toBeNull();
    expect(JSON.stringify(s)).not.toContain('omb_new');
  });

  it('drops a revoked link, and keeps a refusal until the name changes', () => {
    let s = initialTokensState([link()]);
    s = tokensReducer(s, { type: 'revoked', id: 't-1' });
    expect(s.tokens).toEqual([]);
    s = tokensReducer(s, { type: 'refused', message: 'no' });
    expect(s.refusal).toBe('no');
    expect(tokensReducer(s, { type: 'name', name: 'x' }).refusal).toBeNull();
  });
});
