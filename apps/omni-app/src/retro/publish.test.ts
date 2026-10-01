import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { MERGE_SHA, OWNER, REPO, widgetScenario } from '../../test/retro-scenario.ts';
import { publishRetro } from './publish.ts';
import { rulesSheet } from './rules.ts';
import type { Octokit, RunRecord } from './retro.types.ts';

/** The stubbed GitHub, as the tests read it: its state open to look at. */
type Stub = { octokit: Octokit; state: any; filesAt: (branch: string, paths: string[]) => Record<string, any> };
const scenarioOf = () => widgetScenario() as unknown as { github: Stub };

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
const writes = (github: Stub) => github.state.requests.filter((r: any) => !r.route.startsWith('GET ')).map((r: any) => r.route);

async function publishOnce(github: Stub, reason?: string) {
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
    const cut = github.state.requests.find((r: any) => r.route === 'POST /repos/{owner}/{repo}/git/refs');
    expect(cut).toMatchObject({ ref: `refs/heads/${BRANCH}`, sha: MERGE_SHA });
    const commit = github.state.commits.get(github.state.refs.get(`heads/${BRANCH}`));
    expect(commit.parents).toEqual([{ sha: MERGE_SHA }]);
    expect(commit.message.split('\n')[0]).toBe('docs(retro): PRD 7 — Widgets that remember their colour');

    const files = github.filesAt(BRANCH, [MD, JSON_PATH]);
    expect(files[MD]).toContain('# Retro — PRD 7, Widgets that remember their colour');
    expect(JSON.parse(files[JSON_PATH])).toEqual({ prd: 7, runs: [record()] });

    const retroPr = github.state.pulls.find((pull: any) => pull.head.ref === BRANCH);
    expect(retroPr).toMatchObject({ title: 'docs(retro): PRD 7 — Widgets that remember their colour', base: { ref: 'main' }, state: 'open' });
    expect(retroPr.body).toMatch(/^Refs #7\n/);
    expect(retroPr.labels).toEqual([{ name: 'omni:retro' }]);
    expect(out).toMatchObject({ branch: BRANCH, committed: true, pr: { number: retroPr.number, created: true } });
  });

  it('never force-pushes and never writes to the default branch', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    for (const request of github.state.requests.filter((r: any) => r.route.includes('/git/refs'))) {
      expect(request.force ?? false).toBe(false);
      expect(`${request.ref}`).not.toMatch(/main$/);
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
    expect(github.state.pulls.filter((pull: any) => pull.head.ref === BRANCH)).toHaveLength(1);
    expect(out).toMatchObject({ committed: false, pr: { created: false } });
  });

  it('with new facts: adds a commit on top of the last one, a fast-forward, and keeps the one PR', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = github.state.refs.get(`heads/${BRANCH}`);

    await publishOnce(github, 'the model is not asked yet');
    const second = github.state.refs.get(`heads/${BRANCH}`);
    expect(second).not.toBe(first);
    expect(github.state.commits.get(second).parents).toEqual([{ sha: first }]);
    const patch = github.state.requests.filter((r: any) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}').at(-1);
    expect(patch).toMatchObject({ ref: `heads/${BRANCH}`, sha: second, force: false });
    expect(github.filesAt(BRANCH, [MD])[MD]).toContain('Facts only: the model is not asked yet');
    expect(JSON.parse(github.filesAt(BRANCH, [JSON_PATH])[JSON_PATH]).runs).toHaveLength(1);
    expect(github.state.pulls.filter((pull: any) => pull.head.ref === BRANCH)).toHaveLength(1);
  });

  it('opens the PR a half-done run left unopened, on the branch it already cut', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    github.state.pulls = github.state.pulls.filter((pull: any) => pull.head.ref !== BRANCH);

    const out = await publishOnce(github);
    expect(out.pr?.created).toBe(true);
    expect(github.state.pulls.filter((pull: any) => pull.head.ref === BRANCH)).toHaveLength(1);
  });

  it('opens no second PR once the first was merged and nothing changed', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = mergeRetroPr(github, BRANCH);
    github.state.requests.length = 0;

    const out = await publishOnce(github);
    expect(writes(github)).toEqual([]);
    expect(out).toMatchObject({ committed: false, pr: { number: first.number, created: false } });
    expect(github.state.pulls.filter((pull: any) => pull.head.ref === BRANCH)).toHaveLength(1);
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
  const pull = github.state.pulls.find((candidate: any) => candidate.head.ref === branch && candidate.state === 'open');
  Object.assign(pull, { state: 'closed', merged_at: '2026-09-22T10:00:00Z', head: { ...pull.head, sha: github.state.refs.get(`heads/${branch}`) } });
  github.state.refs.set('heads/main', github.state.refs.get(`heads/${branch}`));
  return pull;
}

