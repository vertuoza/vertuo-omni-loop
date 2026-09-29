// `omni visual <n> [--base <ref>]` — the proof step of a visual fix (PRD #541), run on its fix branch,
// mirroring `omni phase0`: one folder under `<paths.delivery>/visual/` for issue <n>, holding a
// before-after.html under the size cap with no base64 raster image, and every commit of the range
// `<base>..HEAD` signed. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/visual/verdict.mjs`). `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad
// ref is a usage error, exit 2.
import { visualVerdict } from '../../lib/visual/verdict.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni visual <n> [--base <ref>]';

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

export const visual = {
  async run(args, { ctx, stdout, exec }) {
    const { positional, flags } = parseArgs('visual', args, { values: ['base'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const issue = positiveInt('visual', '<n>', positional[0]);
    const base = flags.base ?? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;

    if (!refExists(ctx.root, base, exec)) {
      const how = flags.base !== undefined ? 'pass another --base <ref>' : 'fetch it, or pass --base <ref>';
      throw usageError(`omni visual: no ${base} — ${how}.`);
    }

    const commits = ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec);
    const verdict = visualVerdict({ ctx, issue, commits });
    println(stdout, verdict.ok ? 'ok' : 'not ok');
    for (const failure of verdict.failures) println(stdout, `- ${failure}`);
    return verdict.ok ? 0 : 1;
  },
};
