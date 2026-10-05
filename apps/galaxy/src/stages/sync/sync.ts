// POST /api/stages/sync (PRD 587, s2): the 15-minute sync, the truth of where each PRD is. The
// `stages` workflow calls it every quarter hour with `Authorization: Bearer <STAGES_SYNC_SECRET>`; any
// other caller, or every caller while the deployment has no secret, is refused (401) before anything is
// read. For each workspace, each repository its App installation reaches that carries the loop's config
// is read (./github.ts), turned into stages and topics (./core.ts), and recorded through the stage store
// (../store.ts), which keeps each stage's first date: a rerun writes nothing new. After a repository's
// first sync, only its issues and pull requests updated since the last one (less OVERLAP) are read
// (issue 642), so the 15-minute run does not spend the App's hourly GitHub budget. A repository that
// cannot be read or recorded is logged and skipped, and the others still land; a workspace whose
// repositories cannot be listed likewise. Only the workspaces themselves failing to read fails the run
// (500), so the workflow goes red.
//
// PRD 657 (s5): once a repository's stages are recorded, the open outbox questions of each of its PRDs
// seen (every folder, and every issue read) are recounted into prd_outbox (../outbox/recount.ts), so /prd
// and the waiting outbox never read GitHub. A recount that fails is logged; the stages still land.
//
// PRD 691 (s2): after its repositories, each workspace's fix dossiers (visual and bug) that have no stored
// release are read through the fix reader and stored in fix_facts (../../fixes/facts/refresh.ts), so
// /bugs and /visual never read GitHub. A released fix is final and is not read again. A refresh that
// fails, or a workspace whose fixes cannot be listed, is logged; the stages still land and the run
// answers 200.
import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { DossierRef, FixReader, FixRef } from '../../dossier/github/reader';
import { isFinal, refreshFixFacts } from '../../fixes/facts/refresh';
import type { FixFactsStore } from '../../fixes/facts/store';
import { recountOutboxes, type RecountDeps } from '../outbox/recount';
import type { StageStore } from '../store';
import { changedPrds, stagesOfRepo, type RepoSnapshot } from './core';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { firstPart, group } from 'vertuo-omni-plan/kit/lib/narrow.ts';

/** A workspace, and where its repositories are found on GitHub. */
export type SyncWorkspace = { id: string; slug: string; github_org: string | null; github_installation_id: number | null };

export type SyncDeps = {
  /** STAGES_SYNC_SECRET; undefined or empty when the deployment has none. */
  secret: string | undefined;
  workspaces(): Promise<SyncWorkspace[]>;
  /** The workspace's repositories that carry the loop's config, as `owner/name`. */
  repositories(workspace: SyncWorkspace): Promise<string[]>;
  /** Given `since`, only the issues and pull requests updated since then; null reads everything. */
  snapshot(workspace: SyncWorkspace, repository: string, since: string | null): Promise<RepoSnapshot>;
  store: StageStore;
  /** The GitHub summaries and the outbox store the open questions are recounted with; none, no recount. */
  outbox?: Pick<RecountDeps, 'summary' | 'store'>;
  /** The workspace's fix dossiers, the reader their facts are read with and where they are stored; none, no refresh. */
  fixes?: FixSyncDeps;
  /** The PRD dossiers' GitHub snapshots and the client's ETags; none, the sync leaves them alone. */
  snapshots?: SnapshotSyncDeps;
  now(): string;
  log(line: string): void;
};

/** What the sync needs to keep a workspace's fix facts fresh (PRD 691, s2). */
export type FixSyncDeps = {
  /** The workspace's numbered fix dossiers, of kind visual or bug. */
  dossiers(workspace: SyncWorkspace): Promise<FixRef[]>;
  reader: FixReader;
  store: FixFactsStore;
};

