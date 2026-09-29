// A fake PostgREST over the dossier tables, for the fallback's tests. It answers what the service role
// may do there, and nothing more, as supabase/migrations/20260928090000_dossiers.sql grants it: read
// the dossiers with their versions embedded, insert a dossier (only the columns granted, ignoring a
// duplicate key), update a title, read a version's content, and add a version through
// dossier_add_version() — the version rule, with its checks. With 20261011090000_fix_dossiers.sql (PRD
// 627): a dossier has a kind (prd when a row names none), its key is (workspace, repository, kind,
// number), each kind takes its own versions, and a round of variations is added unless one of the same
// content is already there. Anything else is refused, so a store that
// strays from the grants fails its test. Every other table goes to game/test/fake-supabase.mjs.
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { fakeSupabase } from '../test/fake-supabase.mjs';

const HOME_REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
const HEX = /^[0-9a-f]{7,64}$/;
const INSERTABLE = new Set(['workspace_id', 'home_repo', 'kind', 'prd', 'title', 'numbered_at']);
const KEY = 'workspace_id,home_repo,kind,prd';
const TAKES = { prd: ['spec', 'plan', 'before-after'], visual: ['before-after', 'variations'], bug: ['bug-record'] };
const RULE_ARGS = ['p_dossier', 'p_kind', 'p_content', 'p_source', 'p_uploaded_by', 'p_commit_sha', 'p_git_blob'];
const MAX_BYTES = 524288;

const reply = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => (body === undefined ? '' : JSON.stringify(body)) });
const refuse = (status, code, message) => reply(status, { code, message });
const chars = (s) => [...s].length;

// `a,b,rel(c,d)` → { columns: ['a', 'b'], embeds: { rel: ['c', 'd'] } }
function parseSelect(select) {
  const columns = [];
  const embeds = {};
  for (const part of (select ?? '').match(/[a-z_]+\([^)]*\)|[a-z_*]+/g) ?? []) {
    const embed = /^([a-z_]+)\(([^)]*)\)$/.exec(part);
    if (embed) embeds[embed[1]] = embed[2].split(',');
    else columns.push(part);
  }
  return { columns, embeds };
}

const pick = (row, columns) => Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));

function filtered(rows, params) {
  let out = rows;
  for (const [key, value] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key) || key.includes('.')) continue;
    if (value === 'not.is.null') out = out.filter((r) => r[key] !== null && r[key] !== undefined);
    else if (value.startsWith('eq.')) out = out.filter((r) => r[key] !== null && r[key] !== undefined && String(r[key]) === value.slice(3));
    else throw new Error(`the fake does not know the filter ${key}=${value}`);
  }
  return out;
}

