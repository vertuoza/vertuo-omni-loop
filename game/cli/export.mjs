// game/cli/export.mjs <dir> — write the game's database as JSONL, one file per table: the backup the
// weekly workflow keeps as an artifact. The ledger's fleet stamps cannot be rebuilt from GitHub, so
// this export is what restores them. Players carry no email (it stays in auth.users).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { supabaseFromEnv } from '../sources/supabase.mjs';

const dir = process.argv[2];
if (!dir) { console.error('usage: game:export <dir>'); process.exit(2); }
const rest = supabaseFromEnv();
const TABLES = {
  ledger_events: 'select=id,at,type,planet,region,contributor,team,data&order=at.asc,id.asc',
  sectors: 'select=name,repos&order=name',
  teams: 'select=name,home,label,color,motto,mascot,sort,retired_at&order=sort,name',
  players: 'select=id,display_name,team,team_since,hero,github_id,github_login,created_at,updated_at&order=created_at',
};
mkdirSync(dir, { recursive: true });
for (const [table, query] of Object.entries(TABLES)) {
  const rows = await rest.select(table, query);
  writeFileSync(join(dir, `${table}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  console.log(`${table}: ${rows.length} rows`);
}
