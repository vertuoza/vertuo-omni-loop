import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import type { CommanderDeps } from './commander.controller';
import { commanderReader, commanderWriter } from './commander.repository';
import { commanderService, type CommanderService } from './commander.service';
import { openRouterCommander } from './model';

// The Commander's real dependencies (PRD 3107 s1), for /api/virtual-fleets/commander. A person reads and asks through
// their own session (row-level security shows a fleet's thread to its workspace's members alone, and commander_ask()
// records the question as them); the Commander's reply is written as the service role, the one role that writes it
// (SUPABASE_SERVICE_ROLE_KEY, server only). The model runs on the server's own OPENROUTER_API_KEY, never shown to anyone
// (BR-PRODUCT-59): without it the Commander is off and says so. Without Supabase the route answers 503.

async function signedInService(): Promise<CommanderService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const env = serverEnv();
  return commanderService({
    reader: commanderReader(db),
    writer: env.serviceRole === null ? null : commanderWriter(serviceDb()),
    model: env.openrouter === null ? null : openRouterCommander({ apiKey: env.openrouter.key }),
    now: () => new Date(),
  });
}

export function commanderDeps(): CommanderDeps {
  return {
    service: supabaseEnv() ? signedInService : null,
    log: (message) => { log.error({ event: 'virtual-fleets-commander', outcome: 'failed', message }); },
  };
}
