// The retro of a large repository on the job ledger (#2780): the ledger refuses a saved step over 1 MB, as
// background_job_save() does, and a delivery whose CI was red again and again must still finish its retro. The
// red runs' log tails, each one read once by the step "gather-ci", must not be saved again, once per finding that
// cites them, in the step "facts" — and the judge and retro.json must still get every one of them.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fakeStepLedger } from '../../test/saved-steps.ts';
import { JUDGE_ENV, judge, retroRunner, widgetScenario } from '../../test/retro-scenario.ts';
import { readEnv } from '../env.ts';
import { KINDS, type Kind } from './kinds/index.ts';
import { ci } from './kinds/ci.ts';
import { CiRecordsSchema } from './kinds/records.ts';

/** What background_job_save() accepts at most: 1 MB of JSON. */
const STEP_CAP = 1_048_576;

/** The fake ledger, refusing a step over 1 MB with the error the real ledger throws (`ledger.ts`). */
function cappedLedger() {
  const fake = fakeStepLedger();
  const save = fake.ledger.save;
  fake.ledger.save = (input) => {
    if (Buffer.byteLength(JSON.stringify(input.value)) > STEP_CAP) {
      return Promise.reject(new Error(`the database refused: Step "${input.step}": its value is over 1 MB. (22023)`));
    }
    return save(input);
  };
  return fake;
}

const RED_RUNS = 60;
const TAIL_LINES = 200;

/** One red run's log tail: 200 lines naming no test, so the ci kind keeps it as an excerpt. */
const tailOf = (job: number) =>
  Array.from({ length: TAIL_LINES }, (_, line) => `job ${String(job)} line ${String(line)}: the e2e suite timed out waiting for the page to settle`).join('\n');

/** The ci kind's records of a delivery whose check `e2e` was red on `count` commits: about 0.7 MB for 60, each tail once. */
function redAgainAndAgain(count = RED_RUNS): z.infer<typeof CiRecordsSchema> {
  const jobs = Array.from({ length: count }, (_, index) => {
    const id = 9000 + index;
    return {
      id,
      run: 5000 + index,
      workflow: 'CI',
      check: 'e2e',
      slice: index % 2 === 0 ? 's1' : 's2',
      sha: index.toString(16).padStart(40, 'a'),
      attempt: 1,
      status: 'completed',
      conclusion: 'failure',
      url: `https://github.com/acme/widget/actions/runs/${String(5000 + index)}/job/${String(id)}`,
      completedAt: `2026-09-1${String(Math.floor(index / 10))}T10:${String(index % 60).padStart(2, '0')}:00Z`,
    };
  });
  return CiRecordsSchema.parse({ slices: ['s1', 's2'], unread: [], jobs, logs: Object.fromEntries(jobs.map((job) => [String(job.id), { tail: tailOf(job.id) }])) });
}

/** The registry's kinds, the ci kind gathering the records of `count` red runs instead of reading GitHub Actions. */
const kindsRedOn = (count: number): readonly Kind[] =>
  KINDS.map((kind) => (kind.id === ci.id ? { ...ci, gather: () => Promise.resolve(redAgainAndAgain(count)) } : kind));
const kinds = kindsRedOn(RED_RUNS);

