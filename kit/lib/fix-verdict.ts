/**
 * What `omni visual <n>`, `omni bug <n>` and `omni concept <n>` grade alike (PRD #627, PRD 686): a
 * record's one folder for its number, whatever that folder must hold, no page with a raster image
 * inlined, and a signature on every commit of the branch.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { carriesTrailer, trailerLine } from './signature.ts';
import type { TrailerSignature } from './signature.ts';

/** One commit of the branch being graded. */
export type Commit = { sha: string; message: string };

/** What a fix verdict reads of the context: the repository's root and its signature. */
type VerdictContext = { root: string; config: { signature: TrailerSignature | null } };

/** A `data:image/` URL whose type is anything but SVG. */
const RASTER_DATA_URL = /data:image\/(?!svg\+xml)[a-z0-9.+-]+/i;

/** The folder name prefix of an issue's fix: its number, zero-padded to four digits, then `-`. */
export function issuePrefix(issue: number | string): string {
  return `${String(issue).padStart(4, '0')}-`;
}

/** Every folder under `root` named `prefix` then a slug, sorted, as repository paths. */
export function numberedFolders(ctx: { root: string }, root: string, prefix: string): string[] {
  const absolute = join(ctx.root, root);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.length > prefix.length)
    .map((entry) => `${root}/${entry.name}`)
    .sort();
}

/** The line naming a base64 raster image inlined in `page`, whose text is `html`, or none. */
export function rasterFaults(page: string, html: string): string[] {
  return RASTER_DATA_URL.test(html)
    ? [`${page}: holds a base64 raster image (a data:image/ URL that is not SVG); draw it in SVG or CSS.`]
    : [];
}

function signatureViolations(ctx: VerdictContext, commits: readonly Commit[] | undefined): string[] {
  const { signature } = ctx.config;
  const trailer = trailerLine(signature);
  if (trailer === null || commits === undefined) return [];
  return commits
    .filter((commit) => !carriesTrailer(commit.message, signature))
    .map((commit) => `unsigned: ${commit.sha} ${commit.message.split('\n')[0]} has no "${trailer}" line.`);
}

/**
 * Grades one issue's fix: exactly one of `folders` (`<root>/<prefix><slug>`), graded by `grade(folder)`,
 * then the commits' signatures.
 */
export function fixVerdict({
  ctx,
  issue,
  root,
  prefix,
  folders,
  grade,
  commits,
}: {
  ctx: VerdictContext;
  issue: number;
  root: string;
  prefix: string;
  folders: readonly string[];
  grade: (folder: string) => string[];
  commits?: readonly Commit[] | undefined;
}): { ok: boolean; folder: string | null; failures: string[] } {
  const failures: string[] = [];
  let folder: string | null = null;
  const [only] = folders;
  if (only === undefined) {
    failures.push(`no folder ${root}/${prefix}<slug>/ for issue ${issue}.`);
  } else if (folders.length > 1) {
    failures.push(`${folders.length} folders for issue ${issue}, one expected: ${folders.join(', ')}.`);
  } else {
    folder = only;
    failures.push(...grade(only));
  }
  failures.push(...signatureViolations(ctx, commits));
  return { ok: failures.length === 0, folder, failures };
}
