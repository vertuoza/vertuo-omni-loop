import { z } from 'zod';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { LeveledMissionSchema, MovedMissionSchema, type MissionAction } from '../missions.contract';

// The Missions tab's calls from the browser (PRD 2842 s7; ADR-0095): POST /api/missions/<id>/start | pause |
// resume, as the signed-in person, the answer checked against the contract. A refusal comes back in its words.

export type Moved = { ok: true } | { ok: false; message: string };

export interface MissionsPort {
  move(mission: string, action: MissionAction): Promise<Moved>;
  /** Change for this mission (PRD 2896): the level it runs at. */
  setLevel(mission: string, level: MissionLevel): Promise<Moved>;
}

export const COULD_NOT = 'Couldn’t move the mission. Try again in a moment.';
const COULD_NOT_ANSWER: Moved = { ok: false, message: COULD_NOT };
const Refusal = z.object({ error: z.string().min(1) });

async function post(fetch: typeof globalThis.fetch, path: string, answer: z.ZodType, body?: unknown): Promise<Moved> {
  try {
    const res = await fetch(path, body === undefined ? { method: 'POST' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return answer.safeParse(json).success ? { ok: true } : COULD_NOT_ANSWER;
    const refusal = Refusal.safeParse(json);
    return refusal.success ? { ok: false, message: refusal.data.error } : COULD_NOT_ANSWER;
  } catch {
    return COULD_NOT_ANSWER;
  }
}

export function httpMissionsPort(fetch: typeof globalThis.fetch = globalThis.fetch): MissionsPort {
  return {
    move: (mission, action) => post(fetch, `/api/missions/${mission}/${action}`, MovedMissionSchema),
    setLevel: (mission, level) => post(fetch, `/api/missions/${mission}/level`, LeveledMissionSchema, { level }),
  };
}

const DEMO: Moved = { ok: false, message: 'The demo world keeps its own fleets.' };

/** The demo's port: the demo world keeps its own fleets, so it moves no mission. */
export const demoMissionsPort: MissionsPort = { move: () => Promise.resolve(DEMO), setLevel: () => Promise.resolve(DEMO) };
