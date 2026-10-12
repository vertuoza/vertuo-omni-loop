import { describe, expect, it } from 'vitest';
import type { KitToken } from './terminal-tokens.contract';
import { COULD_NOT, demoTerminalPort, httpTerminalPort, MADE_ROUTE, REVOKE_ROUTE } from './terminal-tokens.client';
import {
  atLimit, expiresLabel, initialTerminalState, madeLabel, terminalReducer, TERMINAL_LINE, tokenSignInHref, usedLabel, type ShownToken,
} from './terminal-tokens';

// Terminal tokens on your own profile (PRD 1628 s4): what a row says, where Make a token goes, the
// token shown once, Revoke's confirmation, the limit, and the browser's calls.

const NOW = Date.parse('2026-10-11T10:00:00Z');
const token = (over: Partial<KitToken> = {}): KitToken => ({
  id: 'k-1', name: 'claude-cloud', lastFour: '9fKa', createdAt: '2026-10-11T08:00:00Z', lastUsedAt: null, expiresAt: '2027-01-09T08:00:00Z', ...over,
});
const OMK = `omk_${'Q'.repeat(39)}9fKa`;
const SHOWN: ShownToken = { name: 'claude-cloud', token: OMK, expiresAt: '2027-01-09T08:00:00Z' };

describe('a row', () => {
  it('says Made, Used or Never used, and Expires, by day and month', () => {
    expect(madeLabel(token())).toBe('Made 11 Oct');
    expect(expiresLabel(token().expiresAt)).toBe('Expires 9 Jan');
    expect(usedLabel(token(), NOW)).toBe(TERMINAL_LINE.neverUsed);
    expect(usedLabel(token({ lastUsedAt: '2026-10-11T09:59:30Z' }), NOW)).toBe('Used just now');
    expect(usedLabel(token({ lastUsedAt: '2026-10-11T09:58:00Z' }), NOW)).toBe('Used 2 min ago');
    expect(usedLabel(token({ lastUsedAt: '2026-10-11T07:00:00Z' }), NOW)).toBe('Used 3 h ago');
    expect(usedLabel(token({ lastUsedAt: '2026-10-05T07:00:00Z' }), NOW)).toBe('Used 5 Oct');
  });
});

describe('Make a token', () => {
  it('opens the sign-in round trip for a token, coming back to your profile', () => {
    const href = new URL(tokenSignInHref('claude-cloud', 90, 'vertuoza', '/app/people/ada'), 'https://g.test');
    expect(href.pathname).toBe('/ask/signin');
    expect(Object.fromEntries(href.searchParams)).toEqual({ purpose: 'token', name: 'claude-cloud', days: '90', workspace: 'vertuoza', back: '/app/people/ada' });
  });

  it('says the limit is reached at 20 live tokens, both scopes together', () => {
    expect(atLimit(initialTerminalState({ tokens: [], live: 19 }))).toBe(false);
    expect(atLimit(initialTerminalState({ tokens: [], live: 20 }))).toBe(true);
    expect(atLimit(initialTerminalState({ tokens: null, live: null }))).toBe(false);
  });
});

