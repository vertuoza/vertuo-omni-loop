import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv } from '../env';
import type { JudgeDeps } from './judge.controller';
import { judgeRepository } from './judge.repository';

// The judge route's real dependencies (PRD 1612 s2): STAGE_EVENT_SECRET (server only, shared with
// omni-app) and the service role's client (SUPABASE_SERVICE_ROLE_KEY): the App is nobody's sign-in, so
// the record is read as the service role. Without Supabase or the key, a signed request answers 503.
export function judgeDeps(): JudgeDeps {
  const env = serverEnv();
  return {
    secret: env.stageEventSecret ?? undefined,
    record: supabaseEnv() && env.serviceRole !== null ? () => judgeRepository(serviceDb()) : null,
  };
}
