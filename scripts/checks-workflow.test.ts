// The sharded `checks` workflow (PRD 1042), read from .github/workflows/checks.yml: `test` and `lint`
// each run as a matrix of shards behind `settle`, and a gathering job keeps each check's name, passing
// only when every shard passed and skipping when settle says stale. A draft labelled
// `omni:ready-check` is graded as a ready pull request is, with the e2e job and the acceptance report
// (PRD 2898): the gates are read event by event with scripts/acceptance-workflow-expression.ts.
// Nothing here runs the workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { interpolate, jobsThatRun, type ExpressionContext } from './acceptance-workflow-expression.ts';

type Step = { uses?: string; run?: string; if?: string; env?: Record<string, string>; with?: Record<string, unknown>; 'continue-on-error'?: boolean };

type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  strategy?: { 'fail-fast'?: boolean; matrix?: { shard?: number[] } };
  steps?: Step[];
};

const workflow = parse(readFileSync(fileURLToPath(new URL('../.github/workflows/checks.yml', import.meta.url)), 'utf8')) as {
  on: { pull_request: { types?: string[]; branches?: string[] } & Record<string, unknown> };
  concurrency: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, Job>;
};

/** The job of that id; a missing one fails the test that asked for it. */
function job(id: string): Job {
  const found = workflow.jobs[id];
  if (!found) throw new Error(`checks.yml has no job ${id}`);
  return found;
}

function needs(job: Job): string[] {
  return job.needs === undefined ? [] : [job.needs].flat();
}

function runs(job: Job): string {
  return (job.steps ?? []).map((step) => step.run ?? '').join('\n');
}

describe.each([
  { check: 'test', shards: 3, command: 'pnpm vitest run --shard=${{ matrix.shard }}/3' },
  { check: 'lint', shards: 2, command: 'pnpm lint --shard ${{ matrix.shard }}/2' },
])('the $check check, in $shards shards', ({ check, shards, command }) => {
  it('runs a matrix covering 1/n to n/n, behind settle, with no shard cancelling another', () => {
    const shardJob = job(`${check}-shard`);
    expect(shardJob.strategy?.matrix?.shard).toEqual(Array.from({ length: shards }, (_, k) => k + 1));
    expect(shardJob.strategy?.['fail-fast']).toBe(false);
    expect(needs(shardJob)).toEqual(['settle']);
    expect(shardJob.if).toBe("needs.settle.outputs.stale == 'false'");
    // Each matrix value fills the one command, so the shards run 1/n to n/n.
    expect(runs(shardJob)).toContain(command);
  });

  it(`gathers every shard into one job named ${check}`, () => {
    const gather = job(check);
    expect(gather.name ?? check).toBe(check);
    expect(needs(gather)).toEqual(expect.arrayContaining(['settle', `${check}-shard`]));
    // It runs even when a shard failed, to fail itself, and only when settle said the run is current.
    expect(gather.if).toBe("always() && needs.settle.outputs.stale == 'false'");
    expect(runs(gather)).toContain(`[ "\${{ needs.${check}-shard.result }}" = "success" ]`);
  });
});

const READY_CHECK = 'omni:ready-check';

/** A pull request event, as the workflow's expressions read it. */
type PullRequestEvent = { action: string; draft: boolean; labels?: string[]; label?: string; head_ref?: string; run_id?: string };

/** The contexts a run of this event sees. */
function contextOf(event: PullRequestEvent): ExpressionContext {
  return {
    github: {
      event_name: 'pull_request',
      head_ref: event.head_ref ?? 'feat/people-ranking',
      base_ref: 'main',
      run_id: event.run_id ?? '7001',
      event: {
        action: event.action,
        ...(event.label === undefined ? {} : { label: { name: event.label } }),
        pull_request: { draft: event.draft, number: 42, labels: (event.labels ?? []).map((name) => ({ name })), head: { sha: 'a'.repeat(40) } },
      },
    },
  };
}

/** The concurrency group a run of this event lands in. */
function concurrencyGroup(event: { head_ref: string; draft: boolean } | PullRequestEvent): string {
  return interpolate(workflow.concurrency.group, contextOf({ action: 'synchronize', ...event }));
}

/** The jobs a run of this event runs, settle answering that the run is current. */
function jobsRun(event: PullRequestEvent): string[] {
  return jobsThatRun(workflow.jobs, contextOf(event), { settle: { stale: 'false' }, e2e: { state: 'ran' } });
}

// Issue 1167: a push and `gh pr ready` seconds apart start two runs together. The push's
// `synchronize` run saw a draft and runs nothing; when it shared the ready run's group, either could
// cancel the other, and a cancelled ready run left the PR green with no test, lint, typecheck or fallow.
describe('the concurrency group', () => {
  const branch = 'feat/people-ranking';

  it("keeps a draft run out of a ready run's group, so it can never cancel it", () => {
    expect(concurrencyGroup({ head_ref: branch, draft: true })).not.toBe(concurrencyGroup({ head_ref: branch, draft: false }));
  });

  it('still lets a newer push cancel the ready run before it, on that branch only', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
    expect(concurrencyGroup({ head_ref: branch, draft: false })).toBe(concurrencyGroup({ head_ref: branch, draft: false }));
    expect(concurrencyGroup({ head_ref: branch, draft: false })).not.toBe(concurrencyGroup({ head_ref: 'feat/other', draft: false }));
  });
});

