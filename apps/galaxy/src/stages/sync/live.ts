import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import type { FixRef } from '../../dossier/github/reader';
import { dossierGithub } from '../../dossier/github/server';
import { fixFactsStore } from '../../fixes/facts/store';
import { knowledgeReader, type KnowledgeReader } from '../../knowledge/github';
import { appCredentials } from '../../signup/github-app';
import { outboxDeps } from '../outbox/live';
import { stageStore, type StageStore } from '../store';
import { stagesReader, type StagesReader } from './github';
import type { FixSyncDeps, SyncDeps, SyncWorkspace } from './sync';

// The stages sync's real deps (PRD 587, s2): the bearer secret (STAGES_SYNC_SECRET), the service role's
// client (SUPABASE_SERVICE_ROLE_KEY) for the workspaces and the stage store, and GitHub as the Omni Loop
// App (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY). A workspace's repositories are the ones its installation
// reaches that carry the loop's config, as the knowledge map lists them (src/knowledge/github.ts). Each
// is built when a call first needs it, so a missing setting fails that call, which the route logs.
// PRD 657 (s5): each PRD's open outbox questions are recounted into prd_outbox (../outbox/live.ts).
// PRD 691 (s2): each workspace's numbered fix dossiers are read through the server's one dossier reader
// (its 60-second cache shared with the fix pages) and stored in fix_facts, as the service role.

let knowledge: KnowledgeReader | undefined;
let reader: StagesReader | undefined;
const github = () => (knowledge ??= knowledgeReader(appCredentials()));
const stages = () => (reader ??= stagesReader(appCredentials()));

async function installationOf(workspace: SyncWorkspace): Promise<number> {
  const id = await github().installationFor(workspace);
  if (id === null) throw new Error(`the Omni Loop App is not installed for ${workspace.slug}`);
  return id;
}

/** The store on the service role's client, made at its first call. */
function lazyStore(): StageStore {
  let store: StageStore | undefined;
  const get = () => (store ??= stageStore(serviceDb()));
  return {
    recordStages: (rows, syncedAt) => get().recordStages(rows, syncedAt),
    recordTopic: (topic) => get().recordTopic(topic),
    stagesOf: (key) => get().stagesOf(key),
    currentStages: (workspace, prds) => get().currentStages(workspace, prds),
    stageCounts: (workspace, prds) => get().stageCounts(workspace, prds),
    prdByTopic: (workspace, repository, topic) => get().prdByTopic(workspace, repository, topic),
    lastSynced: (workspace, repository) => get().lastSynced(workspace, repository),
  };
}

/** The server's dossier reader; throws without the App's credentials, so the refresh is logged once per workspace. */
function fixReader() {
  const reader = dossierGithub();
  if (!reader) throw new Error('the Omni Loop App has no credentials here');
  return reader;
}

/** The fix deps on the service role's client and the server's reader, each made at its first call. */
function fixDeps(): FixSyncDeps {
  const store = () => fixFactsStore(serviceDb());
  return {
    async dossiers(workspace) {
      fixReader();
      const { data, error } = await serviceDb().from('dossiers').select('id, home_repo, prd')
        .eq('workspace_id', workspace.id).in('kind', ['visual', 'bug']).not('prd', 'is', null);
      if (error) throw new Error(`Supabase refused to read the fix dossiers: ${error.message}`);
      return (data ?? []).map((row): FixRef => ({ id: String(row.id), home_repo: String(row.home_repo), prd: Number(row.prd) }));
    },
    reader: { fix: (ref) => fixReader().fix(ref) },
    store: {
      readFacts: (workspace, ids) => store().readFacts(workspace, ids),
      writeFacts: (rows, syncedAt) => store().writeFacts(rows, syncedAt),
    },
  };
}

export function syncDeps(env: Record<string, string | undefined> = process.env): SyncDeps {
  return {
    secret: env.STAGES_SYNC_SECRET?.trim() || undefined,
    async workspaces() {
      const { data, error } = await serviceDb().from('workspaces').select('id, slug, github_org, github_installation_id').order('slug');
      if (error) throw new Error(`Supabase refused to read the workspaces: ${error.message}`);
      return (data ?? []).map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        github_org: typeof row.github_org === 'string' ? row.github_org : null,
        github_installation_id: row.github_installation_id === null || row.github_installation_id === undefined ? null : Number(row.github_installation_id),
      }));
    },
    repositories: async (workspace) => github().repos(await installationOf(workspace)),
    snapshot: async (workspace, repository, since) => stages().snapshot(await installationOf(workspace), repository, since),
    store: lazyStore(),
    outbox: outboxDeps(),
    fixes: fixDeps(),
    now: () => new Date().toISOString(),
    log: (line) => console.error(line),
  };
}
