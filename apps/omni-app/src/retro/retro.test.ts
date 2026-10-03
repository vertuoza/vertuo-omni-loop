import { InngestTestEngine, mockCtx } from '@inngest/test';
import { internalEvents } from 'inngest';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { inngest, OUTBOX_CHECK_EVENT, RETRO_EVENT } from '../inngest-client.ts';
import { failing } from '../../test/github-replay.ts';
import { savingRun, savingSteps } from '../../test/saved-steps.ts';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import {
  FEATURE,
  JUDGE_ENV,
  KEPT_LESSON,
  KEPT_WHY,
  KNOWLEDGE_FILES,
  MERGE_SHA,
  SUB_PULLS,
  judge as judgeOf,
  mergeFiles,
  widgetScenario,
} from '../../test/retro-scenario.ts';
import { FUNCTION_ID as OUTBOX_FUNCTION_ID } from '../outbox-check/outbox-check.ts';
import { DAY_14, FIX_PULLS, ISSUES, MERGED_AT, afterMergeRecording } from './kinds/after-merge.fixtures/day-14.ts';
import { GITATTRIBUTES, UNMERGED, churnRecording } from './kinds/churn.fixtures/delivery.ts';
import {
  CLOCK_STEP,
  CONCURRENCY,
  DAILY,
  DAY_EVENT,
  DAY_STEP,
  DAY_WAIT,
  FAILURE_MARKER,
  FOLLOW_UP_STEP,
  RETRO_FUNCTION_ID,
  VERDICT_MARKER,
  createRetro,
  createRetroFailureHandler,
  gatherKnowledge,
  lessonsIn,
  retro,
} from './retro.ts';
import type { Octokit } from './retro.types.ts';

/** The stubbed GitHub and the scenario, as the tests read them: their state open to look at. */
type Scenario = ReturnType<typeof widgetScenario>;
type Stub = Scenario['github'];
/** The scenario's judge: a stubbed fetch that keeps what it was asked. */
type Judge = typeof fetch & { asked: unknown[] };
/** The step tools a run used, as the test engine mocked them: each call kept. */
type Ctx = {
  step: {
    run: Mock<(id: string, ...rest: unknown[]) => unknown>;
    waitForEvent: Mock<(id: string, options: { event: string; timeout: number }) => unknown>;
    sleep: Mock;
    sleepUntil: Mock;
    sendEvent: Mock;
  };
};
/** What a test engine's run gives back: its mocked step tools, its result and its error. */
type Ran = { ctx: Ctx; result: unknown; error: unknown };
type Engine = { execute(): Promise<Ran> };
type Days = { steps: { id: string; handler: () => unknown }[]; waits: Record<string, () => unknown> };
type Env = Record<string, string | undefined>;

const judge = (options?: Parameters<typeof judgeOf>[0]): Judge => judgeOf(options);
const testEngine = (options: InngestTestEngine.Options): Engine => new InngestTestEngine(options) as unknown as Engine;

// The function the app serves reads GitHub through `installationOctokit`: here, the stubbed GitHub
// of the scenario a test puts in `served`.
const served = vi.hoisted((): { octokit: unknown } => ({ octokit: null }));
vi.mock('../outbox-check/outbox-check.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  installationOctokit: () => Promise.resolve(served.octokit),
}));

/** The id of every step a run ran, in order. */
const ranSteps = (ctx: Ctx): string[] => ctx.step.run.mock.calls.map(([id]) => id);

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

/** What `retro.json` holds, as far as the tests read it. */
const RetroJsonSchema = z.object({
  runs: z.array(
    z.object({
      run: z.string(),
      featurePr: z.object({ number: z.number(), mergeSha: z.string() }),
      kinds: z.record(z.string(), z.unknown()),
      findings: z.array(z.object({ ref: z.string(), id: z.string() })),
      verdict: z.unknown(),
      lessons: z.unknown(),
    }),
  ),
});
type RetroJson = z.infer<typeof RetroJsonSchema>;
const retroJsonAt = (github: Stub, branch: string): RetroJson => RetroJsonSchema.parse(parsedJson(fileAt(github, branch, JSON_PATH)));

/** Run `index` of a `retro.json`: the test fails when there is none. */
function runAt(doc: RetroJson, index: number): RetroJson['runs'][number] {
  const run = doc.runs[index];
  assertDefined(run, `run ${String(index)} of retro.json`);
  return run;
}

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
const isRetro = (item: { labels: { name: string }[] }) => item.labels.some((label) => label.name === 'omni:retro');

/** The triggers an Inngest function was created with. */
const triggersOf = (fn: { opts: unknown }) =>
  z.object({ triggers: z.array(z.looseObject({ event: z.string().optional() })) }).parse(fn.opts).triggers;

const BRANCH = 'docs/retro-widget';
const DAY_BRANCH = 'docs/retro-widget-day-14';
const FOLDER = '.omni-loop/delivery/shipped/0007-widget';
const MD = `${FOLDER}/retro.md`;
const JSON_PATH = `${FOLDER}/retro.json`;

