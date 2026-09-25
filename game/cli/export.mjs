// game/cli/export.mjs <dir> --workspace <slug> — write one workspace of the game's database as
// JSONL: `workspace.jsonl` (its row) beside its `ledger_events`, `sectors`, `teams` and `players`, one
// file per table. The backup the weekly workflow keeps as an artifact. The ledger's fleet stamps
// cannot be rebuilt from GitHub, so this export is what restores them. Players carry no email (it
// stays in auth.users).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportWorkspace } from '../sources/supabase.mjs';
import { openWorkspace } from './workspace.mjs';

function exportArgs([dir, ...extra]) {
  if (!dir) throw new Error('name the directory to write');
  if (extra.length) throw new Error(`unexpected argument "${extra[0]}"`);
  return { dir };
}

const { rest, workspace, args: { dir } } = await openWorkspace({ usage: 'game:export <dir> --workspace <slug>', parse: exportArgs });
const files = await exportWorkspace(rest, workspace.id);
mkdirSync(dir, { recursive: true });
for (const [name, rows] of Object.entries(files)) {
  writeFileSync(join(dir, `${name}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  console.log(`${workspace.slug} ${name}: ${rows.length} rows`);
}
