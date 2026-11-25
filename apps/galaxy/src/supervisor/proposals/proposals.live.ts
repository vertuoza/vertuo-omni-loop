import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { z } from 'zod';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import { moveMission } from '../../missions/missions.controller';
import { missionsDeps } from '../../missions/missions.live';
import { missionsWriter } from '../../missions/missions.repository';
import { missionsService } from '../../missions/missions.service';
import { JobReplySchema } from '../../runners/runners.contract';
import { cancelJob, sendJob } from '../../runners/runners.controller';
import { runnersDeps } from '../../runners/runners.live';
import { recordAppError } from '../../server-event/app-errors-live';
import type { ProposalsDeps } from './proposals.controller';
import { proposalActsRepository, proposalsRepository } from './proposals.repository';
import { proposalsService, type Called, type Carry } from './proposals.service';

// An owner's press and dismissal, wired for real (PRD omni-loop-34 s7): the rules over the service role's client, the
// press and the dismissal through the owner-checked functions as the signed-in person, and each action carried out
// through the App's routes of today, called in this request with its session cookies, so they act as the owner who
// pressed and check what they check for anyone: the Runners page's Cancel and Send (/api/runners/jobs/<id>/cancel,
// /api/runners/jobs), the mission page's Pause and Resume (/api/missions/<id>/pause|resume). Waking a mission's
// supervisor has no person's route: it is the missions' own wake, which refreshes the mission's job on the App's ledger
// (ADR-0141), once the press found the mission in the workspace. Without Supabase, or its service role, every call
// answers 503.

const clock = { now: () => new Date() };
const Refusal = z.object({ error: z.string() });

/** What a route of today answered, read as a `Called`. */
async function calledOf<T>(response: Response, read: (body: unknown) => T): Promise<Called<T>> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, value: read(body) };
  const refusal = Refusal.safeParse(body);
  return { ok: false, status: response.status, error: refusal.success ? refusal.data.error : `The App answered ${String(response.status)}.` };
}

/** The routes of today, as the person this request is signed in as. */
function liveCarry(): Carry {
  return {
    cancelJob: async (job) => calledOf(await cancelJob(job, runnersDeps()), () => null),
    sendJob: async (send) => {
      const request = new Request('https://omni.invalid/api/runners/jobs', { method: 'POST', body: JSON.stringify(send) });
      return calledOf(await sendJob(request, runnersDeps()), (body) => ({ id: JobReplySchema.parse(body).job.id }));
    },
    moveMission: async (action, mission) => calledOf(await moveMission(action, mission, missionsDeps()), () => null),
    wakeMission: (mission) => missionsService(missionsWriter(serviceDb()), clock).wake(mission),
  };
}

async function sessionUser(): Promise<string | null> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user?.id ?? null;
}

export function proposalsDeps(): ProposalsDeps {
  const hasDb = supabaseEnv() !== null;
  const hasService = hasDb && serverEnv().serviceRole !== null;
  return {
    session: hasDb ? sessionUser : null,
    service: hasService ? proposalsService({ store: proposalsRepository(serviceDb()), carry: liveCarry(), clock }) : null,
    acts: async () => proposalActsRepository(await supabaseServer()),
    log: (message) => { log.error({ event: 'supervisor', outcome: 'failed', message }); },
    failed: recordAppError,
  };
}
