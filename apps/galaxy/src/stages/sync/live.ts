import 'server-only';
import { serviceDb } from '../../data/sign-in-live';
import { listOf, numberOf } from '../../data/unparsed';
import type { FixRef } from '../../dossier/github/reader';
import { serverEnv, type ArcadeEnv } from '../../env';
import { dossierGithub, githubStore } from '../../dossier/github/server';
import { liveRecountSummary } from '../../dossier/snapshot/live';
import { conceptFactsStore, fixFactsStore } from '../../fixes/facts/store';
import { knowledgeReader, type KnowledgeReader } from '../../knowledge/github';
import { appCredentials } from '../../signup/github-app';
import { outboxDeps } from '../outbox/live';
import { stageStore, type StageStore } from '../store';
import type { MilestoneStore } from '../../timeline/store';
import { milestoneStore } from '../../timeline/store.repository';
import { serverBornStore } from './approvals';
import { dossierTimesStore } from './dossier-times.repository';
import { stagesReader, type StagesReader } from './github';
import type { WaitStore } from './waits';
import { waitsRepository } from './waits.repository';
import { syncSnapshotStore } from './snapshots';
import type { ConceptSyncDeps, FixSyncDeps, SnapshotSyncDeps, SyncDeps, SyncWorkspace } from './sync';
import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import { log as runLog } from 'omni-loop/kit/lib/log/log.ts';

// The stages sync's real deps (PRD 587, s2): the bearer secret (STAGES_SYNC_SECRET), the service role's
// client (SUPABASE_SERVICE_ROLE_KEY) for the workspaces and the stage store, and GitHub as the Omni Loop
// App (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY). A workspace's repositories are the ones its installation
// reaches that carry the loop's config, as the knowledge map lists them (src/knowledge/github.ts). Each
// is built when a call first needs it, so a missing setting fails that call, which the route logs.
// PRD 657 (s5): each PRD's open outbox questions are recounted into prd_outbox (../outbox/live.ts).
// PRD 691 (s2): each workspace's numbered fix dossiers are read through the server's one dossier reader
// (its 60-second cache shared with the fix pages) and stored in fix_facts, as the service role.
// PRD 902 (s1): every read the sync makes of GitHub, its snapshots, its recounts and its fix refreshes, is
// `background`: it spends the installation's budget only above its 20% floor, and never while paused.
// PRD 902 (s4): the sync is the snapshots' safety net. It marks stale the snapshots of the PRDs whose issue
// or pull requests it saw change, and any read over 6 hours ago, refreshes only the stale ones through the
// snapshot (under its lease), recounts from the snapshots (../outbox/live.ts), and drops the ETags nobody
// read for 7 days.
// PRD 1272 (s4): each workspace's numbered concept dossiers are read the same way, through the reader's
// concept read, and stored in fix_facts until their concept PR merges.
// PRD 1299 (s6): each repository's PRDs born on the server are read with their first approval, as the
// service role (./approvals.ts), so their inbox is dated at it.
// PRD 1723 (s7): each run's one `stages-sync` line goes to stdout as JSON, through kit/lib/log.
// PRD 2370 (s1): each PRD's milestones are recorded in prd_milestones, as the service role.
// PRD 2370 (s3): each PRD's idea and plan times are read from its dossier (./dossier-times.ts).
// PRD 2377 (s1, s2): each repository's waits are kept in public.waits, as the service role (./waits.repository.ts).

let knowledge: KnowledgeReader | undefined;
let reader: StagesReader | undefined;
const github = () => (knowledge ??= knowledgeReader(appCredentials(), fetch, Date.now, console.error, { store: githubStore() }));
const stages = () => (reader ??= stagesReader(appCredentials(), fetch, Date.now, githubStore()));

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

/** The milestone store on the service role's client, made at its first call (PRD 2370). */
function lazyMilestones(): MilestoneStore {
  let store: MilestoneStore | undefined;
  const get = () => (store ??= milestoneStore(serviceDb()));
  return {
    recordMilestones: (rows, syncedAt) => get().recordMilestones(rows, syncedAt),
    milestonesOf: (key) => get().milestonesOf(key),
    workspaceMilestones: (workspace) => get().workspaceMilestones(workspace),
    lastSynced: (workspace, repository) => get().lastSynced(workspace, repository),
  };
}

/** The waits on the service role's client, made at each call. */
function waitDeps(): WaitStore {
  return {
    openWaits: (workspace, repository) => waitsRepository(serviceDb()).openWaits(workspace, repository),
    applyWaits: (workspace, repository, changes, at) => waitsRepository(serviceDb()).applyWaits(workspace, repository, changes, at),
    owners: (workspace, repository, prds) => waitsRepository(serviceDb()).owners(workspace, repository, prds),
    approvers: (workspace, repository) => waitsRepository(serviceDb()).approvers(workspace, repository),
    outboxes: (workspace, repository, prds) => waitsRepository(serviceDb()).outboxes(workspace, repository, prds),
    reached: (workspace, repository, prds) => waitsRepository(serviceDb()).reached(workspace, repository, prds),
  };
}