describe('the unsharded checks', () => {
  it('keeps typecheck and fallow as single jobs behind settle', () => {
    for (const name of ['typecheck', 'fallow']) {
      expect(needs(job(name))).toEqual(['settle']);
      expect(job(name).strategy).toBeUndefined();
    }
  });
});

// PRD 2896: above `with-you` a PRD's feature pull request targets its mission's branch, and is checked as one into main.
describe('a pull request into a mission branch', () => {
  it('runs the workflow as one into main does, a sub-PR into a feature branch still not', () => {
    expect(workflow.on.pull_request.branches).toEqual(['main', 'mission/**']);
  });
});

describe('a docs-only pull request', () => {
  it('still runs the workflow, so its checks report as skipped rather than missing', () => {
    expect(workflow.on.pull_request).not.toHaveProperty('paths-ignore');
    expect(workflow.on.pull_request).not.toHaveProperty('paths');
  });

  it('hands settle the pull request number, so it can answer stale for docs alone', () => {
    const gate = (job('settle').steps ?? []).find((step) => step.run === 'bash scripts/settle-head.sh') as { env?: Record<string, string> } | undefined;
    expect(gate?.env?.SETTLE_PR).toBe('${{ github.event.pull_request.number }}');
  });
});

// PRD 2898: a gated skill adds `omni:ready-check` to a draft before `omni ready`, so its latest
// commit gets the full checks, the e2e job and the acceptance report; a push to it gets them again.
describe('a draft labelled omni:ready-check', () => {
  const GRADED = ['settle', 'test-shard', 'test', 'typecheck', 'lint-shard', 'lint', 'fallow', 'e2e', 'acceptance-report'];
  const labelled = { draft: true, labels: [READY_CHECK] };

  it('listens for a label being added, beside the events it already had', () => {
    expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened', 'ready_for_review', 'labeled']);
  });

  it('runs test, lint, typecheck, fallow, the e2e job and the acceptance report once the label is added', () => {
    expect(jobsRun({ action: 'labeled', label: READY_CHECK, ...labelled })).toEqual(GRADED);
  });

  it('runs them all again on each push to the labelled draft', () => {
    expect(jobsRun({ action: 'synchronize', ...labelled })).toEqual(GRADED);
    expect(jobsRun({ action: 'reopened', ...labelled })).toEqual(GRADED);
  });

  it('still runs none of them on an unlabelled draft, or on a draft labelled with anything else', () => {
    expect(jobsRun({ action: 'synchronize', draft: true })).toEqual([]);
    expect(jobsRun({ action: 'opened', draft: true, labels: ['omni:sub'] })).toEqual([]);
    expect(jobsRun({ action: 'labeled', label: 'omni:in-progress', draft: true, labels: ['omni:in-progress'] })).toEqual([]);
  });

  it('runs nothing when another label is added to the labelled draft, and cancels nothing for it', () => {
    const other = { action: 'labeled', label: 'omni:in-progress', draft: true, labels: [READY_CHECK, 'omni:in-progress'] };
    expect(jobsRun(other)).toEqual([]);
    // A run alone in its group: it cannot cancel the graded run of the same branch.
    expect(concurrencyGroup({ ...other, run_id: '7002' })).not.toBe(concurrencyGroup({ action: 'synchronize', ...labelled }));
    expect(concurrencyGroup({ ...other, run_id: '7002' })).not.toBe(concurrencyGroup({ ...other, run_id: '7003' }));
  });

  it('grades it in the ready group, so a newer push cancels the older graded run and a draft run never does', () => {
    expect(concurrencyGroup({ action: 'synchronize', ...labelled })).toBe(concurrencyGroup({ head_ref: 'feat/people-ranking', draft: false }));
    expect(concurrencyGroup({ action: 'labeled', label: READY_CHECK, ...labelled })).toBe(concurrencyGroup({ action: 'synchronize', ...labelled }));
    expect(concurrencyGroup({ action: 'synchronize', draft: true })).not.toBe(concurrencyGroup({ action: 'synchronize', ...labelled }));
  });

  it('runs nothing more when the labelled draft is marked ready: its latest commit was graded already', () => {
    const ready = { action: 'ready_for_review', draft: false, labels: [READY_CHECK] };
    expect(jobsRun(ready)).toEqual([]);
    expect(concurrencyGroup(ready)).not.toBe(concurrencyGroup({ action: 'synchronize', ...labelled }));
  });

  it('grades an unlabelled pull request as before: on ready and on every push after, never on a label', () => {
    expect(jobsRun({ action: 'ready_for_review', draft: false })).toEqual(GRADED);
    expect(jobsRun({ action: 'synchronize', draft: false })).toEqual(GRADED);
    expect(jobsRun({ action: 'synchronize', draft: false, labels: [READY_CHECK] })).toEqual(GRADED);
    expect(jobsRun({ action: 'labeled', label: READY_CHECK, draft: false, labels: [READY_CHECK] })).toEqual([]);
    expect(jobsRun({ action: 'labeled', label: 'omni:feature', draft: false, labels: ['omni:feature'] })).toEqual([]);
  });

  it('never grades a phase-0 pull request, labelled or not', () => {
    expect(jobsRun({ action: 'labeled', label: READY_CHECK, ...labelled, head_ref: 'docs/phase-0-ready-five-checks' })).toEqual([]);
    expect(jobsRun({ action: 'synchronize', draft: false, head_ref: 'docs/phase-0-ready-five-checks' })).toEqual([]);
  });
});

