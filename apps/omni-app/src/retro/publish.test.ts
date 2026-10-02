import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import { MERGE_SHA, OWNER, REPO, widgetScenario } from '../../test/retro-scenario.ts';
import { publishRetro } from './publish.ts';
import { rulesSheet } from './rules.ts';
import type { RunRecord } from './retro.types.ts';

/** The stubbed GitHub, as the tests read it: its state open to look at. */
type Stub = ReturnType<typeof widgetScenario>['github'];
const scenarioOf = () => widgetScenario();

const config = parseConfig('kit: 1\n');
const prd = { number: 7, topic: 'widget', title: 'Widgets that remember their colour', folder: '.omni-loop/delivery/shipped/0007-widget', state: 'shipped' };
const pr = { number: 12, title: 'feat: widgets', url: 'https://github.com/acme/widgets/pull/12', openedAt: 'a', mergedAt: 'b', mergeSha: MERGE_SHA };

const record = (reason = 'no model key'): RunRecord => ({
  run: 'merge',
  rules: rulesSheet(),
  prd: { number: 7, title: prd.title, topic: 'widget', state: 'shipped', folder: prd.folder },
  featurePr: pr,
  kinds: { timeline: null },
  findings: [],
  narration: { model: null, reason, dropped: [] },
  issues: {},
});

const BRANCH = 'docs/retro-widget';
const MD = `${prd.folder}/retro.md`;
const JSON_PATH = `${prd.folder}/retro.json`;
const writes = (github: Stub) => github.state.requests.filter((r) => !r.route.startsWith('GET ')).map((r) => r.route);

/** The text of `path` on `branch`, as the stubbed GitHub holds it: the test fails when there is none. */
function fileAt(github: Stub, branch: string, path: string): string {
  const text = github.filesAt(branch, [path])[path];
  assertDefined(text, `${path} on ${branch}`);
  return text;
}

/** A JSON text, parsed: what it holds is unknown until a schema reads it. */
function parsedJson(text: string): unknown {
  return JSON.parse(text);
}

/** What `retro.json` on `branch` holds, as far as the tests read it. */
const RetroJsonSchema = z.object({ runs: z.array(z.looseObject({ run: z.string() })) });
const retroJsonAt = (github: Stub, branch: string) => RetroJsonSchema.parse(parsedJson(fileAt(github, branch, JSON_PATH)));

/** The sha `branch` points at: the test fails when it does not exist. */
function headOf(github: Stub, branch: string): string {
  const sha = github.state.refs.get(`heads/${branch}`);
  assertDefined(sha, `the branch ${branch}`);
  return sha;
}

/** The commit the stubbed GitHub wrote as `sha`. */
function commitAt(github: Stub, sha: string) {
  const commit = github.state.commits.get(sha);
  assertDefined(commit, `the commit ${sha}`);
  return commit;
}

type StubPull = Stub['state']['pulls'][number];

/** The pull request from `branch` that `match` accepts: the test fails when there is none. */
function pullFrom(github: Stub, branch: string, match: (pull: StubPull) => boolean = () => true): StubPull {
  const pull = github.state.pulls.find((candidate) => candidate.head.ref === branch && match(candidate));
  assertDefined(pull, `a pull request from ${branch}`);
  return pull;
}

const pullsFrom = (github: Stub, branch: string) => github.state.pulls.filter((pull) => pull.head.ref === branch);
const isRetro = (pull: StubPull) => pull.labels.some((label) => label.name === 'omni:retro');

function publishOnce(github: Stub, reason?: string) {
  return publishRetro(github.octokit, { owner: OWNER, repo: REPO, config, prd, pr, record: record(reason), prose: null });
}

