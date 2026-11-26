import type { Viewing } from '../data/viewer';

// The settings layout's reads (omni-loop-29 s1): the member session and the workspace, read through
// the request's one viewer() (React cache(), src/data/viewer.ts) and started, never awaited, so the
// frame and the navigation are sent before any read finishes. A page that asks viewer() (and its
// workspace()) after this gets the same promises: one claims read and one workspace read per request.
// A failed read is left for the page that awaits it to show; here it only stays quiet.

/** Starts the session and workspace reads of this request. Returns at once. */
export function warmSettingsReads(read: () => Promise<Viewing>): void {
  void read()
    .then((seen) => (seen.kind === 'signed-in' ? seen.workspace() : null))
    .catch(() => null);
}
