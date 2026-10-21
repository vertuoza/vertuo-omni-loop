// What the scripts that keep one alert issue share (scripts/health-check.ts, scripts/mutation-alert.ts):
// a `gh` runner and the lookup of an open issue by its exact title. Node built-ins and `gh` only.
import { execFile } from 'node:child_process';

/** Runs `gh` with these arguments and resolves to its stdout; rejects, with its stderr, when it fails. */
export type Gh = (args: string[]) => Promise<string>;

export const gh: Gh = (args) =>
  new Promise((done, fail) => {
    execFile('gh', args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) fail(new Error(stderr.trim() || error.message));
      else done(stdout);
    });
  });

/** The number of the open issue (never a pull request) titled exactly `title`, or null. */
export async function findOpenIssue(repo: string, title: string, run: Gh): Promise<string | null> {
  const out = await run([
    'api',
    '--paginate',
    `repos/${repo}/issues?state=open&per_page=100`,
    '--jq',
    '.[] | select(.pull_request == null) | "\\(.number)\\t\\(.title)"',
  ]);
  for (const line of out.split('\n')) {
    const tab = line.indexOf('\t');
    if (tab > 0 && line.slice(tab + 1) === title) return line.slice(0, tab);
  }
  return null;
}
