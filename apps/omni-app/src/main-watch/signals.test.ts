import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { httpError } from '../../test/github-replay.ts';
import type { Octokit } from '../retro/retro.types.ts';
import { namesPrd, namesPull, readSignals, revertsLane, triageRegression, type Lane } from './signals.ts';

const SHA = 'a'.repeat(40);
const PARENT = 'b'.repeat(40);
const MERGED_AT = '2026-09-20T12:00:00Z';
const UNTIL = '2026-09-27T12:00:00Z';

const LANE: Lane = {
  lane: 'acme/widgets',
  owner: 'acme',
  repo: 'widgets',
  installationId: 7,
  base: 'main',
  mergeSha: SHA,
  mergedAt: MERGED_AT,
  watchUntil: UNTIL,
  pulls: [
    { number: parsePr(12), title: 'feat(widget): widgets remember their colour (PRD 7)' },
    { number: parsePr(13), title: 'The colour is stored' },
  ],
};
const SCOPE = { prd: parsePrd(7), planSlug: 'acme/widgets', regressionLabel: 'omni:regression', retroLabel: 'omni:retro' };

describe('revertsLane — a commit that reverts the PRD (PRD 2410)', () => {
  it('reads GitHub’s revert of the merge commit, by its sha or its first seven characters', () => {
    expect(revertsLane(`Revert "something"\n\nThis reverts commit ${SHA}.`, LANE)).toBe(true);
    expect(revertsLane(`Undo\n\nThis reverts commit ${SHA.slice(0, 7)}.`, LANE)).toBe(true);
    expect(revertsLane(`Undo\n\nThis reverts commit ${'c'.repeat(40)}.`, LANE)).toBe(false);
  });

  it('reads `Revert "<title>"` of the feature PR or a sub-PR, with or without its number', () => {
    expect(revertsLane('Revert "feat(widget): widgets remember their colour (PRD 7)"', LANE)).toBe(true);
    expect(revertsLane('Revert "The colour is stored (#13)" (#30)', LANE)).toBe(true);
    expect(revertsLane('Revert "Something else (#13)"', LANE)).toBe(true);
    expect(revertsLane('Revert "Something else (#130)"', LANE)).toBe(false);
    expect(revertsLane('Revert "Something else"', LANE)).toBe(false);
  });

  it('reads a revert pull request’s `Reverts owner/name#<n>` naming one of its pull requests', () => {
    expect(revertsLane('Revert "x" (#31)\n\nReverts acme/widgets#12', LANE)).toBe(true);
    expect(revertsLane('Revert "x" (#31)\n\nReverts other/repo#12', LANE)).toBe(false);
    expect(revertsLane('fix: the colour\n\nmentions #12 but reverts nothing', LANE)).toBe(false);
  });
});

describe('namesPrd and namesPull', () => {
  it('names the PRD by #<n>, owner/name#<n> or its issue link, never #70 for #7 nor an HTML entity', () => {
    const names = namesPrd(parsePrd(7), 'acme/widgets', { bare: true });
    expect(names('Broken since #7')).toBe(true);
    expect(names('see acme/widgets#7')).toBe(true);
    expect(names('https://github.com/acme/widgets/issues/7')).toBe(true);
    expect(names('#70 and &#7;')).toBe(false);
  });

  it('in a target repository, names the PRD only with the plan repository’s name', () => {
    const names = namesPrd(parsePrd(7), 'acme/plan', { bare: false });
    expect(names('Broken since #7')).toBe(false);
    expect(names('Broken since acme/plan#7')).toBe(true);
  });

  it('names a pull request of the lane by #<n>, owner/name#<n> or its link', () => {
    const names = namesPull(LANE);
    expect(names('culprit #13')).toBe(true);
    expect(names('culprit https://github.com/acme/widgets/pull/12')).toBe(true);
    expect(names('culprit other/repo#13')).toBe(false);
    expect(names('culprit #130')).toBe(false);
  });

  it('reads the Regression line of a /omni:bug-fix triage, and nothing from another comment', () => {
    const triage = '<!-- omni-bug:triage -->\n\n## Triage\n\n- **Kind:** behaviour bug\n- **Regression:** yes — #13 broke it\n- **Reproduction:** pending\n';
    expect(triageRegression(triage)).toBe('yes — #13 broke it');
    expect(triageRegression('- **Regression:** yes — #13')).toBeNull();
  });
});

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';
const COMMIT = 'GET /repos/{owner}/{repo}/commits/{ref}';
const COMMITS = 'GET /repos/{owner}/{repo}/commits';
const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const COMMENTS = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments';

