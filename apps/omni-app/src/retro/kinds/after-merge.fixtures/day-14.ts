// The after-merge kind's fixture (PRD 72, slice s8): what GitHub holds about PRD 7 of `acme/widgets`
// (`test/retro-scenario.ts`) in the fourteen days after its feature PR #12 merged, on
// 2026-09-20T12:00:00Z. The window closes on 2026-10-04T12:00:00Z.
//
//   bug #40  names #7, opened 2026-09-23 (2 days after), closed on 2026-09-24:
//            fixed by #45 ("Fixes #40"), which rewrites lines 9-10 of `src/store/colour.js`, inside
//            the churn range 8-11; and by #47 ("resolves acme/widgets#40"), which changes
//            `src/show/table.js` without a patch
//   bug #41  names #7 in its title, opened 2026-09-29 (8 days after), still open at day 14: its fix
//            #46 merged on 2026-10-08, after the window, and closed it then
//   bug #42  names #7, opened 2026-10-06: after the window, not counted
//   bug #43  names #70, not #7: not counted
//   bug #44  names #7, opened 2026-09-19: before the merge, not counted
//   #39      names #7 but is labelled `enhancement`: never listed
//
//   #48      merged into main within the window, closing nothing
//   #49      "Fixes #40", closed without merging
//
// The merge commit ran two workflows: CI (`unit` green, `e2e` red, `lint` green) and Deploy
// (`deploy` skipped).
import { FEATURE, MERGED_AT, MERGE_SHA, OWNER, REPO } from '../../../../test/retro-scenario.ts';

export { FEATURE, MERGED_AT, MERGE_SHA, OWNER, REPO };

/** The window's end: the merge plus fourteen days. */
export const DAY_14 = '2026-10-04T12:00:00.000Z';

const url = (kind: string, number: number) => `https://github.com/${OWNER}/${REPO}/${kind}/${number}`;

type IssueFixture = { number: number; title: string; body?: string; createdAt: string; closedAt?: string | null; labels?: string[] };

const issue = ({ number, title, body = '', createdAt, closedAt = null, labels = ['bug'] }: IssueFixture) => ({
  number,
  title,
  body,
  state: closedAt ? 'closed' : 'open',
  html_url: url('issues', number),
  labels: labels.map((name) => ({ name })),
  created_at: createdAt,
  updated_at: closedAt ?? createdAt,
  closed_at: closedAt,
});

/** The issues the repository holds, as `GET /repos/{owner}/{repo}/issues` lists them. */
export const ISSUES = [
  issue({ number: 39, title: 'Remember the size too', body: 'Like #7 does for the colour.', createdAt: '2026-09-21T10:00:00Z', labels: ['enhancement'] }),
  issue({ number: 40, title: 'The colour is lost after a reload', body: 'Since #7 shipped, a reload resets it.', createdAt: '2026-09-23T09:00:00Z', closedAt: '2026-09-24T10:00:00Z' }),
  issue({ number: 41, title: 'The table misaligns (#7)', createdAt: '2026-09-29T08:00:00Z', closedAt: '2026-10-08T09:00:00Z' }),
  issue({ number: 42, title: 'A late one', body: 'Seen with #7.', createdAt: '2026-10-06T08:00:00Z' }),
  issue({ number: 43, title: 'Not this PRD', body: 'Broken since #70.', createdAt: '2026-09-25T08:00:00Z' }),
  issue({ number: 44, title: 'Before the merge', body: 'Seen on the preview of #7.', createdAt: '2026-09-19T08:00:00Z' }),
];

type PullFixture = { number: number; title: string; body?: string; mergedAt: string | null; closedAt?: string | null };

const pull = ({ number, title, body = '', mergedAt, closedAt = mergedAt }: PullFixture) => ({
  number,
  title,
  body,
  state: 'closed',
  draft: false,
  merged: Boolean(mergedAt),
  html_url: url('pull', number),
  head: { ref: `fix/${number}`, sha: `head${number}` },
  base: { ref: 'main', sha: `base${number}` },
  labels: [],
  created_at: '2026-09-22T08:00:00Z',
  updated_at: closedAt,
  closed_at: closedAt,
  merged_at: mergedAt,
  merge_commit_sha: mergedAt ? `m${number}` : null,
});

