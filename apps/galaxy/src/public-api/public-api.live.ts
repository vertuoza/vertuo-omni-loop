import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import type { PublicApiDeps } from './public-api.controller';
import { runnersRepository } from '../runners/runners.repository';
import { runnersService } from '../runners/runners.service';
import { publicApiRepository } from './public-api.repository';
import { publicApiService, type PublicApiService } from './public-api.service';

// The public API's real dependencies (PRD 2022 s2), for /api/v1/*: the rules over the service role's
// client (SUPABASE_SERVICE_ROLE_KEY, server only), since a program's key is no person's session and
// api_key_of() is the service role's alone. Without Supabase or the service role key (the demo galaxy)
// every call answers 500, said in its words.

// The runners' rules, as the runners' own routes build them (a key queues, reads, answers and dismisses; it never holds).
const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

/** The rules over the service role's client, or null when this deployment has none. */
function liveService(): PublicApiService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const db = serviceDb();
  return publicApiService(publicApiRepository(db), runnersService(runnersRepository(db), clock));
}

export function publicApiDeps(): PublicApiDeps {
  return {
    service: liveService(),
    log: (message) => { log.error({ event: 'public-api', outcome: 'failed', message }); },
  };
}
