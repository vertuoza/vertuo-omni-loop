// A fake PostgREST over the dossier tables, for the fallback's tests. It answers what the service role
// may do there, and nothing more, as supabase/migrations/20260928090000_dossiers.sql grants it: read
// the dossiers with their versions embedded, insert a dossier (only the columns granted, ignoring a
// duplicate key), update a title, read a version's content, and add a version through
// dossier_add_version() — the version rule, with its checks. With 20261011090000_fix_dossiers.sql (PRD
// 627): a dossier has a kind (prd when a row names none), its key is (workspace, repository, kind,
// number), each kind takes its own versions, and a round of variations is added unless one of the same
// content is already there. Anything else is refused, so a store that
// strays from the grants fails its test. Every other table goes to game/test/fake-supabase.ts.
import { createHash, randomUUID } from 'node:crypto';
import { fakeSupabase, header, serve, textOf, Written, type Headers, type Init, type Reply, type Row, type Served, type Tables } from '../test/fake-supabase.ts';

/** A row of public.dossiers, as the fake holds it. */
export type DossierRow = Row & { id: string; kind: string; prd: unknown; title: unknown; created_at: string };
/** A row of public.dossier_versions, as the fake holds it. */
export type VersionRow = Row & { id: string; dossier_id: unknown; kind: unknown; created_at: string; sha256?: unknown };
/** The fake's tables: the two dossier tables, and any other. */
export type DossierTables = Tables & { dossiers?: DossierRow[]; dossier_versions?: VersionRow[] };
/** What a request carried, as the fake recorded it. */
export type DossierCall = { method: string; path: string; url: URL; headers: Headers | undefined; body: unknown };

const HOME_REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
const HEX = /^[0-9a-f]{7,64}$/;
const INSERTABLE = new Set(['workspace_id', 'home_repo', 'kind', 'prd', 'title', 'numbered_at']);
const KEY = 'workspace_id,home_repo,kind,prd';
const TAKES: Record<string, readonly unknown[]> = { prd: ['spec', 'plan', 'before-after'], visual: ['before-after', 'variations'], bug: ['bug-record'] };
const RULE_ARGS = ['p_dossier', 'p_kind', 'p_content', 'p_source', 'p_uploaded_by', 'p_commit_sha', 'p_git_blob'];
const MAX_BYTES = 524288;
const VERSION_KINDS: readonly unknown[] = ['spec', 'plan', 'before-after', 'variations', 'bug-record'];
const SOURCES: readonly unknown[] = ['kit', 'github'];
const NONE: readonly unknown[] = [];

const reply = (status: number, body: unknown): Reply => ({ ok: status < 300, status, json: () => Promise.resolve(body), text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)) });
const refuse = (status: number, code: string, message: string): Reply => reply(status, { code, message });
const chars = (s: string): number => Array.from(s).length; // in code points, as Postgres counts

// `a,b,rel(c,d)` → { columns: ['a', 'b'], embeds: { rel: ['c', 'd'] } }
function parseSelect(select: string | null): { columns: string[]; embeds: Record<string, string[]> } {
  const columns: string[] = [];
  const embeds: Record<string, string[]> = {};
  for (const part of (select ?? '').match(/[a-z_]+\([^)]*\)|[a-z_*]+/g) ?? []) {
    const embed = /^([a-z_]+)\(([^)]*)\)$/.exec(part);
    if (embed) embeds[embed[1] ?? ''] = (embed[2] ?? '').split(',');
    else columns.push(part);
  }
  return { columns, embeds };
}

const pick = (row: Row, columns: string[]): Row => Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));

function filtered<R extends Row>(rows: R[], params: URLSearchParams): R[] {
  let out = rows;
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key) || key.includes('.')) continue;
    if (value === 'not.is.null') out = out.filter((r) => r[key] !== null && r[key] !== undefined);
    else if (value.startsWith('eq.')) out = out.filter((r) => r[key] !== null && r[key] !== undefined && textOf(r[key]) === value.slice(3));
    else throw new Error(`the fake does not know the filter ${key}=${value}`);
  }
  return out;
}

