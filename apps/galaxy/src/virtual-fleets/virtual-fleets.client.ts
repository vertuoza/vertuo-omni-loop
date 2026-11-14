import type { HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { CreatedVirtualFleetSchema, VirtualFleetRefusalSchema, type RefusalField, type VirtualFleet } from './virtual-fleets.contract';

// The New virtual fleet drawer's call from the browser (PRD 2842 s1; ADR-0095): POST /api/virtual-fleets,
// as the signed-in person, its answer checked against the contract. A refusal comes back with its words
// and the field the drawer shows them under.

export type Created = { ok: true; fleet: VirtualFleet } | { ok: false; field: RefusalField; message: string };

/** What the drawer sends: the fleet's name, its icon and the roles left on. */
export interface NewFleet {
  name: string;
  mascot: string;
  roles: HeroRole[];
}

export interface VirtualFleetsPort {
  create(fleet: NewFleet): Promise<Created>;
}

export const COULD_NOT = 'Couldn’t create the fleet. Try again in a moment.';
const ROUTE = '/api/virtual-fleets';

export function httpVirtualFleetsPort(workspace: string, fetch: typeof globalThis.fetch = globalThis.fetch): VirtualFleetsPort {
  return {
    async create(fleet) {
      try {
        const res = await fetch(ROUTE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace, ...fleet }) });
        const json: unknown = await res.json().catch(() => null);
        if (res.ok) {
          const made = CreatedVirtualFleetSchema.safeParse(json);
          return made.success ? { ok: true, fleet: made.data.fleet } : { ok: false, field: 'form', message: COULD_NOT };
        }
        const refusal = VirtualFleetRefusalSchema.safeParse(json);
        return refusal.success ? { ok: false, field: refusal.data.field ?? 'form', message: refusal.data.error } : { ok: false, field: 'form', message: COULD_NOT };
      } catch {
        return { ok: false, field: 'form', message: COULD_NOT };
      }
    },
  };
}
