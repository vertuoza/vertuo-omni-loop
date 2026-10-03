import { z } from 'zod';
import { orNull, parseRow } from '../../data/parse-rows';
import { LIVE_MAX, mcpUrlOf, nameOf, tokenOf, type AgentToken } from './model';
import { makeToken } from './token';

// Connect an agent's calls from the browser (PRD 855 s1). In production, POST and DELETE
// /api/agent-tokens (./api.ts), as the signed-in person: the server draws the token, so only its hash
// reaches the database. In the demo, the same rules kept in memory, for a viewer who owns the demo
// workspace: a name unique among their live links, 20 live links at most.

export type Made = { ok: true; token: string; url: string; listed: AgentToken } | { ok: false; message: string };
export type Revoked = { ok: true; revoked: AgentToken } | { ok: false; message: string };

export interface TokensPort {
  make(name: string): Promise<Made>;
  revoke(token: AgentToken): Promise<Revoked>;
}

export const COULD_NOT = 'Couldn’t do that. Try again in a moment.';
export const DEMO_NAME_RULE = 'A name: 1 to 40 characters, on one line.';
const ROUTE = '/api/agent-tokens';

/** The route's JSON: an object of fields, each read as unknown, which each caller checks. */
const RouteAnswer = z.record(z.string(), z.unknown());

async function sent(fetch: typeof globalThis.fetch, method: 'POST' | 'DELETE', body: Record<string, string>): Promise<(Record<string, unknown> & { ok: true }) | { ok: false; message: string }> {
  try {
    const res = await fetch(ROUTE, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    const answer = json === null ? null : orNull(parseRow(RouteAnswer, json, `agent-connect/tokens: ${method} ${ROUTE}`));
    if (res.ok && answer) return { ...answer, ok: true };
    return { ok: false, message: typeof answer?.error === 'string' ? answer.error : COULD_NOT };
  } catch {
    return { ok: false, message: COULD_NOT };
  }
}

export function httpTokensPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch): TokensPort {
  return {
    async make(name) {
      const got = await sent(fetch, 'POST', { workspace, name });
      if (!got.ok) return got;
      const listed = tokenOf(got.listed);
      if (typeof got.token !== 'string' || typeof got.url !== 'string' || !listed) return { ok: false, message: COULD_NOT };
      return { ok: true, token: got.token, url: got.url, listed };
    },
    async revoke(token) {
      const got = await sent(fetch, 'DELETE', { workspace, token: token.id });
      if (!got.ok) return got;
      const revoked = tokenOf(got.revoked);
      return revoked ? { ok: true, revoked } : { ok: false, message: COULD_NOT };
    },
  };
}

/** The demo's viewer: they own the demo workspace. */
const DEMO_ME = { id: 'demo-me', login: 'you', name: 'You' };

export function demoTokensPort(start: readonly AgentToken[], origin: () => string, now: () => number = Date.now): TokensPort {
  let live = start.map((t) => ({ ...t }));
  return {
    async make(typed) {
      const name = nameOf(typed);
      if (!name) return { ok: false, message: DEMO_NAME_RULE };
      const mine = live.filter((t) => t.maker.id === DEMO_ME.id);
      if (mine.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        return { ok: false, message: `You already have a link named “${name}”. Pick another name.` };
      }
      if (mine.length >= LIVE_MAX) return { ok: false, message: 'You hold 20 links already: revoke one to make another.' };
      const made = await makeToken();
      const listed: AgentToken = {
        id: `demo-token-${now()}-${live.length}`, name, lastFour: made.lastFour, createdAt: new Date(now()).toISOString(),
        lastUsedAt: null, maker: DEMO_ME, mine: true, canRevoke: true, working: true,
      };
      live = [listed, ...live];
      return { ok: true, token: made.token, url: mcpUrlOf(origin()), listed };
    },
    revoke(token) {
      const there = live.find((t) => t.id === token.id);
      if (!there) return Promise.resolve({ ok: false, message: 'That link is no longer here. Reload the page.' });
      live = live.filter((t) => t.id !== token.id);
      return Promise.resolve({ ok: true, revoked: there });
    },
  };
}
