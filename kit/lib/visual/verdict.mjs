/**
 * **A visual fix can be proven** (PRD #541, slice s1).
 *
 * What `omni visual <n>` grades on a fix branch, as one function a test can hold open. A visual fix
 * has no PRD, spec or plan: its whole record is one folder `<paths.delivery>/visual/<nnnn>-<slug>/`
 * holding `before-after.html`, where `<nnnn>` is the issue number zero-padded to four digits, and
 * (PRD #627) each round of variations the person picked from, as `variations-r<k>.html`, k from 1.
 * The checks, each failing with one line a person can act on:
 *
 * 1. Exactly one such folder exists for the issue.
 * 2. It holds `before-after.html`.
 * 3. The page and every round page are at most `limits.beforeAfterMaxBytes` bytes each — the very
 *    check `omni check inbox` applies to a PRD's page ({@link beforeAfterViolation}).
 * 4. None of them holds a raster image inlined as a `data:image/` URL; an SVG one is allowed.
 * 5. A file named like a round but not `variations-r<k>.html` fails, and so does any other file or
 *    folder: the page, then the rounds in round order, then the rest, by name.
 * 6. Every commit of the branch carries the trailer `omni sign trailer` prints, unless the config
 *    says `signature: null`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAfterViolation } from '../inbox/check-inbox.mjs';
import { fixVerdict } from '../fix-verdict.mjs';

const PAGE = 'before-after.html';

/** A round of variations: `variations-r<k>.html`, k from 1 with no leading zero — as the dossier reads it. */
const ROUND = /^variations-r([1-9]\d*)\.html$/;
/** A name that means to be a round, well formed or not. */
const ROUND_LIKE = /^variations/i;

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

/** The rounds, misnamed rounds and other entries of a fix's folder, beside its page. */
function folderViolations(ctx, folder) {
  const rounds = [];
  const misnamed = [];
  const others = [];
  for (const entry of readdirSync(join(ctx.root, folder), { withFileTypes: true })) {
    const { name } = entry;
    const round = entry.isFile() ? ROUND.exec(name) : null;
    if (round) rounds.push({ name, k: Number(round[1]) });
    else if (name === PAGE && entry.isFile()) continue;
    else if (entry.isFile() && ROUND_LIKE.test(name)) misnamed.push(name);
    else others.push(name);
  }
  const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [
    ...rounds.sort((a, b) => a.k - b.k).flatMap(({ name }) => pageViolations(ctx, `${folder}/${name}`)),
    ...misnamed.sort(byName).map((name) => `${folder}/${name}: a round of variations is named variations-r<k>.html, k from 1.`),
    ...others.sort(byName).map((name) => `${folder}/${name}: not part of a visual fix; the folder holds ${PAGE} and variations-r<k>.html only.`),
  ];
}

/**
 * Grades one issue's visual fix on the working tree, and the branch's commits when given.
 *
 * @param {{ ctx: object, issue: number, commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function visualVerdict({ ctx, issue, commits }) {
  return fixVerdict({
    ctx, issue, commits, root: visualRoot(ctx), prefix: folderPrefix(issue), folders: issueFolders(ctx, issue),
    grade: (folder) => [...pageViolations(ctx, `${folder}/${PAGE}`), ...folderViolations(ctx, folder)],
  });
}
