import { z } from 'zod';
import { MadeTokenSchema, type KitToken } from './terminal-tokens.contract';
import type { ShownToken, TokenDays } from './terminal-tokens';

// Terminal tokens' calls from the browser (PRD 1628 s4), as the signed-in person:
//
//   POST   /api/ask/token/made                  the token the round trip just made, once (the route
//                                               clears its cookie), or 404 when none waits
//   DELETE /api/agent-tokens {workspace, token} revokes it (agent_token_revoke(): its maker or an owner),
//                                               which clears its stored session
//
// In the demo, nothing leaves the page: a made token is drawn here, as Connect an agent's demo draws a
// link, and signs nothing in.

export type Done = { ok: true } | { ok: false; message: string };

export interface TerminalPort {
  /** The token just made for this browser, or null when none waits: asked once per page. */
  takeMade(): Promise<ShownToken | null>;
  revoke(id: string): Promise<Done>;
  /** The demo's Make a token, with no round trip; null outside the demo. */
  makeHere: ((name: string, days: TokenDays) => Promise<{ shown: ShownToken; listed: KitToken }>) | null;
}

export const COULD_NOT = 'Couldn’t do that. Try again in a moment.';
export const MADE_ROUTE = '/api/ask/token/made';
export const REVOKE_ROUTE = '/api/agent-tokens';

const ErrorAnswer = z.object({ error: z.string() });

export function httpTerminalPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch): TerminalPort {
  return {
    async takeMade() {
      try {
        const res = await fetch(MADE_ROUTE, { method: 'POST', headers: { 'cache-control': 'no-store' } });
        if (!res.ok) return null;
        const made = MadeTokenSchema.safeParse(await res.json().catch(() => null));
        return made.success ? { name: made.data.name, token: made.data.token, expiresAt: made.data.expires_at } : null;
      } catch {
        return null;
      }
    },
    async revoke(id) {
      try {
        const res = await fetch(REVOKE_ROUTE, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, token: id }) });
        if (res.ok) return { ok: true };
        const said = ErrorAnswer.safeParse(await res.json().catch(() => null));
        return { ok: false, message: said.success ? said.data.error : COULD_NOT };
      } catch {
        return { ok: false, message: COULD_NOT };
      }
    },
    makeHere: null,
  };
}

const DAY = 24 * 3_600_000;

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The demo's port: a token drawn in the page, `omk_` and 32 random bytes, listed as yours. */
export function demoTerminalPort(now: () => number = Date.now, fill: (bytes: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b)): TerminalPort {
  let made = 0;
  return {
    takeMade: () => Promise.resolve(null),
    revoke: () => Promise.resolve({ ok: true }),
    makeHere(name, days) {
      const token = `omk_${base64url(fill(new Uint8Array(32)))}`;
      const at = now();
      const expiresAt = new Date(at + days * DAY).toISOString();
      made += 1;
      const listed: KitToken = {
        id: `demo-kit-${at}-${made}`, name, lastFour: token.slice(-4), createdAt: new Date(at).toISOString(), lastUsedAt: null, expiresAt,
      };
      return Promise.resolve({ shown: { name, token, expiresAt }, listed });
    },
  };
}