/** The pull requests into main after the merge, as `GET /repos/{owner}/{repo}/pulls` lists them. */
export const FIX_PULLS = [
  pull({ number: 45, title: 'fix(store): keep the colour', body: 'Fixes #40', mergedAt: '2026-09-24T09:55:00Z' }),
  pull({ number: 46, title: 'fix(show): align the table', body: 'Closes #41.', mergedAt: '2026-10-08T08:55:00Z' }),
  pull({ number: 47, title: 'fix(show): the table keeps the colour', body: 'Also resolves acme/widgets#40', mergedAt: '2026-09-27T10:00:00Z' }),
  pull({ number: 48, title: 'docs: a typo', body: 'Nothing to close.', mergedAt: '2026-09-26T10:00:00Z' }),
  pull({ number: 49, title: 'fix(store): a first try', body: 'Fixes #40', mergedAt: null, closedAt: '2026-09-23T15:00:00Z' }),
];

/** The churn ranges the merge run found (`kinds/churn.mjs` facts), as the day-14 run is handed them. */
export const RANGES = [
  { path: 'src/store/colour.js', from: 8, to: 11, commits: ['c100000', 'c200000', 'c400000'], slices: ['s1', 's2'] },
  { path: 'src/show/table.js', from: 61, to: 90, commits: ['c700000', 'c800000', 'c900000'], slices: ['s3'] },
];

const ROUTES = {
  files: 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files',
  runs: 'GET /repos/{owner}/{repo}/actions/runs',
  jobs: 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs',
};
export { ROUTES };

const request = (route: string, params: Record<string, unknown>, data: unknown, status: number | undefined) => ({
  route,
  params: { owner: OWNER, repo: REPO, ...params },
  ...(status ? { status } : { data }),
});

/** The files of each fix, as `GET /repos/{owner}/{repo}/pulls/{pull_number}/files` lists them. */
export const FIX_FILES = {
  45: [
    {
      filename: 'src/store/colour.js',
      status: 'modified',
      additions: 2,
      deletions: 2,
      patch: ['@@ -7,6 +7,6 @@', ' line 7', ' line 8', '-line 9', '-line 10', '+kept 9', '+kept 10', ' line 11', ' line 12'].join('\n'),
    },
    { filename: 'src/store/colour.test.js', status: 'added', additions: 3, deletions: 0, patch: '@@ -0,0 +1,3 @@\n+a\n+b\n+c' },
  ],
  47: [{ filename: 'src/show/table.js', status: 'modified', additions: 4, deletions: 1 }],
};

const job = (id: number, name: string, conclusion: string) => ({
  id,
  name,
  status: 'completed',
  conclusion,
  html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/7001/job/${id}`,
});

/** The workflow runs of the merge commit, and each run's latest jobs. */
export const MERGE_RUNS = [
  { id: 7001, name: 'CI', head_sha: MERGE_SHA, status: 'completed', conclusion: 'failure', html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/7001` },
  { id: 7002, name: 'Deploy', head_sha: MERGE_SHA, status: 'completed', conclusion: 'skipped', html_url: `https://github.com/${OWNER}/${REPO}/actions/runs/7002` },
];
export const MERGE_JOBS = {
  7001: [job(8001, 'unit', 'success'), job(8002, 'e2e', 'failure'), job(8003, 'lint', 'success')],
  7002: [job(8004, 'deploy', 'skipped')],
};

/**
 * The recorded reads the after-merge kind makes that the stubbed GitHub does not answer itself, for
 * `replayGitHub({ recording })`. `missing` names reads GitHub answers with a status instead:
 * `{ runs: 403, jobs: { 7001: 404 }, files: { 45: 404 } }`.
 */
export type Missing = { runs?: number; jobs?: Record<string, number>; files?: Record<string, number> };

export function afterMergeRecording({ missing = {} }: { missing?: Missing } = {}) {
  const entries = [];
  for (const [number, files] of Object.entries(FIX_FILES)) {
    entries.push(request(ROUTES.files, { pull_number: number, per_page: 100, page: 1 }, files, missing.files?.[number]));
  }
  entries.push(request(ROUTES.runs, { head_sha: MERGE_SHA, per_page: 100, page: 1 }, { total_count: MERGE_RUNS.length, workflow_runs: MERGE_RUNS }, missing.runs));
  for (const [runId, jobs] of Object.entries(MERGE_JOBS)) {
    entries.push(request(ROUTES.jobs, { run_id: runId, filter: 'latest', per_page: 100, page: 1 }, { total_count: jobs.length, jobs }, missing.jobs?.[runId]));
  }
  return entries;
}
