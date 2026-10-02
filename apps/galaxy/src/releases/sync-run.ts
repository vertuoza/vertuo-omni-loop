// One run of `pnpm releases:sync` (PRD 262): read what the checkout has shipped (sync-shipped.ts), read
// public.releases, apply the rules (sync.ts), and write the new rows, then the refreshed texts. It
// prints each PRD it inserted or updated, and a count. It writes nothing when a note, a folder or a spec
// is refused, and exits non-zero then, or when Supabase refuses: the releases workflow fails loudly.
//
// The script (apps/galaxy/scripts/releases-sync.ts) calls releasesSync() with the environment. It runs
// on plain Node, so this module and those it imports name their files with their extension.
import { createClient } from '@supabase/supabase-js';
import { defined } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import type { Git } from './git.ts';
import { releaseVersion } from './row.ts';
import { applySync, planSync } from './sync.ts';
import { readShipped } from './sync-shipped.ts';
import { releasesTable, type ReleasesTable } from './sync-table.ts';

/** What the sync needs: the project's URL and the service role's key, which alone writes the table. */
export const SYNC_VARIABLES = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

type Env = Record<string, string | undefined>;
type Print = { out?: (line: string) => void; err?: (line: string) => void };

/** The variables `env` leaves unset or blank, in the order they are named above. */
export function missingVariables(env: Env): string[] {
  return SYNC_VARIABLES.filter((name) => !env[name]?.trim());
}

/** Syncs the checkout at `root` into `table`; the exit code: 0 done, 1 refused. */
export async function syncReleases({ root, table, git, out = console.log, err = console.error }: { root: string; table: ReleasesTable; git?: Git } & Print): Promise<number> {
  const reading = readShipped(root, { git });
  for (const line of reading.waiting) out(line);
  if (reading.refused.length) {
    for (const line of reading.refused) err(line);
    err('releases: nothing written — fix the lines above by pull request, then sync again');
    return 1;
  }

  try {
    const rows = await table.rows();
    const plan = planSync(reading.shipped, rows);
    await table.insert(plan.inserts);
    for (const row of plan.inserts) out(`inserted PRD ${row.prd} as ${releaseVersion(row.release)}, on main since ${row.released_at}: ${row.title}`);
    const release = new Map(applySync(rows, plan).map((row) => [row.prd, row.release]));
    for (const text of plan.updates) {
      await table.refresh(text);
      out(`updated PRD ${text.prd} (${releaseVersion(defined(release.get(text.prd), `the release of PRD ${text.prd}`))}): ${text.title}`);
    }
    const unchanged = reading.shipped.length - plan.inserts.length - plan.updates.length;
    out(`releases: ${plan.inserts.length} inserted, ${plan.updates.length} updated, ${unchanged} unchanged`);
    return 0;
  } catch (error) {
    err(`releases: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** The table as the service role, keeping no session. */
function serviceRole(env: Env): ReleasesTable {
  return releasesTable(createClient<Database>(defined(env.SUPABASE_URL, 'SUPABASE_URL'), defined(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}

/** The script's run: the credentials from `env`, then the sync. Stops before connecting when one is missing. */
export async function releasesSync({ env, root, connect = serviceRole, out, err = console.error }: { env: Env; root: string; connect?: (env: Env) => ReleasesTable } & Print): Promise<number> {
  const missing = missingVariables(env);
  if (missing.length) {
    for (const name of missing) {
      err(`releases:sync needs ${name}: set it (locally, \`npx supabase status\` prints it; in Actions, the releases workflow sets it)`);
    }
    return 1;
  }
  return syncReleases({ root, table: connect(env), out, err });
}
