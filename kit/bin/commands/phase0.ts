// `omni phase0 <prd> [--base <ref>]` — grades a candidate phase-0 pull request's own diff against
// `phase0Verdict` (`kit/lib/policy/phase-0.ts`): docs-only, and carrying the spec, the plan and the
// before/after this one PRD is being asked to approve. `--base` defaults to
// `<repo.remote>/<repo.defaultBranch>`, exactly as `omni check coverage` reads its own default and
// checks it the same way (`git rev-parse --verify`) — a bad ref is a usage error, not a silent
// empty diff. Every commit of the range must also carry the trailer `omni sign trailer` prints
// (PRD #99), unless the config says `signature: null`.
import { phase0Verdict } from '../../lib/policy/phase-0.ts';
import type { Phase0Verdict } from '../../lib/policy/phase-0.ts';
import type { ExecText } from '../../lib/context.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import { rangeBase, rangeCommits } from '../branch-range.ts';
import type { Command, CommandIo, Out } from '../io.ts';
import { synchronous } from '../synchronous.ts';
import type { PrdNumber } from '../../lib/ids.ts';

const USAGE = 'usage: omni phase0 <prd> [--base <ref>]';

function git(args: string[], cwd: string, exec: ExecText): string {
  return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The range's changed paths, `git diff --name-only --no-renames <base>...HEAD` — paths only; this
 * command never needs a change's status, unlike `rangeChanges` (`kit/lib/git.ts`), which the
 * decision-coverage and comment guards read `--name-status` through instead. */
function changedPaths(ctx: { root: string }, base: string, exec: ExecText): string[] {
  return git(['diff', '--name-only', '--no-renames', `${base}...HEAD`], ctx.root, exec)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function signedLine(signed: boolean | null): string {
  if (signed === null) return 'signed: off (signature: null)';
  return `signed: ${signed ? 'yes' : 'no'}`;
}

function carriesLine(label: string, files: readonly string[]): string {
  return `  ${label}: ${files.length > 0 ? files.map((file) => `\`${file}\``).join(', ') : '(none)'}`;
}

function printVerdict(stdout: Out, prd: PrdNumber, base: string, verdict: Phase0Verdict): void {
  println(stdout, `omni phase0 — PRD ${prd}, range ${base}...HEAD:`);
  println(stdout, `${verdict.ok ? 'ok' : 'not ok'} — ${verdict.reason}`);
  println(stdout, `docs-only: ${verdict.docsOnly ? 'yes' : 'no'}`);
  println(stdout, signedLine(verdict.signed));
  println(stdout, 'carries:');
  println(stdout, carriesLine('spec', verdict.carries.spec));
  println(stdout, carriesLine('plan', verdict.carries.plan));
  println(stdout, carriesLine('before-after', verdict.carries['before-after']));
  println(stdout, carriesLine('pending-acceptance', verdict.carries['pending-acceptance']));
  println(stdout, carriesLine('docs', verdict.carries.docs));
  if (verdict.missing.length > 0) {
    println(stdout, `missing: ${verdict.missing.join(', ')}`);
  }
  if (verdict.sourceFiles.length > 0) {
    println(stdout, `source file(s) — not allowed in a phase-0 pull request:`);
    for (const file of verdict.sourceFiles) println(stdout, `  - ${file}`);
  }
  if (verdict.unsigned.length > 0) {
    println(stdout, `unsigned commit(s) — each needs the line "${verdict.trailer}":`);
    for (const commit of verdict.unsigned) println(stdout, `  - ${commit.sha} ${commit.subject}`);
  }
}

export const phase0: Command = {
  run: synchronous((args: string[], { ctx, stdout, exec }: CommandIo): number => {
    const { positional, flags } = parseArgs('phase0', args, { values: ['base'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = prdArg('phase0', '<prd>', positional[0]);
    const base = rangeBase('phase0', ctx, flags, exec);

    const paths = changedPaths(ctx, base, exec);
    const commits = ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec);
    const verdict = phase0Verdict(paths, { ctx, prd, commits });
    printVerdict(stdout, prd, base, verdict);
    return verdict.ok ? 0 : 1;
  }),
};
