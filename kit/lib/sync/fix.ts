// `omni sync --fix` (PRD 1990, spec section 7): the safe fixes, in this order, each only when its
// finding is open and its precondition holds. Each prints a `✓` line for what it did, or a `·` line
// saying why it left it; the command then runs the checks again and prints the new status.
//
// 1. Switch to the default branch: only in the main checkout, only with no tracked file changed,
//    and only when the branch has no commit its upstream (or, with none, any remote) lacks.
// 2. Fast-forward the default branch: only on it, only with no tracked file changed, with
//    `git pull --ff-only`. A default branch with commits of its own is printed as diverged and
//    left untouched. It runs whenever the branch is behind, red or not: one pull a morning is the
//    rhythm the main check asks for, and the spec's own example fast-forwards a green `main`.
// 3. Update the plugins, 4. update the repository's kit (never in the kit's own repository), and
//    5. refresh the page's copy: each when the run's record holds its open finding, through an
//    action the command hands in (`omni update`'s plugin step, `omni update`, `omni constituents`).
//
// It never merges, rebases, resets or pushes, never runs `omni signin` or an invade, and never
// touches a target repository: the steps on `git` are a switch and a fast-forward, nothing else.
import type { ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import type { ExecText } from '../context.ts';
import { propertyOf } from '../narrow.ts';
import type { Config } from '../types.ts';
import { isUnchecked } from './facts.ts';
import type { MainFacts, Unchecked } from './facts.ts';
import { mainFacts } from './main.ts';
import type { SyncRecord } from './schema.ts';

/** The fix the record's findings name when `omni sync --fix` makes it. */
const SYNC_FIX = 'omni sync --fix';
/** How long the fast-forward may take: its fetch, then the merge. */
const PULL_BUDGET_MS = 30_000;

/** The steps `--fix` runs through another command, in the order it runs them. */
const STEPS = ['plugins', 'kit', 'page'] as const;
export type FixStep = (typeof STEPS)[number];

/** What an action did: whether it went through, and the lines it printed. */
export type FixOutcome = { readonly done: boolean; readonly lines: readonly string[] };

/** The three steps that run another command, handed in by the command (a test hands in fakes). */
export type FixActions = Readonly<Record<FixStep, () => FixOutcome>>;

/** The kit check's finding that names the repository's kit, as `syncStatus` words it. */
const REPO_KIT = /^repo kit v/;

/** The step `--fix` runs for an open finding of `check` named `text`, or `null` for one of `main`'s or none. */
function stepOf(check: SyncRecord['findings'][number]['check'], text: string): FixStep | null {
  if (check === 'kit') return REPO_KIT.test(text) ? 'kit' : 'plugins';
  return check === 'page' ? 'page' : null;
}

/** The steps of `STEPS` whose finding `record` holds open with `omni sync --fix` for its fix, in order. */
export function openFixes(record: SyncRecord): FixStep[] {
  const open = new Set(record.findings.filter(({ severity, fix }) => severity !== 'green' && fix === SYNC_FIX).map(({ check, text }) => stepOf(check, text)));
  return STEPS.filter((step) => open.has(step));
}

/** What each step prints: when it went through, and when it did not (its lines follow, indented). */
const WORDS: Record<FixStep, { done: string; left: string }> = {
  plugins: { done: '✓ updated the plugins: a new session loads them', left: '· the plugins not updated:' },
  kit: { done: '✓ ran omni update', left: '· the kit not updated:' },
  page: { done: "✓ refreshed the page's copy", left: "· the page's copy not refreshed:" },
};
const KIT_REPO = "· the kit not updated: this is the kit's own repository, where it is built, not installed";

/** Steps 3 to 5: each open one through its action, the kit never in the kit's own repository (`kitRepo`). */
export function fixOthers({ record, kitRepo, actions }: { record: SyncRecord; kitRepo: boolean; actions: FixActions }): string[] {
  return openFixes(record).flatMap((step) => {
    if (step === 'kit' && kitRepo) return [KIT_REPO];
    const { done, lines } = actions[step]();
    return [done ? WORDS[step].done : WORDS[step].left, ...lines.map((line) => `    ${line}`)];
  });
}

/** What the steps on `git` are handed. */
type GitIo = { readonly cwd: string; readonly exec: ExecText; readonly remote: string; readonly defaultBranch: string };

const QUIET = (cwd: string, timeout?: number): ExecFileSyncOptionsWithStringEncoding => ({ cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...(timeout ? { timeout } : {}) });

/** `git <args>`: its output, or `null` when it fails. */
function gitOut(io: GitIo, args: readonly string[]): string | null {
  try {
    return io.exec('git', args, QUIET(io.cwd)).trim();
  } catch {
    return null;
  }
}

/** `git <args>`, run to change the checkout: `null` when it went through, else the first line git gave as to why. */
function gitDo(io: GitIo, args: readonly string[], timeout?: number): string | null {
  try {
    io.exec('git', args, QUIET(io.cwd, timeout));
    return null;
  } catch (error) {
    const said = [propertyOf(error, 'stderr'), propertyOf(error, 'stdout')].map((text) => (typeof text === 'string' || text instanceof Buffer ? text.toString() : ''));
    const line = said.join('\n').split('\n').map((text) => text.trim()).find(Boolean);
    if (propertyOf(error, 'code') === 'ETIMEDOUT') return 'timed out';
    return line ?? 'git failed';
  }
}

/** `n` and its noun, singular for one. */
const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The commits of the branch checked out (`null`: a detached `HEAD`) that its upstream lacks, or with no upstream, every remote; `null` when git cannot say. */
function unpushedHere(io: GitIo, branch: string | null): { count: number; where: string } | null {
  const upstream = branch === null ? null : gitOut(io, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${branch}@{upstream}`]);
  const range = upstream ? [`${upstream}..HEAD`] : ['HEAD', '--not', '--remotes'];
  const count = Number.parseInt(gitOut(io, ['rev-list', '--count', ...range]) ?? '', 10);
  return Number.isNaN(count) ? null : { count, where: upstream ?? 'any remote' };
}

/** Why the checkout's changed files hold a step, or `null` when there are none. */
function changedHold({ changed }: MainFacts): string | null {
  if (isUnchecked(changed)) return `the changed files: not checked (${changed.notChecked})`;
  return changed > 0 ? counted(changed, 'changed file', 'changed files') : null;
}

/** Step 1: switch to the default branch, when the main checkout is on another branch with nothing to leave behind. */
function switchStep(io: GitIo, facts: MainFacts): { line: string; switched: boolean } | null {
  const { defaultBranch } = io;
  if (facts.linked || facts.branch === defaultBranch) return null;
  const here = facts.branch ?? 'a detached HEAD';
  const left = (why: string) => ({ line: `· stayed on ${here}: ${why}`, switched: false });
  const changed = changedHold(facts);
  if (changed) return left(changed);
  const unpushed = unpushedHere(io, facts.branch);
  if (unpushed === null) return left('could not tell whether it has commits not pushed');
  if (unpushed.count > 0) return left(`${counted(unpushed.count, 'commit', 'commits')} not on ${unpushed.where}`);
  const failed = gitDo(io, ['switch', '--quiet', defaultBranch]);
  return failed ? left(`git switch failed (${failed})`) : { line: `✓ switched to ${defaultBranch}`, switched: true };
}

/** Step 2: fast-forward the default branch, when it is checked out in the main checkout, behind, clean and not diverged. */
function fastForwardStep(io: GitIo, facts: MainFacts): string | null {
  const { remote, defaultBranch } = io;
  if (facts.linked || facts.branch !== defaultBranch) return null;
  if (isUnchecked(facts.behind)) return `· ${defaultBranch} not fast-forwarded: not checked (${facts.behind.notChecked})`;
  const behind = facts.behind.count;
  if (behind === 0) return null;
  const changed = changedHold(facts);
  if (changed) return `· ${defaultBranch} not fast-forwarded: ${changed}`;
  if (isUnchecked(facts.unpushed)) return `· ${defaultBranch} not fast-forwarded: its own commits not checked (${facts.unpushed.notChecked})`;
  if (facts.unpushed > 0) return `· ${defaultBranch} has diverged from ${remote}: fix it by hand`;
  const failed = gitDo(io, ['pull', '--quiet', '--ff-only', '--no-rebase', remote, defaultBranch], PULL_BUDGET_MS);
  if (failed) return `· ${defaultBranch} not fast-forwarded: git pull failed (${failed})`;
  return `✓ fast-forwarded ${defaultBranch} by ${counted(behind, 'commit', 'commits')}`;
}

/** Steps 1 and 2, on the checkout at `cwd`, unless the main check is off: their lines. */
export function fixMain(io: GitIo & { level: Config['sync']['levels']['main'] }): string[] {
  if (io.level === 'off') return [];
  const facts = mainFacts(io);
  if (isUnchecked(facts)) return [`· ${io.defaultBranch} left: not checked (${(facts satisfies Unchecked).notChecked})`];
  const switched = switchStep(io, facts);
  const after = switched?.switched ? mainFacts(io) : facts;
  const forward = isUnchecked(after) ? null : fastForwardStep(io, after);
  return [switched?.line, forward].filter((line): line is string => line !== undefined && line !== null);
}
