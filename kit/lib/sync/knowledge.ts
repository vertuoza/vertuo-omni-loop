// The knowledge check's facts (PRD 1990, spec section 5): the playbook's stale evidence, a plan
// repository's target copies, and the knowledge files changed here.
//
// - Stale evidence: the entries `omni kb status` reports as stale (their evidence file changed or is
//   gone), counted over every form, read from the checkout the command runs in.
// - The target copies, in a plan repository only: what `omni targets` reports per target, read
//   through `gh api`. A plan repository whose targets are a product's (`plan.product`) is not read
//   here: its list lives on the Omni page, and this check never calls the page, so that part does not
//   run (`null`).
// - The knowledge folder: tracked files changed under `paths.knowledge`. A linked worktree (one a
//   skill cut) owns what it writes there, so it is not judged, as the main check does not judge it.
//
// Nothing here throws: what `git` or `gh` would not say is a fact `{ notChecked: <why> }`.
import type { ExecFileSyncOptions, ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { resolve } from 'node:path';
import type { Context, ExecRaw, ExecText } from '../context.ts';
import { createContext } from '../context.ts';
import { playbookStatus } from '../playbook/status.ts';
import { readTargets } from '../plan-repo/targets.ts';
import type { Target, TargetRow } from '../plan-repo/targets.ts';
import type { Config } from '../types.ts';
import type { Fact, GatherIo, KnowledgeFacts, TargetCopyFact } from './facts.ts';

/** How long one `gh` call of the target read may take. */
const GH_BUDGET_MS = 10_000;

/** Reads the targets' rows: `omni targets`'s own reader, or a fake in a test. */
export type ReadTargets = (targets: readonly Target[], io: { ctx: Context; exec: ExecRaw }) => TargetRow[];

const QUIET: Pick<ExecFileSyncOptionsWithStringEncoding, 'encoding' | 'stdio'> = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };

/** The lines `git <args>` prints in `cwd`, or `null` when it fails. */
function gitLines(exec: ExecText, cwd: string, args: readonly string[]): string[] | null {
  try {
    return exec('git', args, { cwd, ...QUIET }).split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/** `exec` as `omni targets`'s reader runs it: every call returns text, and none may take longer than the budget. */
function budgeted(exec: ExecText): ExecRaw {
  return (file: string, args: readonly string[], options: ExecFileSyncOptions) => exec(file, args, { ...options, encoding: 'utf8', timeout: options.timeout ?? GH_BUDGET_MS });
}

/** The count of stale evidence entries over every form of the playbook. */
function staleOf(ctx: Context, exec: ExecText): Fact<number> {
  try {
    return playbookStatus({ ctx, exec }).forms.reduce((sum, form) => sum + form.stale.length, 0);
  } catch {
    return { notChecked: 'the playbook did not read' };
  }
}

/** Each target's copy state, or why they were not read; `null` where this part does not run. */
function targetsOf(ctx: Context, exec: ExecText, read: ReadTargets): Fact<readonly TargetCopyFact[]> | null {
  const plan = ctx.config.plan;
  if (!plan || plan.product !== undefined) return null;
  try {
    return read(plan.targets, { ctx, exec: budgeted(exec) }).map(({ repo, state }) => ({ repo, state }));
  } catch {
    return { notChecked: 'no gh' };
  }
}

/** How many tracked files under `paths.knowledge` are changed; none in a linked worktree. */
function changedOf(root: string, config: Config, exec: ExecText): Fact<number> {
  const [gitDir, commonDir] = gitLines(exec, root, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']) ?? [];
  if (gitDir !== undefined && commonDir !== undefined && resolve(gitDir) !== resolve(commonDir)) return 0;
  const changed = gitLines(exec, root, ['status', '--porcelain', '--untracked-files=no', '--', config.paths.knowledge]);
  return changed === null ? { notChecked: 'git status failed' } : changed.length;
}

/** The knowledge check's facts for the checkout at `io.cwd`; `read` reads the targets. */
export function gatherKnowledge(io: GatherIo, read: ReadTargets = readTargets): Promise<KnowledgeFacts> {
  const root = gitLines(io.exec, io.cwd, ['rev-parse', '--show-toplevel'])?.[0];
  if (root === undefined) return Promise.resolve({ notChecked: 'not a git checkout' });
  const ctx = createContext(root, io.config);
  return Promise.resolve({
    staleEvidence: staleOf(ctx, io.exec),
    targets: targetsOf(ctx, io.exec, read),
    changed: changedOf(root, io.config, io.exec),
  });
}

export const knowledgeFacts = (io: GatherIo): Promise<KnowledgeFacts> => gatherKnowledge(io);