async function publishDay14(github: Stub, { earlier = [record()] }: { earlier?: RunRecord[] } = {}) {
  return publishRetro(github.octokit, { owner: OWNER, repo: REPO, config, prd, pr, record: dayRecord(), prose: null, earlier });
}

describe('publish — the day-14 run', () => {
  it('commits its record to the retro branch while the first PR is open: a fast-forward, the one PR kept', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    const first = github.state.refs.get(`heads/${BRANCH}`);

    const out = await publishDay14(github);
    const head = github.state.refs.get(`heads/${BRANCH}`);
    expect(github.state.commits.get(head).parents).toEqual([{ sha: first }]);
    expect(github.state.commits.get(head).message).toContain('The day-14 run of #12.');
    expect(JSON.parse(github.filesAt(BRANCH, [JSON_PATH])[JSON_PATH]).runs.map((run: any) => run.run)).toEqual(['merge', 'day-14']);
    const md = github.filesAt(BRANCH, [MD])[MD];
    expect(md).toContain('runs: [merge, day-14]');
    expect(md).toContain('### F1 · Bug #40 was reported against the PRD after the merge — `bug:40`');
    expect(github.state.pulls.filter((pull: any) => pull.head.ref === BRANCH)).toHaveLength(1);
    expect(github.state.refs.has(`heads/${DAY_BRANCH}`)).toBe(false);
    expect(out).toMatchObject({ branch: BRANCH, committed: true, pr: { created: false } });
  });

  it('opens <branch>-day-14 from the default branch once the first PR was merged, and leaves the first branch alone', async () => {
    const { github } = scenarioOf();
    await publishOnce(github);
    mergeRetroPr(github, BRANCH);
    const main = github.state.refs.get('heads/main');

    const out = await publishDay14(github);
    const cut = github.state.requests.filter((r: any) => r.route === 'POST /repos/{owner}/{repo}/git/refs').at(-1);
    expect(cut).toMatchObject({ ref: `refs/heads/${DAY_BRANCH}`, sha: main });
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(main);
    const head = github.state.refs.get(`heads/${DAY_BRANCH}`);
    expect(github.state.commits.get(head).parents).toEqual([{ sha: main }]);
    expect(JSON.parse(github.filesAt(DAY_BRANCH, [JSON_PATH])[JSON_PATH]).runs.map((run: any) => run.run)).toEqual(['merge', 'day-14']);

    const second = github.state.pulls.find((pull: any) => pull.head.ref === DAY_BRANCH);
    expect(second).toMatchObject({ base: { ref: 'main' }, state: 'open', labels: [{ name: 'omni:retro' }], title: 'docs(retro): PRD 7 — Widgets that remember their colour' });
    expect(github.state.pulls.filter((pull: any) => pull.state === 'open' && pull.labels.some((label: any) => label.name === 'omni:retro'))).toHaveLength(1);
    expect(out).toMatchObject({ branch: DAY_BRANCH, committed: true, pr: { number: second.number, created: true } });
  });

  it('opens <branch>-day-14 too when the first PR was closed without merging, holding the first run again', async () => {
    const { github } = scenarioOf();
    github.state.refs.set('heads/main', MERGE_SHA);
    await publishOnce(github);
    github.state.pulls.find((pull: any) => pull.head.ref === BRANCH).state = 'closed';

    const out = await publishDay14(github);
    expect(out.branch).toBe(DAY_BRANCH);
    const doc = JSON.parse(github.filesAt(DAY_BRANCH, [JSON_PATH])[JSON_PATH]);
    expect(doc.runs.map((run: any) => run.run)).toEqual(['merge', 'day-14']);
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
    expect(github.state.pulls.filter((pull: any) => pull.labels.some((label: any) => label.name === 'omni:retro'))).toHaveLength(2);
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
