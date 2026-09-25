// `omni phase0 <prd> [--base <ref>]` — grades a candidate phase-0 pull request's own diff against
// `phase0Verdict` (`kit/lib/policy/phase-0.mjs`): docs-only, and carrying the spec, the plan and the
// before/after this one PRD is being asked to approve. `--base` defaults to
// `<repo.remote>/<repo.defaultBranch>`, exactly as `omni check coverage` reads its own default and
// checks it the same way (`git rev-parse --verify`) — a bad ref is a usage error, not a silent
// empty diff.
import { phase0Verdict } from '../../lib/policy/phase-0.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni phase0 <prd> [--base <ref>]';

function defaultBase(ctx) {
  return `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
}

function git(args, cwd, exec) {
  return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function refExists(ctx, ref, exec) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], ctx.root, exec);
    return true;
  } catch {
    return false;
  }
}

/** The range's changed paths, `git diff --name-only --no-renames <base>...HEAD` — paths only; this
 * command never needs a change's status, unlike `rangeChanges` (`kit/lib/git.mjs`), which the
 * decision-coverage and comment guards read `--name-status` through instead. */
function changedPaths(ctx, base, exec) {
  return git(['diff', '--name-only', '--no-renames', `${base}...HEAD`], ctx.root, exec)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function carriesLine(label, files) {
  return `  ${label}: ${files.length > 0 ? files.map((file) => `\`${file}\``).join(', ') : '(none)'}`;
}

function printVerdict(stdout, prd, base, verdict) {
  println(stdout, `omni phase0 — PRD ${prd}, range ${base}...HEAD:`);
  println(stdout, `${verdict.ok ? 'ok' : 'not ok'} — ${verdict.reason}`);
  println(stdout, `docs-only: ${verdict.docsOnly ? 'yes' : 'no'}`);
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
}

export const phase0 = {
  async run(args, { ctx, stdout, exec }) {
    const { positional, flags } = parseArgs('phase0', args, { values: ['base'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const prd = positiveInt('phase0', '<prd>', positional[0]);
    const base = flags.base ?? defaultBase(ctx);

    if (!refExists(ctx, base, exec)) {
      const how = flags.base !== undefined ? 'pass another --base <ref>' : 'fetch it, or pass --base <ref>';
      throw usageError(`omni phase0: no ${base} — ${how}.`);
    }

    const paths = changedPaths(ctx, base, exec);
    const verdict = phase0Verdict(paths, { ctx, prd });
    printVerdict(stdout, prd, base, verdict);
    return verdict.ok ? 0 : 1;
  },
};
