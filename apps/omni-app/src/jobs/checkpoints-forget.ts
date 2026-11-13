// The `checkpoints-forget` job (PRD 2809 s6, spec "Forgetting"): a schedule of the ledger (./schedule.ts), every
// hour, 3 tries. A run deletes from the private `runner-checkpoints` bucket the bundles that have no reason left to
// stay, and stamps `deleted_at` on their rows:
//
//   the chain ended   a job of the save's chain ended with none of its attempts left to run: done, cancelled or not
//                     resumed (its last attempt is over, ../checkpoints/store.ts)
//   seven days old    the save was made 7 days ago or more, or its `keep_until` has passed (L-GDPR-4)
//
// A bundle is deleted before its row is stamped, so a run cut short leaves a row the next run takes again (deleting
// a bundle already gone is harmless). Manifests stay with their rows, holding no file content. The payload holds the
// slot only, never a token and never a path (L-GDPR-2), and no path is logged.
import type { CheckpointStore, Kept } from '../checkpoints/store.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { JobHandler, JobResult } from './worker.ts';

export const CHECKPOINTS_FORGET_KIND = 'checkpoints-forget';

/** How long a bundle may stay in the bucket: 7 days (L-GDPR-4). */
export const KEEP_MS = 7 * 24 * 60 * 60 * 1000;
/** How many saves are read at a time, and how many pages one run reads. */
const PAGE = 200;
const MAX_PAGES = 10;

/** Whether the save is too old to keep at `now`. */
export function tooOld({ createdAt, keepUntil }: Kept, now: number): boolean {
  return now - Date.parse(createdAt) >= KEEP_MS || Date.parse(keepUntil) <= now;
}

/** The handler of the `checkpoints-forget` kind: `store` is the saves' database and bucket. */
export function checkpointsForgetHandler({
  store,
  clock = Date.now,
  log = noteTo('checkpoints-forget'),
}: {
  store: CheckpointStore;
  clock?: () => number;
  log?: (line: string) => void;
}): JobHandler {
  return async (): Promise<JobResult> => {
    const now = clock();
    let forgotten = 0;
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const kept = await store.kept(offset, PAGE);
      const ended = await store.ended([...new Set(kept.map((save) => save.jobId))]);
      const doomed = kept.filter((save) => ended.has(save.jobId) || tooOld(save, now));
      if (doomed.length > 0) {
        await store.remove(doomed.map((save) => save.path));
        await store.stamp(
          doomed.map((save) => save.id),
          new Date(now),
        );
        forgotten += doomed.length;
      }
      // A stamped row leaves the next page's start where it was; one kept moves it on.
      offset += kept.length - doomed.length;
      if (kept.length < PAGE) break;
    }
    log(`checkpoints forget: ${String(forgotten)} bundles deleted`);
    return { outcome: 'done' };
  };
}