export function fakeDossiers(given: DossierTables = {}): { fetch: (href: string, init?: Init) => Promise<Reply>; calls: DossierCall[]; tables: DossierTables } {
  const dossiers: DossierRow[] = (given.dossiers ??= []);
  const versions: VersionRow[] = (given.dossier_versions ??= []);
  const tables = given;
  // The column's default, on a row a test gave without one: read as any row is, its kind unproven.
  for (const d of dossiers) { const row: Row = d; row.kind ??= 'prd'; }
  const others = fakeSupabase(tables);
  const calls: DossierCall[] = [];
  let clock = Date.parse('2026-09-27T10:00:00Z');
  const tick = () => new Date((clock += 1000)).toISOString();

  function readDossiers(url: URL): Row[] {
    const { columns, embeds } = parseSelect(url.searchParams.get('select'));
    const versionOrder = url.searchParams.get('dossier_versions.order');
    return filtered(dossiers, url.searchParams).map((d) => {
      const row = pick(d, columns);
      const embedded = embeds.dossier_versions;
      if (embedded) {
        let ofDossier = versions.filter((v) => v.dossier_id === d.id);
        // Insertion order unless the query asks for the version rule's own order.
        if (versionOrder === 'created_at.desc,id.desc') ofDossier = [...ofDossier].sort((a, b) => (b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
        row.dossier_versions = ofDossier.map((v) => pick(v, embedded));
      }
      return row;
    });
  }

  function insertDossiers(url: URL, headers: Headers | undefined, rows: Row[]): Reply {
    const prefer = header(headers, 'Prefer');
    if (url.searchParams.get('on_conflict') !== KEY || !prefer.includes('resolution=ignore-duplicates')) {
      return refuse(409, '23505', 'the fake takes a dossier only as an insert that ignores a duplicate key');
    }
    const inserted: DossierRow[] = [];
    for (const row of rows) {
      const denied = Object.keys(row).find((c) => !INSERTABLE.has(c));
      if (denied) return refuse(403, '42501', `permission denied for column ${denied} of table dossiers`);
      const kind = textOf(row.kind ?? 'prd');
      if (!(kind in TAKES)) return refuse(400, '23514', 'dossiers_kind_check');
      if (kind !== 'prd' && (row.prd ?? null) === null) return refuse(400, '23514', 'dossiers_fix_numbered');
      if (!HOME_REPO.test(textOf(row.home_repo ?? '')) || String(row.home_repo).length > 200) return refuse(400, '23514', 'dossiers_home_repo_check');
      if (row.prd !== null && row.prd !== undefined && !(typeof row.prd === 'number' && Number.isInteger(row.prd) && row.prd > 0)) return refuse(400, '23514', 'dossiers_prd_check');
      if (typeof row.title !== 'string' || chars(row.title) < 1 || chars(row.title) > 200) return refuse(400, '23514', 'dossiers_title_check');
      if (((row.prd ?? null) === null) !== ((row.numbered_at ?? null) === null)) return refuse(400, '23514', 'dossiers_numbered');
      const taken = dossiers.some((d) => d.workspace_id === row.workspace_id && d.home_repo === row.home_repo && d.kind === kind && row.prd != null && d.prd === row.prd);
      if (taken) continue;
      const dossier: DossierRow = { id: randomUUID(), workspace_id: row.workspace_id, home_repo: row.home_repo, kind, prd: row.prd ?? null, title: row.title, opened_by: null, claude_session_id: null, created_at: tick(), numbered_at: row.numbered_at ?? null };
      dossiers.push(dossier);
      inserted.push(dossier);
    }
    const { columns } = parseSelect(url.searchParams.get('select'));
    return reply(201, prefer.includes('return=representation') ? inserted.map((d) => pick(d, columns)) : []);
  }

  function updateDossiers(url: URL, patch: Row): Reply {
    const denied = Object.keys(patch).find((c) => c !== 'title');
    if (denied) return refuse(403, '42501', `permission denied for column ${denied} of table dossiers`);
    if (!url.searchParams.get('id')?.startsWith('eq.')) return refuse(400, '21000', 'the fake updates one dossier by its id');
    if (typeof patch.title !== 'string' || chars(patch.title) < 1 || chars(patch.title) > 200) return refuse(400, '23514', 'dossiers_title_check');
    for (const d of filtered(dossiers, url.searchParams)) d.title = patch.title;
    return reply(204, undefined);
  }

  // dossier_add_version(): the migration's version rule, as the service role calls it.
  function addVersion(args: Row): Reply {
    const unknown = Object.keys(args).find((k) => !RULE_ARGS.includes(k));
    if (unknown) return refuse(404, 'PGRST202', `no dossier_add_version with the argument ${unknown}`);
    const { p_dossier, p_kind, p_content, p_source, p_uploaded_by = null, p_commit_sha = null, p_git_blob = null } = args;
    if (p_content === null || p_content === undefined) return refuse(400, '22023', 'A version needs its content.');
    const content = textOf(p_content);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_BYTES) return refuse(400, '54000', `An artifact holds 512 KiB at most: this ${textOf(p_kind)} is ${bytes} bytes.`);
    const dossier = dossiers.find((d) => d.id === p_dossier);
    if (!dossier) return refuse(400, 'P0002', 'No such dossier.');
    if (!VERSION_KINDS.includes(p_kind)) return refuse(400, '23514', 'dossier_versions_kind_check');
    if (!(TAKES[dossier.kind] || NONE).includes(p_kind)) return refuse(400, '22023', `A ${dossier.kind} dossier takes no ${textOf(p_kind)} version.`);
    if (!SOURCES.includes(p_source)) return refuse(400, '23514', 'dossier_versions_source_check');
    if (p_source === 'github' && p_commit_sha === null) return refuse(400, '23514', 'dossier_versions_github_commit');
    if ((p_commit_sha !== null && !HEX.test(textOf(p_commit_sha))) || (p_git_blob !== null && !HEX.test(textOf(p_git_blob)))) return refuse(400, '23514', 'dossier_versions_hex_check');
    const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
    const ofKind = versions.filter((v) => v.dossier_id === p_dossier && v.kind === p_kind);
    const latest = [...ofKind].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
    if (p_kind === 'variations' ? ofKind.some((v) => v.sha256 === sha256) : latest?.sha256 === sha256) return reply(200, null);
    versions.push({
      id: randomUUID(), dossier_id: p_dossier, kind: p_kind, content, sha256, bytes, source: p_source,
      uploaded_by: p_uploaded_by, commit_sha: p_commit_sha, git_blob: p_git_blob, created_at: tick(),
    });
    return reply(200, ofKind.length + 1);
  }

  const answer = (href: string, init: Init): Promise<Reply> | Reply => {
    const url = new URL(href);
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '');
    const method = init.method ?? 'GET';
    const body: unknown = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, url, headers: init.headers, body });
    const sent: Row = body && typeof body === 'object' && !Array.isArray(body) ? Object.fromEntries(Object.entries(body)) : {};
    if (path === 'rpc/dossier_add_version') return method === 'POST' ? addVersion(sent) : refuse(405, 'PGRST101', 'POST only');
    if (path === 'dossiers') {
      if (method === 'GET') return reply(200, readDossiers(url));
      if (method === 'POST') return insertDossiers(url, init.headers, Array.isArray(body) ? Written.parse(body) : [sent]);
      if (method === 'PATCH') return updateDossiers(url, sent);
      return refuse(403, '42501', `permission denied: ${method} on dossiers`);
    }
    if (path === 'dossier_versions') {
      if (method !== 'GET') return refuse(403, '42501', `permission denied: ${method} on dossier_versions: a version is added only by dossier_add_version()`);
      const { columns } = parseSelect(url.searchParams.get('select'));
      return reply(200, filtered(versions, url.searchParams).map((v) => pick(v, columns)));
    }
    return others.fetch(href, init);
  };
  // Answers at once, as an async function's body did; a request it cannot read rejects.
  const fetch = (href: string, init: Init = {}): Promise<Reply> => new Promise((resolve) => { resolve(answer(href, init)); });
  return { fetch, calls, tables };
}

/** The same fake behind http://127.0.0.1:<port>: resolves to { url, calls, tables, close() }. */
export async function serveDossiers(tables?: DossierTables): Promise<Served<DossierCall>> {
  return serve(fakeDossiers(tables), (text): Record<string, string> => (text ? { 'Content-Type': 'application/json' } : {}));
}
