import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { liveNotifier } from '../public-api/notify.live';
import type { RunnersDeps } from './runners.controller';
import { githubDeps } from './runners.github';
import { runnersRepository } from './runners.repository';
import { runnersService, type RunnersService } from './runners.service';

// The runners' real dependencies (PRD 1830 s1), for /api/runners/*: the kit's sign-in checked with the
// Auth server (a client acting as the caller's access token), the browser's from the page's session
// cookies, and the rules over the service role's client (SUPABASE_SERVICE_ROLE_KEY, server only), the
// one role that writes the two tables. Without Supabase configured (the demo galaxy) every call answers
// 503; without the service role key, too, said in its words. A job sent by a key with a link (PRD 2425 s8) pings it from
// here too: the runners' routes are where a job is claimed and reported, so they are where its status changes.
//
// A key's job runs as the key's GitHub App (PRD 2433): its private key is opened under SECRETS_MASTER_KEY
// and its token minted through the global fetch (./runners.github.ts).

const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** The rules over the service role's client, or null when this deployment has none. */
function liveRunnersService(): RunnersService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  return runnersService(runnersRepository(serviceDb()), clock, githubDeps(serverEnv().secretsMasterKey), liveNotifier());
}

/** The signed-in person of the page's session, by id, or null. */
async function sessionUser(): Promise<string | null> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user?.id ?? null;
}

export function runnersDeps(): RunnersDeps {
  const hasDb = supabaseEnv() !== null;
  return {
    connect: hasDb ? supabaseAs : null,
    session: hasDb ? sessionUser : null,
    service: liveRunnersService(),
    log: (message) => { log.error({ event: 'runners', outcome: 'failed', message }); },
    timer: () => {
      const start = performance.now();
      return () => performance.now() - start;
    },
  };
}
