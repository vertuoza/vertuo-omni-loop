import type { HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { AddedHeroSchema, HeroRefusalSchema, RemovedHeroSchema, type HeroRefusalField } from './heroes.contract';

// The Heroes tab's calls from the browser (PRD 2842 s6; ADR-0095): POST and DELETE
// /api/virtual-fleets/heroes, as the signed-in person, each answer checked against the contract. A refusal
// comes back with its words and the field they belong to.

export type Changed = { ok: true } | { ok: false; field: HeroRefusalField; message: string };

export interface HeroesPort {
  add(role: HeroRole): Promise<Changed>;
  remove(hero: string): Promise<Changed>;
}

export const COULD_NOT = 'Couldn’t change the heroes. Try again in a moment.';
const ROUTE = '/api/virtual-fleets/heroes';
const COULD_NOT_ANSWER: Changed = { ok: false, field: 'form', message: COULD_NOT };

export function httpHeroesPort(workspace: string, fleet: string, fetch: typeof globalThis.fetch = globalThis.fetch): HeroesPort {
  async function call(method: 'POST' | 'DELETE', body: object, answered: { safeParse(json: unknown): { success: boolean } }): Promise<Changed> {
    try {
      const res = await fetch(ROUTE, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, ...body }) });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok) return answered.safeParse(json).success ? { ok: true } : COULD_NOT_ANSWER;
      const refusal = HeroRefusalSchema.safeParse(json);
      return refusal.success ? { ok: false, field: refusal.data.field ?? 'form', message: refusal.data.error } : COULD_NOT_ANSWER;
    } catch {
      return COULD_NOT_ANSWER;
    }
  }
  return {
    add: (role) => call('POST', { fleet, role }, AddedHeroSchema),
    remove: (hero) => call('DELETE', { hero }, RemovedHeroSchema),
  };
}

const DEMO: Changed = { ok: false, field: 'form', message: 'The demo world keeps its own fleets.' };

/** The demo's port: the demo world keeps its own fleets, so it changes none. */
export const demoHeroesPort: HeroesPort = { add: () => Promise.resolve(DEMO), remove: () => Promise.resolve(DEMO) };
