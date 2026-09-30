// game/cli/xp.mjs --workspace <slug> — recompute every login's XP, level and unlocked games from the
// workspace's whole ledger with the rulebook's `xp` block of the day, and write them all to
// public.player_xp in one request. The ledger job runs it right after `pnpm game:project`.
// Fresh start (PRD 728): only rows with a home count. A login only older rows name keeps its row,
// rewritten at 0; its unlocked games stay. It never writes the ledger. A failed read writes nothing and exits 1: the ledger step has already
// succeeded, so XP catches up at the next poll.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { supabaseLedger } from '../sources/supabase.mjs';
import { counted, playerXp } from '../experience.mjs';
import { RULEBOOK } from '../rulebook.mjs';
import { openWorkspace } from './workspace.mjs';

// What game:xp reads back of a stored row: the games already unlocked, which a new run only adds to.
const StoredRows = z.array(z.object({ github_login: z.string().min(1), unlocked: z.array(z.string()) }));

/**
 * Reads the workspace's ledger and stored player_xp rows, then upserts one row per login the ledger
 * names (lower-cased), keyed by workspace and login. Both reads finish before any write. Returns the
 * rows written; a ledger that names no login yet writes nothing.
 */
export async function runXp({ rest, workspaceId, now = new Date(), rules = RULEBOOK.xp }) {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('game:xp: a workspace id is needed: every player_xp row belongs to one workspace');
  }
  const [events, stored] = await Promise.all([
    supabaseLedger(rest, workspaceId).read(),
    rest.select('player_xp', `select=github_login,unlocked&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=github_login`),
  ]);
  const unlocked = Object.fromEntries(StoredRows.parse(stored).map((r) => [r.github_login.toLowerCase(), r.unlocked]));
  const computedAt = now.toISOString();
  const logins = events.filter((e) => e.contributor).map((e) => e.contributor);
  const rows = playerXp(counted(events), { now, rules, stored: unlocked, logins }).map(({ login, xp, level, unlocked: games }) => ({
    workspace_id: workspaceId, github_login: login, xp, level, unlocked: games, computed_at: computedAt,
  }));
  if (rows.length) await rest.upsert('player_xp', rows, 'workspace_id,github_login');
  return rows;
}

const isMain = () => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isMain()) {
  const { rest, workspace } = await openWorkspace({ usage: 'game:xp --workspace <slug>' });
  try {
    const rows = await runXp({ rest, workspaceId: workspace.id });
    console.log(`${workspace.slug}: ${rows.length} logins · ${rows.filter((r) => r.level > 0).length} with a level · ${rows.length ? 'written to player_xp' : 'nothing to write'}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
