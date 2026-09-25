import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it } from 'vitest';
import { inngest, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.mjs';
import { failing } from '../../test/github-replay.mjs';
import { FEATURE, MERGE_SHA, SUB_PULLS, mergeFiles, widgetScenario } from '../../test/retro-scenario.mjs';
import { FUNCTION_ID as OUTBOX_FUNCTION_ID } from '../outbox-check/outbox-check.mjs';
import { CONCURRENCY, FAILURE_MARKER, RETRO_FUNCTION_ID, createRetro, createRetroFailureHandler, retro } from './retro.mjs';

const BRANCH = 'docs/retro-widget';
const FOLDER = '.omni-loop/delivery/shipped/0007-widget';

function engine(scenario, { octokit = scenario.github.octokit, env = {} } = {}) {
  const fn = createRetro({ client: inngest, octokitFor: () => octokit, env });
  return new InngestTestEngine({ function: fn, events: [scenario.event] });
}

const writes = (github) => github.state.requests.filter((r) => !r.route.startsWith('GET '));

describe('retro — a merged feature PR', () => {
  it('runs its steps in order: qualify, the gathers, facts, narrate, guard, the issues, then publish', async () => {
    const scenario = widgetScenario();
    const { ctx, result, error } = await engine(scenario).execute();
    expect(error).toBeUndefined();
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual([
      'qualify',
      'gather-pulls',
      'gather-timeline',
      'gather-delivery',
      'gather-ci',
      'gather-churn',
      'facts',
      'narrate',
      'guard',
      'publish-issues',
      'publish',
    ]);
    expect(result).toMatchObject({ prd: 7, findings: 1, issues: 1, branch: BRANCH, committed: true, pr: { created: true } });
  });

  it('publishes docs/retro-<topic>, retro.md and retro.json in the PRD’s shipped folder, and a PR labelled omni:retro into main', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    const { github } = scenario;
    const files = github.filesAt(BRANCH, [`${FOLDER}/retro.md`, `${FOLDER}/retro.json`]);
    expect(files[`${FOLDER}/retro.md`]).toContain('# Retro — PRD 7, Widgets that remember their colour');
    expect(files[`${FOLDER}/retro.md`]).toContain('### F1 · Slice s3 took far longer than the others — `slow-slice:s3`');
    const doc = JSON.parse(files[`${FOLDER}/retro.json`]);
    expect(doc.runs.map((run) => [run.run, run.featurePr.number, run.featurePr.mergeSha])).toEqual([['merge', 12, MERGE_SHA]]);
    expect(doc.runs[0].kinds.timeline.waves).toEqual({ planned: 2, merged: 2 });
    const retroPr = github.state.pulls.find((pull) => pull.head.ref === BRANCH);
    expect(retroPr).toMatchObject({ base: { ref: 'main' }, labels: [{ name: 'omni:retro' }], title: 'docs(retro): PRD 7 — Widgets that remember their colour' });
  });

  it('publishes in the inbox folder a PRD merged without being shipped', async () => {
    const scenario = widgetScenario({ files: mergeFiles({ state: 'inbox' }) });
    await engine(scenario).execute();
    const path = '.omni-loop/delivery/inbox/0007-widget/retro.md';
    expect(scenario.github.filesAt(BRANCH, [path])[path]).toContain('# Retro — PRD 7');
  });

  it('writes the files, then opens the PR: the issues come first, in their own step', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    const routes = writes(scenario.github).map((r) => r.route);
    expect(routes.indexOf('POST /repos/{owner}/{repo}/git/commits')).toBeLessThan(routes.indexOf('POST /repos/{owner}/{repo}/pulls'));
  });

  it('never reads or writes a check run', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    expect(scenario.github.state.requests.filter((r) => r.route.includes('check-runs'))).toEqual([]);
  });
});