describe('publish — the first run', () => {
  it('cuts the retro branch from the merge SHA, commits retro.md and retro.json on it, then opens the PR labelled for retros', async () => {
    const { github } = scenarioOf();
    const out = await publishOnce(github);

    expect(writes(github)).toEqual([
      'POST /repos/{owner}/{repo}/git/refs',
      'POST /repos/{owner}/{repo}/git/trees',
      'POST /repos/{owner}/{repo}/git/commits',
      'PATCH /repos/{owner}/{repo}/git/refs/{ref}',
      'POST /repos/{owner}/{repo}/pulls',
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
    ]);
    const cut = github.state.requests.find((r) => r.route === 'POST /repos/{owner}/{repo}/git/refs');
    expect(cut).toMatchObject({ ref: `refs/heads/${BRANCH}`, sha: MERGE_SHA });
    const commit = commitAt(github, headOf(github, BRANCH));
    expect(commit.parents).toEqual([{ sha: MERGE_SHA }]);
    expect(z.string().parse(commit.message).split('\n')[0]).toBe('docs(retro): PRD 7 — Widgets that remember their colour');

    expect(fileAt(github, BRANCH, MD)).toContain('# Retro — PRD 7, Widgets that remember their colour');
    expect(parsedJson(fileAt(github, BRANCH, JSON_PATH))).toEqual({ prd: 7, runs: [record()] });

    const retroPr = pullFrom(github, BRANCH);
    expect(retroPr).toMatchObject({ title: 'docs(retro): PRD 7 — Widgets that remember their colour', base: { ref: 'main' }, state: 'open' });
    expect(retroPr.body).toMatch(/^Refs #7\n/);
    expect(retroPr.labels).toEqual([{ name: 'omni:retro' }]);
    expect(out).toMatchObject({ branch: BRANCH, committed: true, pr: { number: retroPr.number, created: true } });
  });

  it('never force-pushes and never writes to the default branch', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    for (const request of github.state.requests.filter((r) => r.route.includes('/git/refs'))) {
      expect(request.force ?? false).toBe(false);
      expect(String(request.ref)).not.toMatch(/main$/);
    }
  });
});

describe('publish — a replay', () => {
  it('with the same facts: no second branch, no commit, no second PR — the PR body is rewritten in place', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const head = github.state.refs.get(`heads/${BRANCH}`);
    github.state.requests.length = 0;

    const out = await publishOnce(github);
    expect(writes(github)).toEqual([
      'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
    ]);
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
    expect(out).toMatchObject({ committed: false, pr: { created: false } });
  });

  it('with new facts: adds a commit on top of the last one, a fast-forward, and keeps the one PR', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = github.state.refs.get(`heads/${BRANCH}`);

    await publishOnce(github, 'the model is not asked yet');
    const second = github.state.refs.get(`heads/${BRANCH}`);
    expect(second).not.toBe(first);
    expect(commitAt(github, headOf(github, BRANCH)).parents).toEqual([{ sha: first }]);
    const patch = github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}').at(-1);
    expect(patch).toMatchObject({ ref: `heads/${BRANCH}`, sha: second, force: false });
    expect(fileAt(github, BRANCH, MD)).toContain('Facts only: the model is not asked yet');
    expect(retroJsonAt(github, BRANCH).runs).toHaveLength(1);
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
  });

  it('opens the PR a half-done run left unopened, on the branch it already cut', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    github.state.pulls = github.state.pulls.filter((pull) => pull.head.ref !== BRANCH);

    const out = await publishOnce(github);
    expect(out.pr?.created).toBe(true);
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
  });

  it('opens no second PR once the first was merged and nothing changed', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = mergeRetroPr(github, BRANCH);
    github.state.requests.length = 0;

    const out = await publishOnce(github);
    expect(writes(github)).toEqual([]);
    expect(out).toMatchObject({ committed: false, pr: { number: first.number, created: false } });
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
  });
});

/** The day-14 run's record: the after-merge kind's facts, and one `bug` finding. */
const dayRecord = (): RunRecord => ({
  ...record(),
  run: 'day-14',
  kinds: { 'after-merge': null },
  findings: [{ ref: 'F1', id: 'bug:40', kind: 'bug', source: 'after-merge', title: 'Bug #40 was reported against the PRD after the merge', happened: 'Issue #40 was opened.', evidence: [] }],
});
const DAY_BRANCH = `${BRANCH}-day-14`;

