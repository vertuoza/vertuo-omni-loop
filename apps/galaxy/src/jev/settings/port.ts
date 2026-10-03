import { z } from 'zod';
import { parseRow } from '../../data/parse-rows';
import type { JevDecisionSettings, JevKeyStatus } from '../store';
import type { DecisionSaved } from './decision';

// Settings › Jev's calls from the browser (PRD 812 s1, s2). In production, POST and DELETE
// /api/jev/key (./api.ts), as the signed-in person: the server tests, seals and stores the key, so it
// never reaches the database or the page again; and a decision's settings through the page's server
// action (app/app/settings/jev/actions.ts). In the demo, the same rules kept in memory: a key that
// starts with `bad` is refused as TypeSafe would refuse it, and a decision is saved as sent.

export type KeySaved = { ok: true; key: JevKeyStatus } | { ok: false; message: string };

/** The page's server action: one decision's settings, saved as the signed-in person. */
export type SaveDecisionAction = (workspace: string, settings: JevDecisionSettings) => Promise<DecisionSaved>;

export interface JevPort {
  saveKey(key: string): Promise<KeySaved>;
  removeKey(): Promise<KeySaved>;
  saveDecision(settings: JevDecisionSettings): Promise<DecisionSaved>;
}

export const COULD_NOT_SAVE_DECISION = 'Couldn’t save this decision. Try again in a moment.';
const NO_ACTION: SaveDecisionAction = () => Promise.resolve({ ok: false, message: COULD_NOT_SAVE_DECISION });

export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';
export const DEMO_REFUSAL = 'TypeSafe refused this key: Invalid API key';
const ROUTE = '/api/jev/key';

/** What the key route (./api.ts) answers: the key's status, or why it refused. */
export const KeyAnswer = z.union([
  z.strictObject({ key: z.strictObject({ stored: z.boolean(), lastFour: z.string().nullable(), setAt: z.string().nullable() }) }),
  z.strictObject({ error: z.string() }),
]);

async function sent(fetch: typeof globalThis.fetch, method: 'POST' | 'DELETE', body: Record<string, string>): Promise<KeySaved> {
  try {
    const res = await fetch(ROUTE, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    // A body that is no JSON (a proxy's error page) is a failure the route never wrote: nothing to log.
    const parsed = json === null ? null : parseRow(KeyAnswer, json, `jev/settings: ${method} ${ROUTE}`);
    const answer = parsed?.ok ? parsed.value : null;
    if (res.ok && answer && 'key' in answer) return { ok: true, key: answer.key };
    return { ok: false, message: answer && 'error' in answer ? answer.error : COULD_NOT_SAVE };
  } catch {
    return { ok: false, message: COULD_NOT_SAVE };
  }
}

export function httpJevPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch, save: SaveDecisionAction = NO_ACTION): JevPort {
  return {
    saveKey: (key) => sent(fetch, 'POST', { workspace, key }),
    removeKey: () => sent(fetch, 'DELETE', { workspace }),
    async saveDecision(settings) {
      try {
        return await save(workspace, settings);
      } catch {
        return { ok: false, message: COULD_NOT_SAVE_DECISION };
      }
    },
  };
}

export function demoJevPort(now: () => number = Date.now): JevPort {
  return {
    saveKey(key) {
      const trimmed = key.trim();
      if (trimmed.length < 8 || trimmed.startsWith('bad')) return Promise.resolve({ ok: false, message: DEMO_REFUSAL });
      return Promise.resolve({ ok: true, key: { stored: true, lastFour: trimmed.slice(-4), setAt: new Date(now()).toISOString() } });
    },
    removeKey() {
      return Promise.resolve({ ok: true, key: { stored: false, lastFour: null, setAt: null } });
    },
    saveDecision(settings) {
      return Promise.resolve({ ok: true, settings });
    },
  };
}
