import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { runDeps } from '../draft/live';
import { runDraft } from '../draft/run';
import { draftStore } from '../draft/store';
import { rechecked, type ClaimsDb, type RecheckDeps } from './recheck';

// The weekly recheck's real deps (PRD 774, s4): the bearer secret (BUSINESS_RECHECK_SECRET) and the
// service role's client (SUPABASE_SERVICE_ROLE_KEY), which the migration's draft functions accept for a
// recheck. Each run is the member's draft run (../draft/live.ts runDeps) over that client: GitHub as the
// Omni Loop App, the safe page fetch, and the small model only when OPENROUTER_API_KEY is set. The client
// is made when a call first needs it, so a missing setting fails that call, which the route logs.

/** The one read rechecked() makes, over the service role's client: the port it takes, and nothing more. */
const claimsOf = (db: ReturnType<typeof serviceDb>): ClaimsDb => ({
  from: (table) => ({ select: (columns) => ({ eq: (column, value) => db.from(table).select(columns).eq(column, value) }) }),
});

export function recheckDeps(env: Record<string, string | undefined> = process.env): RecheckDeps {
  return {
    secret: env.BUSINESS_RECHECK_SECRET?.trim() || undefined,
    businesses: () => rechecked(claimsOf(serviceDb())),
    start: (workspace) => draftStore(serviceDb()).start(workspace, 'recheck'),
    run: (workspace, draft) => runDraft(runDeps(serviceDb()), workspace, draft),
    now: () => new Date().toISOString(),
    log: (line) => { console.error(line); },
  };
}