/** A person merges the retro PR from `branch`: it closes, merged, and the default branch moves to its head. */
function mergeRetroPr(github: Stub, branch: string) {
  const pull = pullFrom(github, branch, (candidate) => candidate.state === 'open');
  const head = headOf(github, branch);
  Object.assign(pull, { state: 'closed', merged_at: '2026-09-22T10:00:00Z', head: { ...pull.head, sha: head } });
  github.state.refs.set('heads/main', head);
  return pull;
}

function publishDay14(github: Stub, { earlier = [record()] }: { earlier?: RunRecord[] } = {}) {
  return publishRetro(github.octokit, { owner: OWNER, repo: REPO, config, prd, pr, record: dayRecord(), prose: null, earlier });
}

describe('publish — the day-14 run', () => {
  it('commits its record to the retro branch while the first PR is open: a fast-forward, the one PR kept', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = github.state.refs.get(`heads/${BRANCH}`);

    const out = await publishDay14(github);
    const head = commitAt(github, headOf(github, BRANCH));
    expect(head.parents).toEqual([{ sha: first }]);
    expect(head.message).toContain('The day-14 run of #12.');
    expect(retroJsonAt(github, BRANCH).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    const md = fileAt(github, BRANCH, MD);
    expect(md).toContain('runs: [merge, day-14]');
    expect(md).toContain('### F1 · Bug #40 was reported against the PRD after the merge — `bug:40`');
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
    expect(github.state.refs.has(`heads/${DAY_BRANCH}`)).toBe(false);
    expect(out).toMatchObject({ branch: BRANCH, committed: true, pr: { created: false } });
  });

  it('opens <branch>-day-14 from the default branch once the first PR was merged, and leaves the first branch alone', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    mergeRetroPr(github, BRANCH);
    const main = github.state.refs.get('heads/main');

    const out = await publishDay14(github);
    const cut = github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/git/refs').at(-1);
    expect(cut).toMatchObject({ ref: `refs/heads/${DAY_BRANCH}`, sha: main });
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(main);
    expect(commitAt(github, headOf(github, DAY_BRANCH)).parents).toEqual([{ sha: main }]);
    expect(retroJsonAt(github, DAY_BRANCH).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);

    const second = pullFrom(github, DAY_BRANCH);
    expect(second).toMatchObject({ base: { ref: 'main' }, state: 'open', labels: [{ name: 'omni:retro' }], title: 'docs(retro): PRD 7 — Widgets that remember their colour' });
    expect(github.state.pulls.filter((pull) => pull.state === 'open' && isRetro(pull))).toHaveLength(1);
    expect(out).toMatchObject({ branch: DAY_BRANCH, committed: true, pr: { number: second.number, created: true } });
  });

  it('opens <branch>-day-14 too when the first PR was closed without merging, holding the first run again', async () => {
    const { github } = scenarioOf();
    github.state.refs.set('heads/main', MERGE_SHA);
    await publishOnce(github);
    pullFrom(github, BRANCH).state = 'closed';

    const out = await publishDay14(github);
    expect(out.branch).toBe(DAY_BRANCH);
    const doc = retroJsonAt(github, DAY_BRANCH);
    expect(doc.runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    expect(doc.runs[0]).toEqual(record());
  });

  it('on a replay after <branch>-day-14 was merged: no commit, no third PR', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    mergeRetroPr(github, BRANCH);
    await publishDay14(github);
    mergeRetroPr(github, DAY_BRANCH);
    github.state.requests.length = 0;

    const out = await publishDay14(github);
    expect(writes(github)).toEqual([]);
    expect(out).toMatchObject({ branch: DAY_BRANCH, committed: false, pr: null });
    expect(github.state.pulls.filter(isRetro)).toHaveLength(2);
  });

  it('with the same facts again, adds nothing on the open PR', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    await publishDay14(github);
    const head = github.state.refs.get(`heads/${BRANCH}`);

    const out = await publishDay14(github);
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
    expect(out).toMatchObject({ committed: false, pr: { created: false } });
  });
});
