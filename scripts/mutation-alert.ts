// The nightly mutation run's alert, run by the `score` job of .github/workflows/mutation.yml. A red
// night went unseen six nights running (2026-10-16 to 10-21: `ids` below its floor after #2012), since
// the run is never a required check. So the run keeps one issue, found among the open issues by its
// exact title: red with none open, it opens one assigned to the laws' owners (`laws.owners`), so
// GitHub tells them; red with one open, it comments once a night; green with one open, it comments that
// the floors hold again and closes it; green with none open, it does nothing.
//
// Node built-ins and the `gh` command only. Its inputs are arguments; it reads no environment (gh
// reads its own token):
//   node scripts/mutation-alert.ts --repo <owner>/<repo> --state red|green --run <url> [--score <file>] [--assign <login>]...
// It exits 0 whatever it found: the red night is already the run's own verdict. It exits 1 only when
// its arguments are wrong or gh could not write what it found, so the alert is not lost.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOpenIssue, gh } from './gh-issues.ts';

export const TITLE = 'Mutation: the nightly run is red';

export interface Deps {
  /** Runs `gh` with these arguments and resolves to its stdout; rejects when it fails. */
  gh: (args: string[]) => Promise<string>;
  /** The score table `pnpm mutation:score` wrote, or null when there is none. */
  read: (file: string) => string | null;
}

export interface Options {
  repo: string;
  red: boolean;
  run: string;
  score: string | null;
  assign: string[];
}

export function parseArgs(argv: readonly string[]): Options | null {
  let repo = '';
  let state = '';
  let run = '';
  let score: string | null = null;
  const assign: string[] = [];
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (value === undefined || value === '') return null;
    if (argv[i] === '--repo') repo = value;
    else if (argv[i] === '--state') state = value;
    else if (argv[i] === '--run') run = value;
    else if (argv[i] === '--score') score = value;
    else if (argv[i] === '--assign') assign.push(value);
    else return null;
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || (state !== 'red' && state !== 'green') || !run.startsWith('https://')) return null;
  return { repo, red: state === 'red', run, score, assign };
}

function describeRed(options: Options, deps: Deps): string {
  const table = options.score === null ? null : deps.read(options.score);
  return [
    `Run: ${options.run}`,
    '',
    table?.trim() ? table.trim() : 'No score table: a shard did not finish, so the run could not score the floors (see the run).',
  ].join('\n');
}

/** Keeps the one issue; returns what it did, in one line. */
export async function keep(options: Options, deps: Deps): Promise<string> {
  const { repo } = options;
  const openNumber = await findOpenIssue(repo, TITLE, deps.gh);
  if (!options.red) {
    if (openNumber === null) return 'green';
    await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues/${openNumber}/comments`, '-f', `body=Green again: every module holds its floor in \`mutation/floor.json\`. Run: ${options.run}`]);
    await deps.gh(['api', '-X', 'PATCH', `repos/${repo}/issues/${openNumber}`, '-f', 'state=closed', '-f', 'state_reason=completed']);
    return `green, closed #${openNumber}`;
  }
  if (openNumber === null) {
    const body = [
      'The nightly mutation run is red: a module of the delivery core is below its floor in `mutation/floor.json`, or a shard did not finish. It is not a required check, so nothing else says so.',
      '',
      describeRed(options, deps),
      '',
      'Raise the score with tests that kill the surviving mutants; never lower the floor (testing form). The run comments here each red night and closes this issue once it is green.',
    ].join('\n');
    await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues`, '-f', `title=${TITLE}`, '-f', `body=${body}`, ...options.assign.flatMap((login) => ['-f', `assignees[]=${login}`])]);
    return 'red, opened an issue';
  }
  await deps.gh(['api', '-X', 'POST', `repos/${repo}/issues/${openNumber}/comments`, '-f', `body=Still red.\n\n${describeRed(options, deps)}`]);
  return `red, commented on #${openNumber}`;
}

const realDeps: Deps = {
  gh,
  read: (file) => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  },
};

const USAGE = 'mutation-alert: needs --repo <owner>/<repo>, --state red|green and --run <https URL>; --score <file> and --assign <login> are optional';

/** Reads `argv`, keeps the issue and says what it did; answers the exit code (1: bad arguments or gh failed). */
export async function main(argv: readonly string[], deps: Deps, say: (line: string) => void): Promise<number> {
  const options = parseArgs(argv);
  if (!options) {
    say(USAGE);
    return 1;
  }
  try {
    say(`mutation-alert: ${await keep(options, deps)}`);
    return 0;
  } catch (error) {
    say(`mutation-alert: gh failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2), realDeps, console.log));