describe('the acceptance report', () => {
  it('keeps each shard’s vitest JSON report, even after a failed test', () => {
    const shard = job('test-shard');
    expect(runs(shard)).toContain('--reporter=default --reporter=json --outputFile.json=.acceptance/vitest-${{ matrix.shard }}.json');
    const upload = (shard.steps ?? []).find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload?.if).toBe('${{ !cancelled() }}');
    expect(upload?.with?.name).toBe('acceptance-vitest-${{ matrix.shard }}');
  });

  it('is gathered after the shards and the e2e job, even a failed one, from the head commit with its history', () => {
    const report = job('acceptance-report');
    expect(report.name).toBe('acceptance report');
    expect(needs(report)).toEqual(['settle', 'test-shard', 'e2e']);
    expect(report.if).toBe("always() && needs.settle.outputs.stale == 'false'");
    const checkout = (report.steps ?? []).find((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkout?.with).toEqual({ ref: '${{ github.event.pull_request.head.sha }}', 'fetch-depth': 0 });
    expect(runs(report)).toContain('node scripts/acceptance-report.ts post');
  });

  it('may write check runs, and only this job may', () => {
    expect(job('acceptance-report').permissions).toEqual({ contents: 'read', checks: 'write' });
    const writers = Object.entries(workflow.jobs).filter(([, other]) => other.permissions?.checks === 'write').map(([id]) => id);
    expect(writers).toEqual(['acceptance-report']);
  });

  it('is never a job named acceptance, whose own check run would shadow the report’s', () => {
    expect(Object.entries(workflow.jobs).map(([id, other]) => other.name ?? id)).not.toContain('acceptance');
  });
});

describe('the e2e job', () => {
  const e2e = job('e2e');
  const steps = e2e.steps ?? [];
  const runStep = steps.find((step) => step.run?.includes('e2e run'));

  it('runs behind settle on every graded run, so its check is never a skipped one', () => {
    expect(needs(e2e)).toEqual(['settle']);
    expect(e2e.if).toBe("needs.settle.outputs.stale == 'false'");
  });

  it('turns the framework’s telemetry off for the whole job', () => {
    expect(e2e.env?.E2E_TELEMETRY_DISABLED).toBe('1');
  });

  it('runs nothing for a PRD with no e2e criterion: every step after the plan waits on its state', () => {
    const afterPlan = steps.slice(steps.findIndex((step) => step.run?.includes('acceptance-report.ts e2e-plan')) + 1);
    expect(afterPlan.length).toBeGreaterThan(0);
    for (const step of afterPlan) expect(step.if ?? '').toContain("steps.plan.outputs.state == 'ran'");
  });

  it('runs the PRD’s scenarios tagged prd-<n>, on the preview it waited for', () => {
    expect(runStep?.run).toBe('pnpm --filter @omni/e2e exec e2e run --tag "prd-$PRD" --pass-with-no-tests');
    expect(runStep?.env?.APP_URL).toBe('${{ steps.preview.outputs.url }}');
    expect(steps.some((step) => step.run?.includes('acceptance-report.ts preview'))).toBe(true);
  });

  it('reads the model key and the bypass from secrets only, in the one step that runs the tests', () => {
    expect(runStep?.env?.OPENROUTER_API_KEY).toBe('${{ secrets.OPENROUTER_API_KEY }}');
    expect(runStep?.env?.VERCEL_AUTOMATION_BYPASS_SECRET).toBe('${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}');
    const holders = steps.filter((step) => JSON.stringify(step).includes('secrets.OPENROUTER_API_KEY }}'));
    expect(holders).toEqual([runStep]);
    // The plan step learns only whether a key is set, never the key.
    const plan = steps.find((step) => step.run?.includes('e2e-plan'));
    expect(plan?.env?.KEY_SET).toBe("${{ secrets.OPENROUTER_API_KEY != '' }}");
  });

  it('keeps its HTML report as an artifact, even after a failed test, and never the replay cache', () => {
    const upload = steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload?.if).toBe("${{ !cancelled() && steps.plan.outputs.state == 'ran' }}");
    expect(upload?.with?.name).toBe('e2e-report');
    expect(upload?.with?.path).toBe('e2e/.e2e/\n!e2e/.e2e/cache/\n');
  });

  it('hands the head branch to the shell as a variable, never spliced into a command', () => {
    for (const [id, other] of Object.entries(workflow.jobs)) expect(runs(other), id).not.toContain('${{ github.head_ref }}');
  });
});
