import 'server-only';
import { serviceDb } from '../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../data/supabase-server';
import { serverEnv } from '../env';
import { liveChannels } from '../notify/notify-live';
import { approvalsRepository, reachRepository } from './approvals.repository';
import type { RequestDeps, WaitingDeps } from './approvals.controller';

// The approvals routes' real dependencies (PRD 1322 s2). The request runs as the caller's access token,
// never a service key, so approval_request() checks who asks. Reaching people reads their addresses and
// devices as the service role (SUPABASE_SERVICE_ROLE_KEY), which alone may; without it the request is
// recorded and nobody is reached, said in the log. The channels are this deployment's VAPID and Resend
// keys, the push contact its own address. The bell reads as the page's own session. Without Supabase
// configured (the demo galaxy) every call answers 503.

const log = (line: string) => { console.error(line); };

export function requestDeps(): RequestDeps {
  const hasDb = supabaseEnv() !== null;
  const reach = hasDb && serverEnv().serviceRole !== null ? reachRepository(serviceDb()) : null;
  return {
    connect: hasDb
      ? (token) => {
          const client = supabaseAs(token);
          return { auth: client.auth, approvals: approvalsRepository(client) };
        }
      : null,
    reach,
    channels: liveChannels,
    log,
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
