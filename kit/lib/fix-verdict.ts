// @ts-nocheck
/**
 * What `omni visual <n>`, `omni bug <n>` and `omni concept <n>` grade alike (PRD #627, PRD 686): a
 * record's one folder for its number, whatever that folder must hold, no page with a raster image
 * inlined, and a signature on every commit of the branch.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { carriesTrailer, trailerLine } from './signature.ts';

/** A `data:image/` URL whose type is anything but SVG. */
const RASTER_DATA_URL = /data:image\/(?!svg\+xml)[a-z0-9.+-]+/i;

/** Every folder under `root` named `prefix` then a slug, sorted, as repository paths. */
export function numberedFolders(ctx, root, prefix) {
  const absolute = join(ctx.root, root);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.length > prefix.length)
    .map((entry) => `${root}/${entry.name}`)
    .sort();
}

/** The line naming a base64 raster image inlined in `page`, whose text is `html`, or none. */
export function rasterFaults(page, html) {
  return RASTER_DATA_URL.test(html)
    ? [`${page}: holds a base64 raster image (a data:image/ URL that is not SVG); draw it in SVG or CSS.`]
    : [];
}

function signatureViolations(ctx, commits) {
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
 *
 * @param {{ ctx: object, issue: number, root: string, prefix: string, folders: string[],
 *   grade: (folder: string) => string[], commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function fixVerdict({ ctx, issue, root, prefix, folders, grade, commits }) {
  const failures = [];
  let folder = null;
  if (folders.length === 0) {
    failures.push(`no folder ${root}/${prefix}<slug>/ for issue ${issue}.`);
  } else if (folders.length > 1) {
    failures.push(`${folders.length} folders for issue ${issue}, one expected: ${folders.join(', ')}.`);
  } else {
    [folder] = folders;
    failures.push(...grade(folder));
  }
  failures.push(...signatureViolations(ctx, commits));
  return { ok: failures.length === 0, folder, failures };
}