/** A GitHub answering each route with `answers[route](params)`; a route not given answers an empty page. */
function github(answers: Record<string, (params: Record<string, unknown>) => unknown>): Octokit & { routes: string[] } {
  const routes: string[] = [];
  return {
    routes,
    request(route, params = {}) {
      routes.push(route);
      const answer = answers[route];
      if (!answer) return Promise.resolve({ data: route === RUNS ? { workflow_runs: [] } : [] });
      try {
        return Promise.resolve({ data: answer(params) });
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    },
  };
}

const job = (id: number, name: string, conclusion: string, attempt = 1) => ({
  id,
  name,
  conclusion,
  run_attempt: attempt,
  html_url: `https://github.com/acme/widgets/actions/runs/1/job/${id}`,
  completed_at: '2026-09-20T12:10:00Z',
});

describe('readSignals — one lane, against a stubbed GitHub', () => {
  it('reads a red job on the merge commit, a red a re-run turned green included, once, with the parent’s result', async () => {
    const octokit = github({
      [RUNS]: ({ head_sha: sha }) => ({ workflow_runs: [{ id: sha === SHA ? 1 : 2, name: 'CI', html_url: 'https://github.com/acme/widgets/actions/runs/1' }] }),
      [JOBS]: ({ run_id: run }) => ({
        jobs: run === 1 ? [job(10, 'unit', 'failure'), job(11, 'unit', 'success', 2), job(12, 'lint', 'failure'), job(13, 'lint', 'failure', 2)] : [job(20, 'unit', 'success'), job(21, 'lint', 'failure')],
      }),
      [COMMIT]: () => ({ sha: SHA, parents: [{ sha: PARENT }] }),
    });
    const read = await readSignals(octokit, LANE, SCOPE);
    expect(read.unread).toEqual([]);
    expect(read.breaks).toEqual([
      { kind: 'ci-red', source: '1/unit', url: 'https://github.com/acme/widgets/actions/runs/1/job/10', title: 'CI › unit', parent: 'green', at: '2026-09-20T12:10:00Z' },
      { kind: 'ci-red', source: '1/lint', url: 'https://github.com/acme/widgets/actions/runs/1/job/12', title: 'CI › lint', parent: 'red', at: '2026-09-20T12:10:00Z' },
    ]);
  });

  it('names the parent unknown when its commit cannot be read, and reads no parent when nothing is red', async () => {
    const red = github({
      [RUNS]: () => ({ workflow_runs: [{ id: 1, name: 'CI' }] }),
      [JOBS]: () => ({ jobs: [job(10, 'unit', 'timed_out')] }),
      [COMMIT]: () => {
        throw httpError(404, 'Not Found');
      },
    });
    expect((await readSignals(red, LANE, SCOPE)).breaks.map((one) => one.parent)).toEqual(['unknown']);
    const green = github({ [RUNS]: () => ({ workflow_runs: [{ id: 1, name: 'CI' }] }), [JOBS]: () => ({ jobs: [job(10, 'unit', 'success')] }) });
    expect(await readSignals(green, LANE, SCOPE)).toEqual({ breaks: [], unread: [] });
    expect(green.routes).not.toContain(COMMIT);
  });

  it('reads the reverts pushed to the default branch within the window, never the merge commit itself', async () => {
    const octokit = github({
      [COMMITS]: (params) => {
        expect(params).toMatchObject({ sha: 'main', since: MERGED_AT, until: UNTIL });
        return [
          { sha: SHA, html_url: `https://github.com/acme/widgets/commit/${SHA}`, commit: { message: 'Revert "The colour is stored"', committer: { date: MERGED_AT } } },
          { sha: 'd'.repeat(40), html_url: `https://github.com/acme/widgets/commit/${'d'.repeat(40)}`, commit: { message: 'Revert "The colour is stored (#13)" (#30)\n\nReverts acme/widgets#13', committer: { date: '2026-09-22T08:00:00Z' } } },
          { sha: 'e'.repeat(40), html_url: `https://github.com/acme/widgets/commit/${'e'.repeat(40)}`, commit: { message: 'fix: something else', committer: { date: '2026-09-22T09:00:00Z' } } },
        ];
      },
    });
    expect((await readSignals(octokit, LANE, SCOPE)).breaks).toEqual([
      { kind: 'revert', source: 'd'.repeat(40), url: `https://github.com/acme/widgets/commit/${'d'.repeat(40)}`, title: 'Revert "The colour is stored (#13)" (#30)', parent: null, at: '2026-09-22T08:00:00Z' },
    ]);
  });

  it('reads an issue naming the PRD, or a regression whose triage names one of its pull requests, opened within the seven days', async () => {
    const issue = (number: number, createdAt: string, over: Record<string, unknown> = {}) => ({
      number,
      title: `Issue ${number}`,
      body: '',
      html_url: `https://github.com/acme/widgets/issues/${number}`,
      created_at: createdAt,
      user: { type: 'User' },
      labels: [],
      ...over,
    });
    const octokit = github({
      [ISSUES]: () => [
        issue(40, '2026-09-21T10:00:00Z', { body: 'The colour is lost again since #7.' }),
        issue(41, '2026-09-22T10:00:00Z', { labels: [{ name: 'omni:regression' }] }),
        issue(42, '2026-09-28T13:00:00Z', { body: 'Day eight: #7 broke it.' }),
        issue(43, '2026-09-21T11:00:00Z', { body: 'A retro finding of #7.', labels: [{ name: 'omni:retro' }] }),
        issue(44, '2026-09-21T12:00:00Z', { body: 'Opened by an app about #7.', user: { type: 'Bot' } }),
        issue(45, '2026-09-21T13:00:00Z', { body: 'A pull request naming #7.', pull_request: {} }),
        issue(46, '2026-09-21T14:00:00Z', { labels: ['omni:regression'] }),
      ],
      [COMMENTS]: ({ issue_number: number }) =>
        number === 41
          ? [{ body: 'first look' }, { body: '<!-- omni-bug:triage -->\n\n## Triage\n\n- **Regression:** yes — #13\n' }]
          : [{ body: '<!-- omni-bug:triage -->\n\n- **Regression:** yes — #99\n' }],
    });
    const read = await readSignals(octokit, LANE, SCOPE);
    expect(read.breaks.map(({ kind, source, title, at }) => ({ kind, source, title, at }))).toEqual([
      { kind: 'regression', source: '40', title: 'Issue 40', at: '2026-09-21T10:00:00Z' },
      { kind: 'regression', source: '41', title: 'Issue 41', at: '2026-09-22T10:00:00Z' },
    ]);
    expect(read.unread).toEqual([]);
  });

  it('names each read GitHub refused, and reads the others', async () => {
    const refused = () => {
      throw httpError(403, 'Resource not accessible by integration');
    };
    const octokit = github({ [RUNS]: refused, [COMMITS]: refused, [ISSUES]: () => [] });
    expect(await readSignals(octokit, LANE, SCOPE)).toEqual({ breaks: [], unread: ['ci', 'reverts'] });
    const jobs = github({ [RUNS]: () => ({ workflow_runs: [{ id: 1, name: 'CI' }] }), [JOBS]: refused, [ISSUES]: refused });
    expect(await readSignals(jobs, LANE, SCOPE)).toEqual({ breaks: [], unread: ['ci', 'regressions'] });
  });

  it('throws any other failure, so the step is retried', async () => {
    const octokit = github({
      [RUNS]: () => {
        throw httpError(502, 'GitHub is down');
      },
    });
    await expect(readSignals(octokit, LANE, SCOPE)).rejects.toThrow('GitHub is down');
  });
});