/** The retro against the scenario's GitHub; its judge, by default, keeps every finding. */
function engine(
  scenario: Scenario,
  { octokit = scenario.github.octokit, env = JUDGE_ENV, fetch = judge() }: { octokit?: Octokit; env?: Env; fetch?: typeof globalThis.fetch } = {},
): Engine {
  const fn = createRetro({ client: inngest, octokitFor: () => octokit, env, fetch });
  return testEngine({ function: fn, events: [scenario.event] });
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The longest any sleep or wait may last on the app's Inngest plan (answered on #75). */
const PLAN_CAP = 7 * DAY_MS;
const daysAfterMerge = (days: number) => Date.parse(MERGED_AT) + days * DAY_MS;

/** The tick the retro's daily schedule sends, as a wait receives it. */
const tick = (ts: number) => ({ name: DAY_EVENT, data: {}, id: `tick-${ts}`, ts });
const waitStep = (turn: number) => `${FOLLOW_UP_STEP}-${turn}`;

/**
 * The fourteen days, passed at once: the clock reads the merge (`steps`), and the first wait ends
 * on the tick of the fourteenth day (`waits`). `onWake` runs when it wakes, to change what GitHub
 * holds in between.
 */
const fourteenDays = (onWake: () => void = () => {}): Days => ({
  steps: [{ id: CLOCK_STEP, handler: () => Date.parse(MERGED_AT) }],
  waits: { [waitStep(1)]: () => (onWake(), tick(Date.parse(DAY_14))) },
});

/**
 * Answers the run's waits by step id. `@inngest/test` hands a mocked `waitForEvent` its answer as a
 * promise, which the SDK then refuses as an event, so the waits are answered in the step tools
 * themselves, each once however often the run replays; a wait nobody answers fails the run.
 */
function answering(waits: Record<string, () => unknown>) {
  const given = new Map<string, unknown>();
  return (ctx: Parameters<typeof mockCtx>[0]): ReturnType<typeof mockCtx> => {
    const mocked = mockCtx(ctx);
    const waitForEvent = mocked.step.waitForEvent as unknown as Mock<(id: string) => Promise<unknown>>;
    waitForEvent.mockImplementation((id: string) => {
      const answer = waits[id];
      if (answer === undefined) return Promise.reject(new Error(`nobody answers the wait ${id}`));
      if (!given.has(id)) given.set(id, answer());
      return Promise.resolve(given.get(id));
    });
    return mocked;
  };
}

/** A retro's test engine, its fourteen days passed as `days` says. */
function daysEngine(fn: InngestTestEngine.Options['function'], event: NonNullable<InngestTestEngine.Options['events']>[number], { steps, waits: answers }: Days): Engine {
  return testEngine({ function: fn, events: [event], steps, transformCtx: answering(answers) });
}

/** The retro with its day-14 run, its fourteen days passed as `days` says. */
function followUpEngine(
  scenario: Scenario,
  {
    env = JUDGE_ENV,
    fetch = judge(),
    onWake = () => {},
    days = fourteenDays(onWake),
  }: { env?: Env; fetch?: typeof globalThis.fetch; onWake?: () => void; days?: Days } = {},
): Engine {
  const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env, fetch, followUp: true });
  return daysEngine(fn, scenario.event, days);
}

/** Every wait the run made, as [id, options]. */
const waits = (ctx: Ctx) => ctx.step.waitForEvent.mock.calls;

const DAY_14_STEPS = [
  'gather-after-merge-day-14',
  'facts-day-14',
  'narrate-day-14',
  'guard-day-14',
  'publish-issues-day-14',
  'publish-day-14',
];

/** The widget scenario and, in the fourteen days after its merge, the bugs of the after-merge fixture and their fixes. */
function afterMergeScenario({ churn = false }: { churn?: boolean } = {}): Scenario {
  const scenario = widgetScenario({
    ...(churn ? { files: { ...mergeFiles(), '.gitattributes': GITATTRIBUTES } } : {}),
    subPulls: [...(churn ? [UNMERGED] : []), ...SUB_PULLS, ...FIX_PULLS],
    recording: [...(churn ? churnRecording() : []), ...afterMergeRecording()],
  });
  scenario.github.state.issues.push(...structuredClone(ISSUES));
  return scenario;
}

/** A person merges the retro PR from `branch`: it closes, merged, and the default branch moves to its head. */
function mergeRetroPr(github: Stub, branch: string): void {
  const pull = pullFrom(github, branch, (candidate) => candidate.state === 'open');
  const head = headOf(github, branch);
  Object.assign(pull, { state: 'closed', merged_at: '2026-09-22T10:00:00Z', head: { ...pull.head, sha: head } });
  github.state.refs.set('heads/main', head);
}

const retroIssues = (github: Stub) => github.state.issues.filter(isRetro);

const writes = (github: Stub) => github.state.requests.filter((r) => !r.route.startsWith('GET '));

/** The verdict comments on the merged feature PR. */
const verdictComments = (github: Stub) => github.state.comments.filter((comment) => comment.issue === 12 && comment.body.includes(VERDICT_MARKER));

