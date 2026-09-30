// game/cli/export.mjs <dir> --workspace <slug> — write one workspace of the game's database as
// JSONL: `workspace.jsonl` (its row) beside its `ledger_events`, `sectors`, `teams`, `players` and
// `arcade_scores`, one file per table. The backup the weekly workflow keeps as an artifact. The
// ledger's fleet stamps cannot be rebuilt from GitHub, nor the crew's high scores from anything, so
// this export is what restores them. Players carry no email (it stays in auth.users). player_xp is
// left out: the next `pnpm game:xp` rebuilds it from the ledger.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportWorkspace } from '../sources/supabase.mjs';
import { openWorkspace, runByPath } from './workspace.mjs';

/**
 * One workspace's backup, as file name → rows: its row, ledger, sectors, fleets and players, then
 * every player's best score at each arcade game. Every row carries its workspace_id.
 */
export async function backupFiles(rest, workspaceId) {
  const files = await exportWorkspace(rest, workspaceId); // throws, before any read, without a workspace id
  const arcadeScores = await rest.select(
    'arcade_scores', `select=workspace_id,user_id,game,best,at&workspace_id=eq.${encodeURIComponent(workspaceId)}&order=game,best.desc,at`,
  );
  return { ...files, arcade_scores: arcadeScores };
}

function exportArgs([dir, ...extra]) {
  if (!dir) throw new Error('name the directory to write');
  if (extra.length) throw new Error(`unexpected argument "${extra[0]}"`);
  return { dir };
}

if (runByPath(import.meta.url)) {
  const { rest, workspace, args: { dir } } = await openWorkspace({ usage: 'game:export <dir> --workspace <slug>', parse: exportArgs });
  const files = await backupFiles(rest, workspace.id);
  mkdirSync(dir, { recursive: true });
  for (const [name, rows] of Object.entries(files)) {
    writeFileSync(join(dir, `${name}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
    console.log(`${workspace.slug} ${name}: ${rows.length} rows`);
  }
}
