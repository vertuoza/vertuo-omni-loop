// The retro's runner job (PRD 2338): a retro PR holding a kept lesson with no outcome carries
// `/omni:retro-apply --retro <retro PR>` in its body, and the retro queues that line once, as a job the
// app sends; a replay, or the day-14 run on the same retro PR, finds the job again; the day-14 run keeps
// every outcome the branch holds.
import { InngestTestEngine, mockCtx } from '@inngest/test';
import { type Mock, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { inngest } from '../inngest-client.ts';
import { readEnv } from '../env.ts';
import { addCommit } from '../git-write/git-write.ts';
import { JUDGE_ENV, OWNER, REPO, SUB_PULLS, judge, widgetScenario } from '../../test/retro-scenario.ts';
import { DAY_14, FIX_PULLS, ISSUES, MERGED_AT, afterMergeRecording } from './kinds/after-merge.fixtures/day-14.ts';
import { CLOCK_STEP, DAY_EVENT, FOLLOW_UP_STEP, createRetro } from './retro.ts';
import type { ApplyJob, ApplyQueue } from './runner-queue.ts';

type Scenario = ReturnType<typeof widgetScenario>;
type Stub = Scenario['github'];
type Ran = { ctx: { step: { run: Mock<(id: string) => unknown> } }; result: unknown; error: unknown };

const BRANCH = 'docs/retro-widget';
const JSON_PATH = '.omni-loop/delivery/shipped/0007-widget/retro.json';
const MD = '.omni-loop/delivery/shipped/0007-widget/retro.md';
const BECAME = { became: 'playbook/testing#never' };

/** A queue that keeps its jobs as the database would: one per workspace, repository and line. */
function fakeQueue() {
  const jobs: ApplyJob[] = [];
  const calls: ApplyJob[] = [];
  const queue: ApplyQueue = (job) => {
    calls.push(job);
    const index = jobs.findIndex((one) => one.line === job.line && one.repository === job.repository && one.installationId === job.installationId);
    if (index !== -1) return Promise.resolve({ job: `job-${String(index + 1)}`, created: false, reason: null });
    jobs.push(job);
    return Promise.resolve({ job: `job-${String(jobs.length)}`, created: true, reason: null });
  };
  return { queue, jobs, calls };
}

const execute = (options: InngestTestEngine.Options) => new InngestTestEngine(options).execute() as unknown as Promise<Ran>;
const ranSteps = (ran: Ran) => ran.ctx.step.run.mock.calls.map(([id]) => id);

/** The merge run of the widget scenario, its judge keeping every finding unless told otherwise. */
function mergeRun(scenario: Scenario, { queue = null, fetch = judge() }: { queue?: ApplyQueue | null; fetch?: typeof globalThis.fetch } = {}) {
  const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, openrouter: readEnv(JUDGE_ENV).openrouter, fetch, queue });
  return execute({ function: fn, events: [scenario.event] });
}

/** The open retro PR from the retro branch: the test fails when there is none. */
function retroPr(github: Stub) {
  const pull = github.state.pulls.find((candidate) => candidate.head.ref === BRANCH && candidate.state === 'open');
  assertDefined(pull, 'the open retro PR');
  return pull;
}

const lineOf = (github: Stub) => `/omni:retro-apply --retro ${String(retroPr(github).number)}`;

/** The text of `path` on the retro branch. */
function fileAt(github: Stub, path: string): string {
  const text = github.filesAt(BRANCH, [path])[path];
  assertDefined(text, `${path} on ${BRANCH}`);
  return text;
}

const RetroJsonSchema = z.object({ prd: z.number(), runs: z.array(z.looseObject({ run: z.string(), outcomes: z.unknown().optional() })) });

/** Records `outcomes` on the merge run of the retro branch's retro.json, as `/omni:retro-apply` commits it. */
async function settleOnBranch(github: Stub, outcomes: Record<string, unknown>): Promise<void> {
  const doc = RetroJsonSchema.parse(JSON.parse(fileAt(github, JSON_PATH)));
  const runs = doc.runs.map((run, index) => (index === 0 ? { ...run, outcomes } : run));
  const parent = github.state.refs.get(`heads/${BRANCH}`);
  assertDefined(parent, 'the retro branch');
  await addCommit(github.octokit, {
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
    defaultBranch: 'main',
    parent,
    message: 'docs(retro): settle a lesson',
    files: [{ path: JSON_PATH, content: `${JSON.stringify({ ...doc, runs }, null, 2)}\n` }],
  });
}