describe('retro — a large repository on the job ledger (#2780)', () => {
  it('saves its fact sheet under the ledger’s 1 MB cap when red runs’ log tails would repeat past it, and finishes', async () => {
    const scenario = widgetScenario();
    const ledger = cappedLedger();
    const fetch = judge();
    const { error, saved } = await retroRunner({ octokitFor: () => scenario.github.octokit, openrouter: readEnv(JUDGE_ENV).openrouter, fetch, kinds }, scenario.job, {
      ledger,
    }).execute();

    expect(error).toBeUndefined();
    expect(saved).toContain('facts');
    expect(saved).toContain('publish');
  });

  it('saves no log tail in the step "facts", and still gives the judge and retro.json every one', async () => {
    const scenario = widgetScenario();
    const ledger = cappedLedger();
    const fetch = judge();
    const { error } = await retroRunner({ octokitFor: () => scenario.github.octokit, openrouter: readEnv(JUDGE_ENV).openrouter, fetch, kinds }, scenario.job, {
      ledger,
    }).execute();
    expect(error).toBeUndefined();

    const facts = JSON.stringify(ledger.stepsOf(scenario.job.key).facts);
    expect(facts).not.toContain('timed out waiting');
    expect(Buffer.byteLength(facts)).toBeLessThan(STEP_CAP / 4);

    expect(JSON.stringify(fetch.asked)).toContain(JSON.stringify(tailOf(9000 + RED_RUNS - 1)).slice(1, -1));
    const json = scenario.github.filesAt('docs/retro-widget', ['.omni-loop/delivery/shipped/0007-widget/retro.json'])['.omni-loop/delivery/shipped/0007-widget/retro.json'] ?? '';
    for (let index = 0; index < RED_RUNS; index += 1) expect(json).toContain(JSON.stringify(tailOf(9000 + index)));
  });

  it('reads the same sheet back on a retry: the tails put back from the gathers’ saved records', async () => {
    const scenario = widgetScenario();
    const ledger = cappedLedger();
    const deps = { octokitFor: () => scenario.github.octokit, openrouter: null, kinds };
    const first = await retroRunner(deps, scenario.job, { ledger }).execute();
    const again = await retroRunner(deps, scenario.job, { ledger }).execute();
    expect(first.error).toBeUndefined();
    expect(again.error).toBeUndefined();
    expect(again.saved).toEqual([]);
    expect(again.result).toEqual(first.result);
  });
});

// The step "gather-ci" itself on the same ledger (#2786): it keeps every red run's log tail once, so a delivery red
// on enough commits gathers more than the 1 MB the ledger saves a step, however lean the step "facts" is.
const MANY_RED_RUNS = 140;

describe('retro — a delivery red on so many commits that its CI records pass 1 MB (#2786)', () => {
  it('gathers records over 1 MB: what the step "gather-ci" would save in one value', () => {
    expect(Buffer.byteLength(JSON.stringify(redAgainAndAgain(MANY_RED_RUNS)))).toBeGreaterThan(STEP_CAP);
  });

  it('saves every step under the ledger’s 1 MB cap, finishes, and gives the judge and retro.json every tail', async () => {
    const scenario = widgetScenario();
    const ledger = cappedLedger();
    const fetch = judge();
    const { error, saved } = await retroRunner(
      { octokitFor: () => scenario.github.octokit, openrouter: readEnv(JUDGE_ENV).openrouter, fetch, kinds: kindsRedOn(MANY_RED_RUNS) },
      scenario.job,
      { ledger },
    ).execute();

    expect(error).toBeUndefined();
    expect(saved).toContain('publish');
    const steps = ledger.stepsOf(scenario.job.key);
    for (const value of Object.values(steps)) expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThanOrEqual(STEP_CAP);
    expect(Object.keys(steps).filter((id) => id.startsWith('gather-ci:part-')).length).toBeGreaterThan(2);

    // The judge's input is capped at LIMITS.modelInputTokens (`narrate.ts`), which keeps the latest tails whole and drops
    // the older ones: the tails it reads are whole ones, read back from the parts.
    const asked = JSON.stringify(fetch.asked);
    const read = Array.from({ length: MANY_RED_RUNS }, (_, index) => JSON.stringify(tailOf(9000 + index)).slice(1, -1)).filter((tail) => asked.includes(tail));
    expect(read.length).toBeGreaterThan(0);
    const json = scenario.github.filesAt('docs/retro-widget', ['.omni-loop/delivery/shipped/0007-widget/retro.json'])['.omni-loop/delivery/shipped/0007-widget/retro.json'] ?? '';
    for (let index = 0; index < MANY_RED_RUNS; index += 1) expect(json).toContain(JSON.stringify(tailOf(9000 + index)));
  });

  it('reads the same records back on a retry, from the steps it saved', async () => {
    const scenario = widgetScenario();
    const ledger = cappedLedger();
    const deps = { octokitFor: () => scenario.github.octokit, openrouter: null, kinds: kindsRedOn(MANY_RED_RUNS) };
    const first = await retroRunner(deps, scenario.job, { ledger }).execute();
    const again = await retroRunner(deps, scenario.job, { ledger }).execute();
    expect(first.error).toBeUndefined();
    expect(again.error).toBeUndefined();
    expect(again.saved).toEqual([]);
    expect(again.result).toEqual(first.result);
  });
});
