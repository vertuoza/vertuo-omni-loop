import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../../data/sign-in-live';
import { supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { serverEnv } from '../../env';
import { answerMissionItem } from '../../missions/missions.controller';
import { missionsDeps } from '../../missions/missions.live';
import { answerQuestions } from '../../runners/runners.controller';
import { runnersDeps } from '../../runners/runners.live';
import type { CommanderDeps } from './commander.controller';
import { commanderReader, commanderWriter } from './commander.repository';
import { commanderService, type CommanderService } from './commander.service';
import { openRouterCommander } from './model';
import { railReader } from './rail.repository';
import { railService, type CardAnswerers } from './rail.service';

// The Commander's real dependencies (PRD 3107 s1), for /api/virtual-fleets/commander. A person reads and asks through
// their own session (row-level security shows a fleet's thread to its workspace's members alone, and commander_ask()
// records the question as them); the Commander's reply is written as the service role, the one role that writes it
// (SUPABASE_SERVICE_ROLE_KEY, server only). The model runs on the server's own OPENROUTER_API_KEY, never shown to anyone
// (BR-PRODUCT-59): without it the Commander is off and says so. Without Supabase the route answers 503.
//
// The rail (s2) reads its cards as the person too, and answers a card through the question's own route: the same
// controller the question's page calls, handed a request with no bearer token, so it reads this request's sign-in
// cookies and records the answer as the member, exactly as on that page (BR-PRODUCT-12). It needs no model key.

/** A POST to one of the app's own answer routes, as this request's signed-in person: no bearer token, so its session. */
const asMember = (path: string, body: object): Request =>
  new Request(new URL(path, 'http://commander.internal'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const answerers: CardAnswerers = {
  job: async (id, answers) => (await answerQuestions(asMember(`/api/runners/jobs/${encodeURIComponent(id)}/answers`, { answers }), id, runnersDeps())).ok,
  item: async (id, answer) => (await answerMissionItem(id, asMember(`/api/missions/items/${encodeURIComponent(id)}`, { answer }), missionsDeps())).ok,
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Their GitHub login, as the session's metadata holds it. */
const loginOf = (metadata: Record<string, unknown> | null | undefined): string | null => text(metadata?.user_name) ?? text(metadata?.preferred_username);

async function signedInService(): Promise<CommanderService | null> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const env = serverEnv();
  const now = () => new Date();
  return commanderService({
    reader: commanderReader(db),
    writer: env.serviceRole === null ? null : commanderWriter(serviceDb()),
    model: env.openrouter === null ? null : openRouterCommander({ apiKey: env.openrouter.key }),
    rail: railService({ reader: railReader(db), answerers, now }),
    me: loginOf(user.user_metadata),
    now,
  });
}

export function commanderDeps(): CommanderDeps {
  return {
    service: supabaseEnv() ? signedInService : null,
    log: (message) => { log.error({ event: 'virtual-fleets-commander', outcome: 'failed', message }); },
  };
}
