// Pages read a snapshot (PRD 902, s2): what GitHub said of a numbered PRD is kept in dossier_github
// (./store.ts), and the PRD page, the outbox recount and the outbox send read it instead of GitHub.
//
// - The page renders from the snapshot and says when GitHub was read. With none yet (a first visit),
//   it makes the one `interactive` read a page ever waits on, stores it, and renders it. A stale
//   snapshot renders at once, and one `background` refresh runs after the response.
// - A refresh holds the snapshot's lease (LEASE_MS), so one runs at a time per dossier; a second one
//   while it holds does nothing. It reads GitHub fresh, through the reader's in-flight sharing only.
// - A refresh that fails (GitHub unread, the budget refused) keeps the previous snapshot and leaves it
//   stale. A part it could not read keeps its stored value, and the snapshot stays stale until a read
//   gets every part; a stale mark set while it read stays for the next one.
// - The recount reads the snapshot, refreshing it first when it is stale or missing (`background`).
// - The outbox send forces one `interactive` read and stores it; once its reply is posted, the
//   snapshot is marked stale, so the recount after it reads again.
// - The page also says when GitHub resumes while the installation's budget is paused.
// Every store failure is logged and never stops a page: it then reads as no snapshot.
import { UNREAD, type GithubSummary } from '../github/summary';
import type { DossierRef } from '../github/reader';
import type { Priority } from '@omni/github';
import type { SnapshotStore } from './store';

/** How long a refresh holds the lease: past it, another refresh may take it. */
export const LEASE_MS = 60_000;

/** A numbered PRD dossier, as a snapshot needs it. */
export type SnapshotDossier = DossierRef & { workspace_id: string };

/** When the page's GitHub part was read, and when GitHub resumes while the budget is paused (ISO). */
export type GithubAt = { readAt: string; resumesAt: string | null };

export type SnapshotDeps = {
  /** The service role's store. */
  store: SnapshotStore;
  /** The server's one reader. */
  reader: { summary(dossier: DossierRef, options: { priority: Priority }): Promise<GithubSummary | null>; forget(dossierId: string): void };
  /** Until when (epoch ms) the workspace's installation is paused; null when it is not, or not known. */
  pausedUntil: (workspaceId: string) => Promise<number | null>;
  now: () => number;
  /** Runs `task` once the response is sent. */
  later: (task: () => Promise<void>) => void;
  log?: (line: string) => void;
};

const iso = (ms: number) => new Date(ms).toISOString();
const why = (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error));
const refOf = ({ id, home_repo, prd }: SnapshotDossier): DossierRef => ({ id, home_repo, prd });

/** The fresh summary, each part it could not read kept from `stored`; `partial` when any part was unread. */
export function mergeSummary(stored: GithubSummary | null, fresh: GithubSummary): { summary: GithubSummary; partial: boolean } {
  let partial = false;
  const keep = <T,>(part: T, kept: T | undefined): T => {
    if (part !== UNREAD) return part;
    partial = true;
    return kept === undefined ? part : kept;
  };
  const was = stored ?? fresh;
  const summary: GithubSummary = {
    ...fresh,
    issue: keep(fresh.issue, was.issue),
    phase0: keep(fresh.phase0, was.phase0),
    feature: keep(fresh.feature, was.feature),
    retro: keep(fresh.retro, was.retro),
    mergedSlices: keep(fresh.mergedSlices, was.mergedSlices),
  };
  if (fresh.outbox !== undefined) summary.outbox = keep(fresh.outbox, was.outbox);
  if (fresh.outboxComment !== undefined) summary.outboxComment = keep(fresh.outboxComment, was.outboxComment);
  if (fresh.replies !== undefined) summary.replies = keep(fresh.replies, was.replies);
  if (fresh.retroText !== undefined) summary.retroText = keep(fresh.retroText, was.retroText);
  if (fresh.care !== undefined) summary.care = keep(fresh.care, was.care);
  return { summary, partial };
}

/** The stored snapshot; null when it has none or it could not be read (logged). */
async function stored(dossier: SnapshotDossier, deps: SnapshotDeps) {
  try {
    return await deps.store.read(dossier.id);
  } catch (error) {
    (deps.log ?? console.error)(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd} could not be read — ${why(error)}`);
    return null;
  }
}

/** Reads GitHub at `priority` and stores what it read over the stored snapshot (a store failure is
 * logged); the summary read, or null when GitHub could not be read (the stored snapshot is then kept). */
async function readAndStore(dossier: SnapshotDossier, priority: Priority, deps: SnapshotDeps): Promise<GithubSummary | null> {
  const startedAt = iso(deps.now());
  deps.reader.forget(dossier.id);
  const fresh = await deps.reader.summary(refOf(dossier), { priority });
  if (!fresh) return null;
  try {
    const previous = await stored(dossier, deps);
    const { summary, partial } = mergeSummary(previous?.summary ?? null, fresh);
    await deps.store.write({ dossierId: dossier.id, workspaceId: dossier.workspace_id, summary, readAt: startedAt });
    if (!partial) await deps.store.current(dossier.id, startedAt);
    return summary;
  } catch (error) {
    (deps.log ?? console.error)(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd} could not be stored — ${why(error)}`);
    return fresh;
  }
}

