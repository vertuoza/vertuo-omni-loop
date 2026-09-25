import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it, vi } from 'vitest';
import { inngest, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.mjs';
import { failing } from '../../test/github-replay.mjs';
import { FEATURE, MERGE_SHA, SUB_PULLS, mergeFiles, widgetScenario } from '../../test/retro-scenario.mjs';
import { FUNCTION_ID as OUTBOX_FUNCTION_ID } from '../outbox-check/outbox-check.mjs';
import { DAY_14, FIX_PULLS, ISSUES, afterMergeRecording } from './kinds/after-merge.fixtures/day-14.mjs';
import { GITATTRIBUTES, UNMERGED, churnRecording } from './kinds/churn.fixtures/delivery.mjs';
import { DEFAULT_MODEL } from './narrate.mjs';
import {
  CONCURRENCY,
  FAILURE_MARKER,
  FOLLOW_UP_STEP,
  RETRO_FUNCTION_ID,
  createRetro,
  createRetroFailureHandler,
  retro,
} from './retro.mjs';

// The function the app serves reads GitHub through `installationOctokit`: here, the stubbed GitHub
// of the scenario a test puts in `served`.
const served = vi.hoisted(() => ({ octokit: null }));
vi.mock('../outbox-check/outbox-check.mjs', async (importOriginal) => ({
  ...(await importOriginal()),
  installationOctokit: async () => served.octokit,
}));

const BRANCH = 'docs/retro-widget';
const DAY_BRANCH = 'docs/retro-widget-day-14';
const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
const MD = `${FOLDER}/retro.md`;
const JSON_PATH = `${FOLDER}/retro.json`;

function engine(scenario, { octokit = scenario.github.octokit, env = {} } = {}) {
  const fn = createRetro({ client: inngest, octokitFor: () => octokit, env });
  return new InngestTestEngine({ function: fn, events: [scenario.event] });
}

/**
 * The retro with its day-14 run, its fourteen days' sleep passed at once: `onWake` runs when it
 * wakes, to change what GitHub holds in between.
 */
function followUpEngine(scenario, { env = {}, onWake = () => {} } = {}) {
  const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env, followUp: true });
  return new InngestTestEngine({ function: fn, events: [scenario.event], steps: [{ id: FOLLOW_UP_STEP, handler: onWake }] });
}

/** The widget scenario and, in the fourteen days after its merge, the bugs of the after-merge fixture and their fixes. */
function afterMergeScenario({ churn = false } = {}) {
  const scenario = widgetScenario({
    ...(churn ? { files: { ...mergeFiles(), '.gitattributes': GITATTRIBUTES } } : {}),
    subPulls: [...(churn ? [UNMERGED] : []), ...SUB_PULLS, ...FIX_PULLS],
    recording: [...(churn ? churnRecording() : []), ...afterMergeRecording()],
  });
  scenario.github.state.issues.push(...structuredClone(ISSUES));
  return scenario;
}

/** A person merges the retro PR from `branch`: it closes, merged, and the default branch moves to its head. */
function mergeRetroPr(github, branch) {
  const pull = github.state.pulls.find((candidate) => candidate.head.ref === branch && candidate.state === 'open');
  const head = github.state.refs.get(`heads/${branch}`);
  Object.assign(pull, { state: 'closed', merged_at: '2026-09-22T10:00:00Z', head: { ...pull.head, sha: head } });
  github.state.refs.set('heads/main', head);
}

const retroIssues = (github) => github.state.issues.filter((issue) => issue.labels.some((label) => label.name === 'omni:retro'));

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
    // With a key the model is asked: stubbed here, so no test reaches OpenRouter.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    try {
      await engine(scenario, { env: { OPENROUTER_API_KEY: 'k' } }).execute();
    } finally {
      vi.unstubAllGlobals();
    }
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

