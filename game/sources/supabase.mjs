// The game's second impure module: reads and appends through Supabase's REST API (PostgREST) with
// plain fetch, so the game layer needs no client library. Every call goes through `fetch`, so tests
// run on a fake. The key is the service role's (GitHub Actions) or any key allowed to read.
import { makeEvent } from '../events.mjs';
import { configFrom } from '../config.mjs';

const PAGE = 1000; // the project's max_rows (supabase/config.toml)
const BATCH = 500;

export function supabaseRest({ url, key, fetch = globalThis.fetch }) {
  if (!url || !key) throw new Error('Supabase: a URL and a key are needed');
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const fail = async (what, res) => {
    const body = await res.text().catch(() => '');
    return new Error(`Supabase: ${what} failed (${res.status}${body ? `: ${body.slice(0, 200)}` : ''})`);
  };
  return {
    /** Every row of a table, `query` being a PostgREST query string (select, filters, order). */
    async select(table, query) {
      const rows = [];
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(`${base}/${table}?${query}&limit=${PAGE}&offset=${offset}`, { headers });
        if (!res.ok) throw await fail(`read ${table}`, res);
        const page = await res.json();
        rows.push(...page);
        if (page.length < PAGE) return rows;
      }
    },
    /** Inserts rows, skipping any whose `onConflict` key exists; returns the rows actually inserted. */
    async insertNew(table, rows, onConflict, select = onConflict) {
      const inserted = [];
      for (let i = 0; i < rows.length; i += BATCH) {
        const res = await fetch(`${base}/${table}?on_conflict=${onConflict}&select=${select}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(rows.slice(i, i + BATCH)),
        });
        if (!res.ok) throw await fail(`write ${table} ${i}–${i + Math.min(BATCH, rows.length - i)}`, res);
        inserted.push(...(await res.json()));
      }
      return inserted;
    },
  };
}

/** The REST client from the environment: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY. */
export function supabaseFromEnv(env = process.env, fetchImpl) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the game reads and writes the galaxy database). '
      + 'Locally, `npx supabase status` prints both.');
  }
  return supabaseRest({ url, key, ...(fetchImpl ? { fetch: fetchImpl } : {}) });
}

/**
 * Sectors, fleets and the roster. F7: every read is hard. A failed read throws, so a poll appends
 * nothing rather than events stripped of their fleets (the ledger is append-only).
 */
export async function loadConfig(rest) {
  const [sectors, teams, roster] = await Promise.all([
    rest.select('sectors', 'select=name,repos&order=name'),
    rest.select('teams', 'select=name,home,label,color,motto,mascot,sort,retired_at&order=sort,name'),
    rest.select('players', 'select=github_login,team&github_login=not.is.null&team=not.is.null&order=github_login'),
  ]);
  return configFrom({ sectors, teams, roster });
}

const toRow = (e) => ({
  id: e.id, at: e.at, type: e.type, planet: e.planet,
  region: e.region ?? null, contributor: e.contributor ?? null, team: e.team ?? null, data: e.data,
});
const fromRow = (r) => makeEvent({
  id: r.id, at: new Date(r.at).toISOString().replace(/\.\d{3}Z$/, 'Z'), type: r.type, planet: r.planet, data: r.data ?? {},
  ...(r.region ? { region: r.region } : {}),
  ...(r.contributor ? { contributor: r.contributor } : {}),
  ...(r.team ? { team: r.team } : {}),
});

/** The ledger in public.ledger_events: the same contract as fileLedger and memoryLedger (ledger.mjs). */
export function supabaseLedger(rest) {
  return {
    async read() {
      const rows = await rest.select('ledger_events', 'select=id,at,type,planet,region,contributor,team,data&order=at.asc,id.asc');
      return rows.map(fromRow).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    },
    async append(events) {
      const valid = [...new Map(events.map(makeEvent).map((e) => [e.id, e])).values()]; // validates before anything is written
      const inserted = new Set((await rest.insertNew('ledger_events', valid.map(toRow), 'id')).map((r) => r.id));
      return valid.filter((e) => inserted.has(e.id));
    },
  };
}
