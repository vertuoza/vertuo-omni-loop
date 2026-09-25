// The game's second impure module: reads and appends through Supabase's REST API (PostgREST) with
// plain fetch, so the game layer needs no client library. Every call goes through `fetch`, so tests
// run on a fake. The key is the service role's (GitHub Actions) or any key allowed to read.
//
// Everything the game holds belongs to one workspace (public.workspaces). A command names its
// workspace by slug (loadWorkspace), and every read and write below takes that workspace's id: each
// read is filtered by `workspace_id=eq.<id>`, each appended row carries it. The workspace is a
// storage column, never an event field.
import { z } from 'zod';
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
  // A request that never got an answer (Supabase down, a wrong URL) says what it was doing, and where.
  const send = async (what, href, init) => {
    try {
      return await fetch(href, init);
    } catch (err) {
      throw new Error(`Supabase: ${what} failed (${err.cause?.code ?? err.cause?.message ?? err.message} at ${url})`, { cause: err });
    }
  };
  return {
    /** Every row of a table, `query` being a PostgREST query string (select, filters, order). */
    async select(table, query) {
      const rows = [];
      for (let offset = 0; ; offset += PAGE) {
        const res = await send(`read ${table}`, `${base}/${table}?${query}&limit=${PAGE}&offset=${offset}`, { headers });
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
        const what = `write ${table} ${i}–${i + Math.min(BATCH, rows.length - i)}`;
        const res = await send(what, `${base}/${table}?on_conflict=${onConflict}&select=${select}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=representation' },
          body: JSON.stringify(rows.slice(i, i + BATCH)),
        });
        if (!res.ok) throw await fail(what, res);
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

const WorkspaceRow = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  github_org: z.string().nullable(),
  plan_repo: z.string().nullable(),
});

/** The workspace a command plays for, by its slug. An unknown slug throws, naming it. */
export async function loadWorkspace(rest, slug) {
  const rows = await rest.select('workspaces', `select=id,slug,name,github_org,plan_repo&slug=eq.${encodeURIComponent(slug)}`);
  if (!rows.length) throw new Error(`no workspace "${slug}": no row of public.workspaces has that slug`);
  return WorkspaceRow.parse(rows[0]);
}

// The filter every read of a game table carries. No workspace, no read: a missing id throws before
// any call, rather than reading (or writing) every workspace at once.
function scope(workspaceId) {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('Supabase: a workspace id is needed: every read and write of the game belongs to one workspace');
  }
  return `workspace_id=eq.${encodeURIComponent(workspaceId)}`;
}

/**
 * One workspace's sectors, fleets and roster. F7: every read is hard. A failed read throws, so a
 * poll appends nothing rather than events stripped of their fleets (the ledger is append-only).
 */
export async function loadConfig(rest, workspaceId) {
  const inWorkspace = scope(workspaceId);
  const [sectors, teams, roster] = await Promise.all([
    rest.select('sectors', `select=name,repos&${inWorkspace}&order=name`),
    rest.select('teams', `select=name,home,label,color,motto,mascot,sort,retired_at&${inWorkspace}&order=sort,name`),
    rest.select('players', `select=github_login,team&${inWorkspace}&github_login=not.is.null&team=not.is.null&order=github_login`),
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

/**
 * One workspace's ledger in public.ledger_events: the same contract as fileLedger and memoryLedger
 * (ledger.mjs). An event id is unique within its workspace: two workspaces may each hold one.
 */
export function supabaseLedger(rest, workspaceId) {
  const inWorkspace = scope(workspaceId);
  return {
    async read() {
      const rows = await rest.select('ledger_events', `select=id,at,type,planet,region,contributor,team,data&${inWorkspace}&order=at.asc,id.asc`);
      return rows.map(fromRow).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    },
    async append(events) {
      const valid = [...new Map(events.map(makeEvent).map((e) => [e.id, e])).values()]; // validates before anything is written
      const rows = valid.map((e) => ({ workspace_id: workspaceId, ...toRow(e) }));
      const inserted = new Set((await rest.insertNew('ledger_events', rows, 'workspace_id,id', 'id')).map((r) => r.id));
      return valid.filter((e) => inserted.has(e.id));
    },
  };
}

/**
 * The backup of one workspace (game:export): its row, then its ledger, sectors, fleets and players,
 * as file name → rows. Every row carries its workspace_id; players carry no email (it stays in
 * auth.users).
 */
export async function exportWorkspace(rest, workspaceId) {
  const inWorkspace = scope(workspaceId);
  return {
    workspace: await rest.select('workspaces', `select=id,slug,name,github_org,plan_repo,join_domain,theme,created_at&id=eq.${encodeURIComponent(workspaceId)}`),
    ledger_events: await rest.select('ledger_events', `select=workspace_id,id,at,type,planet,region,contributor,team,data&${inWorkspace}&order=at.asc,id.asc`),
    sectors: await rest.select('sectors', `select=workspace_id,name,repos&${inWorkspace}&order=name`),
    teams: await rest.select('teams', `select=workspace_id,name,home,label,color,motto,mascot,sort,retired_at&${inWorkspace}&order=sort,name`),
    players: await rest.select('players', `select=workspace_id,user_id,display_name,team,team_since,hero,github_id,github_login,created_at,updated_at&${inWorkspace}&order=created_at,user_id`),
  };
}