describe('retro — fourteen days later', () => {
  it('sleeps until the merge plus fourteen days, then runs the day-14 steps: the after-merge kind, facts, narrate, guard, the issues, publish', async () => {
    const scenario = afterMergeScenario();
    const { ctx, result, error } = await followUpEngine(scenario).execute();
    expect(error).toBeUndefined();
    expect(ctx.step.sleepUntil.mock.calls).toEqual([[FOLLOW_UP_STEP, DAY_14]]);
    expect(ctx.step.run.mock.calls.map(([id]) => id).slice(-6)).toEqual([
      'gather-after-merge-day-14',
      'facts-day-14',
      'narrate-day-14',
      'guard-day-14',
      'publish-issues-day-14',
      'publish-day-14',
    ]);
    expect(result).toMatchObject({
      prd: 7,
      findings: 1,
      issues: 1,
      branch: BRANCH,
      followUp: { findings: 2, issues: 2, branch: BRANCH, committed: true, pr: { created: false } },
    });
  });

  it('adds the "After merge" section to the open retro PR: one commit on top, the one PR kept', async () => {
    const scenario = afterMergeScenario({ churn: true });
    const { error } = await followUpEngine(scenario).execute();
    expect(error).toBeUndefined();
    const { github } = scenario;

    const [first, second] = [...github.state.commits.values()];
    expect(first.parents).toEqual([{ sha: MERGE_SHA }]);
    expect(second.parents).toEqual([{ sha: first.sha }]);
    expect(second.message).toContain('The day-14 run of #12.');
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(second.sha);
    expect(github.state.pulls.filter((pull) => pull.head.ref === BRANCH)).toHaveLength(1);
    expect(github.state.refs.has(`heads/${DAY_BRANCH}`)).toBe(false);

    const files = github.filesAt(BRANCH, [MD, JSON_PATH]);
    const doc = JSON.parse(files[JSON_PATH]);
    expect(doc.runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    const md = files[MD];
    expect(md).toContain('runs: [merge, day-14]');
    expect(md).toContain('\n## After merge\n\n- 2 `bug` issues naming #7 were opened within 14 days of the merge: 1 fixed within those days, 1 linked to churn.\n');
    expect(md).toMatch(/- \[#40\]\([^)]+\): opened 2 days after the merge, closed; fixed by \[#45\]\([^)]+\) and \[#47\]\([^)]+\); linked to `churn:src\/store\/colour\.js:8-11` \(#45\)\.\n/);
    expect(md.indexOf('## After merge')).toBeGreaterThan(md.indexOf('## Rules'));
  });

  it('counts a bug naming the PRD inside the window, and none outside it', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const doc = JSON.parse(scenario.github.filesAt(BRANCH, [JSON_PATH])[JSON_PATH]);
    const facts = doc.runs[1].kinds['after-merge'];
    expect(facts.bugs.map((bug) => [bug.number, bug.closed, bug.fixes])).toEqual([
      [40, true, [45, 47]],
      [41, false, []],
    ]);
    expect(doc.runs[1].findings.map((finding) => [finding.ref, finding.id])).toEqual([
      ['F2', 'bug:40'],
      ['F3', 'bug:41'],
    ]);
  });

  it('gives each new finding its issue, labelled for retros and never as a PRD, and links it from retro.md', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const issues = retroIssues(scenario.github);
    expect(issues.map((issue) => issue.title)).toEqual([
      'retro(PRD 7): Slice s3 took far longer than the others',
      'retro(PRD 7): Bug #40 was reported against the PRD after the merge',
      'retro(PRD 7): Bug #41 was reported against the PRD after the merge',
    ]);
    const md = scenario.github.filesAt(BRANCH, [MD])[MD];
    for (const issue of issues) {
      expect(issue.labels).toEqual([{ name: 'omni:retro' }]);
      expect(md).toContain(`[#${issue.number}](${issue.html_url})`);
    }
    expect(issues[1].body).toContain('<!-- omni-outbox-retro: prd=7 finding=bug:40 -->');
    expect(issues[1].body).toContain('\nkind: bug\n');
  });

  it('opens <branch>-day-14 when the first retro PR was merged in the meantime', async () => {
    const scenario = afterMergeScenario();
    const { github } = scenario;
    let merged = null;
    const { result, error } = await followUpEngine(scenario, {
      onWake: () => {
        mergeRetroPr(github, BRANCH);
        merged = github.state.refs.get('heads/main');
      },
    }).execute();
    expect(error).toBeUndefined();

    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(merged);
    const second = github.state.pulls.find((pull) => pull.head.ref === DAY_BRANCH);
    expect(second).toMatchObject({ base: { ref: 'main' }, state: 'open', labels: [{ name: 'omni:retro' }] });
    expect(result.followUp).toMatchObject({ branch: DAY_BRANCH, committed: true, pr: { number: second.number, created: true } });
    const head = github.state.refs.get(`heads/${DAY_BRANCH}`);
    expect(github.state.commits.get(head).parents).toEqual([{ sha: merged }]);
    const files = github.filesAt(DAY_BRANCH, [MD, JSON_PATH]);
    expect(JSON.parse(files[JSON_PATH]).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    expect(files[MD]).toContain('\n## After merge\n');
  });

  it('on a replay creates no second PR, no second issue and no new commit', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const head = scenario.github.state.refs.get(`heads/${BRANCH}`);
    const issues = retroIssues(scenario.github).length;

    const { error } = await followUpEngine(scenario).execute();
    expect(error).toBeUndefined();
    expect(scenario.github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
    expect(retroIssues(scenario.github)).toHaveLength(issues);
    expect(scenario.github.state.pulls.filter((pull) => pull.labels.some((label) => label.name === 'omni:retro'))).toHaveLength(1);
  });

  it('writes no number in retro.md that retro.json does not hold', async () => {
    const scenario = afterMergeScenario({ churn: true });
    await followUpEngine(scenario).execute();
    const files = scenario.github.filesAt(BRANCH, [MD, JSON_PATH]);
    const held = new Set(files[JSON_PATH].match(/\d+/g));
    expect((files[MD].match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
  });

  it('asks the model about the whole retro, and keeps the first run’s words when it gives none', async () => {
    const reply = {
      summary: 'The widgets shipped in the waves planned, but one slice ran far past the others.',
      findings: { 'slow-slice:s3': { title: 'One slice ran far past the others', whyItMatters: 'It held the whole feature back.' } },
      lessons: [],
    };
    const answers = [Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] }), new Response('{}', { status: 401 })];
    const fetch = vi.fn(async () => answers.shift() ?? new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    const scenario = afterMergeScenario();
    try {
      const { error } = await followUpEngine(scenario, { env: { OPENROUTER_API_KEY: 'k' } }).execute();
      expect(error).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetch).toHaveBeenCalledTimes(2);
    const asked = JSON.parse(JSON.parse(fetch.mock.calls[1][1].body).messages[1].content);
    expect(asked.findings.map((finding) => finding.id)).toEqual(['slow-slice:s3', 'bug:40', 'bug:41']);

    const files = scenario.github.filesAt(BRANCH, [MD, JSON_PATH]);
    expect(files[MD]).toContain(`\n${reply.summary}\n`);
    expect(files[MD]).toContain('### F1 · One slice ran far past the others — `slow-slice:s3`');
    expect(files[MD]).toContain(`model: ${DEFAULT_MODEL}`);
    expect(JSON.parse(files[JSON_PATH]).runs[1].narration).toEqual({ model: DEFAULT_MODEL, reason: 'model unavailable (401)', dropped: [] });
  });

  it('goes out facts only at day 14 too, without a model key', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const md = scenario.github.filesAt(BRANCH, [MD])[MD];
    expect(md).toContain('\nFacts only: no model key\n');
    expect(md).toContain('model: none');
  });

  it('never sleeps when built without its day-14 run, nor when no kind takes part in it', async () => {
    const plain = await engine(widgetScenario()).execute();
    expect(plain.ctx.step.sleepUntil).not.toHaveBeenCalled();

    const scenario = widgetScenario();
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env: {}, followUp: true, kinds: [] });
    const { ctx, error } = await new InngestTestEngine({ function: fn, events: [scenario.event] }).execute();
    expect(error).toBeUndefined();
    expect(ctx.step.sleepUntil).not.toHaveBeenCalled();
  });

  it('is part of the function the app serves', async () => {
    const scenario = afterMergeScenario();
    served.octokit = scenario.github.octokit;
    vi.stubEnv('OPENROUTER_API_KEY', '');
    try {
      const { ctx, result, error } = await new InngestTestEngine({
        function: retro,
        events: [scenario.event],
        steps: [{ id: FOLLOW_UP_STEP, handler() {} }],
      }).execute();
      expect(error).toBeUndefined();
      expect(ctx.step.sleepUntil.mock.calls).toEqual([[FOLLOW_UP_STEP, DAY_14]]);
      expect(result.followUp).toMatchObject({ findings: 2, issues: 2 });
    } finally {
      vi.unstubAllEnvs();
      served.octokit = null;
    }
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
