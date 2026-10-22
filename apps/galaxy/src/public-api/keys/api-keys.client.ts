import {
  ApiKeyRefusalSchema, AttachedGithubAppSchema, MadeApiKeySchema, RemovedGithubAppSchema, RevokedApiKeySchema, type ApiKey,
} from './api-keys.contract';

// Settings › API keys' calls from the browser (PRD 2022 s1; ADR-0095): POST and DELETE /api/api-keys, as
// the signed-in person, each answer checked against the contract. The server draws the secret, so the
// browser only ever receives it, once, in the answer to its own make.
//
// A key's GitHub App (PRD 2433 s4) has its own port: the owner's attach (and replace) and remove, on
// /api/api-keys/<id>/github-app. The private key goes up once, as typed, and only the App's slug comes back.

export type Made = { ok: true; secret: string; key: ApiKey } | { ok: false; message: string };
export type Revoked = { ok: true; key: ApiKey } | { ok: false; message: string };
export type Attached = { ok: true; slug: string } | { ok: false; message: string };
export type Detached = { ok: true; removed: boolean } | { ok: false; message: string };

export interface ApiKeysPort {
  make(name: string, repos: string[]): Promise<Made>;
  revoke(key: ApiKey): Promise<Revoked>;
}

export interface GithubAppPort {
  /** Attaches the App to the key, or replaces the one it holds: `appId` as typed, `privateKey` as pasted. */
  attach(key: ApiKey, appId: string, privateKey: string): Promise<Attached>;
  /** Removes the key's App. */
  remove(key: ApiKey): Promise<Detached>;
}

export const COULD_NOT = 'Couldn’t do that. Try again in a moment.';
const ROUTE = '/api/api-keys';

/** Sends one call: its JSON when it succeeded, or the refusal's words. */
async function sent(
  fetch: typeof globalThis.fetch, route: string, method: 'POST' | 'DELETE', body?: unknown,
): Promise<{ ok: true; json: unknown } | { ok: false; message: string }> {
  try {
    const init: RequestInit = body === undefined
      ? { method }
      : { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
    const res = await fetch(route, init);
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
      const got = await sent(fetch, ROUTE, 'POST', { workspace, name, repos });
      if (!got.ok) return got;
      const made = MadeApiKeySchema.safeParse(got.json);
      return made.success ? { ok: true, ...made.data } : { ok: false, message: COULD_NOT };
    },
    async revoke(key) {
      const got = await sent(fetch, ROUTE, 'DELETE', { workspace, key: key.id });
      if (!got.ok) return got;
      const revoked = RevokedApiKeySchema.safeParse(got.json);
      return revoked.success ? { ok: true, key: revoked.data.key } : { ok: false, message: COULD_NOT };
    },
  };
}

export function httpGithubAppPort(fetch: typeof globalThis.fetch = globalThis.fetch): GithubAppPort {
  const routeOf = (key: ApiKey) => `${ROUTE}/${encodeURIComponent(key.id)}/github-app`;
  return {
    async attach(key, appId, privateKey) {
      const got = await sent(fetch, routeOf(key), 'POST', { appId: appId.trim(), privateKey });
      if (!got.ok) return got;
      const attached = AttachedGithubAppSchema.safeParse(got.json);
      return attached.success ? { ok: true, slug: attached.data.slug } : { ok: false, message: COULD_NOT };
    },
    async remove(key) {
      const got = await sent(fetch, routeOf(key), 'DELETE');
      if (!got.ok) return got;
      const removed = RemovedGithubAppSchema.safeParse(got.json);
      return removed.success ? { ok: true, removed: removed.data.removed } : { ok: false, message: COULD_NOT };
    },
  };
}
