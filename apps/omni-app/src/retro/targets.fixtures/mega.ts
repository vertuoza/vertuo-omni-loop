// A synthetic multi-repository PRD for the retro's tests (PRD 1130): the plan repository `acme/plan`,
// whose PRD 7 (`widget`) landed in `acme/backend` and `acme/frontend`, through the App installed on
// each, and in `acme/mobile`, where the App is not installed. The plan PR is #12; the back-end's
// feature PR #40 took three slices, one of them slow; the front-end's #50 took one. Test support
// only; nothing in the app imports it.
import { parsePr } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { type Recorded, httpError, replayGitHub } from '../../../test/github-replay.ts';
import { addedPatch, hunkPatch } from '../kinds/churn.fixtures/delivery.ts';
import { MERGE_SHA, MERGED_AT, SPEC, retroEvent } from '../../../test/retro-scenario.ts';
import type { Octokit } from '../retro.types.ts';

const PLAN_CONFIG = [
  'kit: 1',
  'repo:',
  '  slug: acme/plan',
  '  defaultBranch: main',
  'plan:',
  '  targets:',
  '    - repo: acme/backend',
  '      role: back-end',
  '      knowledge: own',
  '    - repo: acme/frontend',
  '      role: front-end',
  '      knowledge: none',
  '    - repo: acme/mobile',
  '      role: mobile',
  '      knowledge: none',
  '',
].join('\n');

const MEGA_PLAN = [
  '# Widgets — plan',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| plan | plan | — | own |',
  '| backend | back-end | abc1234 | own |',
  '| frontend | front-end | def5678 | none |',
  '| mobile | mobile | 0123456 | none |',
  '',
  '## Slices',
  '',
  '| id | repo | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- | --- |',
  '| s1 | backend | The colour is stored | `src/store/` | — | 1 |',
  '| s2 | backend | The colour is read back | `src/read/` | s1 | 2 |',
  '| s3 | backend | The colour is served | `src/serve/` | s1 | 2 |',
  '| s4 | frontend | The colour is shown | `src/show/` | s2 | 3 |',
  '| s5 | mobile | The colour is shown on a phone | `src/phone/` | s2 | 3 |',
  '',
].join('\n');

const FOLDER = '.omni-loop/delivery/shipped/0007-widget';

/** One pull request of `owner/name`, in the REST shape the stubbed GitHub reads. */
function pull(slug: string, number: number, head: string, base: string, createdAt: string, mergedAt: string) {
  return {
    number,
    title: `slice ${head}`,
    state: 'closed',
    draft: false,
    merged: true,
    html_url: `https://github.com/${slug}/pull/${number}`,
    head: { ref: head, sha: `head${number}` },
    base: { ref: base, sha: `base${number}` },
    labels: [],
    created_at: createdAt,
    closed_at: mergedAt,
    merged_at: mergedAt,
    merge_commit_sha: `m${number}`,
  };
}

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';
const LIST_COMMITS = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits';
const GET_COMMIT = 'GET /repos/{owner}/{repo}/commits/{ref}';
const LIST_FILES = 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files';

/** One green run of `unit` on each slice branch of `repo`, its run and job ids from `id`. */
function greenRuns(repo: string, branches: readonly string[], id: number): Recorded[] {
  return branches.flatMap((branch, index) => {
    const run = id + index;
    const sha = `${branch.replace(/\W/g, '')}sha`;
    return [
      {
        route: RUNS,
        params: { owner: 'acme', repo, branch, exclude_pull_requests: true, per_page: 100, page: 1 },
        data: { total_count: 1, workflow_runs: [{ id: run, name: 'CI', head_branch: branch, head_sha: sha, run_attempt: 1, status: 'completed' }] },
      },
      {
        route: JOBS,
        params: { owner: 'acme', repo, run_id: run, filter: 'all', per_page: 100, page: 1 },
        data: {
          total_count: 1,
          jobs: [
            {
              id: run * 10,
              run_id: run,
              workflow_name: 'CI',
              name: 'unit',
              head_sha: sha,
              run_attempt: 1,
              status: 'completed',
              conclusion: 'success',
              html_url: `https://github.com/acme/${repo}/actions/runs/${run}/job/${run * 10}`,
              started_at: '2026-09-19T09:30:00Z',
              completed_at: '2026-09-19T09:30:00Z',
            },
          ],
        },
      },
    ];
  });
}

const COLOUR = 'src/store/colour.js';
const changed = (additions: number, deletions: number, patch: string) => ({ filename: COLOUR, status: 'modified', additions, deletions, changes: additions + deletions, patch });
/** The back-end's commits: s1 adds the colour file, then s2 and s3 rewrite one range of it twice more. */
const BACKEND_COMMITS: Record<number, [string, ReturnType<typeof changed>][]> = {
  41: [['b1', { ...changed(20, 0, addedPatch(20)), status: 'added' }]],
  42: [['b2', changed(4, 4, hunkPatch({ total: 20, from: 5, remove: 4, add: 4 }))]],
  43: [['b3', changed(4, 4, hunkPatch({ total: 20, from: 5, remove: 4, add: 4, name: 'again' }))]],
};

