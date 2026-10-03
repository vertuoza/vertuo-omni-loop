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
import { DossierRowSchema, type VERSION_KINDS } from './store.schema.ts';
import { causeOf, supabaseRest, type FetchLike } from '../sources/supabase.ts';
import type { IssueNumber, PrdNumber } from '../../kit/lib/ids.ts';

export type DossierVersionKind = (typeof VERSION_KINDS)[number];

/** One version of a dossier's artifact, as the store returns it. */
export type DossierVersion = { id: string; gitBlob: string | null; bytes: number };

/** A dossier, read from its row: the latest version of each kind. */
export type Dossier = {
  id: string;
  prd: PrdNumber;
  title: string;
  latest: Partial<Record<DossierVersionKind, DossierVersion>>;
  /** A visual fix's only: every `variations` version, since each round is its own. */
  rounds?: DossierVersion[];
};

/** The fallback's way into the dossier tables. */
export type DossierStore = {
  // A fix's dossier is keyed by its issue's number (PRD 627): `prd` takes either kind.
  dossiersOf: (workspaceId: string, homeRepo: string, prd?: PrdNumber | IssueNumber | null, options?: { kind?: string }) => Promise<Map<number, Dossier>>;
  open: (dossier: { workspaceId: string; homeRepo: string; kind?: string; prd: PrdNumber | IssueNumber; title: string; at: string }) => Promise<Dossier | null>;
  retitle: (id: string, title: string) => Promise<void>;
  addVersion: (version: { dossierId: string; kind: string; content: string; commitSha: string; gitBlob: string }) => Promise<number | null>;
  content: (versionId: string) => Promise<string | null>;
};

// A version's content, as dossier_versions answers it.
const ContentRow = z.looseObject({ content: z.unknown() });

const KEY = 'workspace_id,home_repo,kind,prd';
// dossier_add_version()'s own order: the first version of a kind in this order is its latest.
const LATEST_FIRST = 'created_at.desc,id.desc';

function toDossier(row: unknown, kind: string): Dossier {
  const { id, prd, title, dossier_versions: versions } = DossierRowSchema.parse(row);
  const latest: Partial<Record<DossierVersionKind, DossierVersion>> = {};
  const rounds: DossierVersion[] = [];
  for (const v of versions) {
    const read = { id: v.id, gitBlob: v.git_blob, bytes: v.bytes };
    if (v.kind === 'variations') rounds.push(read);
    else latest[v.kind] ??= read;
  }
  return kind === 'visual' ? { id, prd, title, latest, rounds } : { id, prd, title, latest };
}

function ofKind(kind: string): string {
  if (!['prd', 'visual', 'bug'].includes(kind)) throw new Error(`Supabase: a dossier's kind is prd, visual or bug, not ${kind}`);
  return `kind=eq.${kind}`;
}

function inWorkspace(workspaceId: unknown): string {
  if (typeof workspaceId !== 'string' || !workspaceId) {
    throw new Error('Supabase: a workspace id is needed: every dossier belongs to one workspace');
  }
  return `workspace_id=eq.${encodeURIComponent(workspaceId)}`;
}

export function dossierStore({ url, key, fetch = globalThis.fetch }: { url: string | undefined; key: string | undefined; fetch?: FetchLike }): DossierStore {
  const rest = supabaseRest({ url, key, fetch });
  if (!url || !key) throw new Error('Supabase: a URL and a key are needed'); // as supabaseRest has already thrown
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  // A request the REST client has no verb for (an update, a function call), failing as it does.
  async function send(what: string, path: string, init: { method: string; headers?: Record<string, string>; body: string }) {
    let res;
    try {
      res = await fetch(`${base}/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    } catch (err) {
      throw new Error(`Supabase: ${what} failed (${causeOf(err)} at ${url})`, { cause: err });
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
     * its size; a visual fix's with every round too. `options.kind`: `prd` when none is named.
     */
    async dossiersOf(workspaceId, homeRepo, prd = null, { kind = 'prd' } = {}) {
      const which = prd === null ? 'prd=not.is.null' : `prd=eq.${prd}`;
      const rows = await rest.select('dossiers', [
        'select=id,prd,title,dossier_versions(id,kind,git_blob,bytes)',
        inWorkspace(workspaceId), `home_repo=eq.${encodeURIComponent(homeRepo)}`, ofKind(kind), which,
        'order=prd.asc', `dossier_versions.order=${LATEST_FIRST}`,
      ].join('&'));
      return new Map(rows.map((row) => toDossier(row, kind)).map((d) => [d.prd, d]));
    },

    /**
     * Opens dossier `prd` of `kind` (`prd` when none is named) by its key; null when the key is already
     * taken.
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
      return row ? z.string().parse(ContentRow.parse(row).content) : null;
    },
  };
}