export function fakeDossiers(tables = {}) {
  tables.dossiers ??= [];
  tables.dossier_versions ??= [];
  for (const d of tables.dossiers) d.kind ??= 'prd'; // the column's default
  const others = fakeSupabase(tables);
  const calls = [];
  let clock = Date.parse('2026-09-27T10:00:00Z');
  const tick = () => new Date((clock += 1000)).toISOString();

  function readDossiers(url) {
    const { columns, embeds } = parseSelect(url.searchParams.get('select'));
    const versionOrder = url.searchParams.get('dossier_versions.order');
    return filtered(tables.dossiers, url.searchParams).map((d) => {
      const row = pick(d, columns);
      if (embeds.dossier_versions) {
        let versions = tables.dossier_versions.filter((v) => v.dossier_id === d.id);
        // Insertion order unless the query asks for the version rule's own order.
        if (versionOrder === 'created_at.desc,id.desc') versions = [...versions].sort((a, b) => (b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
        row.dossier_versions = versions.map((v) => pick(v, embeds.dossier_versions));
      }
      return row;
    });
  }

  function insertDossiers(url, headers, rows) {
    const prefer = headers?.Prefer ?? headers?.prefer ?? '';
    if (url.searchParams.get('on_conflict') !== KEY || !prefer.includes('resolution=ignore-duplicates')) {
      return refuse(409, '23505', 'the fake takes a dossier only as an insert that ignores a duplicate key');
    }
    const inserted = [];
    for (const row of rows) {
      const denied = Object.keys(row).find((c) => !INSERTABLE.has(c));
      if (denied) return refuse(403, '42501', `permission denied for column ${denied} of table dossiers`);
      const kind = row.kind ?? 'prd';
      if (!(kind in TAKES)) return refuse(400, '23514', 'dossiers_kind_check');
      if (kind !== 'prd' && (row.prd ?? null) === null) return refuse(400, '23514', 'dossiers_fix_numbered');
      if (!HOME_REPO.test(row.home_repo ?? '') || row.home_repo.length > 200) return refuse(400, '23514', 'dossiers_home_repo_check');
      if (row.prd !== null && row.prd !== undefined && !(Number.isInteger(row.prd) && row.prd > 0)) return refuse(400, '23514', 'dossiers_prd_check');
      if (typeof row.title !== 'string' || chars(row.title) < 1 || chars(row.title) > 200) return refuse(400, '23514', 'dossiers_title_check');
      if (((row.prd ?? null) === null) !== ((row.numbered_at ?? null) === null)) return refuse(400, '23514', 'dossiers_numbered');
      const taken = tables.dossiers.some((d) => d.workspace_id === row.workspace_id && d.home_repo === row.home_repo && d.kind === kind && row.prd != null && d.prd === row.prd);
      if (taken) continue;
      const dossier = { id: randomUUID(), workspace_id: row.workspace_id, home_repo: row.home_repo, kind, prd: row.prd ?? null, title: row.title, opened_by: null, claude_session_id: null, created_at: tick(), numbered_at: row.numbered_at ?? null };
      tables.dossiers.push(dossier);
      inserted.push(dossier);
    }
    const { columns } = parseSelect(url.searchParams.get('select'));
    return reply(201, prefer.includes('return=representation') ? inserted.map((d) => pick(d, columns)) : []);
  }

  function updateDossiers(url, patch) {
    const denied = Object.keys(patch).find((c) => c !== 'title');
    if (denied) return refuse(403, '42501', `permission denied for column ${denied} of table dossiers`);
    if (!url.searchParams.get('id')?.startsWith('eq.')) return refuse(400, '21000', 'the fake updates one dossier by its id');
    if (typeof patch.title !== 'string' || chars(patch.title) < 1 || chars(patch.title) > 200) return refuse(400, '23514', 'dossiers_title_check');
    for (const d of filtered(tables.dossiers, url.searchParams)) d.title = patch.title;
    return reply(204, undefined);
  }

  // dossier_add_version(): the migration's version rule, as the service role calls it.
  function addVersion(args) {
    const unknown = Object.keys(args).find((k) => !RULE_ARGS.includes(k));
    if (unknown) return refuse(404, 'PGRST202', `no dossier_add_version with the argument ${unknown}`);
    const { p_dossier, p_kind, p_content, p_source, p_uploaded_by = null, p_commit_sha = null, p_git_blob = null } = args;
    if (p_content === null || p_content === undefined) return refuse(400, '22023', 'A version needs its content.');
    const bytes = Buffer.byteLength(p_content, 'utf8');
    if (bytes > MAX_BYTES) return refuse(400, '54000', `An artifact holds 512 KiB at most: this ${p_kind} is ${bytes} bytes.`);
    const dossier = tables.dossiers.find((d) => d.id === p_dossier);
    if (!dossier) return refuse(400, 'P0002', 'No such dossier.');
    if (!['spec', 'plan', 'before-after', 'variations', 'bug-record'].includes(p_kind)) return refuse(400, '23514', 'dossier_versions_kind_check');
    if (!TAKES[dossier.kind].includes(p_kind)) return refuse(400, '22023', `A ${dossier.kind} dossier takes no ${p_kind} version.`);
    if (!['kit', 'github'].includes(p_source)) return refuse(400, '23514', 'dossier_versions_source_check');
    if (p_source === 'github' && p_commit_sha === null) return refuse(400, '23514', 'dossier_versions_github_commit');
    if ((p_commit_sha !== null && !HEX.test(p_commit_sha)) || (p_git_blob !== null && !HEX.test(p_git_blob))) return refuse(400, '23514', 'dossier_versions_hex_check');
    const sha256 = createHash('sha256').update(p_content, 'utf8').digest('hex');
    const ofKind = tables.dossier_versions.filter((v) => v.dossier_id === p_dossier && v.kind === p_kind);
    const latest = [...ofKind].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
    if (p_kind === 'variations' ? ofKind.some((v) => v.sha256 === sha256) : latest?.sha256 === sha256) return reply(200, null);
    tables.dossier_versions.push({
      id: randomUUID(), dossier_id: p_dossier, kind: p_kind, content: p_content, sha256, bytes, source: p_source,
      uploaded_by: p_uploaded_by, commit_sha: p_commit_sha, git_blob: p_git_blob, created_at: tick(),
    });
    return reply(200, ofKind.length + 1);
  }

  const fetch = async (href, init = {}) => {
    const url = new URL(href);
    const path = url.pathname.replace(/^.*\/rest\/v1\//, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, url, headers: init.headers, body });
    if (path === 'rpc/dossier_add_version') return method === 'POST' ? addVersion(body) : refuse(405, 'PGRST101', 'POST only');
    if (path === 'dossiers') {
      if (method === 'GET') return reply(200, readDossiers(url));
      if (method === 'POST') return insertDossiers(url, init.headers, Array.isArray(body) ? body : [body]);
      if (method === 'PATCH') return updateDossiers(url, body);
      return refuse(403, '42501', `permission denied: ${method} on dossiers`);
    }
    if (path === 'dossier_versions') {
      if (method !== 'GET') return refuse(403, '42501', `permission denied: ${method} on dossier_versions: a version is added only by dossier_add_version()`);
      const { columns } = parseSelect(url.searchParams.get('select'));
      return reply(200, filtered(tables.dossier_versions, url.searchParams).map((v) => pick(v, columns)));
    }
    return others.fetch(href, init);
  };
  return { fetch, calls, tables };
}

/** The same fake behind http://127.0.0.1:<port>: resolves to { url, calls, tables, close() }. */
export async function serveDossiers(tables) {
  const fake = fakeDossiers(tables);
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const answer = await fake.fetch(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(body ? { body } : {}) });
    const text = await answer.text();
    res.writeHead(answer.status, text ? { 'Content-Type': 'application/json' } : {});
    res.end(text);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls: fake.calls,
    tables: fake.tables,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
