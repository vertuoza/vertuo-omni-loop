// The collection behind the Engineering board (PRD 612): every tracked repository of every workspace
// with an installation of the app, read from GitHub and written to the store.
//
//   step "list-repositories"                  the tracked repositories and their installations
//   steps "collect <workspace>/<repo> <n>"    one repository, at most `BATCH` pull requests a step
//
// A repository's first collection backfills `BACKFILL_DAYS` days; each after it reads only the pull
// requests updated after its cursor (`collected_until`), oldest update first, so the cursor only moves
// past what was written. A failure (no access, a rate limit, a GitHub error) is caught inside that
// repository's step and recorded on its row (`collect_error`), with the cursor at what was written;
// the next run retries it from there, and the other repositories are collected all the same.
// Upserts keyed on the pull request and the reviewer make a second run write the same rows.
import { pullsUpdatedAfter, readPullRecord } from './github.mjs';

export const BACKFILL_DAYS = 90;
/**
 * Pull requests read and written in one step at most: each costs three GitHub calls, and one step is
 * one call of a Vercel function, so a step stays well inside its time limit.
 */
export const BATCH = 50;
/** Steps one repository takes at most in one run; a longer backfill carries on at the next run. */
export const MAX_BATCHES = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{
 *   store: { trackedRepositories: Function, savePull: Function, updateRepository: Function },
 *   octokitFor: (installationId: number) => Promise<{ request: Function }> | { request: Function },
 *   step: { run: (id: string, fn: () => unknown) => Promise<any> },
 *   now: number,
 * }} deps
 */
export async function collectAll({ store, octokitFor, step, now }) {
  const nowIso = new Date(now).toISOString();
  const backfillFrom = new Date(now - BACKFILL_DAYS * DAY_MS).toISOString();
  const repositories = await step.run('list-repositories', () => store.trackedRepositories());

  const summary = { repositories: repositories.length, collected: 0, failed: 0, unfinished: 0, saved: 0 };
  for (const repository of repositories) {
    let cursor = repository.collectedUntil ?? backfillFrom;
    for (let n = 1; ; n += 1) {
      const out = await step.run(`collect ${repository.workspaceId}/${repository.fullName} ${n}`, () =>
        collectBatch({ store, octokitFor, repository, cursor, nowIso }),
      );
      summary.saved += out.saved;
      cursor = out.cursor;
      if (out.error) {
        summary.failed += 1;
        break;
      }
      if (!out.more) {
        summary.collected += 1;
        break;
      }
      if (n === MAX_BATCHES) {
        summary.unfinished += 1;
        break;
      }
    }
  }
  return summary;
}

/** One step of one repository: at most one batch of pull requests, then its row updated. */
async function collectBatch({ store, octokitFor, repository, cursor, nowIso }) {
  const { workspaceId, fullName, installationId } = repository;
  const [owner, repo] = fullName.split('/');
  let reached = cursor;
  let saved = 0;
  try {
    const octokit = await octokitFor(installationId);
    const listed = await pullsUpdatedAfter(octokit, { owner, repo, since: cursor });
    const taken = batchOf(listed);
    for (const [index, item] of taken.entries()) {
      const { row, reviews } = await readPullRecord(octokit, { workspaceId, fullName, number: item.number });
      await store.savePull(row, reviews);
      saved += 1;
      // The cursor never stops between two pull requests updated at the same instant: the next read
      // starts strictly after it.
      if (taken[index + 1]?.updatedAt !== item.updatedAt) reached = item.updatedAt;
    }
    const more = listed.length > taken.length;
    await store.updateRepository(
      workspaceId,
      fullName,
      more ? { collected_until: reached } : { collected_at: nowIso, collected_until: reached, collect_error: null },
    );
    return { saved, cursor: reached, more };
  } catch (error) {
    const reason = describe(error);
    await store.updateRepository(workspaceId, fullName, { collected_until: reached, collect_error: reason });
    return { saved, cursor: reached, more: false, error: reason };
  }
}

/** The first `BATCH` pull requests, and every one after them updated at the same instant as the last. */
function batchOf(listed) {
  let end = Math.min(BATCH, listed.length);
  while (end < listed.length && listed[end].updatedAt === listed[end - 1].updatedAt) end += 1;
  return listed.slice(0, end);
}

function describe(error) {
  const message = String(error?.message ?? error ?? 'unknown error').split('\n')[0];
  return error?.status ? `HTTP ${error.status}: ${message}` : message;
}
