import type { Board, Runner } from '../runners.contract';
import { agoWords, cannotRunReason, prWords, statusWords, type Fleet } from './model';

// The repositories of a runner (PRD 3232 s4): the words of its card's button and the rows of its drawer, pure, so the order, the
// counts and the search are tested without a page. The rows are made on the server from the board and carry their words, so the
// drawer, which runs in the browser, only filters them.

/** The URL parameter that opens a runner's drawer: `?repos=<runner name>`. */
const REPOS_PARAM = 'repos';

/** One repository a runner holds, as the drawer lists it. */
export type RepoRow = {
  repo: string; owner: string; name: string;
  running: number; queued: number; cannot: number; busy: boolean;
  /** `1 running · 2 queued · 1 cannot run`, or `No job queued or running`. */
  counts: string;
  /** Its last ended job among the board's: `Done · PR #12 · 3 h ago`, or `No job in the last 50`. */
  last: string;
  /** `Also on <runner>, <runner>`, or `Only on this runner`. */
  alsoOn: string;
};

/** The rows of the drawer of a runner whose name the URL gave. */
export type RunnerRepos = { name: string; rows: readonly RepoRow[] };

/** The rows whose repository matches `search`, ignoring case and the spaces around it; every row for an empty search. */
export function filterRows(rows: readonly RepoRow[], search: string): RepoRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => row.repo.toLowerCase().includes(needle));
}

const count = (n: number, word: string): string[] => (n > 0 ? [`${String(n)} ${word}`] : []);

/** A runner's repositories, the ones with a job queued or running first, then A to Z (case ignored), filtered by `search`. */
export function repositoryRows(runner: Pick<Runner, 'id' | 'repos'>, board: Pick<Board, 'jobs' | 'runners'>, fleets: readonly Fleet[], now: Date, search = ''): RepoRow[] {
  const rows = runner.repos.map((repo): RepoRow => {
    const jobs = board.jobs.filter((job) => job.repo === repo);
    const running = jobs.filter((job) => job.status === 'claimed' || job.status === 'running').length;
    const waiting = jobs.filter((job) => job.status === 'queued');
    const cannot = waiting.filter((job) => cannotRunReason(job, board.runners, fleets) !== null).length;
    const queued = waiting.length - cannot;
    const last = jobs.filter((job) => job.endedAt !== null).sort((a, b) => Date.parse(b.endedAt ?? '') - Date.parse(a.endedAt ?? ''))[0];
    const others = board.runners.filter((other) => other.id !== runner.id && other.repos.includes(repo)).map((other) => other.name);
    const [owner = '', ...rest] = repo.split('/');
    const counts = [...count(running, 'running'), ...count(queued, 'queued'), ...count(cannot, 'cannot run')];
    return {
      repo, owner, name: rest.join('/'), running, queued, cannot, busy: running + queued + cannot > 0,
      counts: counts.length === 0 ? 'No job queued or running' : counts.join(' · '),
      last: last?.endedAt == null ? 'No job in the last 50' : [statusWords(last, now), ...(last.prUrl ? [prWords(last.prUrl)] : []), agoWords(last.endedAt, now)].join(' · '),
      alsoOn: others.length === 0 ? 'Only on this runner' : `Also on ${others.join(', ')}`,
    };
  });
  const byName = (a: RepoRow, b: RepoRow) => a.repo.toLowerCase().localeCompare(b.repo.toLowerCase());
  return filterRows([...rows.filter((row) => row.busy).sort(byName), ...rows.filter((row) => !row.busy).sort(byName)], search);
}

/** The card's button: `17 repositories`, then `· 3 with jobs` when some of them have a job queued or running. */
export function reposWords(rows: readonly Pick<RepoRow, 'busy'>[]): string {
  const busy = rows.filter((row) => row.busy).length;
  return `${String(rows.length)} ${rows.length === 1 ? 'repository' : 'repositories'}${busy > 0 ? ` · ${String(busy)} with jobs` : ''}`;
}

/** `href` with `?repos=<runner name>` set, or removed when `name` is null; every other parameter and the hash kept. */
export function withRepos(href: string, name: string | null): string {
  const url = new URL(href);
  if (name === null) url.searchParams.delete(REPOS_PARAM);
  else url.searchParams.set(REPOS_PARAM, name);
  return `${url.pathname}${url.search}${url.hash}`;
}