export type RefreshOutcome = 'refreshed' | 'failed' | 'busy';

/** Refreshes the snapshot under its lease, at `priority`: busy when another refresh holds it. */
export async function refreshSnapshot(dossier: SnapshotDossier, priority: Priority, deps: SnapshotDeps): Promise<RefreshOutcome> {
  const log = deps.log ?? console.error;
  const now = deps.now();
  try {
    if (!(await deps.store.lease(dossier.id, iso(now), iso(now + LEASE_MS)))) return 'busy';
  } catch (error) {
    log(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd} could not be leased — ${why(error)}`);
    return 'failed';
  }
  try {
    return (await readAndStore(dossier, priority, deps)) ? 'refreshed' : 'failed';
  } catch (error) {
    log(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd} could not be refreshed — ${why(error)}`);
    return 'failed';
  } finally {
    await deps.store.release(dossier.id).catch((error: unknown) => { log(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd}'s lease could not be freed — ${why(error)}`); });
  }
}

/** When GitHub resumes for the dossier's workspace, while paused; null otherwise. */
async function resumesAt(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<string | null> {
  try {
    const until = await deps.pausedUntil(dossier.workspace_id);
    return until !== null && until > deps.now() ? iso(until) : null;
  } catch (error) {
    (deps.log ?? console.error)(`GitHub snapshot: the budget of ${dossier.home_repo} could not be read — ${why(error)}`);
    return null;
  }
}

/** What the PRD page renders: the snapshot (a stale one refreshed after the response), or, with none, one
 * `interactive` read stored; `at` says when GitHub was read and when it resumes, null when never read. */
export async function pageSnapshot(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<{ summary: GithubSummary | null; at: GithubAt | null }> {
  const [kept, resumes] = await Promise.all([stored(dossier, deps), resumesAt(dossier, deps)]);
  if (kept) {
    if (kept.staleSince !== null) deps.later(async () => { await refreshSnapshot(dossier, 'background', deps); });
    return { summary: kept.summary, at: { readAt: kept.readAt, resumesAt: resumes } };
  }
  const readAt = iso(deps.now());
  const summary = await deps.reader.summary(refOf(dossier), { priority: 'interactive' });
  if (!summary) return { summary: null, at: null };
  deps.later(async () => {
    try {
      await deps.store.write({ dossierId: dossier.id, workspaceId: dossier.workspace_id, summary, readAt });
    } catch (error) {
      (deps.log ?? console.error)(`GitHub snapshot: ${dossier.home_repo}#${dossier.prd} could not be stored — ${why(error)}`);
    }
  });
  return { summary, at: { readAt, resumesAt: resumes } };
}

/** The summary the recount derives from: the snapshot, refreshed first (`background`) when it is stale or
 * missing; null when there is none and GitHub could not be read. */
export async function recountSnapshot(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<GithubSummary | null> {
  const kept = await stored(dossier, deps);
  if (kept && kept.staleSince === null) return kept.summary;
  if (!kept) return readAndStore(dossier, 'background', deps);
  await refreshSnapshot(dossier, 'background', deps);
  return (await stored(dossier, deps))?.summary ?? kept.summary;
}

/** The outbox send's read: one `interactive` read, stored; null when GitHub could not be read. */
export function sendSnapshot(dossier: SnapshotDossier, deps: SnapshotDeps): Promise<GithubSummary | null> {
  return readAndStore(dossier, 'interactive', deps);
}

/** Marks the dossier's snapshot stale now (a send posted a reply): the next reader reads GitHub again. */
export async function staleSnapshot(dossierId: string, deps: Pick<SnapshotDeps, 'store' | 'reader' | 'now' | 'log'>): Promise<void> {
  deps.reader.forget(dossierId);
  try {
    await deps.store.markStale(dossierId, iso(deps.now()));
  } catch (error) {
    (deps.log ?? console.error)(`GitHub snapshot: ${dossierId} could not be marked stale — ${why(error)}`);
  }
}
