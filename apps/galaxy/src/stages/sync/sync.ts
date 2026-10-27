// /api/stages/sync (PRD 587, s2): the 15-minute sync, the truth of where each PRD is. Vercel Cron
// calls it every quarter hour with `Authorization: Bearer <CRON_SECRET>`, set to STAGES_SYNC_SECRET; any
// other caller, or every caller while the deployment has no secret, is refused (401) before anything is
// read. For each workspace, each repository its App installation reaches that carries the loop's config
// is read (./github.ts), turned into stages and topics (./core.ts), and recorded through the stage store
// (../store.ts), which keeps each stage's first date: a rerun writes nothing new. After a repository's
// first sync, only its issues and pull requests updated since the last one (less OVERLAP) are read
// (issue 642), so the 15-minute run does not spend the App's hourly GitHub budget. A workspace's
// repositories are read four at a time and answered in their order, so the run fits the route's 300 s
// (#2529). A repository that
// cannot be read or recorded is logged and skipped, and the others still land; a workspace whose
// repositories cannot be listed likewise. Only the workspaces themselves failing to read fails the run
// (500), so the workflow goes red.
//
// PRD 657 (s5): once a repository's stages are recorded, the open outbox questions of each of its PRDs
// seen (every folder, and every issue read) are recounted into prd_outbox (../outbox/recount.ts), so /prd
// and the waiting outbox never read GitHub. A recount that fails is logged; the stages still land. PRD 1794
// (s5): the recount reads each open feature PR's escalation record too, when `escalation` is given.
//
// PRD 691 (s2): after its repositories, each workspace's fix dossiers (visual and bug) that have no stored
// release are read through the fix reader and stored in fix_facts (../../fixes/facts/refresh.ts), so
// /bugs and /visual never read GitHub. A released fix is final and is not read again. A refresh that
// fails, or a workspace whose fixes cannot be listed, is logged; the stages still land and the run
// answers 200.
//
// PRD 1272 (s4): then each workspace's concept dossiers whose concept PR has not merged are read through the
// concept reader and stored in fix_facts too, so /concepts and a concept's page show its state without
// GitHub. A merged concept is in the inbox for good and is not read again. A failure is logged the same way.
//
// PRD 1299 (s6): with each repository's snapshot, the PRDs it holds that were born on the server (◆) are
// read with their first approval (`approvals`), so their inbox is dated at that approval and never at a
// phase-0 merge (./core.ts). Approvals that cannot be read are logged, and the repository's stages are
// dated as for a PRD born in the repository.
//
// PRD 1723 (s7): each run, at its end, writes exactly one `stages-sync` line through the run logger
// (kit/lib/log): `ok` with how many repositories it read, `refused` on a wrong bearer (401), `failed` when
// the workspaces cannot be read (500) or the run throws, which is rethrown unchanged; each with its status
// and how long it took. The per-repository sentences above are still written through `log`, and a run
// logger that throws changes no answer.
//
// PRD 2370 (s1): from the same snapshot, each PRD's milestones (./milestones.ts) are recorded through the
// milestone store (../../timeline/store.ts), which keeps the first time of each. A repository whose
// milestones were never recorded is read in full once, so the first sync fills the timelines of every PRD
// it can read, the shipped ones included. Milestones that cannot be recorded are logged; the stages still
// land.
//
// PRD 2370 (s3): each PRD's `idea` (its dossier opened) and `plan` (its first plan version) milestones are
// recorded with them, read from the dossiers (./dossier-times.ts). A PRD with no dossier gets neither; a
// read that fails is logged and the snapshot's milestones still land.
//
// PRD 2370 (s4): a PRD of a plan repository gets one lane per target feature PR (`Part of <owner/repo>#<n>`)
// that a repository of the same workspace shows (./milestones.ts). Once every repository of the workspace
// was read, the lanes claimed are recorded for the PRDs a repository read holds (a folder, or born on the
// server); a claim naming a PRD nobody read, a repository the workspace does not sync, or a product PRD is
// dropped. A plan repository that could not be read records none of its lanes that run. Lanes that cannot
// be recorded are logged; the stages still land.
//
// PRD 2377 (s1, s2): once a repository's stages and outboxes are recorded, its waits (`review`, `merge`,
// `approval`, `outbox` and `law`) are recorded in public.waits (./waits.ts), when `waits` is given. A
// repository that cannot be read is skipped before it, so its open waits stay as they are; so do the
// approvals when the ◆ PRDs cannot be read; waits that cannot be recorded are logged, and the stages
// still land.
import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { ConceptReader, DossierRef, FixReader, FixRef } from '../../dossier/github/reader';
import { isFinal, refreshConceptFacts, refreshFixFacts } from '../../fixes/facts/refresh';
import type { ConceptFactsStore, FixFactsStore } from '../../fixes/facts/store';
import { recountOutboxes, type RecountDeps } from '../outbox/recount';
import type { StageStore } from '../store';
import type { MilestoneStore } from '../../timeline/store';
import { changedPrds, foldersOf, stagesOfRepo, type RepoSnapshot, type ServerBorn } from './core';
import type { DossierTimes } from './dossier-times.repository';
import { dossierMilestones, milestonesOfRepo, targetMilestones, type SeenMilestone } from './milestones';
import { recordWaits, type WaitStore } from './waits';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Logger } from 'omni-loop/kit/lib/log/log.ts';
import { firstPart, group } from 'omni-loop/kit/lib/narrow.ts';

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
  /** The repository's PRDs born on the server, each with its first approval; none given, there are none. */
  approvals?(workspace: SyncWorkspace, repository: string): Promise<ServerBorn[]>;
  store: StageStore;
  /** Where each PRD's milestones are recorded (PRD 2370); none, the sync records none. */
  milestones?: MilestoneStore;
  /** The repository's PRD dossiers with when each was opened and its plan first written (PRD 2370, s3); none, no idea or plan milestone. */
  dossierTimes?(workspace: SyncWorkspace, repository: string): Promise<DossierTimes[]>;
  /** The GitHub summaries and the outbox store the open questions are recounted with; none, no recount. */
  outbox?: Pick<RecountDeps, 'summary' | 'store' | 'escalation'>;
  /** The workspace's fix dossiers, the reader their facts are read with and where they are stored; none, no refresh. */
  fixes?: FixSyncDeps;
  /** The workspace's concept dossiers, the reader their facts are read with and where they are stored; none, no refresh. */
  concepts?: ConceptSyncDeps;
  /** The PRD dossiers' GitHub snapshots and the client's ETags; none, the sync leaves them alone. */
  snapshots?: SnapshotSyncDeps;
  /** Where the waits are kept (PRD 2377); none, the sync records none. */
  waits?: WaitStore;
  now(): string;
  log(line: string): void;
  /** Where the run's one `stages-sync` line goes (PRD 1723): kit/lib/log's stdout logger, live. */
  runLog: Logger;
};