/** Nothing of a retro PR: no ref created, no pull request, no issue. */
function expectNothingPublished(github: Stub): void {
  expect(github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/git/refs')).toEqual([]);
  expect(github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/pulls')).toEqual([]);
  expect(github.state.requests.filter((r) => r.route === 'POST /repos/{owner}/{repo}/issues')).toEqual([]);
  expect(github.state.refs.has(`heads/${BRANCH}`)).toBe(false);
}

describe('retro — a merged feature PR', () => {
  it('runs its steps in order: qualify, the gathers, facts, narrate, guard, the issues, then publish', async () => {
    const scenario = widgetScenario();
    const { ctx, result, error } = await engine(scenario).execute();
    expect(error).toBeUndefined();
    expect(ranSteps(ctx)).toEqual([
      'qualify',
      'gather-pulls',
      'gather-timeline',
      'gather-delivery',
      'gather-ci',
      'gather-churn',
      'facts',
      'gather-knowledge',
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
    const md = fileAt(github, BRANCH, `${FOLDER}/retro.md`);
    expect(md).toContain('# Retro — PRD 7, Widgets that remember their colour');
    expect(md).toContain('### F1 · Slice s3 took far longer than the others — `slow-slice:s3`');
    const doc = retroJsonAt(github, BRANCH);
    expect(doc.runs.map((run) => [run.run, run.featurePr.number, run.featurePr.mergeSha])).toEqual([['merge', 12, MERGE_SHA]]);
    expect(z.object({ waves: z.unknown() }).parse(runAt(doc, 0).kinds.timeline).waves).toEqual({ planned: 2, merged: 2 });
    const retroPr = pullFrom(github, BRANCH);
    expect(retroPr).toMatchObject({ base: { ref: 'main' }, labels: [{ name: 'omni:retro' }], title: 'docs(retro): PRD 7 — Widgets that remember their colour' });
  });

  it('publishes in the shipped folder a PRD merged without being shipped', async () => {
    const scenario = widgetScenario({ files: mergeFiles({ state: 'inbox' }) });
    await engine(scenario).execute();
    const path = '.omni-loop/delivery/shipped/0007-widget/retro.md';
    expect(scenario.github.filesAt(BRANCH, [path])[path]).toContain('# Retro — PRD 7');
    expect(scenario.github.state.issues.map((issue) => issue.body)).toEqual([expect.stringContaining(`\nretro: ${path}\n`)]);
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

describe('retro — judged worth a pull request', () => {
  /** The widget scenario with the churn recording: four findings, of which the judge keeps the slow slice only. */
  function churnScenario() {
    return widgetScenario({
      files: { ...mergeFiles(), '.gitattributes': GITATTRIBUTES },
      subPulls: [UNMERGED, ...SUB_PULLS],
      recording: churnRecording(),
    });
  }
  const keepSlow = () => judge({ keep: (id: string) => id === 'slow-slice:s3' });

  it('publishes the branch, retro.md with the kept finding marked and judge: 1, retro.json and the PR, and issues for kept findings only', async () => {
    const scenario = churnScenario();
    const { result, error } = await engine(scenario, { fetch: keepSlow() }).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ findings: 4, issues: 1, branch: BRANCH, committed: true, pr: { created: true } });

    const { github } = scenario;
    const md = fileAt(github, BRANCH, MD);
    expect(md).toContain('\njudge: 1\n');
    expect(md.match(/- \*\*Kept:\*\* /g)).toHaveLength(1);
    expect(md).toContain(`- **Proposed lesson:** ${KEPT_LESSON}\n- **Kept:** ${KEPT_WHY}\n`);
    expect(md).toContain('— `churn:src/store/colour.js:8-11`');

    const first = runAt(retroJsonAt(github, BRANCH), 0);
    expect(first.verdict).toEqual({ worthIt: true, reason: 'One lesson is new.' });
    expect(first.lessons).toEqual([{ text: KEPT_LESSON, findings: ['slow-slice:s3'] }]);

    expect(retroIssues(github).map((issue) => issue.title)).toEqual(['retro(PRD 7): Slice s3 took far longer than the others']);
    expect(retroIssues(github)[0]?.body).toContain(`## Why it is kept\n\n${KEPT_WHY}\n`);
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
    expect(verdictComments(github)).toEqual([]);
  });
});

describe('retro — judged not worth a pull request', () => {
  it('creates no ref, no PR and no issue: one comment on the feature PR, "Retro: no new lesson", the timeline and each finding', async () => {
    const scenario = widgetScenario();
    const { ctx, result, error } = await engine(scenario, { fetch: judge({ worthIt: false, reason: 'A slow slice is a known pattern.' }) }).execute();
    expect(error).toBeUndefined();
    expect(ranSteps(ctx).slice(-3)).toEqual(['narrate', 'guard', 'verdict']);
    expect(result).toMatchObject({ prd: 7, findings: 1, issues: 0, verdict: 'no new lesson', comment: { created: true } });

    expectNothingPublished(scenario.github);
    const comments = verdictComments(scenario.github);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toBe(
      [
        VERDICT_MARKER,
        'Retro: no new lesson — A slow slice is a known pattern.',
        '',
        '- Feature PR #12: 180 minutes from open to merge.',
        '- 3 slices in 2 waves as merged, 2 planned.',
        '',
        '- F1 · Slice s3 took far longer than the others — `slow-slice:s3`',
        '',
      ].join('\n'),
    );
  });

  it('without a model key is not judged: the same quiet path, "Retro: not judged — no model key"', async () => {
    const scenario = widgetScenario();
    const { result, error } = await engine(scenario, { env: {} }).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ findings: 1, issues: 0, verdict: 'not judged' });
    expectNothingPublished(scenario.github);
    const [comment, ...more] = verdictComments(scenario.github);
    expect(more).toEqual([]);
    expect(comment?.body).toMatch(/^<!-- omni-outbox-retro-verdict -->\nRetro: not judged — no model key\n\n- Feature PR #12: /);
  });

  it('is not judged when the verdict is refused, and says why', async () => {
    const scenario = widgetScenario();
    await engine(scenario, { fetch: judge({ reason: 'Worth it, see https://example.com.' }) }).execute();
    expectNothingPublished(scenario.github);
    expect(verdictComments(scenario.github)[0]?.body).toContain(
      '\nRetro: not judged — the verdict was refused: it carries a link that is not evidence\n',
    );
  });

  it('on a replay edits the one comment in place, never a second', async () => {
    const scenario = widgetScenario();
    await engine(scenario, { fetch: judge({ worthIt: false }) }).execute();
    await engine(scenario, { env: {} }).execute();
    const comments = verdictComments(scenario.github);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toContain('\nRetro: not judged — no model key\n');
    expect(scenario.github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}')).toHaveLength(1);
    expectNothingPublished(scenario.github);
  });
});

describe('retro — what the judge is given', () => {
  it('reads the knowledge summary and the earlier retros’ lessons at the merge commit, and hands them to the model', async () => {
    const scenario = widgetScenario({ files: { ...mergeFiles(), ...KNOWLEDGE_FILES } });
    const fetch = judge();
    const { error } = await engine(scenario, { fetch }).execute();
    expect(error).toBeUndefined();
    const asked = z.object({ knowledge: z.unknown(), earlierLessons: z.unknown() }).parse(fetch.asked[0]);
    expect(asked.knowledge).toEqual([
      { id: 'P-PRODUCT-1', line: 'A widget keeps what a person chose for it.' },
      { id: 'ADR-0001', line: 'ADR-0001 — Colours are stored per widget' },
    ]);
    expect(asked.earlierLessons).toEqual(['Answer decisions before the wave that builds on them.']);
  });

  it('gives nothing to compare with in a repository without knowledge or earlier retros', async () => {
    const scenario = widgetScenario();
    const config = mergeFiles()['.omni-loop/config.yml'];
    assertDefined(config, 'the scenario config');
    const out = await gatherKnowledge(scenario.github.octokit, { owner: 'acme', repo: 'widgets', sha: MERGE_SHA, config: parseConfig(config) });
    expect(out).toEqual({ knowledge: { principles: [], laws: [], decisions: [] }, lessons: [] });
  });

  it('lessonsIn: every run’s lessons, in order, each once; a file that is not JSON gives none', () => {
    const doc = (texts: string[]) => JSON.stringify({ runs: [{ lessons: texts.map((text) => ({ text, findings: [] })) }, { run: 'day-14' }] });
    expect(lessonsIn([doc(['A', 'B']), 'not json', null, doc(['B', 'C'])])).toEqual(['A', 'B', 'C']);
  });
});

describe('retro — what gets no retro publishes nothing', () => {
  it.each([
    [
      'a merged sub-PR',
      () => {
        const [sub] = SUB_PULLS;
        assertDefined(sub, 'the first sub-PR');
        return widgetScenario({ feature: { ...sub, merge_commit_sha: MERGE_SHA }, subPulls: [] });
      },
    ],
    ['a merged phase-0 PR', () => widgetScenario({ feature: { ...FEATURE, head: { ref: 'docs/phase-0-widget', sha: 'p0' } } })],
    ['a repository without config', () => widgetScenario({ files: mergeFiles({ config: null }) })],
  ])('%s', async (_name, make) => {
    const scenario = make();
    const { ctx, result } = await engine(scenario).execute();
    expect(z.object({ skipped: z.unknown() }).parse(result).skipped).toBeTruthy();
    expect(ranSteps(ctx)).toEqual(['qualify']);
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
    expect(pullsFrom(scenario.github, BRANCH)).toHaveLength(1);
    expect(scenario.github.state.refs.get(`heads/${BRANCH}`)).toBe(head);
  });

  it('adds a commit on top of the first instead of rewriting it when the retro changed', async () => {
    const scenario = widgetScenario();
    await engine(scenario).execute();
    const first = scenario.github.state.refs.get(`heads/${BRANCH}`);
    // The judge, asked again, words its summary another way.
    await engine(scenario, { fetch: judge({ summary: 'The widgets shipped; one slice held the feature back.' }) }).execute();
    const second = scenario.github.state.refs.get(`heads/${BRANCH}`);
    expect(second).not.toBe(first);
    expect(commitAt(scenario.github, headOf(scenario.github, BRANCH)).parents).toEqual([{ sha: first }]);
    for (const request of scenario.github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}')) {
      expect(request.force).toBe(false);
    }
    expect(pullsFrom(scenario.github, BRANCH)).toHaveLength(1);
  });
});

describe('retro — every step read back as Inngest saved it (s19-01)', () => {
  const MERGE_STEPS = ['qualify', 'gather-pulls', 'gather-timeline', 'gather-delivery', 'gather-ci', 'gather-churn', 'facts', 'gather-knowledge', 'narrate', 'guard'];

  /** The retro against `scenario`, each step's value saved as JSON and read back, the ids of the steps that were added to `saved`. */
  function savingEngine(
    scenario: Scenario,
    saved: string[],
    { env = JUDGE_ENV, followUp = false, alter }: { env?: Env; followUp?: boolean; alter?: (id: string, value: unknown) => unknown } = {},
  ): Engine {
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env, fetch: judge(), followUp });
    // A wait, if the clock asks for one, ends on the tick of the fourteenth day.
    const transformCtx = followUp ? (ctx: Parameters<typeof mockCtx>[0]) => answering(fourteenDays().waits)(savingRun(ctx, saved, alter)) : savingSteps(saved, alter);
    return testEngine({ function: fn, events: [scenario.event], transformCtx });
  }

  it('parses every step of a run worth a pull request, once saved, and writes the same retro as before', async () => {
    const plain = widgetScenario();
    await engine(plain).execute();
    const scenario = widgetScenario();
    const saved: string[] = [];
    const { result, error } = await savingEngine(scenario, saved).execute();
    expect(error).toBeUndefined();
    expect(saved).toEqual([...MERGE_STEPS, 'publish-issues', 'publish']);
    expect(result).toMatchObject({ prd: 7, findings: 1, issues: 1, branch: BRANCH, committed: true });
    expect(fileAt(scenario.github, BRANCH, MD)).toBe(fileAt(plain.github, BRANCH, MD));
    expect(fileAt(scenario.github, BRANCH, JSON_PATH)).toBe(fileAt(plain.github, BRANCH, JSON_PATH));
  });

  it('parses every step of a run not judged, once saved, and leaves the same comment', async () => {
    const plain = widgetScenario();
    await engine(plain, { env: {} }).execute();
    const scenario = widgetScenario();
    const saved: string[] = [];
    const { error } = await savingEngine(scenario, saved, { env: {} }).execute();
    expect(error).toBeUndefined();
    expect(saved).toEqual([...MERGE_STEPS, 'verdict']);
    expect(verdictComments(scenario.github).map((comment) => comment.body)).toEqual(verdictComments(plain.github).map((comment) => comment.body));
  });

  it('parses every step of the day-14 run, the clock and the merge run’s facts included, once saved', async () => {
    const scenario = afterMergeScenario({ churn: true });
    const saved: string[] = [];
    // The clock is read, not stubbed: its value too is saved and read back.
    const { result, error } = await savingEngine(scenario, saved, { followUp: true }).execute();
    expect(error).toBeUndefined();
    expect(saved).toEqual([...MERGE_STEPS, 'publish-issues', 'publish', CLOCK_STEP, ...DAY_14_STEPS]);
    expect(result).toMatchObject({ followUp: { findings: 2, issues: 2, branch: BRANCH, committed: true } });
    expect(retroJsonAt(scenario.github, BRANCH).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
  });

  it('fails the run on a saved value of another shape, naming the step and the field', async () => {
    const withoutRules = (id: string, value: unknown) => (id === 'facts' ? { ...z.looseObject({}).parse(value), rules: undefined } : value);
    const { error } = await savingEngine(widgetScenario(), [], { alter: withoutRules }).execute();
    expect(z.looseObject({ message: z.string() }).parse(error).message).toMatch(/^The step "facts" came back in an unexpected shape: rules: /);
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
    expect(comments[0]?.body).toBe(`${FAILURE_MARKER}\nThe retro could not run: GitHub is still down\n`);
  });
});

describe('retro — fourteen days later', () => {
  it('waits a day at a time, woken by its daily schedule, until the merge plus fourteen days, then runs the day-14 steps', async () => {
    const scenario = afterMergeScenario();
    const days = Array.from({ length: 14 }, (_, index) => index + 1);
    const { ctx, result, error } = await followUpEngine(scenario, {
      days: {
        steps: [{ id: CLOCK_STEP, handler: () => Date.parse(MERGED_AT) + 60_000 }],
        waits: Object.fromEntries(days.map((day) => [waitStep(day), () => tick(daysAfterMerge(day))])),
      },
    }).execute();
    expect(error).toBeUndefined();

    expect(waits(ctx)).toEqual(days.map((day) => [waitStep(day), { event: DAY_EVENT, timeout: DAY_WAIT }]));
    const ran = ranSteps(ctx);
    expect(ran.slice(ran.indexOf(CLOCK_STEP))).toEqual([CLOCK_STEP, ...DAY_14_STEPS]);
    expect(result).toMatchObject({
      prd: 7,
      findings: 1,
      issues: 1,
      branch: BRANCH,
      followUp: { findings: 2, issues: 2, branch: BRANCH, committed: true, pr: { created: false } },
    });
  });

  it('never sleeps, and no wait may outlast the plan’s seven days', async () => {
    const { ctx } = await followUpEngine(afterMergeScenario()).execute();
    expect(ctx.step.sleep).not.toHaveBeenCalled();
    expect(ctx.step.sleepUntil).not.toHaveBeenCalled();
    expect(waits(ctx).length).toBeGreaterThan(0);
    for (const [, { timeout }] of waits(ctx)) expect(timeout).toBeLessThan(PLAN_CAP);
  });

  it('wakes on its own when no tick comes, reads the clock, and waits on until the fourteenth day', async () => {
    const scenario = afterMergeScenario();
    const days = {
      steps: [
        { id: CLOCK_STEP, handler: () => Date.parse(MERGED_AT) },
        { id: `${CLOCK_STEP}-1`, handler: () => daysAfterMerge(13) },
        { id: `${CLOCK_STEP}-2`, handler: () => daysAfterMerge(15) },
      ],
      waits: { [waitStep(1)]: () => null, [waitStep(2)]: () => null },
    };
    const { ctx, result, error } = await followUpEngine(scenario, { days }).execute();
    expect(error).toBeUndefined();
    expect(waits(ctx).map(([id]) => id)).toEqual([waitStep(1), waitStep(2)]);
    const ran = ranSteps(ctx);
    expect(ran.slice(ran.indexOf(CLOCK_STEP))).toEqual([CLOCK_STEP, `${CLOCK_STEP}-1`, `${CLOCK_STEP}-2`, ...DAY_14_STEPS]);
    expect(result).toMatchObject({ followUp: { findings: 2, issues: 2 } });
  });

  it('runs the day-14 steps at once when the merge is already fourteen days old, as on a late replay', async () => {
    const scenario = afterMergeScenario();
    const days = { steps: [{ id: CLOCK_STEP, handler: () => daysAfterMerge(20) }], waits: {} };
    const { ctx, result, error } = await followUpEngine(scenario, { days }).execute();
    expect(error).toBeUndefined();
    expect(ctx.step.waitForEvent).not.toHaveBeenCalled();
    expect(ranSteps(ctx).slice(-6)).toEqual(DAY_14_STEPS);
    expect(result).toMatchObject({ followUp: { findings: 2, issues: 2 } });
  });

  it('adds the "After merge" section to the open retro PR: one commit on top, the one PR kept', async () => {
    const scenario = afterMergeScenario({ churn: true });
    const { error } = await followUpEngine(scenario).execute();
    expect(error).toBeUndefined();
    const { github } = scenario;

    const [first, second] = [...github.state.commits.values()];
    assertDefined(first, 'the merge run’s commit');
    assertDefined(second, 'the day-14 run’s commit');
    expect(first.parents).toEqual([{ sha: MERGE_SHA }]);
    expect(second.parents).toEqual([{ sha: first.sha }]);
    expect(second.message).toContain('The day-14 run of #12.');
    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(second.sha);
    expect(pullsFrom(github, BRANCH)).toHaveLength(1);
    expect(github.state.refs.has(`heads/${DAY_BRANCH}`)).toBe(false);

    const doc = retroJsonAt(github, BRANCH);
    expect(doc.runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    const md = fileAt(github, BRANCH, MD);
    expect(md).toContain('runs: [merge, day-14]');
    expect(md).toContain('\n## After merge\n\n- 2 `bug` issues naming #7 were opened within 14 days of the merge: 1 fixed within those days, 1 linked to churn.\n');
    expect(md).toMatch(/- \[#40\]\([^)]+\): opened 2 days after the merge, closed; fixed by \[#45\]\([^)]+\) and \[#47\]\([^)]+\); linked to `churn:src\/store\/colour\.js:8-11` \(#45\)\.\n/);
    expect(md.indexOf('## After merge')).toBeGreaterThan(md.indexOf('## Rules'));
  });

  it('counts a bug naming the PRD inside the window, and none outside it', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const run = runAt(retroJsonAt(scenario.github, BRANCH), 1);
    const facts = z
      .object({ bugs: z.array(z.object({ number: z.number(), closed: z.boolean(), fixes: z.array(z.number()) })) })
      .parse(run.kinds['after-merge']);
    expect(facts.bugs.map((bug) => [bug.number, bug.closed, bug.fixes])).toEqual([
      [40, true, [45, 47]],
      [41, false, []],
    ]);
    expect(run.findings.map((finding) => [finding.ref, finding.id])).toEqual([
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
    const md = fileAt(scenario.github, BRANCH, MD);
    for (const issue of issues) {
      expect(issue.labels).toEqual([{ name: 'omni:retro' }]);
      expect(md).toContain(`[#${issue.number}](${issue.html_url})`);
    }
    expect(issues[1]?.body).toContain('<!-- omni-outbox-retro: prd=7 finding=bug:40 -->');
    expect(issues[1]?.body).toContain('\nkind: bug\n');
  });

  it('opens <branch>-day-14 when the first retro PR was merged in the meantime', async () => {
    const scenario = afterMergeScenario();
    const { github } = scenario;
    let merged: string | null = null;
    const { result, error } = await followUpEngine(scenario, {
      onWake: () => {
        mergeRetroPr(github, BRANCH);
        merged = headOf(github, 'main');
      },
    }).execute();
    expect(error).toBeUndefined();

    expect(github.state.refs.get(`heads/${BRANCH}`)).toBe(merged);
    const second = pullFrom(github, DAY_BRANCH);
    expect(second).toMatchObject({ base: { ref: 'main' }, state: 'open', labels: [{ name: 'omni:retro' }] });
    expect(result).toMatchObject({ followUp: { branch: DAY_BRANCH, committed: true, pr: { number: second.number, created: true } } });
    expect(commitAt(github, headOf(github, DAY_BRANCH)).parents).toEqual([{ sha: merged }]);
    expect(retroJsonAt(github, DAY_BRANCH).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    expect(fileAt(github, DAY_BRANCH, MD)).toContain('\n## After merge\n');
  });

  it('on a replay creates no second PR and no second issue, and ends with the same retro', async () => {
    const scenario = afterMergeScenario();
    await followUpEngine(scenario).execute();
    const before = scenario.github.filesAt(BRANCH, [MD, JSON_PATH]);
    const issues = retroIssues(scenario.github).length;

    const { error } = await followUpEngine(scenario).execute();
    expect(error).toBeUndefined();
    // The merge run's words cover its own findings only, so its replay rewrites the file, and the
    // day-14 run writes the whole retro back: on top, never a rewrite.
    expect(scenario.github.filesAt(BRANCH, [MD, JSON_PATH])).toEqual(before);
    for (const request of scenario.github.state.requests.filter((r) => r.route === 'PATCH /repos/{owner}/{repo}/git/refs/{ref}')) {
      expect(request.force).toBe(false);
    }
    expect(retroIssues(scenario.github)).toHaveLength(issues);
    expect(scenario.github.state.pulls.filter(isRetro)).toHaveLength(1);
  });

  it('writes no number in retro.md that retro.json does not hold', async () => {
    const scenario = afterMergeScenario({ churn: true });
    await followUpEngine(scenario).execute();
    const held = new Set(fileAt(scenario.github, BRANCH, JSON_PATH).match(/\d+/g));
    expect((fileAt(scenario.github, BRANCH, MD).match(/\d+/g) ?? []).filter((n) => !held.has(n))).toEqual([]);
  });

  it('asks the model about the whole retro, and keeps the first run’s words and verdict when it gives none', async () => {
    const reply = {
      summary: 'The widgets shipped in the waves planned, but one slice ran far past the others.',
      findings: { 'slow-slice:s3': { title: 'One slice ran far past the others', whyItMatters: 'It held the whole feature back.' } },
      lessons: [],
      verdict: { worthIt: false, reason: 'A slow slice is a known pattern.' },
    };
    const answers = [Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] }), new Response('{}', { status: 401 })];
    const fetch = vi.fn<(url: unknown, init?: RequestInit) => Promise<Response>>(() => Promise.resolve(answers.shift() ?? new Response('{}', { status: 401 })));
    const scenario = afterMergeScenario();
    const { result, error } = await followUpEngine(scenario, { fetch }).execute();
    expect(error).toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(2);
    const call = fetch.mock.calls[1];
    assertDefined(call, 'the second request to the model');
    const { messages } = z.object({ messages: z.array(z.object({ content: z.string() })) }).parse(parsedJson(z.string().parse(call[1]?.body)));
    const user = messages[1];
    assertDefined(user, 'the user message');
    const asked = z.object({ findings: z.array(z.object({ id: z.string() })) }).parse(parsedJson(user.content));
    expect(asked.findings.map((finding) => finding.id)).toEqual(['slow-slice:s3', 'bug:40', 'bug:41']);

    // The merge run's verdict stays: no new lesson, so the one comment is rewritten with every finding.
    expect(result).toMatchObject({ verdict: 'no new lesson', followUp: { findings: 2, issues: 0, verdict: 'no new lesson' } });
    expectNothingPublished(scenario.github);
    const comments = verdictComments(scenario.github);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toContain('\nRetro: no new lesson — A slow slice is a known pattern.\n');
    expect(comments[0]?.body).toContain('\n- F1 · One slice ran far past the others — `slow-slice:s3`\n');
    expect(comments[0]?.body).toContain('\n- F3 · Bug #41 was reported against the PRD after the merge — `bug:41`\n');
  });

  it('without a model key, leaves at day 14 the one comment, rewritten "not judged" with both runs’ findings', async () => {
    const scenario = afterMergeScenario();
    const { result } = await followUpEngine(scenario, { env: {} }).execute();
    expect(result).toMatchObject({ verdict: 'not judged', followUp: { verdict: 'not judged', comment: { created: false } } });
    expectNothingPublished(scenario.github);
    const comments = verdictComments(scenario.github);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toContain('\nRetro: not judged — no model key\n');
    expect(comments[0]?.body.match(/^- F\d /gm)).toEqual(['- F1 ', '- F2 ', '- F3 ']);
  });

  it('opens the retro PR at day 14 when the merge run was not worth one, with issues for every kept finding', async () => {
    const scenario = afterMergeScenario();
    const atMerge = judge({ worthIt: false });
    const atDay14 = judge();
    const fetch: typeof globalThis.fetch = (url, init) => (atMerge.asked.length === 0 ? atMerge(url, init) : atDay14(url, init));
    const { result, error } = await followUpEngine(scenario, { fetch }).execute();
    expect(error).toBeUndefined();
    expect(result).toMatchObject({ verdict: 'no new lesson', followUp: { findings: 2, issues: 3, branch: BRANCH, pr: { created: true } } });

    const { github } = scenario;
    const pull = pullFrom(github, BRANCH);
    expect(pull).toMatchObject({ state: 'open', labels: [{ name: 'omni:retro' }] });
    expect(commitAt(github, headOf(github, BRANCH)).parents).toEqual([{ sha: MERGE_SHA }]);
    expect(retroJsonAt(github, BRANCH).runs.map((run) => run.run)).toEqual(['merge', 'day-14']);
    expect(retroIssues(github).map((issue) => issue.title)).toEqual([
      'retro(PRD 7): Slice s3 took far longer than the others',
      'retro(PRD 7): Bug #40 was reported against the PRD after the merge',
      'retro(PRD 7): Bug #41 was reported against the PRD after the merge',
    ]);
  });

  it('rewrites the verdict comment at day 14 when neither run is worth a PR', async () => {
    const scenario = afterMergeScenario();
    const { result } = await followUpEngine(scenario, { fetch: judge({ worthIt: false }) }).execute();
    expect(result).toMatchObject({ followUp: { findings: 2, issues: 0, verdict: 'no new lesson', comment: { created: false } } });
    expectNothingPublished(scenario.github);
    const comments = verdictComments(scenario.github);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toContain('\n- F2 · Bug #40 was reported against the PRD after the merge — `bug:40`\n');
  });

  it('never waits when built without its day-14 run, nor when no kind takes part in it', async () => {
    const plain = await engine(widgetScenario()).execute();
    expect(plain.ctx.step.waitForEvent).not.toHaveBeenCalled();
    expect(ranSteps(plain.ctx)).not.toContain(CLOCK_STEP);

    const scenario = widgetScenario();
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, env: {}, followUp: true, kinds: [] });
    const { ctx, error } = await testEngine({ function: fn, events: [scenario.event] }).execute();
    expect(error).toBeUndefined();
    expect(ctx.step.waitForEvent).not.toHaveBeenCalled();
    expect(ranSteps(ctx)).not.toContain(CLOCK_STEP);
  });

  it('is part of the function the app serves', async () => {
    const scenario = afterMergeScenario();
    served.octokit = scenario.github.octokit;
    vi.stubEnv('OPENROUTER_API_KEY', '');
    try {
      const { ctx, result, error } = await daysEngine(retro, scenario.event, fourteenDays()).execute();
      expect(error).toBeUndefined();
      expect(waits(ctx)).toEqual([[waitStep(1), { event: DAY_EVENT, timeout: DAY_WAIT }]]);
      expect(ctx.step.sleepUntil).not.toHaveBeenCalled();
      expect(result).toMatchObject({ followUp: { findings: 2, issues: 0, verdict: 'not judged' } });
    } finally {
      vi.unstubAllEnvs();
      served.octokit = null;
    }
  });
});

describe('retro — its daily schedule', () => {
  const scheduled = { name: internalEvents.ScheduledTimer, data: { cron: DAILY } };

  it('runs every day, beside the retro event', () => {
    expect(triggersOf(retro)).toEqual([{ event: RETRO_EVENT }, { cron: DAILY }]);
    expect(DAILY).toMatch(/^\d+ \d+ \* \* \*$/);
  });

  it('tells every retro waiting for its day-14 run that a day has passed, and reads nothing from GitHub', async () => {
    const scenario = widgetScenario();
    served.octokit = scenario.github.octokit;
    try {
      const { ctx, result, error } = await testEngine({
        function: retro,
        events: [scheduled],
        steps: [{ id: DAY_STEP, handler: () => ({ ids: ['tick'] }) }],
      }).execute();
      expect(error).toBeUndefined();
      expect(ctx.step.sendEvent.mock.calls).toEqual([[DAY_STEP, { name: DAY_EVENT, data: {} }]]);
      expect(ctx.step.run).not.toHaveBeenCalled();
      expect(result).toEqual({ sent: DAY_EVENT });
      expect(scenario.github.state.requests).toEqual([]);
    } finally {
      served.octokit = null;
    }
  });

  it('is not part of a retro built without its day-14 run', () => {
    const fn = createRetro({ client: inngest, octokitFor: () => null as never, env: {} });
    expect(triggersOf(fn)).toEqual([{ event: RETRO_EVENT }]);
  });

  it('leaves no comment anywhere when a scheduled run fails', async () => {
    const octokitFor = vi.fn();
    const handler = createRetroFailureHandler({ octokitFor });
    const failed = { name: internalEvents.FunctionFailed, data: { event: scheduled, error: { message: 'down' } } };
    expect(await handler({ event: failed, error: new Error('down') })).toEqual({ skipped: 'not a merge' });
    expect(octokitFor).not.toHaveBeenCalled();
  });
});

describe('retro — the function’s configuration', () => {
  it('is its own function, triggered by the retro event and its daily schedule, never by the outbox check’s event', () => {
    expect(retro.id()).toBe(RETRO_FUNCTION_ID);
    expect(RETRO_FUNCTION_ID).not.toBe(OUTBOX_FUNCTION_ID);
    expect(triggersOf(retro).filter((trigger) => trigger.event)).toEqual([{ event: RETRO_EVENT }]);
    expect(triggersOf(retro)).not.toContainEqual({ event: OUTBOX_CHECK_EVENT });
  });

  it('runs one retro at a time per repository, retries, and has a failure handler', () => {
    expect(retro.opts.concurrency).toBe(CONCURRENCY);
    expect(CONCURRENCY).toEqual({ key: 'event.data.repository', limit: 1 });
    expect(retro.opts.retries).toBe(3);
    expect(typeof retro.opts.onFailure).toBe('function');
  });
});
