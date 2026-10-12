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
 *    folder but `outbox/` (PRD 1342): the page, then the rounds in round order, then the rest, by name.
 * 5b. A range that changes a law has an item ranked high for it in `outbox/`, and an account naming
 *    it: the lines `laws` gives for the folder.
 * 6. Every commit of the branch carries the trailer `omni sign trailer` prints, unless the config
 *    says `signature: null`.
 */
import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
import { beforeAfterViolation } from '../inbox/check-inbox.ts';
import { fixVerdict, issuePrefix, numberedFolders, rasterFaults } from '../fix-verdict.ts';
import type { Commit } from '../fix-verdict.ts';
import type { TrailerSignature } from '../signature.ts';
import type { IssueNumber } from '../ids.ts';

/** What a visual verdict reads of the context: the root, the delivery path, the page cap and the signature. */
type VisualContext = {
  root: string;
  config: { paths: { delivery: string }; limits: { beforeAfterMaxBytes: number }; signature: TrailerSignature | null };
};

const PAGE = 'before-after.html';

/** The folder a change to a law is answered in (PRD 1342), as a bug fix's is. */
const OUTBOX = 'outbox';

/** A round of variations: `variations-r<k>.html`, k from 1 with no leading zero — as the dossier reads it. */
const ROUND = /^variations-r([1-9]\d*)\.html$/;
/** A name that means to be a round, well formed or not. */
const ROUND_LIKE = /^variations/i;

/** Where every visual fix's folder lives. */
export function visualRoot(ctx: { config: { paths: { delivery: string } } }): string {
  return `${ctx.config.paths.delivery}/visual`;
}

function pageViolations(ctx: VisualContext, page: string): string[] {
  if (!existsSync(join(ctx.root, page))) return [`${page}: missing.`];
  const violations: string[] = [];
  const size = beforeAfterViolation(page, ctx);
  if (size) violations.push(size);
  violations.push(...rasterFaults(page, readFileSync(join(ctx.root, page), 'utf8')));
  return violations;
}

/** The page itself, or the outbox folder a change to a law is answered in. */
function belongs(entry: Dirent): boolean {
  return entry.isFile() ? entry.name === PAGE : entry.isDirectory() && entry.name === OUTBOX;
}

/** The rounds, misnamed rounds and other entries of a fix's folder, beside its page. */
function folderViolations(ctx: VisualContext, folder: string): string[] {
  const rounds: { name: string; k: number }[] = [];
  const misnamed: string[] = [];
  const others: string[] = [];
  for (const entry of readdirSync(join(ctx.root, folder), { withFileTypes: true })) {
    const { name } = entry;
    const round = entry.isFile() ? ROUND.exec(name) : null;
    if (round) rounds.push({ name, k: Number(round[1]) });
    else if (belongs(entry)) continue;
    else if (entry.isFile() && ROUND_LIKE.test(name)) misnamed.push(name);
    else others.push(name);
  }
  const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return [
    ...rounds.sort((a, b) => a.k - b.k).flatMap(({ name }) => pageViolations(ctx, `${folder}/${name}`)),
    ...misnamed.sort(byName).map((name) => `${folder}/${name}: a round of variations is named variations-r<k>.html, k from 1.`),
    ...others.sort(byName).map((name) => `${folder}/${name}: not part of a visual fix; the folder holds ${PAGE} and variations-r<k>.html only.`),
  ];
}

/**
 * Grades one issue's visual fix on the working tree, and the branch's commits when given.
 */
export function visualVerdict({ ctx, issue, commits, laws }: {
  ctx: VisualContext;
  issue: IssueNumber;
  commits?: readonly Commit[] | undefined;
  /** The changes to a law the range has not answered in the folder (PRD 1342), one line each. */
  laws?: ((folder: string) => string[]) | undefined;
}): { ok: boolean; folder: string | null; failures: string[] } {
  return fixVerdict({
    ctx, number: issue, commits, root: visualRoot(ctx), prefix: issuePrefix(issue), folders: numberedFolders(ctx, visualRoot(ctx), issuePrefix(issue)),
    grade: (folder) => [...pageViolations(ctx, `${folder}/${PAGE}`), ...folderViolations(ctx, folder), ...(laws?.(folder) ?? [])],
  });
}
