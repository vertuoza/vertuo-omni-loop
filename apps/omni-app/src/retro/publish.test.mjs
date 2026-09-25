import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.mjs';
import { MERGE_SHA, OWNER, REPO, widgetScenario } from '../../test/retro-scenario.mjs';
import { publishRetro } from './publish.mjs';
import { rulesSheet } from './rules.mjs';

const config = parseConfig('kit: 1\n');
const prd = { number: 7, topic: 'widget', title: 'Widgets that remember their colour', folder: '.omni-loop/delivery/shipped/0007-widget', state: 'shipped' };
const pr = { number: 12, title: 'feat: widgets', url: 'https://github.com/acme/widgets/pull/12', openedAt: 'a', mergedAt: 'b', mergeSha: MERGE_SHA };

const record = (reason = 'no model key') => ({
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
const writes = (github) => github.state.requests.filter((r) => !r.route.startsWith('GET ')).map((r) => r.route);

async function publishOnce(github, reason) {
  return publishRetro(github.octokit, { owner: OWNER, repo: REPO, config, prd, pr, record: record(reason), prose: null });
}

describe('publish — the first run', () => {
  it('cuts the retro branch from the merge SHA, commits retro.md and retro.json on it, then opens the PR labelled for retros', async () => {
    const { github } = widgetScenario();
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
    const commit = github.state.commits.get(github.state.refs.get(`heads/${BRANCH}`));
    expect(commit.parents).toEqual([{ sha: MERGE_SHA }]);
    expect(commit.message.split('\n')[0]).toBe('docs(retro): PRD 7 — Widgets that remember their colour');

    const files = github.filesAt(BRANCH, [MD, JSON_PATH]);
    expect(files[MD]).toContain('# Retro — PRD 7, Widgets that remember their colour');
    expect(JSON.parse(files[JSON_PATH])).toEqual({ prd: 7, runs: [record()] });

    const retroPr = github.state.pulls.find((pull) => pull.head.ref === BRANCH);
    expect(retroPr).toMatchObject({ title: 'docs(retro): PRD 7 — Widgets that remember their colour', base: { ref: 'main' }, state: 'open' });
    expect(retroPr.body).toMatch(/^Refs #7\n/);
    expect(retroPr.labels).toEqual([{ name: 'omni:retro' }]);
    expect(out).toMatchObject({ branch: BRANCH, committed: true, pr: { number: retroPr.number, created: true } });
  });

  it('never force-pushes and never writes to the default branch', async () => {
    const { github } = widgetScenario();
    await publishOnce(github);
    for (const request of github.state.requests.filter((r) => r.route.includes('/git/refs'))) {
      expect(request.force ?? false).toBe(false);
      expect(`${request.ref}`).not.toMatch(/main$/);
    }
  });
});

describe('publish — a replay', () => {
  it('with the same facts: no second branch, no commit, no second PR — the PR body is rewritten in place', async () => {
    const { github } = widgetScenario();
    await publishOnce(github);
    const head = github.state.refs.get(`heads/${BRANCH}`);
    github.state.requests.length = 0;

    const out = await publishOnce(github);
    expect(writes(github)).toEqual([
      'PATCH /repos/{owner}/{repo}/pulls/{pull_number}',
      'POST /repos/{owner}/{repo}/issues/{issue_number}/labels',
    ]);
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
    expect(github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
    expect(out).toMatchObject({ committed: false, pr: { created: false } });
  });

  it('with new facts: adds a commit on top of the last one, a fast-forward, and keeps the one PR', async () => {
    const { github } = widgetScenario();
    await publishOnce(github);
    const first = github.state.refs.get(`heads/${BRANCH}`);

    await publishOnce(github, 'the model is not asked yet');
    const second = github.state.refs.get(`heads/${BRANCH}`);
    expect(second).not.toBe(first);
    expect(github.state.commits.get(second).parents).toEqual([{ sha: first }]);
    const patch = github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}').at(-1);
    expect(patch).toMatchObject({ ref: `heads/${BRANCH}`, sha: second, force: false });
    expect(github.filesAt(BRANCH, [MD])[MD]).toContain('Facts only: the model is not asked yet');
    expect(JSON.parse(github.filesAt(BRANCH, [JSON_PATH])[JSON_PATH]).runs).toHaveLength(1);
    expect(github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
  });

  it('opens the PR a half-done run left unopened, on the branch it already cut', async () => {
    const { github } = widgetScenario();
    await publishOnce(github);
    github.state.pulls = github.state.pulls.filter((pull) => pull.head.ref !== BRANCH);

    const out = await publishOnce(github);
    expect(out.pr.created).toBe(true);
    expect(github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
  });
});
