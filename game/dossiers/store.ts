// @ts-nocheck
// The fallback's one way into the dossier tables (PRD 216), through Supabase's REST API as the service
// role, with plain fetch as game/sources/supabase.ts does. It does only what the migration grants the
// service role (supabase/migrations/20260928090000_dossiers.sql): read the dossiers and their versions,
// open a numbered dossier by its key, retitle one, and add a version through dossier_add_version(), the
// same version rule the kit's pushes go through. It never writes a version itself.
//
// Every read and write belongs to one workspace: a missing workspace id throws before any call.
//
// A dossier has a kind (PRD 627, supabase/migrations/20261011090000_fix_dossiers.sql): `prd`, `visual`
// or `bug`, part of its key. Every read names the kind it reads (`prd` when it names none), so a visual
// fix and a PRD of the same number never meet.
import { z } from 'zod';
import { supabaseRest } from '../sources/supabase.ts';

const KEY = 'workspace_id,home_repo,kind,prd';
// dossier_add_version()'s own order: the first version of a kind in this order is its latest.
const LATEST_FIRST = 'created_at.desc,id.desc';

const VERSION_KINDS = ['spec', 'plan', 'before-after', 'variations', 'bug-record'];
const VersionRow = z.object({ id: z.string().min(1), kind: z.enum(VERSION_KINDS), git_blob: z.string().nullable(), bytes: z.number().int() });
const DossierRow = z.object({ id: z.string().min(1), prd: z.number().int().positive(), title: z.string(), dossier_versions: z.array(VersionRow).default([]) });

/**
 * @typedef {{ id: string, gitBlob: string | null, bytes: number }} Latest
 * @typedef {{ id: string, prd: number, title: string, latest: Partial<Record<string, Latest>>, rounds?: Latest[] }} Dossier
 *   `rounds`, a visual fix's only: every variations version, since each round is its own
 */
function toDossier(row, kind) {
  const { id, prd, title, dossier_versions: versions } = DossierRow.parse(row);
  const latest = {};
  const rounds = [];
  for (const v of versions) {
    const read = { id: v.id, gitBlob: v.git_blob, bytes: v.bytes };
    if (v.kind === 'variations') rounds.push(read);
    else latest[v.kind] ??= read;
  }
  return kind === 'visual' ? { id, prd, title, latest, rounds } : { id, prd, title, latest };
}

function ofKind(kind) {
  if (!['prd', 'visual', 'bug'].includes(kind)) throw new Error(`Supabase: a dossier's kind is prd, visual or bug, not ${kind}`);
  return `kind=eq.${kind}`;
}

function inWorkspace(workspaceId) {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('Supabase: a workspace id is needed: every dossier belongs to one workspace');
  }
  return `workspace_id=eq.${encodeURIComponent(workspaceId)}`;
}

export function dossierStore({ url, key, fetch = globalThis.fetch }) {
  const rest = supabaseRest({ url, key, fetch });
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // A request the REST client has no verb for (an update, a function call), failing as it does.
  async function send(what, path, init) {
    let res;
    try {
      res = await fetch(`${base}/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    } catch (err) {
      throw new Error(`Supabase: ${what} failed (${err.cause?.code ?? err.cause?.message ?? err.message} at ${url})`, { cause: err });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase: ${what} failed (${res.status}${body ? `: ${body.slice(0, 200)}` : ''})`);
    }
    return res;
  }

  return {
    /**
     * A repository's numbered dossiers of one kind in the workspace (or only number `prd`'s), by number,
     * each with the latest version of each kind: its id, its blob hash (null when the kit pushed it) and
     * its size; a visual fix's with every round too.
     * @param {{ kind?: 'prd' | 'visual' | 'bug' }} [options] which kind of dossier: `prd` when none is named
     * @returns {Promise<Map<number, Dossier>>}
     */
    async dossiersOf(workspaceId, homeRepo, prd = null, { kind = 'prd' } = {}) {
      const which = prd === null ? 'prd=not.is.null' : `prd=eq.${Number(prd)}`;
      const rows = await rest.select('dossiers', [
        'select=id,prd,title,dossier_versions(id,kind,git_blob,bytes)',
        inWorkspace(workspaceId), `home_repo=eq.${encodeURIComponent(homeRepo)}`, ofKind(kind), which,
        'order=prd.asc', `dossier_versions.order=${LATEST_FIRST}`,
      ].join('&'));
      return new Map(rows.map((row) => toDossier(row, kind)).map((d) => [d.prd, d]));
    },

    /**
     * Opens dossier `prd` of `kind` (`prd` when none is named) by its key; null when the key is already
     * taken. @returns {Promise<Dossier | null>}
     */
    async open({ workspaceId, homeRepo, kind = 'prd', prd, title, at }) {
      inWorkspace(workspaceId);
      ofKind(kind);
      const [row] = await rest.insertNew('dossiers', [{ workspace_id: workspaceId, home_repo: homeRepo, kind, prd, title, numbered_at: at }], KEY, 'id,prd,title');
      return row ? toDossier(row, kind) : null;
    },

    async retitle(id, title) {
      await send('retitle a dossier', `dossiers?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ title }),
      });
    },

    /**
     * Adds a version read from GitHub through dossier_add_version(): its number among its kind's
     * versions, or null when its content hashes the same as the latest.
     * @returns {Promise<number | null>}
     */
    async addVersion({ dossierId, kind, content, commitSha, gitBlob }) {
      const res = await send(`add a ${kind} version`, 'rpc/dossier_add_version', {
        method: 'POST',
        body: JSON.stringify({ p_dossier: dossierId, p_kind: kind, p_content: content, p_source: 'github', p_uploaded_by: null, p_commit_sha: commitSha, p_git_blob: gitBlob }),
      });
      return z.number().int().positive().nullable().parse(await res.json());
    },

    /** One version's content, or null when there is no such version. */
    async content(versionId) {
      const [row] = await rest.select('dossier_versions', `select=content&id=eq.${encodeURIComponent(versionId)}`);
      return row ? z.string().parse(row.content) : null;
    },
  };
}
