import 'server-only';
import { after } from 'next/server';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import type { MissionsDeps } from './missions.controller';
import { missionsReader, missionsWriter } from './missions.repository';
import { missionsService, type Caller, type MissionsService } from './missions.service';

// The missions' real dependencies (PRD 2842 s5), for /api/missions/<id>/start|pause|resume and the wakes.
// A person reads through their own session (row-level security shows a mission to its workspace's members
// alone); the moves, the events and the mission's job on the ledger are written as the service role, the
// one role that writes them (SUPABASE_SERVICE_ROLE_KEY, server only). Without Supabase, or without the
// service role key, the routes answer 503 and a wake does nothing.

const clock = { now: () => new Date() };

/** The rules over the service role's client, or null when this deployment has none. */
function liveMissionsService(): MissionsService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  return missionsService(missionsWriter(serviceDb()), clock);
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Their GitHub login, as the session's metadata holds it. */
function loginOf(metadata: Record<string, unknown> | null | undefined): string | null {
  return text(metadata?.user_name) ?? text(metadata?.preferred_username);
}

/** The signed-in person and their reads, or null when nobody is signed in. */
async function signedIn(): Promise<{ caller: Caller; reader: ReturnType<typeof missionsReader> } | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? { caller: { id: user.id, login: loginOf(user.user_metadata) }, reader: missionsReader(db) } : null;
}

export function missionsDeps(): MissionsDeps {
  const hasDb = supabaseEnv() !== null;
  return {
    session: hasDb ? signedIn : null,
    service: liveMissionsService(),
    log: (message) => { log.error({ event: 'missions', outcome: 'failed', message }); },
  };
}

/** Runs `wake` once the response has gone: a wake never changes what a request answers, and one that fails is logged and left to the minute's check. */
function afterResponse(what: string, wake: (service: MissionsService) => Promise<unknown>): void {
  const service = liveMissionsService();
  if (service === null) return;
  const run = async () => {
    try {
      await wake(service);
    } catch (error) {
      log.error({ event: 'missions', outcome: 'failed', message: `${what}: ${error instanceof Error ? error.message : String(error)}` });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request (a script): run it now.
    void run();
  }
}

/** A job of the mission ended: its job is refreshed, due at once. */
export function wakeMission(missionId: string): void {
  afterResponse('a job ended', (service) => service.wake(missionId));
}
