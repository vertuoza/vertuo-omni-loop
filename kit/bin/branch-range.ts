// What the verbs that grade a branch share (`omni phase0`, `omni visual`, `omni bug`, `omni concept`):
// the base ref, the range's commits and changed paths, read from git in the repository's root, and,
// for the verbs that print a bare verdict, their whole `omni <verb> <n> [--base <ref>]` shell.
import type { Context, ExecText } from '../lib/context.ts';
import type { Commit } from '../lib/fix-verdict.ts';
import { parseArgs, println, usageError } from './args.ts';
import type { Command } from './io.ts';
import { synchronous } from './synchronous.ts';

/** What the range helpers read of the context: the root and the default remote branch. */
type RangeContext = { root: string; config: { repo: { remote: string; defaultBranch: string } } };

function git(args: string[], cwd: string, exec: ExecText): string {
  return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function refExists(root: string, ref: string, exec: ExecText): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root, exec);
    return true;
  } catch {
    return false;
  }
}

/** `--base`, else `<repo.remote>/<repo.defaultBranch>`; a ref that names no commit is a usage error. */
export function rangeBase(verb: string, ctx: RangeContext, flags: { base?: string }, exec: ExecText): string {
  const base = flags.base ?? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;
  if (!refExists(ctx.root, base, exec)) {
    const how = flags.base !== undefined ? 'pass another --base <ref>' : 'fetch it, or pass --base <ref>';
    throw usageError(`omni ${verb}: no ${base} — ${how}.`);
  }
  return base;
}

/** The range's commits, oldest first, as `{ sha, message }`: `git log --reverse <base>..HEAD`, with
 * `sha` in git's short form. */
export function rangeCommits(root: string, base: string, exec: ExecText): Commit[] {
  return git(['log', '--reverse', '--format=%h%x00%B%x1e', `${base}..HEAD`], root, exec)
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.includes('\x00'))
    .map((record) => {
      const [sha, message] = record.split('\x00');
      return { sha: sha ?? '', message: message ?? '' };
    });
}

/** Every path the range's commits touch, as repository paths (`git log --name-only`). */
export function loggedPaths(root: string, base: string, exec: ExecText): string[] {
  return git(['log', '--format=', '--name-only', '--no-renames', `${base}..HEAD`], root, exec)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Every path the branch changed since it left `base`, as repository paths (`git diff base...HEAD`). */
export function branchPaths(root: string, base: string, exec: ExecText): string[] {
  return git(['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', `${base}...HEAD`, '--'], root, exec)
    .split('\0')
    .filter(Boolean);
}

/**
 * A verb that grades one numbered record on a branch: `omni <verb> <n> [--base <ref>]`. `paths`, when
 * given, reads the changed paths the grade needs; `grade` returns `{ ok, failures }`. It prints `ok`,
 * or `not ok` then one `- ` line per failure, and exits `0` or `1`.
 */
export function branchVerdictCommand<N extends number>({
  verb,
  read,
  paths,
  grade,
}: {
  verb: string;
  /** How `<n>` is read: the record's own kind of number (an issue's, a concept's). */
  read: (command: string, what: string, value: string | undefined) => N;
  paths?: (root: string, base: string, exec: ExecText) => string[];
  grade: (input: { ctx: Context; number: N; changed?: string[] | undefined; commits?: Commit[] | undefined }) => {
    ok: boolean;
    failures: string[];
  };
}): Command {
  const usage = `usage: omni ${verb} <n> [--base <ref>]`;
  return {
    run: synchronous((args, { ctx, stdout, exec }): number => {
      const { positional, flags } = parseArgs(verb, args, { values: ['base'] });
      if (positional.length !== 1) throw usageError(usage);
      const number = read(verb, '<n>', positional[0]);
      const base = rangeBase(verb, ctx, flags, exec);
      const changed = paths ? paths(ctx.root, base, exec) : undefined;
      const commits = ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec);
      const verdict = grade({ ctx, number, changed, commits });
      println(stdout, verdict.ok ? 'ok' : 'not ok');
      for (const failure of verdict.failures) println(stdout, `- ${failure}`);
      return verdict.ok ? 0 : 1;
    }),
  };
}
