// The main watch's two events (PRD 2410), as the webhook sends them and the `main-watch` function
// (./main-watch.ts) parses them:
//
//   MAIN_WATCH_EVENT     a pull request merged into the repository's default branch, beside the retro's
//                        and the harvest's events: the function decides whether it is a feature PR
//   MAIN_WATCH_CI_EVENT  a check suite on the default branch completed red: it wakes the watch of the
//                        commit it ran on, so a red merge commit reads broke as soon as the App hears
//                        of it, not at the next daily tick
//
// The webhook reads no database, so it cannot tell a watched commit from any other: it sends the CI
// event for every red suite of the default branch, and a watch waits only for its own merge commit's.
// Each event carries an id, so a delivery GitHub sends twice is one event.
import { z } from 'zod';
import { PrNumberSchema, type PrNumber } from 'omni-loop/kit/lib/ids.ts';

/** The event `/api/github` sends for a pull request merged into the default branch. */
export const MAIN_WATCH_EVENT = 'omni-loop/main-watch.requested';

/** The event `/api/github` sends for a check suite of the default branch that completed red. */
export const MAIN_WATCH_CI_EVENT = 'omni-loop/main-watch.ci-red';

const slug = z.string().regex(/^[^/\s]+\/[^/\s]+$/, 'owner/name');

/** A merged pull request, as the watch reads it: where, which, and its merge. */
export const MainWatchDataSchema = z.looseObject({
  installationId: z.number(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  repository: slug,
  prNumber: PrNumberSchema,
  mergeSha: z.string().min(1),
  mergedAt: z.string().nullish(),
});
export type MainWatchData = z.infer<typeof MainWatchDataSchema>;

/** A red check suite of the default branch: where, and the commit it ran on. */
const MainWatchCiDataSchema = z.looseObject({
  installationId: z.number(),
  repository: slug,
  sha: z.string().min(1),
});
export type MainWatchCiData = z.infer<typeof MainWatchCiDataSchema>;

/** One main watch event, as the webhook sends it; its `id` makes a redelivery one event. */
export type MainWatchRequest =
  | { name: typeof MAIN_WATCH_EVENT; id: string; data: MainWatchData }
  | { name: typeof MAIN_WATCH_CI_EVENT; id: string; data: MainWatchCiData };

/** The merge event's id: one per repository, pull request and merge commit. */
export function mainWatchId({ repository, prNumber, mergeSha }: { repository: string; prNumber: PrNumber; mergeSha: string }): string {
  return `main-watch:${repository.toLowerCase()}#${String(prNumber)}:${mergeSha}`;
}

/** The CI event's id: one per repository and check suite. */
export function mainWatchCiId({ repository, suite }: { repository: string; suite: number }): string {
  return `main-watch-ci:${repository.toLowerCase()}:${String(suite)}`;
}
