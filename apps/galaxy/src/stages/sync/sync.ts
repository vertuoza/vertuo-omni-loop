// POST /api/stages/sync (PRD 587, s2): the 15-minute sync, the truth of where each PRD is. The
// `stages` workflow calls it every quarter hour with `Authorization: Bearer <STAGES_SYNC_SECRET>`; any
// other caller, or every caller while the deployment has no secret, is refused (401) before anything is
// read. For each workspace, each repository its App installation reaches that carries the loop's config
// is read (./github.ts), turned into stages and topics (./core.ts), and recorded through the stage store
// (../store.ts), which keeps each stage's first date: a rerun writes nothing new. A repository that
// cannot be read or recorded is logged and skipped, and the others still land; a workspace whose
// repositories cannot be listed likewise. Only the workspaces themselves failing to read fails the run
// (500), so the workflow goes red.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { StageStore } from '../store';
import { stagesOfRepo, type RepoSnapshot } from './core';

/** A workspace, and where its repositories are found on GitHub. */
export type SyncWorkspace = { id: string; slug: string; github_org: string | null; github_installation_id: number | null };

export type SyncDeps = {
  /** STAGES_SYNC_SECRET; undefined or empty when the deployment has none. */
  secret: string | undefined;
  workspaces(): Promise<SyncWorkspace[]>;
  /** The workspace's repositories that carry the loop's config, as `owner/name`. */
  repositories(workspace: SyncWorkspace): Promise<string[]>;
  snapshot(workspace: SyncWorkspace, repository: string): Promise<RepoSnapshot>;
  store: StageStore;
  now(): string;
  log(line: string): void;
};

/** What a repository gave: the stages and topics seen and recorded. */
type SyncedRepo = { workspace: string; repository: string; stages: number; topics: number };
/** What was skipped, and why; `repository` null when the workspace's repositories could not be listed. */
type SkippedRepo = { workspace: string; repository: string | null; reason: string };
type SyncReply = { synced_at: string; repositories: SyncedRepo[]; skipped: SkippedRepo[] };

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));
const digest = (text: string) => createHash('sha256').update(text).digest();

/** Whether the request carries `Bearer <secret>`; never, without a secret. Compared in constant time. */
function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
}

/** Reads and records one repository; its counts, or throws with why it was skipped. */
async function syncRepo(deps: SyncDeps, workspace: SyncWorkspace, repository: string, syncedAt: string): Promise<SyncedRepo> {
  const { stages, topics } = stagesOfRepo(await deps.snapshot(workspace, repository), syncedAt);
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
  return { workspace: workspace.slug, repository: repository.toLowerCase(), stages: stages.length, topics: learnt };
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
  for (const workspace of workspaces) {
    let repositories: string[];
    try {
      repositories = await deps.repositories(workspace);
    } catch (error) {
      deps.log(`stages sync: the repositories of ${workspace.slug} cannot be listed — ${why(error)}`);
      reply.skipped.push({ workspace: workspace.slug, repository: null, reason: why(error) });
      continue;
    }
    for (const repository of repositories) {
      try {
        reply.repositories.push(await syncRepo(deps, workspace, repository, syncedAt));
      } catch (error) {
        deps.log(`stages sync: ${repository} of ${workspace.slug} is skipped — ${why(error)}`);
        reply.skipped.push({ workspace: workspace.slug, repository: repository.toLowerCase(), reason: why(error) });
      }
    }
  }
  return json(200, reply);
}
