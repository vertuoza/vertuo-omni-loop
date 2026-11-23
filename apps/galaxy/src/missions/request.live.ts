import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { bearerToken } from '../ask/auth';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import type { RequestDeps } from './request.controller';
import { requestsRepository } from './request.repository';
import { requestsService } from './request.service';

// The New mission box's real dependencies (PRD omni-loop-24 s3), for POST /api/missions and GET /api/missions/requests/<id>. A
// person reads and writes through their own client: row-level security shows a request to its workspace's members alone, and
// mission_request_make() saves one as them. Without Supabase, the routes answer 503.

/** The signed-in person's requests, or null when nobody is signed in. */
async function signedIn() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  return user ? requestsRepository(db) : null;
}

/** The requests of the person behind a terminal's bearer token (a runner signs in as its owner), or null when the token is none. */
async function viaToken(authorization: string | null) {
  const token = bearerToken(authorization);
  if (token === null) return null;
  const db = supabaseAs(token);
  const { data } = await db.auth.getUser(token);
  return data.user ? requestsRepository(db) : null;
}

export function requestDeps(): RequestDeps {
  const hasDb = supabaseEnv() !== null;
  return {
    session: hasDb ? signedIn : null,
    bearer: hasDb ? viaToken : null,
    service: requestsService(),
    log: (message) => { log.error({ event: 'mission-requests', outcome: 'failed', message }); },
  };
}
