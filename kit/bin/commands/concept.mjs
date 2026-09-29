// `omni concept <n> [--base <ref>]` — the proof step of a concept (PRD 686), run on its concept
// branch, mirroring `omni visual`: one folder under the inbox's concepts folder for concept <n>,
// holding a valid concept.md, its vision tour, its debate and its boards, every page self-contained
// and under the size cap, no file outside that folder changed since `<base>`, and every commit of
// `<base>..HEAD` signed. Prints `ok`, or `not ok` then one `- ` line per failed check
// (`kit/lib/concept/verdict.mjs`). `--base` defaults to `<repo.remote>/<repo.defaultBranch>`; a bad
// ref is a usage error, exit 2.
import { conceptVerdict } from '../../lib/concept/verdict.mjs';
import { parseArgs, positiveInt, println, usageError } from '../args.mjs';

const USAGE = 'usage: omni concept <n> [--base <ref>]';

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

/** Every path the branch changed since it left `base`, as repository paths. */
function branchChanged(root, base, exec) {
  return git(['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', `${base}...HEAD`, '--'], root, exec)
    .split('\0')
    .filter(Boolean);
}

export const concept = {
  async run(args, { ctx, stdout, exec }) {
    const { positional, flags } = parseArgs('concept', args, { values: ['base'] });
    if (positional.length !== 1) throw usageError(USAGE);
    const number = positiveInt('concept', '<n>', positional[0]);
    const base = flags.base ?? `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}`;

    if (!refExists(ctx.root, base, exec)) {
      const how = flags.base !== undefined ? 'pass another --base <ref>' : 'fetch it, or pass --base <ref>';
      throw usageError(`omni concept: no ${base} — ${how}.`);
    }

    const changed = branchChanged(ctx.root, base, exec);
    const commits = ctx.config.signature === null ? undefined : rangeCommits(ctx.root, base, exec);
    const verdict = conceptVerdict({ ctx, concept: number, changed, commits });
    println(stdout, verdict.ok ? 'ok' : 'not ok');
    for (const failure of verdict.failures) println(stdout, `- ${failure}`);
    return verdict.ok ? 0 : 1;
  },
};
