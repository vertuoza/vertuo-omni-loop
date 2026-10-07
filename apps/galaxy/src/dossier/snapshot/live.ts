import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { serviceDb } from '../../data/sign-in-live';
import { orNull, parseRow } from '../../data/parse-rows';
import { dossierGithub, githubStore } from '../github/server';
import type { GithubSummary } from '../github/summary';
import type { DossierRef } from '../github/reader';
import { isDossierId } from '../page/source';
import { pageSnapshot, recountSnapshot, sendSnapshot, staleSnapshot, type GithubAt, type SnapshotDeps, type SnapshotDossier } from './snapshot';
import { snapshotStore, type SnapshotStore } from './store';

// The snapshot's real deps (PRD 902, s2): the service role's client for dossier_github, the server's one
// GitHub reader, the installation's stored budget (packages/github) for when GitHub resumes, and Next's
// after() for the refresh that runs once the response is sent. Each is made when a call first needs it,
// so a missing setting fails that call, which the snapshot logs.

const RESOURCES = ['core', 'graphql'] as const;
const Installation = z.object({ github_installation_id: z.number().nullable() });

/** The service role's store, made at its first call. */
function lazyStore(): SnapshotStore {
  let store: SnapshotStore | undefined;
  const get = () => (store ??= snapshotStore(serviceDb()));
  return {
    read: (id) => get().read(id),
    write: (row) => get().write(row),
    markStale: (id, at) => get().markStale(id, at),
    current: (id, before) => get().current(id, before),
    lease: (id, now, until) => get().lease(id, now, until),
    release: (id) => get().release(id),
    dossierOf: (workspace, repository, prd) => get().dossierOf(workspace, repository, prd),
  };
}

/** Until when the workspace's installation is paused, on any resource; null when it is not. */
async function pausedUntil(workspaceId: string): Promise<number | null> {
  const { data, error } = await serviceDb().from('workspaces').select('github_installation_id').eq('id', workspaceId).maybeSingle();
  if (error) throw new Error(`Supabase refused to read the workspace's installation: ${error.message}`);
  const installation = data === null ? null : orNull(parseRow(Installation, data, 'dossier/snapshot: workspaces'))?.github_installation_id ?? null;
  if (installation === null) return null;
  const budgets = await Promise.all(RESOURCES.map((resource) => githubStore().budget(installation, resource)));
  const until = Math.max(0, ...budgets.map((b) => b?.pausedUntil ?? 0));
  return until > 0 ? until : null;
}

const NO_READER: SnapshotDeps['reader'] = { summary: () => Promise.resolve(null), forget: () => {} };

function deps(): SnapshotDeps {
  return {
    store: lazyStore(),
    reader: dossierGithub() ?? NO_READER,
    pausedUntil,
    now: Date.now,
    later: (task) => { after(task); },
  };
}

/** The PRD page's GitHub part: the snapshot, and when GitHub was read. */
export function livePageSnapshot(dossier: SnapshotDossier): Promise<{ summary: GithubSummary | null; at: GithubAt | null }> {
  return pageSnapshot(dossier, deps());
}

/** The recount's summary of a workspace's PRD: from its dossier's snapshot (the ref's own id when it is a
 * dossier's, else the one found for the PRD), or, a PRD with no dossier, from the reader in the background. */
export async function liveRecountSummary(workspaceId: string, ref: DossierRef): Promise<GithubSummary | null> {
  const live = deps();
  const id = isDossierId(ref.id) ? ref.id : await live.store.dossierOf(workspaceId, ref.home_repo, ref.prd).catch((error: unknown) => {
    console.error(`GitHub snapshot: the dossier of ${ref.home_repo}#${ref.prd} could not be found — ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  if (id === null) return live.reader.summary(ref, { priority: 'background' });
  return recountSnapshot({ ...ref, id, workspace_id: workspaceId }, live);
}

/** The outbox send's read: one interactive read of the dossier, stored. */
export function liveSendSnapshot(dossier: DossierRef & { workspace_id: string }): Promise<GithubSummary | null> {
  return sendSnapshot(dossier, deps());
}

/** A reply was posted: the dossier's snapshot is stale. */
export function liveStaleSnapshot(dossierId: string): Promise<void> {
  return staleSnapshot(dossierId, deps());
}