describe('retro — the runner job that settles its kept lessons (PRD 2338)', () => {
  it('queues the retro PR’s line once, in its own step after publish, for the installation and the repository', async () => {
    const scenario = widgetScenario();
    const { queue, jobs, calls } = fakeQueue();
    const ran = await mergeRun(scenario, { queue });
    expect(ran.error).toBeUndefined();

    const line = lineOf(scenario.github);
    expect(ranSteps(ran).slice(-2)).toEqual(['publish', 'queue-apply']);
    expect(calls).toEqual([{ installationId: 7, repository: 'acme/widgets', line }]);
    expect(jobs).toHaveLength(1);
    expect(ran.result).toMatchObject({ apply: line, queued: { job: 'job-1', created: true, reason: null } });
  });

  it('writes the same line in the retro PR’s body, for a person to run when no runner takes it', async () => {
    const scenario = widgetScenario();
    await mergeRun(scenario, { queue: fakeQueue().queue });
    expect(retroPr(scenario.github).body).toContain(`\n${lineOf(scenario.github)}\n`);
  });

  it('on a replay of the retro, finds the job again and queues no second one', async () => {
    const scenario = widgetScenario();
    const { queue, jobs, calls } = fakeQueue();
    await mergeRun(scenario, { queue });
    const again = await mergeRun(scenario, { queue });
    expect(again.error).toBeUndefined();
    expect(jobs).toHaveLength(1);
    expect(calls.map((call) => call.line)).toEqual([lineOf(scenario.github), lineOf(scenario.github)]);
    expect(again.result).toMatchObject({ queued: { job: 'job-1', created: false } });
  });

  it('queues nothing and writes no line when the retro keeps no lesson', async () => {
    const scenario = widgetScenario();
    const { queue, calls } = fakeQueue();
    const ran = await mergeRun(scenario, { queue, fetch: judge({ worthIt: false }) });
    expect(ran.error).toBeUndefined();
    expect(ranSteps(ran)).not.toContain('queue-apply');
    expect(calls).toEqual([]);
    expect(scenario.github.state.pulls.some((pull) => pull.head.ref === BRANCH)).toBe(false);
  });

  it('queues nothing once every kept lesson has its outcome on the branch, and drops the line', async () => {
    const scenario = widgetScenario();
    const { queue, calls } = fakeQueue();
    await mergeRun(scenario, { queue });
    await settleOnBranch(scenario.github, { 'slow-slice:s3': BECAME });
    const again = await mergeRun(scenario, { queue });
    expect(ranSteps(again)).not.toContain('queue-apply');
    expect(calls).toHaveLength(1);
    expect(retroPr(scenario.github).body).not.toContain('retro-apply');
    expect(fileAt(scenario.github, MD)).toContain('\n- **Became:** `playbook/testing#never`\n');
  });

  it('without a database, queues nothing, and the retro PR’s body still carries the line', async () => {
    const scenario = widgetScenario();
    const ran = await mergeRun(scenario);
    expect(ranSteps(ran)).not.toContain('queue-apply');
    expect(ran.result).toMatchObject({ apply: lineOf(scenario.github) });
    expect(ran.result).not.toHaveProperty('queued');
    expect(retroPr(scenario.github).body).toContain(lineOf(scenario.github));
  });
});

describe('retro — the day-14 run and the outcomes (PRD 2338)', () => {
  /** The widget scenario and the bugs reported in the fourteen days after its merge. */
  function afterMerge(): Scenario {
    const scenario = widgetScenario({ subPulls: [...SUB_PULLS, ...FIX_PULLS], recording: afterMergeRecording() });
    scenario.github.state.issues.push(...structuredClone(ISSUES));
    return scenario;
  }

  /** The retro with its day-14 run: the clock reads the merge, and the first wait wakes on day 14, after `onWake`. */
  function followUp(scenario: Scenario, queue: ApplyQueue, onWake: () => Promise<void>) {
    const fn = createRetro({ client: inngest, octokitFor: () => scenario.github.octokit, openrouter: readEnv(JUDGE_ENV).openrouter, fetch: judge(), followUp: true, queue });
    const given = new Map<string, Promise<unknown>>();
    const wake = `${FOLLOW_UP_STEP}-1`;
    const tick = { name: DAY_EVENT, data: {}, id: 'tick-14', ts: Date.parse(DAY_14) };
    return execute({
      function: fn,
      events: [scenario.event],
      steps: [{ id: CLOCK_STEP, handler: () => Date.parse(MERGED_AT) }],
      transformCtx: (ctx) => {
        const mocked = mockCtx(ctx);
        const waitForEvent = mocked.step.waitForEvent as unknown as Mock<(id: string) => Promise<unknown>>;
        waitForEvent.mockImplementation((id: string) => {
          if (id !== wake) return Promise.reject(new Error(`nobody answers the wait ${id}`));
          if (!given.has(id)) given.set(id, onWake().then(() => tick));
          return given.get(id) ?? Promise.reject(new Error('no answer'));
        });
        return mocked;
      },
    });
  }

  it('keeps every outcome the branch holds, renders it, and finds the one job again for the same retro PR', async () => {
    const scenario = afterMerge();
    const { queue, jobs, calls } = fakeQueue();
    const ran = await followUp(scenario, queue, () => settleOnBranch(scenario.github, { 'slow-slice:s3': BECAME }));
    expect(ran.error).toBeUndefined();

    const doc = RetroJsonSchema.parse(JSON.parse(fileAt(scenario.github, JSON_PATH)));
    expect(doc.runs.map((run) => [run.run, run.outcomes])).toEqual([
      ['merge', { 'slow-slice:s3': BECAME }],
      ['day-14', undefined],
    ]);
    expect(fileAt(scenario.github, MD)).toContain('\n- **Became:** `playbook/testing#never`\n');
    expect(ranSteps(ran)).toContain('queue-apply-day-14');
    expect(calls.map((call) => call.line)).toEqual([lineOf(scenario.github), lineOf(scenario.github)]);
    expect(jobs).toHaveLength(1);
    expect(ran.result).toMatchObject({ queued: { created: true }, followUp: { queued: { job: 'job-1', created: false } } });
  });
});