/** The server's dossier reader; throws without the App's credentials, so the refresh is logged once per workspace. */
function fixReader() {
  const reader = dossierGithub();
  if (!reader) throw new Error('the Omni Loop App has no credentials here');
  return reader;
}

/** The workspace's numbered dossiers of `kinds`, on the service role's client; `what` names them in a refusal. */
async function numberedDossiers(workspace: SyncWorkspace, kinds: readonly string[], what: string): Promise<FixRef[]> {
  fixReader();
  const { data, error } = await serviceDb().from('dossiers').select('id, home_repo, prd')
    .eq('workspace_id', workspace.id).in('kind', kinds).not('prd', 'is', null);
  if (error) throw new Error(`Supabase refused to read the ${what} dossiers: ${error.message}`);
  // Each row is read as PostgREST sent it, its columns unparsed.
  return listOf(data).map((row: { id: unknown; home_repo: unknown; prd: unknown }): FixRef => ({ id: String(row.id), home_repo: String(row.home_repo), prd: parseIssue(numberOf(row.prd)) }));
}

/** The fix deps on the service role's client and the server's reader, each made at its first call. */
function fixDeps(): FixSyncDeps {
  const store = () => fixFactsStore(serviceDb());
  return {
    dossiers: (workspace) => numberedDossiers(workspace, ['visual', 'bug'], 'fix'),
    reader: { fix: (ref) => fixReader().fix(ref, { priority: 'background' }) },
    store: {
      readFacts: (workspace, ids) => store().readFacts(workspace, ids),
      writeFacts: (rows, syncedAt) => store().writeFacts(rows, syncedAt),
    },
  };
}

/** The concept deps on the service role's client and the server's reader, each made at its first call. */
function conceptDeps(): ConceptSyncDeps {
  const store = () => conceptFactsStore(serviceDb());
  return {
    dossiers: (workspace) => numberedDossiers(workspace, ['concept'], 'concept'),
    reader: { concept: (ref) => fixReader().concept(ref, { priority: 'background' }) },
    store: {
      readFacts: (workspace, ids) => store().readFacts(workspace, ids),
      writeFacts: (rows, syncedAt) => store().writeFacts(rows, syncedAt),
    },
  };
}

/** The snapshots on the service role's client, each refreshed through the snapshot's own recount read. */
function snapshotDeps(): SnapshotSyncDeps {
  const store = () => syncSnapshotStore(serviceDb());
  return {
    markChanged: (workspace, repository, prds, at) => store().markChanged(workspace.id, repository, prds, at),
    markOld: (workspace, before, at) => store().markOld(workspace.id, before, at),
    stale: (workspace, repository) => store().stale(workspace.id, repository),
    refresh: async (workspace, dossier) => { await liveRecountSummary(workspace.id, dossier); },
    dropEtags: (before) => store().dropEtags(before),
  };
}

export function syncDeps(env: Pick<ArcadeEnv, 'stagesSyncSecret'> = serverEnv()): SyncDeps {
  return {
    secret: env.stagesSyncSecret ?? undefined,
    async workspaces() {
      const { data, error } = await serviceDb().from('workspaces').select('id, slug, github_org, github_installation_id').order('slug');
      if (error) throw new Error(`Supabase refused to read the workspaces: ${error.message}`);
      // Each row is read as PostgREST sent it, its columns unparsed.
      return listOf(data).map((row: { id: unknown; slug: unknown; github_org: unknown; github_installation_id?: unknown }) => ({
        id: String(row.id),
        slug: String(row.slug),
        github_org: typeof row.github_org === 'string' ? row.github_org : null,
        github_installation_id: row.github_installation_id === null || row.github_installation_id === undefined ? null : Number(row.github_installation_id),
      }));
    },
    repositories: async (workspace) => github().repos(await installationOf(workspace)),
    snapshot: async (workspace, repository, since) => stages().snapshot(await installationOf(workspace), repository, since),
    approvals: (workspace, repository) => serverBornStore(serviceDb()).serverBorn(workspace.id, repository),
    store: lazyStore(),
    milestones: lazyMilestones(),
    dossierTimes: (workspace, repository) => dossierTimesStore(serviceDb()).dossierTimes(workspace.id, repository),
    outbox: outboxDeps(),
    fixes: fixDeps(),
    concepts: conceptDeps(),
    snapshots: snapshotDeps(),
    waits: waitDeps(),
    now: () => new Date().toISOString(),
    log: (line) => { console.error(line); },
    runLog,
  };
}
