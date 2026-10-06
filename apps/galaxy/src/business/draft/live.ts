import 'server-only';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAs, supabaseEnv, supabaseServer } from '../../data/supabase-server';
import { githubStore } from '../../dossier/github/server';
import { knowledgeReader, type KnowledgeReader } from '../../knowledge/github';
import { appCredentials } from '../../signup/github-app';
import type { DraftRouteDeps, SourcesRouteDeps } from './api';
import { extractorFromEnv } from './extract';
import { repoReader, type RepoReader } from './github';
import { checkUrl, fetchPage } from './page';
import { runDraft, type DraftDeps } from './run';
import { draftStore, WORKSPACE_COLUMNS, WorkspaceRow } from './store';
import { orNull, parseRow } from '../../data/parse-rows';
import { serverEnv } from '../../env';

// The draft routes' real dependencies (./api.ts, PRD 774 s2). The store is the signed-in person's own
// Supabase session, so row-level security and the migration's functions decide who may read and write.
// A started draft runs after the answer (Next's after()), on a client holding that person's access
// token, so it no longer needs the request's cookies. GitHub is read as the Omni Loop App
// (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY) through the installation the workspace owns; without those
// settings every repository is skipped. The small model runs only when OPENROUTER_API_KEY is set.

let knowledge: KnowledgeReader | undefined;
let reader: RepoReader | undefined;
const github = () => (knowledge ??= knowledgeReader(appCredentials(), fetch, Date.now, console.error, { store: githubStore() }));
const repos = () => (reader ??= repoReader(appCredentials(), fetch, Date.now, githubStore()));

/** The signed-in person's session, with its access token; null when nobody is signed in. */
async function signedIn(): Promise<{ db: SupabaseClient; token: string } | null> {
  if (!supabaseEnv()) return null;
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await db.auth.getSession();
  return session ? { db, token: session.access_token } : null;
}



/** A workspaces row as the installation lookup reads it: the installation id as a number. */
const installationRow = (row: WorkspaceRow) => ({
  github_org: row.github_org,
  github_installation_id: row.github_installation_id === null ? null : Number(row.github_installation_id),
});

const why = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A draft's run over `db`, the person's session or (for the recheck) the service role's. */
export function runDeps(db: Pick<SupabaseClient, 'from' | 'rpc'>): DraftDeps {
  return {
    store: draftStore(db),
    async installation(workspace) {
      try {
        const { data } = await db.from('workspaces').select(WORKSPACE_COLUMNS).eq('id', workspace).maybeSingle();
        const row = data ? orNull(parseRow(WorkspaceRow, data, 'business/draft/live: workspaces')) : null;
        return row ? await github().installationFor(installationRow(row)) : null;
      } catch (error) {
        console.error(`business draft: no GitHub installation for ${workspace} (${why(error)})`);
        return null;
      }
    },
    github: {
      listing: (installation, repository) => repos().listing(installation, repository),
      file: (installation, repository, path) => repos().file(installation, repository, path),
    },
    page: (url) => fetchPage(url),
    extract: extractorFromEnv(serverEnv().openrouter),
    log: (line) => { console.error(line); },
  };
}

export function draftRouteDeps(): DraftRouteDeps {
  let token: string | null = null;
  return {
    async store() {
      const session = await signedIn();
      token = session?.token ?? null;
      return session ? draftStore(session.db) : null;
    },
    later(_store, workspace, draft) {
      if (!token) return;
      const deps = runDeps(supabaseAs(token));
      after(() => runDraft(deps, workspace, draft.id));
    },
  };
}

export function sourcesRouteDeps(): SourcesRouteDeps {
  return {
    async store() {
      const session = await signedIn();
      return session ? draftStore(session.db) : null;
    },
    check: (url) => checkUrl(url),
  };
}
