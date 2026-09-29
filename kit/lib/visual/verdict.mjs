/**
 * **A visual fix can be proven** (PRD #541, slice s1).
 *
 * What `omni visual <n>` grades on a fix branch, as one function a test can hold open. A visual fix
 * has no PRD, spec or plan: its whole record is one folder `<paths.delivery>/visual/<nnnn>-<slug>/`
 * holding `before-after.html`, where `<nnnn>` is the issue number zero-padded to four digits. The
 * checks, each failing with one line a person can act on:
 *
 * 1. Exactly one such folder exists for the issue.
 * 2. It holds `before-after.html`.
 * 3. The page is at most `limits.beforeAfterMaxBytes` bytes — the very check `omni check inbox`
 *    applies to a PRD's page ({@link beforeAfterViolation}).
 * 4. The page holds no raster image inlined as a `data:image/` URL; an SVG one is allowed.
 * 5. Every commit of the branch carries the trailer `omni sign trailer` prints, unless the config
 *    says `signature: null`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAfterViolation } from '../inbox/check-inbox.mjs';
import { carriesTrailer, trailerLine } from '../signature.mjs';

const PAGE = 'before-after.html';

/** A `data:image/` URL whose type is anything but SVG. */
const RASTER_DATA_URL = /data:image\/(?!svg\+xml)[a-z0-9.+-]+/i;

/** Where every visual fix's folder lives. */
export function visualRoot(ctx) {
  return `${ctx.config.paths.delivery}/visual`;
}

/** The folder name prefix of an issue's visual fix: its number, zero-padded to four digits, then `-`. */
export function folderPrefix(issue) {
  return `${String(issue).padStart(4, '0')}-`;
}

/** Every folder under the visual root named for `issue`, sorted, as repository paths. */
function issueFolders(ctx, issue) {
  const root = visualRoot(ctx);
  const absolute = join(ctx.root, root);
  if (!existsSync(absolute)) return [];
  const prefix = folderPrefix(issue);
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && entry.name.length > prefix.length)
    .map((entry) => `${root}/${entry.name}`)
    .sort();
}

function pageViolations(ctx, page) {
  if (!existsSync(join(ctx.root, page))) return [`${page}: missing.`];
  const violations = [];
  const size = beforeAfterViolation(page, ctx);
  if (size) violations.push(size);
  if (RASTER_DATA_URL.test(readFileSync(join(ctx.root, page), 'utf8'))) {
    violations.push(`${page}: holds a base64 raster image (a data:image/ URL that is not SVG); draw it in SVG or CSS.`);
  }
  return violations;
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
 * Grades one issue's visual fix on the working tree, and the branch's commits when given.
 *
 * @param {{ ctx: object, issue: number, commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function visualVerdict({ ctx, issue, commits }) {
  const failures = [];
  const folders = issueFolders(ctx, issue);
  let folder = null;
  if (folders.length === 0) {
    failures.push(`no folder ${visualRoot(ctx)}/${folderPrefix(issue)}<slug>/ for issue ${issue}.`);
  } else if (folders.length > 1) {
    failures.push(`${folders.length} folders for issue ${issue}, one expected: ${folders.join(', ')}.`);
  } else {
    [folder] = folders;
    failures.push(...pageViolations(ctx, `${folder}/${PAGE}`));
  }
  failures.push(...signatureViolations(ctx, commits));
  return { ok: failures.length === 0, folder, failures };
}
