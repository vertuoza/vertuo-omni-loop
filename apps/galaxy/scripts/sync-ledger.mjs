// pnpm galaxy:sync — copy game/ledger/*.jsonl and projects.yml into Supabase.
// Events are inserted with ON CONFLICT DO NOTHING (the ids are deterministic, the table is
// append-only), so running it twice, or after every `pnpm game:project`, is safe.
// Needs SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), e.g. in .env.local.
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

// Org facts: replaced wholesale, teams first (they reference sectors).
let r = await db.from('teams').delete().neq('name', '');
if (r.error) fail('clear teams', r.error);
r = await db.from('sectors').delete().neq('name', '');
if (r.error) fail('clear sectors', r.error);
r = await db.from('sectors').insert(Object.entries(projects.sectors).map(([name, { repos }]) => ({ name, repos })));
if (r.error) fail('write sectors', r.error);
r = await db.from('teams').insert(Object.entries(projects.teams).map(([name, { home }]) => ({ name, home })));
if (r.error) fail('write teams', r.error);

let sent = 0;
for (let i = 0; i < events.length; i += 500) {
  const batch = events.slice(i, i + 500).map((e) => ({
    id: e.id, at: e.at, type: e.type, planet: e.planet,
    region: e.region ?? null, contributor: e.contributor ?? null, team: e.team ?? null, data: e.data,
  }));
  const { error } = await db.from('ledger_events').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
  if (error) fail(`write events ${i}–${i + batch.length}`, error);
  sent += batch.length;
}
console.log(`synced ${Object.keys(projects.sectors).length} sectors, ${Object.keys(projects.teams).length} teams, ${sent} ledger events (existing ids skipped)`);