describe('retro — without prose', () => {
  it('reads "Facts only: no model key" without OPENROUTER_API_KEY', async () => {
    const scenario = widgetScenario();
    await engine(scenario, { env: {} }).execute();
    const md = scenario.github.filesAt(BRANCH, [`${FOLDER}/retro.md`])[`${FOLDER}/retro.md`];
    expect(md).toContain('\nFacts only: no model key\n');
    expect(md).toContain('model: none');
  });
});

describe('retro — what gets no retro publishes nothing', () => {
  it.each([
    ['a merged sub-PR', () => widgetScenario({ feature: { ...SUB_PULLS[0], merge_commit_sha: MERGE_SHA }, subPulls: [] })],
    ['a merged phase-0 PR', () => widgetScenario({ feature: { ...FEATURE, head: { ref: 'docs/phase-0-widget', sha: 'p0' } } })],
    ['a repository without config', () => widgetScenario({ files: mergeFiles({ config: null }) })],
  ])('%s', async (_name, make) => {
    const scenario = make();
    const { ctx, result } = await engine(scenario).execute();
    expect(result.skipped).toBeTruthy();
    expect(ctx.step.run.mock.calls.map(([id]) => id)).toEqual(['qualify']);
    expect(writes(scenario.github)).toEqual([]);
  });
});

describe('retro — a replay', () => {
  it('creates no second branch or PR; the same facts add no commit', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    const head = scenario.github.state.refs.get(`heads/${BRANCH}`);
    await engine(scenario).execute();
    expect(scenario.github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/git/refs')).toHaveLength(1);
    expect(scenario.github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/pulls')).toHaveLength(1);
    expect(scenario.github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
    expect(scenario.github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
  });

  it('adds a commit on top of the first instead of rewriting it when the retro changed', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    const first = scenario.github.state.refs.get(`heads/${BRANCH}`);
    await engine(scenario, { env: { OPENROUTER_API_KEY: 'k' } }).execute();
    const second = scenario.github.state.refs.get(`heads/${BRANCH}`);
    expect(second).not.toBe(first);
    expect(scenario.github.state.commits.get(second).parents).toEqual([{ sha: first }]);
    for (const request of scenario.github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}')) {
      expect(request.force).toBe(false);
    }
    expect(scenario.github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
  });
});

describe('retro — a GitHub failure', () => {
  it('fails the run, and after the retries leaves one comment on the merged PR', async () => {
    const scenario = widgetScenario();
    const broken = failing(scenario.github.octokit, 'POST /repos/{owner}/{repo}/git/commits');
    const { error } = await engine(scenario, { octokit: broken }).execute();
    expect(error).toBeTruthy();

    const handler = createRetroFailureHandler({ octokitFor: () => scenario.github.octokit });
    const failed = { name: 'inngest/function.failed', data: { event: scenario.event, error: { message: 'GitHub is down' } } };
    await handler({ event: failed, error: new Error('GitHub is down\nat stack') });
    await handler({ event: failed, error: new Error('GitHub is still down') });

    const comments = scenario.github.state.comments.filter((comment) => comment.issue === 12);
    expect(comments).toHaveLength(1);
    expect(comments[0].body).toBe(`${FAILURE_MARKER}\nThe retro could not run: GitHub is still down\n`);
  });
});

describe('retro — the function’s configuration', () => {
  it('is its own function, triggered by the retro event only', () => {
    expect(retro.id()).toBe(RETRO_FUNCTION_ID);
    expect(RETRO_FUNCTION_ID).not.toBe(OUTBOX_FUNCTION_ID);
    expect(retro.opts.triggers).toEqual([{ event: RETRO_EVENT }]);
    expect(retro.opts.triggers).not.toContainEqual({ event: OUTBOX_CHECK_EVENT });
  });

  it('runs one retro at a time per repository, retries, and has a failure handler', () => {
    expect(retro.opts.concurrency).toBe(CONCURRENCY);
    expect(CONCURRENCY).toEqual({ key: 'event.data.repository', limit: 1 });
    expect(retro.opts.retries).toBe(3);
    expect(typeof retro.opts.onFailure).toBe('function');
  });
});
