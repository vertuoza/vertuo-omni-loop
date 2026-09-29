// `omni bug <n> [--base <ref>]` — the proof step of a bug fix (PRD #556), run on its fix branch,
// shaped like `omni visual`: one folder under `<paths.delivery>/bugs/` for issue <n>, holding a
// complete bug.md whose reproduction file the range `<base>..HEAD` changes, and every commit of that
// range signed. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/bug/verdict.mjs`). It runs no test. `--base` defaults to
// `<repo.remote>/<repo.defaultBranch>`; a bad ref is a usage error, exit 2.
import { bugVerdict } from '../../lib/bug/verdict.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni bug <n> [--base <ref>]';

function git(args, cwd, exec) {
  return exec('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function refExists(root, ref, exec) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root, exec);
    return true;
  } catch {
    return false;
  }
}

/** The range's commits, oldest first, as `{ sha, message }` (`sha` in git's short form). */
function rangeCommits(root, base, exec) {
  return git(['log', '--reverse', '--format=%h%x00%B%x1e', `${base}..HEAD`], root, exec)
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.includes('\x00'))
    .map((record) => {
      const [sha, message] = record.split('\x00');
      return { sha, message };
    });
}

/** Every path the range's commits touch, as repository paths. */
function rangeChanged(root, base, exec) {
  return git(['log', '--format=', '--name-only', '--no-renames', `${base}..HEAD`], root, exec)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const bug = {
  async run(args, { ctx, stdout, exec }) {
    const { positional, flags } = parseArgs('bug', args, { values: ['base'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const issue = positiveInt('bug', '<n>', positional[0]);
    const base = flags.base ?? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;

    if (!refExists(ctx.root, base, exec)) {
      const how = flags.base !== undefined ? 'pass another --base <ref>' : 'fetch it, or pass --base <ref>';
      throw usageError(`omni bug: no ${base} — ${how}.`);
    }

    const changed = rangeChanged(ctx.root, base, exec);
    const commits = ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec);
    const verdict = bugVerdict({ ctx, issue, changed, commits });
    println(stdout, verdict.ok ? 'ok' : 'not ok');
    for (const failure of verdict.failures) println(stdout, `- ${failure}`);
    return verdict.ok ? 0 : 1;
  },
};
