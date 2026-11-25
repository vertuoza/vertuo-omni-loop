import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseAs, supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import { notifyAll } from '../../notify/notify';
import { liveChannels } from '../../notify/notify-live';
import { recordAppError } from '../../server-event/app-errors-live';
import type { SupervisorDeps } from './supervisor.controller';
import { supervisorActsRepository, supervisorRepository } from './supervisor.repository';
import { supervisorService, type SupervisorService } from './supervisor.service';

// The Supervisor API's real dependencies (PRD omni-loop-34 s3), for /api/supervisor/*: the kit's sign-in checked with
// the Auth server, the browser's from the page's session cookies, the rules over the service role's client, and an
// owner's acts over the signed-in person's client, so the database checks is_owner(). A high finding reaches the owners
// through notify.ts over this deployment's VAPID and Resend keys. Without Supabase configured every call answers 503;
// without the service role key too, said in its words.

const clock = {
  now: () => new Date(),
  sleep: (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
};

const line = (message: string) => { log.error({ event: 'supervisor', outcome: 'failed', message }); };

function liveService(): SupervisorService | null {
  if (!supabaseEnv() || serverEnv().serviceRole === null) return null;
  const store = supervisorRepository(serviceDb());
  return supervisorService({
    store,
    clock,
    alert: async (recipients, message, origin) => {
      await notifyAll(recipients, message, liveChannels(origin, store.forgetDevice), line);
    },
  });
}

async function sessionUser(): Promise<string | null> {
  const { data: { user } } = await (await supabaseServer()).auth.getUser();
  return user?.id ?? null;
}

export function supervisorDeps(): SupervisorDeps {
  const hasDb = supabaseEnv() !== null;
  return {
    connect: hasDb ? supabaseAs : null,
    session: hasDb ? sessionUser : null,
    service: liveService(),
    acts: async () => supervisorActsRepository(await supabaseServer()),
    log: line,
    failed: recordAppError,
  };
}
