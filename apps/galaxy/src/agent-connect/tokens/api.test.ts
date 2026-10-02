import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GONE, makeTokenRoute, NAME_RULE, nameTaken, ONLY_MAKER, ONLY_MEMBER, originOf, revokeTokenRoute, TOO_MANY, type TokenRouteDeps } from './api';
import type { AgentToken } from './model';
import { AgentTokenStoreError } from './store';
import type { MadeToken } from './token';

// Connect an agent's routes with a fake store (PRD 855 s1): a link is made from the token's hash and
// last four only, and the token is answered this once with galaxy's MCP address; each refusal of the
// database is one plain line.

const W = 'ws-1';
const MADE: MadeToken = { token: `omb_${'Q'.repeat(39)}Zz09`, hash: 'a'.repeat(64), lastFour: 'Zz09' };
const listed = (over: Partial<AgentToken> = {}): AgentToken => ({
  id: 't-1', name: 'Tom’s editor', lastFour: 'Zz09', createdAt: '2026-10-01T08:00:00Z', lastUsedAt: null,
  maker: { id: 'u-1', login: 'tom', name: 'Tom' }, mine: true, canRevoke: true, working: true, ...over,
});

function deps(fail?: AgentTokenStoreError) {
  const made: unknown[][] = [];
  const revoked: unknown[][] = [];
  const store = {
    make(...args: [string, string, string, string]) {
      if (fail) return Promise.reject(fail);
      made.push(args);
      return Promise.resolve(listed({ name: args[1] }));
    },
    revoke(...args: [string, string]) {
      if (fail) return Promise.reject(fail);
      revoked.push(args);
      return Promise.resolve(listed());
    },
  };
  const d: TokenRouteDeps = { store: () => Promise.resolve(store), draw: () => Promise.resolve(MADE) };
  return { deps: d, made, revoked };
}

const call = (method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://galaxy.test/api/agent-tokens', {
    method, headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const pgError = (code: string, hint?: string, reason = 'no') => new AgentTokenStoreError('make a link', code, hint, reason);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/agent-tokens', () => {
  it('stores only the hash and last four, and answers the token once with the MCP address', async () => {
    const { deps: d, made } = deps();
    const res = await makeTokenRoute(call('POST', { workspace: W, name: '  Tom’s editor ' }, { 'x-forwarded-host': 'galaxy.example', 'x-forwarded-proto': 'https' }), d);
    expect(res.status).toBe(201);
    expect(made).toEqual([[W, 'Tom’s editor', MADE.hash, MADE.lastFour]]);
    expect(made.flat()).not.toContain(MADE.token);
    const body: unknown = await res.json();
    expect(body).toEqual({ token: MADE.token, url: 'https://galaxy.example/api/mcp', listed: listed() });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('refuses the signed out, a malformed body and a bad name, drawing nothing', async () => {
    const draw = vi.fn(() => Promise.resolve(MADE));
    const { deps: d } = deps();
    expect((await makeTokenRoute(call('POST', { workspace: W, name: 'x' }), { ...d, store: () => Promise.resolve(null), draw })).status).toBe(401);
    expect((await makeTokenRoute(call('POST', 'not json'), { ...d, draw })).status).toBe(400);
    for (const name of ['', '   ', 'n'.repeat(41), 'two\nlines', 7]) {
      const res = await makeTokenRoute(call('POST', { workspace: W, name }), { ...d, draw });
      expect(res.status, String(name)).toBe(422);
      expect(await res.json()).toEqual({ error: NAME_RULE });
    }
    expect(draw).not.toHaveBeenCalled();
  });

  it('says each refusal of the database in one line', async () => {
    const cases: Array<[AgentTokenStoreError, number, string]> = [
      [pgError('42501'), 403, ONLY_MEMBER],
      [pgError('54000', 'limit'), 429, TOO_MANY],
      [pgError('22023', 'name', 'Name: you already have a link named Tom’s editor.'), 422, nameTaken('Tom’s editor')],
      [pgError('22023', 'hash'), 422, NAME_RULE],
      [pgError('XX000'), 500, 'The database could not answer. Try again.'],
    ];
    for (const [error, status, said] of cases) {
      const res = await makeTokenRoute(call('POST', { workspace: W, name: 'Tom’s editor' }), deps(error).deps);
      expect(res.status, error.code).toBe(status);
      expect(await res.json()).toEqual({ error: said });
    }
  });
});

describe('DELETE /api/agent-tokens', () => {
  it('revokes the link as the signed-in person', async () => {
    const { deps: d, revoked } = deps();
    const res = await revokeTokenRoute(call('DELETE', { workspace: W, token: 't-1' }), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: listed() });
    expect(revoked).toEqual([[W, 't-1']]);
  });

  it('refuses the signed out, a malformed body, someone else’s link and a link gone', async () => {
    const { deps: d } = deps();
    expect((await revokeTokenRoute(call('DELETE', { workspace: W, token: 't-1' }), { store: () => Promise.resolve(null) })).status).toBe(401);
    expect((await revokeTokenRoute(call('DELETE', { workspace: W }), d)).status).toBe(400);
    const notYours = await revokeTokenRoute(call('DELETE', { workspace: W, token: 't-1' }), deps(pgError('42501')).deps);
    expect([notYours.status, await notYours.json()]).toEqual([403, { error: ONLY_MAKER }]);
    const gone = await revokeTokenRoute(call('DELETE', { workspace: W, token: 't-1' }), deps(pgError('P0002')).deps);
    expect([gone.status, await gone.json()]).toEqual([404, { error: GONE }]);
  });
});

describe('originOf', () => {
  it('is the address the browser reached, behind a proxy or not', () => {
    expect(originOf(new Request('http://localhost:3000/api/agent-tokens'))).toBe('http://localhost:3000');
    expect(originOf(new Request('http://internal/api/agent-tokens', { headers: { 'x-forwarded-host': 'g.example', 'x-forwarded-proto': 'https' } }))).toBe('https://g.example');
  });
});
