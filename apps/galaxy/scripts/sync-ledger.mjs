// pnpm galaxy:sync — copy game/ledger/*.jsonl and projects.yml into Supabase.
// Events are inserted with ON CONFLICT DO NOTHING (the ids are deterministic, the table is
// append-only), so running it twice, or after every `pnpm game:project`, is safe.
// Needs SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), e.g. in .env.local.
// In production the game workflow runs it after every poll (.github/workflows/game.yml).
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { readLedger } from 'vertuo-omni-plan/game/ledger.mjs';
import { loadProjects } from 'vertuo-omni-plan/game/config.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/galaxy/.env.local). `supabase status` prints both for the local stack.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const fail = (what, error) => { console.error(`${what}: ${error.message}`); process.exit(1); };

const projects = loadProjects(`${root}projects.yml`);
const events = readLedger(`${root}game/ledger`);

// Org facts end up exactly as projects.yml lists them: upsert what it lists (sectors first, teams
// reference them), then prune what it dropped (teams first). Never cleared first, so the live
// galaxy, which reads these tables between two syncs, never sees an empty map.
const upsert = (table, rows) => (rows.length ? db.from(table).upsert(rows, { onConflict: 'name' }) : { error: null });
const prune = (table, keep) => {
  const q = db.from(table).delete();
  return keep.length ? q.not('name', 'in', `(${keep.map((n) => JSON.stringify(n)).join(',')})`) : q.neq('name', '');
};
let r = await upsert('sectors', Object.entries(projects.sectors).map(([name, { repos }]) => ({ name, repos })));
if (r.error) fail('write sectors', r.error);
r = await upsert('teams', Object.entries(projects.teams).map(([name, { home }]) => ({ name, home })));
if (r.error) fail('write teams', r.error);
r = await prune('teams', Object.keys(projects.teams));
if (r.error) fail('prune teams', r.error);
r = await prune('sectors', Object.keys(projects.sectors));
if (r.error) fail('prune sectors', r.error);

let inserted = 0;
for (let i = 0; i < events.length; i += 500) {
  const batch = events.slice(i, i + 500).map((e) => ({
    id: e.id, at: e.at, type: e.type, planet: e.planet,
    region: e.region ?? null, contributor: e.contributor ?? null, team: e.team ?? null, data: e.data,
  }));
  // ignore-duplicates returns only the rows it actually inserted.
  const { data, error } = await db.from('ledger_events').upsert(batch, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (error) fail(`write events ${i}–${i + batch.length}`, error);
  inserted += data?.length ?? 0;
}
console.log(`synced ${Object.keys(projects.sectors).length} sectors, ${Object.keys(projects.teams).length} teams; ledger: ${events.length} events read, ${inserted} new`);