describe('terminalReducer', () => {
  it('lists newest first, and shows a token made once, on top of the list', () => {
    let s = initialTerminalState({ tokens: [token({ id: 'old', createdAt: '2026-09-02T08:00:00Z' }), token({ id: 'new' })], live: 2 });
    expect(s.tokens?.map((t) => t.id)).toEqual(['new', 'old']);
    s = terminalReducer(s, { type: 'shown', shown: SHOWN, listed: token({ id: 'made' }) });
    expect(s.shown).toEqual(SHOWN);
    expect([s.tokens?.map((t) => t.id), s.live]).toEqual([['made', 'new', 'old'], 3]);
    s = terminalReducer(s, { type: 'copied' });
    expect(s.copied).toBe(true);
  });

  it('shows a token made by the round trip without listing it again', () => {
    const s = terminalReducer(initialTerminalState({ tokens: [token()], live: 1 }), { type: 'shown', shown: SHOWN });
    expect([s.tokens?.length, s.live, s.shown?.name]).toEqual([1, 1, 'claude-cloud']);
  });

  it('asks to confirm Revoke, then drops the row and frees a place under the limit', () => {
    let s = initialTerminalState({ tokens: [token()], live: 20 });
    s = terminalReducer(s, { type: 'confirm', id: 'k-1' });
    expect(s.confirming).toBe('k-1');
    expect(terminalReducer(s, { type: 'keep' }).confirming).toBeNull();
    s = terminalReducer(terminalReducer(s, { type: 'busy' }), { type: 'revoked', id: 'k-1' });
    expect([s.tokens, s.live, s.busy, s.confirming, atLimit(s)]).toEqual([[], 19, false, null, false]);
  });

  it('keeps a refusal, and forgets the confirmation', () => {
    const s = terminalReducer(terminalReducer(initialTerminalState({ tokens: [token()], live: 1 }), { type: 'confirm', id: 'k-1' }), { type: 'refused', message: 'no' });
    expect([s.refusal, s.confirming, s.tokens?.length]).toEqual(['no', null, 1]);
  });
});

function fetcher(status: number, body: unknown) {
  const sent: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = ((url: string, init: RequestInit) => {
    sent.push({ url, method: String(init.method), body: typeof init.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof globalThis.fetch;
  return { fetch, sent };
}

describe('httpTerminalPort', () => {
  it('takes the token just made from the made-token route, or none', async () => {
    const made = fetcher(200, { token: OMK, name: 'claude-cloud', expires_at: '2027-01-09T08:00:00Z' });
    expect(await httpTerminalPort('ws-1', made.fetch).takeMade()).toEqual(SHOWN);
    expect(made.sent).toEqual([{ url: MADE_ROUTE, method: 'POST', body: undefined }]);
    expect(await httpTerminalPort('ws-1', fetcher(404, { error: 'No token is waiting to be shown here: tokens are shown once.' }).fetch).takeMade()).toBeNull();
    expect(await httpTerminalPort('ws-1', fetcher(200, { token: 'omb_x', name: 'x', expires_at: 'y' }).fetch).takeMade()).toBeNull();
    const down = (() => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch;
    expect(await httpTerminalPort('ws-1', down).takeMade()).toBeNull();
  });

  it('revokes through the links’ route, as the signed-in person, and says its refusal', async () => {
    const gone = fetcher(200, { revoked: {} });
    expect(await httpTerminalPort('ws-1', gone.fetch).revoke('k-1')).toEqual({ ok: true });
    expect(gone.sent).toEqual([{ url: REVOKE_ROUTE, method: 'DELETE', body: { workspace: 'ws-1', token: 'k-1' } }]);
    const refused = fetcher(404, { error: 'That link is no longer here. Reload the page.' });
    expect(await httpTerminalPort('ws-1', refused.fetch).revoke('k-1')).toEqual({ ok: false, message: 'That link is no longer here. Reload the page.' });
    expect(await httpTerminalPort('ws-1', fetcher(500, 'down').fetch).revoke('k-1')).toEqual({ ok: false, message: COULD_NOT });
    expect(httpTerminalPort('ws-1').makeHere).toBeNull();
  });
});

describe('demoTerminalPort', () => {
  it('draws a token shaped as a real one, listed as yours, and never finds one waiting', async () => {
    const port = demoTerminalPort(() => NOW, (bytes) => bytes.fill(0));
    expect(await port.takeMade()).toBeNull();
    const made = await port.makeHere?.('demo', 30);
    expect(made?.shown.token).toBe(`omk_${'A'.repeat(43)}`);
    expect(made?.listed).toMatchObject({ name: 'demo', lastFour: 'AAAA', lastUsedAt: null, createdAt: '2026-10-11T10:00:00.000Z', expiresAt: '2026-11-10T10:00:00.000Z' });
    expect(await port.revoke('x')).toEqual({ ok: true });
  });
});
