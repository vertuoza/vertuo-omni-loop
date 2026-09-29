// Fleets moved under Settings (PRD 572): the fleets page lives at /app/settings/fleets, and the old
// /app/fleets redirects there permanently, the query kept (app/app/fleets/route.ts).

/** Where the fleets page lives. */
export const FLEETS_PATH = '/app/settings/fleets';

/** Where it lived until PRD 572, now a permanent redirect to FLEETS_PATH. */
export const OLD_FLEETS_PATH = '/app/fleets';

/** Where a request for the old path goes: the same origin and query at the new path; the hash never
 * reaches the server, so none is kept. */
export function fleetsMovedTo(url: URL): URL {
  const to = new URL(FLEETS_PATH, url);
  to.search = url.search;
  return to;
}