/** The back-end's commits, as churn reads them: each sub-PR's, each commit's files, and the feature PR's final diff. */
function backendChurn(): Recorded[] {
  const sha = (tag: string) => tag.padEnd(40, '0');
  const url = (tag: string) => `https://github.com/acme/backend/commit/${sha(tag)}`;
  return [
    ...Object.entries(BACKEND_COMMITS).flatMap(([number, commits]) => [
      {
        route: LIST_COMMITS,
        params: { owner: 'acme', repo: 'backend', pull_number: number, per_page: 100, page: 1 },
        data: commits.map(([tag]) => ({ sha: sha(tag), html_url: url(tag), commit: { message: tag }, parents: [{ sha: sha(`p${tag}`) }] })),
      },
      ...commits.map(([tag, file]) => ({
        route: GET_COMMIT,
        params: { owner: 'acme', repo: 'backend', ref: sha(tag), per_page: 100, page: 1 },
        data: { sha: sha(tag), html_url: url(tag), commit: { message: tag }, parents: [{ sha: sha(`p${tag}`) }], files: [file] },
      })),
    ]),
    {
      route: LIST_FILES,
      params: { owner: 'acme', repo: 'backend', pull_number: 40, per_page: 100, page: 1 },
      data: [{ filename: COLOUR, status: 'added', additions: 20, deletions: 0, changes: 20 }],
    },
  ];
}

const PLAN_PR = { ...pull('acme/plan', 12, 'feat/widget', 'main', '2026-09-20T09:00:00Z', MERGED_AT), title: 'feat(widget): widgets remember their colour (PRD 7)', merge_commit_sha: MERGE_SHA };

/** Each stubbed repository's GitHub, by the installation the App has there: the plan repository's is 7. */
export function megaScenario() {
  const plan = replayGitHub({
    commits: { [MERGE_SHA]: { '.omni-loop/config.yml': PLAN_CONFIG, [`${FOLDER}/spec.md`]: SPEC, [`${FOLDER}/plan.md`]: MEGA_PLAN } },
    pulls: [PLAN_PR],
    events: { 12: [{ id: 1, event: 'ready_for_review', created_at: '2026-09-20T11:00:00Z' }] },
  });
  // s1 takes 30 minutes, s2 20 and s3 120: more than three times the median of 30, so s3 is slow.
  const backend = replayGitHub({
    pulls: [
      pull('acme/backend', 40, 'feat/widget', 'main', '2026-09-19T09:00:00Z', '2026-09-20T10:00:00Z'),
      pull('acme/backend', 41, 'feat/widget--s1', 'feat/widget', '2026-09-19T09:10:00Z', '2026-09-19T09:40:00Z'),
      pull('acme/backend', 42, 'feat/widget--s2', 'feat/widget', '2026-09-19T09:45:00Z', '2026-09-19T10:05:00Z'),
      pull('acme/backend', 43, 'feat/widget--s3', 'feat/widget', '2026-09-19T09:46:00Z', '2026-09-19T11:46:00Z'),
    ],
    events: { 40: [{ id: 2, event: 'ready_for_review', created_at: '2026-09-20T09:30:00Z' }] },
    recording: [...greenRuns('backend', ['feat/widget--s1', 'feat/widget--s2', 'feat/widget--s3'], 401), ...backendChurn()],
  });
  const frontend = replayGitHub({
    pulls: [
      pull('acme/frontend', 50, 'feat/widget', 'main', '2026-09-19T12:00:00Z', '2026-09-20T11:00:00Z'),
      pull('acme/frontend', 51, 'feat/widget--s4', 'feat/widget', '2026-09-19T12:10:00Z', '2026-09-19T12:50:00Z'),
    ],
    events: { 50: [] },
    recording: greenRuns('frontend', ['feat/widget--s4'], 501),
  });
  const installations: Record<string, number> = { 'acme/backend': 21, 'acme/frontend': 22 };
  const byInstallation: Record<number, { request: Octokit['request'] }> = { 7: plan.octokit, 21: backend.octokit, 22: frontend.octokit };
  const appCalls: { route: string; owner: unknown; repo: unknown }[] = [];
  const app: Octokit = {
    request(route, params = {}) {
      appCalls.push({ route, owner: params.owner, repo: params.repo });
      const id = installations[`${String(params.owner)}/${String(params.repo)}`];
      if (route !== 'GET /repos/{owner}/{repo}/installation' || id === undefined) return Promise.reject(httpError(404, 'Not Found'));
      return Promise.resolve({ data: { id, app_id: 1 } });
    },
  };
  const octokitFor = (installationId: number): Octokit => {
    const octokit = byInstallation[installationId];
    if (!octokit) throw new Error(`no installation ${installationId}`);
    return octokit;
  };
  return {
    github: { plan, backend, frontend },
    app,
    appCalls,
    octokitFor,
    event: retroEvent({ owner: 'acme', repo: 'plan', repository: 'acme/plan', prNumber: parsePr(12) }),
  };
}
