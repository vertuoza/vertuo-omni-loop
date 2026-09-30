import type { JevKeyStatus } from '../store';

// Settings › Jev's two key calls from the browser (PRD 812 s1). In production, POST and DELETE
// /api/jev/key (./api.ts), as the signed-in person: the server tests, seals and stores the key, so it
// never reaches the database or the page again. In the demo, the same rules kept in memory: a key that
// starts with `bad` is refused as TypeSafe would refuse it.

export type KeySaved = { ok: true; key: JevKeyStatus } | { ok: false; message: string };

export interface JevPort {
  saveKey(key: string): Promise<KeySaved>;
  removeKey(): Promise<KeySaved>;
}

export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';
export const DEMO_REFUSAL = 'TypeSafe refused this key: Invalid API key';
const ROUTE = '/api/jev/key';

async function sent(fetch: typeof globalThis.fetch, method: 'POST' | 'DELETE', body: Record<string, string>): Promise<KeySaved> {
  try {
    const res = await fetch(ROUTE, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const answer = (await res.json().catch(() => null)) as { key?: JevKeyStatus; error?: string } | null;
    if (res.ok && answer?.key) return { ok: true, key: answer.key };
    return { ok: false, message: typeof answer?.error === 'string' ? answer.error : COULD_NOT_SAVE };
  } catch {
    return { ok: false, message: COULD_NOT_SAVE };
  }
}

export function httpJevPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch): JevPort {
  return {
    saveKey: (key) => sent(fetch, 'POST', { workspace, key }),
    removeKey: () => sent(fetch, 'DELETE', { workspace }),
  };
}

export function demoJevPort(now: () => number = Date.now): JevPort {
  return {
    async saveKey(key) {
      const trimmed = key.trim();
      if (trimmed.length < 8 || trimmed.startsWith('bad')) return { ok: false, message: DEMO_REFUSAL };
      return { ok: true, key: { stored: true, lastFour: trimmed.slice(-4), setAt: new Date(now()).toISOString() } };
    },
    async removeKey() {
      return { ok: true, key: { stored: false, lastFour: null, setAt: null } };
    },
  };
}
