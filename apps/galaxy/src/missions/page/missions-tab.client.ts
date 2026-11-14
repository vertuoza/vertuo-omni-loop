import { z } from 'zod';
import { MovedMissionSchema, type MissionAction } from '../missions.contract';

// The Missions tab's calls from the browser (PRD 2842 s7; ADR-0095): POST /api/missions/<id>/start | pause |
// resume, as the signed-in person, the answer checked against the contract. A refusal comes back in its words.

export type Moved = { ok: true } | { ok: false; message: string };

export interface MissionsPort {
  move(mission: string, action: MissionAction): Promise<Moved>;
}

export const COULD_NOT = 'Couldn’t move the mission. Try again in a moment.';
const COULD_NOT_ANSWER: Moved = { ok: false, message: COULD_NOT };
const Refusal = z.object({ error: z.string().min(1) });

export function httpMissionsPort(fetch: typeof globalThis.fetch = globalThis.fetch): MissionsPort {
  return {
    async move(mission, action) {
      try {
        const res = await fetch(`/api/missions/${mission}/${action}`, { method: 'POST' });
        const json: unknown = await res.json().catch(() => null);
        if (res.ok) return MovedMissionSchema.safeParse(json).success ? { ok: true } : COULD_NOT_ANSWER;
        const refusal = Refusal.safeParse(json);
        return refusal.success ? { ok: false, message: refusal.data.error } : COULD_NOT_ANSWER;
      } catch {
        return COULD_NOT_ANSWER;
      }
    },
  };
}

const DEMO: Moved = { ok: false, message: 'The demo world keeps its own fleets.' };

/** The demo's port: the demo world keeps its own fleets, so it moves no mission. */
export const demoMissionsPort: MissionsPort = { move: () => Promise.resolve(DEMO) };