/** What the sync needs to be the snapshots' safety net (PRD 902, s4). Times are ISO. */
export type SnapshotSyncDeps = {
  /** Marks stale, since `at`, the current snapshot of each of the repository's PRDs given. */
  markChanged(workspace: SyncWorkspace, repository: string, prds: readonly PrdNumber[], at: string): Promise<void>;
  /** Marks stale, since `at`, every current snapshot of the workspace read before `before`. */
  markOld(workspace: SyncWorkspace, before: string, at: string): Promise<void>;
  /** The PRD dossiers of the repository whose snapshot is stale. */
  stale(workspace: SyncWorkspace, repository: string): Promise<DossierRef[]>;
  /** Refreshes the dossier's stale snapshot, `background`, under its lease. */
  refresh(workspace: SyncWorkspace, dossier: DossierRef): Promise<void>;
  /** Deletes the ETags not read since `before`. */
  dropEtags(before: string): Promise<void>;
};

/** What a repository gave: the stages and topics seen and recorded. */
type SyncedRepo = { workspace: string; repository: string; stages: number; topics: number };
/** What was skipped, and why; `repository` null when the workspace's repositories could not be listed. */
type SkippedRepo = { workspace: string; repository: string | null; reason: string };
type SyncReply = { synced_at: string; repositories: SyncedRepo[]; skipped: SkippedRepo[] };

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const why = (error: unknown) => (error instanceof Error ? firstPart(error.message, '\n') : String(error));
const digest = (text: string) => createHash('sha256').update(text).digest();

/** How far before the last sync a repository is read again, for clocks that disagree. */
const OVERLAP_MS = 5 * 60_000;
/** A snapshot read longer ago than this is stale, whatever GitHub said (a webhook missed twice over). */
const SNAPSHOT_MAX_AGE_MS = 6 * 3_600_000;
/** An ETag not read for this long is dropped. */
const ETAG_MAX_IDLE_MS = 7 * 24 * 3_600_000;

const before = (at: string, ms: number) => new Date(Date.parse(at) - ms).toISOString();

/** Marks stale the repository's PRDs that changed, then refreshes each of its stale snapshots, one at a
 * time; logs, never throws. */
async function refreshSnapshots(deps: SyncDeps, workspace: SyncWorkspace, repository: string, changed: readonly PrdNumber[], syncedAt: string): Promise<void> {
  const snapshots = deps.snapshots;
  if (!snapshots) return;
  if (changed.length > 0) {
    try {
      await snapshots.markChanged(workspace, repository, changed, syncedAt);
    } catch (error) {
      deps.log(`stages sync: the changed snapshots of ${repository} were not marked stale — ${why(error)}`);
    }
  }
  let stale: DossierRef[];
  try {
    stale = await snapshots.stale(workspace, repository);
  } catch (error) {
    deps.log(`stages sync: the stale snapshots of ${repository} cannot be listed — ${why(error)}`);
    return;
  }
  for (const dossier of stale) {
    try {
      await snapshots.refresh(workspace, dossier);
    } catch (error) {
      deps.log(`stages sync: the snapshot of ${repository}#${dossier.prd} was not refreshed — ${why(error)}`);
    }
  }
}

/** When to read a repository's changes from: its last sync less OVERLAP_MS; null, never synced, reads it all. */
async function sinceOf(deps: SyncDeps, workspace: SyncWorkspace, repository: string): Promise<string | null> {
  const last = await deps.store.lastSynced(workspace.id, repository);
  return last === null ? null : new Date(Date.parse(last) - OVERLAP_MS).toISOString();
}

/** Whether the request carries `Bearer <secret>`; never, without a secret. Compared in constant time. */
function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqual(digest(group(match, 1)), digest(secret));
}

