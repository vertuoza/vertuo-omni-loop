import { z } from 'zod';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { CappedFleetSchema } from '../../virtual-fleets/virtual-fleets.contract';
import { AnsweredItemSchema, AnsweredStopSchema, BudgetedMissionSchema, LeveledMissionSchema, MovedMissionSchema, PickedBugsSchema, type BugsPick, type ItemAnswer, type MissionAction, type StopAnswer } from '../missions.contract';

// The Missions tab's calls from the browser (PRD 2842 s7; ADR-0095): POST /api/missions/<id>/start | pause |
// resume, as the signed-in person, the answer checked against the contract. A refusal comes back in its words.

export type Moved = { ok: true } | { ok: false; message: string };

export interface MissionsPort {
  move(mission: string, action: MissionAction): Promise<Moved>;
  /** Change for this mission (PRD 2896): the level it runs at. */
  setLevel(mission: string, level: MissionLevel): Promise<Moved>;
  /** Decide the bugs (PRD 3001): send the PRD on to the Reviewer, or stop it. */
  pickBugs(mission: string, prd: PrdNumber, pick: BugsPick): Promise<Moved>;
  /** A mission's token budget (PRD 3040), null for none. */
  setBudget(mission: string, tokens: number | null): Promise<Moved>;
  /** A budget stop's answer (PRD 3040), the new cap with a raise. */
  answerStop(stop: string, answer: StopAnswer, tokens?: number): Promise<Moved>;
  /** The fleet's daily token cap (PRD 3040), null for none: an owner's. */
  setDailyCap(workspace: string, fleet: string, tokens: number | null): Promise<Moved>;
  /** Stop the mission a stuck pause asks about (PRD 3065): it ends stopped, saying it was stuck. */
  stopStuck(mission: string): Promise<Moved>;
  /** Adopt or Decline a question of the mission's own outbox (PRD 3065), once; Adopt applies nothing. */
  answerItem(item: string, answer: ItemAnswer): Promise<Moved>;
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
    pickBugs: (mission, prd, pick) => post(fetch, `/api/missions/${mission}/bugs`, PickedBugsSchema, { prd, pick }),
    setBudget: (mission, tokens) => post(fetch, `/api/missions/${mission}/tokens`, BudgetedMissionSchema, { tokens }),
    answerStop: (stop, answer, tokens) => post(fetch, `/api/missions/stops/${stop}`, AnsweredStopSchema, tokens === undefined ? { answer } : { answer, tokens }),
    setDailyCap: (workspace, fleet, tokens) => post(fetch, '/api/virtual-fleets/tokens', CappedFleetSchema, { workspace, fleet, tokens }),
    stopStuck: (mission) => post(fetch, `/api/missions/${mission}/stop`, MovedMissionSchema),
    answerItem: (item, answer) => post(fetch, `/api/missions/items/${item}`, AnsweredItemSchema, { answer }),
  };
}

const DEMO: Moved = { ok: false, message: 'The demo world keeps its own fleets.' };

/** The demo's port: the demo world keeps its own fleets, so it moves no mission. */
export const demoMissionsPort: MissionsPort = {
  move: () => Promise.resolve(DEMO),
  setLevel: () => Promise.resolve(DEMO),
  pickBugs: () => Promise.resolve(DEMO),
  setBudget: () => Promise.resolve(DEMO),
  answerStop: () => Promise.resolve(DEMO),
  setDailyCap: () => Promise.resolve(DEMO),
  stopStuck: () => Promise.resolve(DEMO),
  answerItem: () => Promise.resolve(DEMO),
};
