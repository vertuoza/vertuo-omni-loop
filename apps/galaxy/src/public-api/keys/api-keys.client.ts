import { ApiKeyRefusalSchema, MadeApiKeySchema, RevokedApiKeySchema, type ApiKey } from './api-keys.contract';

// Settings › API keys' calls from the browser (PRD 2022 s1; ADR-0095): POST and DELETE /api/api-keys, as
// the signed-in person, each answer checked against the contract. The server draws the secret, so the
// browser only ever receives it, once, in the answer to its own make.

export type Made = { ok: true; secret: string; key: ApiKey } | { ok: false; message: string };
export type Revoked = { ok: true; key: ApiKey } | { ok: false; message: string };

export interface ApiKeysPort {
  make(name: string, repos: string[]): Promise<Made>;
  revoke(key: ApiKey): Promise<Revoked>;
}

export const COULD_NOT = 'Couldn’t do that. Try again in a moment.';
const ROUTE = '/api/api-keys';

/** Sends one call: its JSON when it succeeded, or the refusal's words. */
async function sent(fetch: typeof globalThis.fetch, method: 'POST' | 'DELETE', body: unknown): Promise<{ ok: true; json: unknown } | { ok: false; message: string }> {
  try {
    const res = await fetch(ROUTE, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return { ok: true, json };
    const refusal = ApiKeyRefusalSchema.safeParse(json);
    return { ok: false, message: refusal.success ? refusal.data.error : COULD_NOT };
  } catch {
    return { ok: false, message: COULD_NOT };
  }
}

export function httpApiKeysPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch): ApiKeysPort {
  return {
    async make(name, repos) {
      const got = await sent(fetch, 'POST', { workspace, name, repos });
      if (!got.ok) return got;
      const made = MadeApiKeySchema.safeParse(got.json);
      return made.success ? { ok: true, ...made.data } : { ok: false, message: COULD_NOT };
    },
    async revoke(key) {
      const got = await sent(fetch, 'DELETE', { workspace, key: key.id });
      if (!got.ok) return got;
      const revoked = RevokedApiKeySchema.safeParse(got.json);
      return revoked.success ? { ok: true, key: revoked.data.key } : { ok: false, message: COULD_NOT };
    },
  };
}