/** Reads and records one repository; its counts, or throws with why it was skipped. */
async function syncRepo(deps: SyncDeps, workspace: SyncWorkspace, repository: string, syncedAt: string): Promise<SyncedRepo> {
  const since = await sinceOf(deps, workspace, repository);
  const snapshot = await deps.snapshot(workspace, repository, since);
  const { stages, topics } = stagesOfRepo(snapshot, syncedAt);
  await deps.store.recordStages(stages.map((s) => ({ ...s, workspace_id: workspace.id })), syncedAt);
  let learnt = 0;
  for (const topic of topics) {
    try {
      await deps.store.recordTopic({ ...topic, workspace_id: workspace.id });
      learnt += 1;
    } catch (error) {
      deps.log(`stages sync: the topic ${topic.topic} of ${repository}#${topic.prd} was not recorded — ${why(error)}`);
    }
  }
  await refreshSnapshots(deps, workspace, repository, changedPrds(snapshot), syncedAt);
  if (deps.outbox) {
    const prds = [...new Set([...stages, ...topics].map((s) => s.prd))].sort((a, b) => a - b).map((prd) => ({ repository, prd }));
    try {
      await recountOutboxes(workspace.id, prds, { ...deps.outbox, stages: deps.store, log: (line) => { deps.log(line); } }, syncedAt);
    } catch (error) {
      deps.log(`stages sync: the outboxes of ${repository} were not recounted — ${why(error)}`);
    }
  }
  return { workspace: workspace.slug, repository: repository.toLowerCase(), stages: stages.length, topics: learnt };
}

/** Reads and stores the facts of the workspace's fixes that have no stored release; logs, never throws. */
async function refreshFixes(deps: SyncDeps, workspace: SyncWorkspace, syncedAt: string): Promise<void> {
  if (!deps.fixes) return;
  const fixDeps = deps.fixes;
  const { reader, store } = fixDeps;
  try {
    const fixes = await fixDeps.dossiers(workspace);
    if (fixes.length === 0) return;
    const stored = await store.readFacts(workspace.id, fixes.map((f) => f.id));
    const unreleased = fixes.filter((f) => !isFinal(stored.get(f.id)));
    const log = (error: unknown) => { deps.log(`stages sync: a fix of ${workspace.slug} was not read — ${why(error)}`); };
    await refreshFixFacts(workspace.id, unreleased, { reader, store, now: () => syncedAt, log });
  } catch (error) {
    deps.log(`stages sync: the fix facts of ${workspace.slug} were not refreshed — ${why(error)}`);
  }
}

export async function syncStages(request: Request, deps: SyncDeps): Promise<Response> {
  if (!bearerMatches(request, deps.secret)) return json(401, { error: 'A valid bearer secret is required.' });
  const syncedAt = deps.now();
  let workspaces: SyncWorkspace[];
  try {
    workspaces = await deps.workspaces();
  } catch (error) {
    deps.log(`stages sync: the workspaces cannot be read — ${why(error)}`);
    return json(500, { error: 'The workspaces cannot be read.' });
  }
  const reply: SyncReply = { synced_at: syncedAt, repositories: [], skipped: [] };
  await deps.snapshots?.dropEtags(before(syncedAt, ETAG_MAX_IDLE_MS)).catch((error: unknown) => {
    deps.log(`stages sync: the idle ETags were not dropped — ${why(error)}`);
  });
  for (const workspace of workspaces) {
    await deps.snapshots?.markOld(workspace, before(syncedAt, SNAPSHOT_MAX_AGE_MS), syncedAt).catch((error: unknown) => {
      deps.log(`stages sync: the old snapshots of ${workspace.slug} were not marked stale — ${why(error)}`);
    });
    let repositories: string[] = [];
    try {
      repositories = await deps.repositories(workspace);
    } catch (error) {
      deps.log(`stages sync: the repositories of ${workspace.slug} cannot be listed — ${why(error)}`);
      reply.skipped.push({ workspace: workspace.slug, repository: null, reason: why(error) });
    }
    for (const repository of repositories) {
      try {
        reply.repositories.push(await syncRepo(deps, workspace, repository, syncedAt));
      } catch (error) {
        deps.log(`stages sync: ${repository} of ${workspace.slug} is skipped — ${why(error)}`);
        reply.skipped.push({ workspace: workspace.slug, repository: repository.toLowerCase(), reason: why(error) });
      }
    }
    await refreshFixes(deps, workspace, syncedAt);
  }
  return json(200, reply);
}
