// The links of what a session is on (PRD 1208's spec, "Links", slice s4): a file the background
// refresh keeps, so that `omni now` and everything drawn from it never waits on GitHub or the Omni
// page, as PRD 324's board does (`../statusline/board-cache.ts`, whose lock and timings it shares).
//
// - The file is `.omni-loop/local/now/links-<kind>-<n>.json` in the repository's main checkout,
//   holding `{ "at": "<iso time>", "links": [{ "label", "href" }] }`, or
//   `{ "at": "<iso time>", "error": "<one line>" }` after a refresh that failed. `<kind>` is `prd`,
//   `bug`, `visual` or `roadmap`.
// - **Shown** while its `at` is under 10 minutes old (a time after now counts as old); a missing file,
//   one that does not read, an error entry or an older file shows no links. A link whose label or
//   address is not text is left out.
// - **Refreshed** under the lock `links-<kind>-<n>.lock`, with the board's rules: one 2 minutes old
//   or more is taken over, a younger one means another refresh runs, and this one writes nothing. The
//   links are built (each one that cannot be had is left out by the builder), written to a temporary
//   name and renamed into place, and the lock removed. A build that throws is written as the error
//   entry.
// - **Written as is** by `omni roadmap push <n>`, which keeps the roadmap page it printed.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { releaseLockAt, SHOWN_UNDER_MS, takeLockAt, writeJsonAt } from '../statusline/board-cache.ts';
import type { NowLink } from './now.ts';

/** The kinds of work a links file is kept for. */
export type LinksKind = 'prd' | 'bug' | 'visual' | 'roadmap';

const LINKS_DIR = join(LOCAL_DIR, 'now');

const linksFile = (root: string, kind: LinksKind, n: number): string => join(root, LINKS_DIR, `links-${kind}-${n}.json`);
const linksLock = (root: string, kind: LinksKind, n: number): string => join(root, LINKS_DIR, `links-${kind}-${n}.lock`);

const LinkSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });
const LinksFileSchema = z.object({
  at: z.string(),
  links: z.array(z.unknown()).optional(),
  error: z.string().optional(),
});

/** The links kept for the `kind` work numbered `n` in the main checkout at `root`, as of `now`: none
 * when the file is missing, holds an error, does not read or is 10 minutes old or more. Never throws. */
export function readLinks(root: string, kind: LinksKind, n: number, now: number): NowLink[] {
  try {
    const parsed = LinksFileSchema.safeParse(JSON.parse(readFileSync(linksFile(root, kind, n), 'utf8')));
    if (!parsed.success || parsed.data.error !== undefined || !parsed.data.links) return [];
    const age = now - Date.parse(parsed.data.at);
    if (!(age >= 0 && age < SHOWN_UNDER_MS)) return [];
    return parsed.data.links.flatMap((link) => {
      const read = LinkSchema.safeParse(link);
      return read.success ? [read.data] : [];
    });
  } catch {
    return [];
  }
}

/** The folder of the links files, and the local folder's `.gitignore`, written once. */
function ensureLinksDir(root: string): void {
  ensureLocalDir(root);
  mkdirSync(join(root, LINKS_DIR), { recursive: true });
}

/** Keeps `links` as the `kind` work numbered `n`'s, written at `now`, in the main checkout at `root`. */
export function writeLinks(root: string, kind: LinksKind, n: number, links: readonly NowLink[], now: number): void {
  ensureLinksDir(root);
  writeJsonAt(linksFile(root, kind, n), { at: new Date(now).toISOString(), links });
}

/** The first line of what `error` says. */
function oneLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return (message.split('\n')[0] ?? '').trim() || 'the links could not be read';
}

/**
 * The refresh of the `kind` work numbered `n`'s links in the main checkout at `root`: takes the lock
 * (`'held'`, and nothing written, while another refresh holds it), writes what `build()` resolves to,
 * or what it throws as the error entry, then removes the lock (`'written'`).
 */
export async function refreshLinks({ root, kind, n, now, build }: { root: string; kind: LinksKind; n: number; now: number; build: () => Promise<NowLink[]> }): Promise<'written' | 'held'> {
  ensureLinksDir(root);
  const lock = linksLock(root, kind, n);
  const owner = takeLockAt(lock, now);
  if (owner === null) return 'held';
  try {
    let entry: { at: string; links: NowLink[] } | { at: string; error: string };
    const at = new Date(now).toISOString();
    try {
      entry = { at, links: await build() };
    } catch (error) {
      entry = { at, error: oneLine(error) };
    }
    writeJsonAt(linksFile(root, kind, n), entry);
  } finally {
    releaseLockAt(lock, owner);
  }
  return 'written';
}