/** What the sync needs to keep a workspace's fix facts fresh (PRD 691, s2). */
export type FixSyncDeps = {
  /** The workspace's numbered fix dossiers, of kind visual or bug. */
  dossiers(workspace: SyncWorkspace): Promise<FixRef[]>;
  reader: FixReader;
  store: FixFactsStore;
};

/** What the sync needs to keep a workspace's concept facts fresh (PRD 1272, s4). */
export type ConceptSyncDeps = {
  /** The workspace's numbered concept dossiers. */
  dossiers(workspace: SyncWorkspace): Promise<FixRef[]>;
  reader: ConceptReader;
  store: ConceptFactsStore;
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

/** How many of a workspace's repositories are read at once: one after another, 22 of them overran the
 * route's 300 s (#2529). */
const REPO_READS = 4;

/** `each` of the items, at most `limit` at a time; what each gave, in the items' order. */
async function inTurns<T, R>(items: readonly T[], limit: number, each: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  const lane = async () => {
    for (const [index, item] of queue) results[index] = await each(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

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

/** When the repository's milestones were last recorded; `stages` (its stages' last sync) without a milestone
 * store, or when it cannot be read (logged); null when it holds none (PRD 2370). */
async function milestonesSynced(deps: SyncDeps, workspace: SyncWorkspace, repository: string, stages: string): Promise<string | null> {
  if (!deps.milestones) return stages;
  try {
    return await deps.milestones.lastSynced(workspace.id, repository);
  } catch (error) {
    deps.log(`stages sync: when the milestones of ${repository} were last synced cannot be read — ${why(error)}`);
    return stages;
  }
}

/** When to read a repository's changes from: the earlier of its stages' and its milestones' last sync, less
 * OVERLAP_MS; null, either never synced, reads it all. */
async function sinceOf(deps: SyncDeps, workspace: SyncWorkspace, repository: string): Promise<string | null> {
  const last = await deps.store.lastSynced(workspace.id, repository);
  if (last === null) return null;
  const milestones = await milestonesSynced(deps, workspace, repository, last);
  if (milestones === null) return null;
  return new Date(Math.min(Date.parse(last), Date.parse(milestones)) - OVERLAP_MS).toISOString();
}

/** The `idea` and `plan` milestones of the repository's PRD dossiers; none, logged, when they cannot be read (PRD 2370, s3). */
async function dossierMilestonesOf(deps: SyncDeps, workspace: SyncWorkspace, repository: string): Promise<SeenMilestone[]> {
  if (!deps.dossierTimes) return [];
  try {
    return dossierMilestones(repository, await deps.dossierTimes(workspace, repository));
  } catch (error) {
    deps.log(`stages sync: the dossier times of ${repository} cannot be read — ${why(error)}`);
    return [];
  }
}

/** What a workspace's repositories showed of plan repositories' PRDs (PRD 2370, s4): each PRD a repository
 * read holds (`owner/name#n`), and each target lane claimed, recorded once every repository was read. */
type TargetLanes = { held: Set<string>; claimed: SeenMilestone[] };

const prdKey = (repository: string, prd: PrdNumber) => `${repository.toLowerCase()}#${String(prd)}`;

/** Notes the PRDs the snapshot holds (its folders and its ◆ PRDs) and the target lanes it claims. */
function noteTargets(lanes: TargetLanes, snapshot: RepoSnapshot, born: readonly ServerBorn[]): void {
  for (const { prd } of [...foldersOf(snapshot), ...born]) lanes.held.add(prdKey(snapshot.repository, prd));
  lanes.claimed.push(...targetMilestones(snapshot));
}

/** Records the target lanes whose PRD a repository of the workspace holds; logs, never throws (PRD 2370, s4). */
async function recordTargetLanes(deps: SyncDeps, workspace: SyncWorkspace, lanes: TargetLanes, syncedAt: string): Promise<void> {
  if (!deps.milestones) return;
  const held = lanes.claimed.filter((m) => lanes.held.has(prdKey(m.repository, m.prd)));
  if (held.length === 0) return;
  try {
    await deps.milestones.recordMilestones(held.map((m) => ({ ...m, workspace_id: workspace.id })), syncedAt);
  } catch (error) {
    deps.log(`stages sync: the target lanes of ${workspace.slug} were not recorded — ${why(error)}`);
  }
}

/** Records the milestones the snapshot shows; logs, never throws (PRD 2370). */
async function recordMilestones(deps: SyncDeps, workspace: SyncWorkspace, snapshot: RepoSnapshot, born: readonly ServerBorn[], syncedAt: string): Promise<void> {
  if (!deps.milestones) return;
  try {
    const seen = [...milestonesOfRepo(snapshot, born), ...(await dossierMilestonesOf(deps, workspace, snapshot.repository))];
    await deps.milestones.recordMilestones(seen.map((m) => ({ ...m, workspace_id: workspace.id })), syncedAt);
  } catch (error) {
    deps.log(`stages sync: the milestones of ${snapshot.repository} were not recorded — ${why(error)}`);
  }
}

/** Whether the request carries `Bearer <secret>`; never, without a secret. Compared in constant time. */
function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqual(digest(group(match, 1)), digest(secret));
}

/** The repository's ◆ PRDs and their first approval; null, logged, when they cannot be read (none given: none to read). */
async function serverBornOf(deps: SyncDeps, workspace: SyncWorkspace, repository: string): Promise<ServerBorn[] | null> {
  if (!deps.approvals) return [];
  try {
    return await deps.approvals(workspace, repository);
  } catch (error) {
    deps.log(`stages sync: the approvals of ${repository} cannot be read — ${why(error)}`);
    return null;
  }
}

/** Records the waits of one repository's snapshot, once its outboxes are recounted; logs, never throws. */
async function recordRepoWaits(
  deps: SyncDeps, workspace: SyncWorkspace, snapshot: RepoSnapshot, serverBorn: ServerBorn[] | null, syncedAt: string,
): Promise<void> {
  if (!deps.waits) return;
  const escalation = deps.outbox?.escalation;
  const { repository } = snapshot;
  try {
    await recordWaits(deps.waits, workspace.id, snapshot, syncedAt, {
      serverBorn,
      ...(escalation ? { record: ({ pr, prd }: { pr: PrNumber; prd: PrdNumber }) => escalation({ repository, prd, pr }) } : {}),
    });
  } catch (error) {
    deps.log(`stages sync: the waits of ${repository} were not recorded — ${why(error)}`);
  }
}

/** Reads and records one repository; its counts, or throws with why it was skipped. */
async function syncRepo(deps: SyncDeps, workspace: SyncWorkspace, repository: string, syncedAt: string, lanes: TargetLanes): Promise<SyncedRepo> {
  const since = await sinceOf(deps, workspace, repository);
  const snapshot = await deps.snapshot(workspace, repository, since);
  const serverBorn = await serverBornOf(deps, workspace, repository);
  const born = serverBorn ?? [];
  const { stages, topics } = stagesOfRepo(snapshot, syncedAt, born);
  await deps.store.recordStages(stages.map((s) => ({ ...s, workspace_id: workspace.id })), syncedAt);
  await recordMilestones(deps, workspace, snapshot, born, syncedAt);
  noteTargets(lanes, snapshot, born);
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
  await recordRepoWaits(deps, workspace, snapshot, serverBorn, syncedAt);
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

/** Reads and stores the facts of the workspace's concepts, merged ones too (their issue can close); logs, never throws. */
async function refreshConcepts(deps: SyncDeps, workspace: SyncWorkspace, syncedAt: string): Promise<void> {
  if (!deps.concepts) return;
  const concepts = deps.concepts;
  try {
    const log = (error: unknown) => { deps.log(`stages sync: a concept of ${workspace.slug} was not read — ${why(error)}`); };
    const found = await concepts.dossiers(workspace);
    await refreshConceptFacts(workspace.id, found, { reader: concepts.reader, store: concepts.store, now: () => syncedAt, log });
  } catch (error) {
    deps.log(`stages sync: the concept facts of ${workspace.slug} were not refreshed — ${why(error)}`);
  }
}

/** Runs `step`, swallowing what it throws: the run line never changes the run's answer. */
function quietly(step: () => void): void {
  try {
    step();
  } catch {
    // A log line never breaks a request.
  }
}

/** A stopwatch on the run logger's clock that never throws; one that cannot be read gives 0, as the kit's own. */
function stopwatch(runLog: Logger): () => number {
  try {
    const stop = runLog.timer();
    return () => {
      try {
        return stop();
      } catch {
        return 0;
      }
    };
  } catch {
    return () => 0;
  }
}

/** The `/api/stages/sync` run (PRD 587), logged as one `stages-sync` line at its end (PRD 1723, s7). */
export async function syncStages(request: Request, deps: SyncDeps): Promise<Response> {
  const elapsed = stopwatch(deps.runLog);
  let run: SyncRun;
  try {
    run = await runSync(request, deps);
  } catch (error) {
    quietly(() => { deps.runLog.error({ event: 'stages-sync', outcome: 'failed', ms: elapsed(), error }); });
    throw error;
  }
  const ms = elapsed();
  const { answer, repos } = run;
  const { status } = answer;
  if (status === 401) quietly(() => { deps.runLog.warn({ event: 'stages-sync', outcome: 'refused', status, ms }); });
  else if (status >= 500) quietly(() => { deps.runLog.error({ event: 'stages-sync', outcome: 'failed', status, ms }); });
  else quietly(() => { deps.runLog.info({ event: 'stages-sync', outcome: 'ok', status, ms, ...(repos === undefined ? {} : { repos }) }); });
  return answer;
}

/** A run's answer, and how many repositories it read when it got that far. */
type SyncRun = { answer: Response; repos?: number };

async function runSync(request: Request, deps: SyncDeps): Promise<SyncRun> {
  if (!bearerMatches(request, deps.secret)) return { answer: json(401, { error: 'A valid bearer secret is required.' }) };
  const syncedAt = deps.now();
  let workspaces: SyncWorkspace[];
  try {
    workspaces = await deps.workspaces();
  } catch (error) {
    deps.log(`stages sync: the workspaces cannot be read — ${why(error)}`);
    return { answer: json(500, { error: 'The workspaces cannot be read.' }) };
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
    const lanes: TargetLanes = { held: new Set(), claimed: [] };
    const read = await inTurns(repositories, REPO_READS, async (repository): Promise<SyncedRepo | SkippedRepo> => {
      try {
        return await syncRepo(deps, workspace, repository, syncedAt, lanes);
      } catch (error) {
        deps.log(`stages sync: ${repository} of ${workspace.slug} is skipped — ${why(error)}`);
        return { workspace: workspace.slug, repository: repository.toLowerCase(), reason: why(error) };
      }
    });
    for (const repo of read) {
      if ('reason' in repo) reply.skipped.push(repo);
      else reply.repositories.push(repo);
    }
    await recordTargetLanes(deps, workspace, lanes, syncedAt);
    await refreshFixes(deps, workspace, syncedAt);
    await refreshConcepts(deps, workspace, syncedAt);
  }
  return { answer: json(200, reply), repos: reply.repositories.length };
}
