import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { liveChannels } from '../notify/notify-live';
import { approvalsRepository, reachRepository } from './approvals.repository';
import type { RequestDeps, WaitingDeps } from './approvals.controller';
import type { ReachDeps } from './approvals.service';

// The approvals routes' real dependencies (PRD 1322 s2). The request runs as the caller's access token,
// never a service key, so approval_request() checks who asks. Reaching people reads their addresses and
// devices as the service role (SUPABASE_SERVICE_ROLE_KEY), which alone may; without it the request is
// recorded and nobody is reached, said in the log. The channels are this deployment's VAPID and Resend
// keys, the push contact its own address. The bell reads as the page's own session. Without Supabase
// configured (the demo galaxy) every call answers 503.

const log = (line: string) => { console.error(line); };

/** How asked people are reached here: the service role's read, the channels and the log. */
export function reachDeps(): ReachDeps {
  const reach = supabaseEnv() !== null && serverEnv().serviceRole !== null ? reachRepository(serviceDb()) : null;
  return { reach, channels: liveChannels, log };
}

export function requestDeps(): RequestDeps {
  return {
    connect: supabaseEnv() !== null
      ? (token) => {
          const client = supabaseAs(token);
          return { auth: client.auth, approvals: approvalsRepository(client) };
        }
      : null,
    ...reachDeps(),
  };
}

export function waitingDeps(): WaitingDeps {
  if (!supabaseEnv()) return { session: null };
  return {
    async session() {
      const db = await supabaseServer();
      const { data: { user } } = await db.auth.getUser();
      return user ? approvalsRepository(db) : null;
    },
  };
}
