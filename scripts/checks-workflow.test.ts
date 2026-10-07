// The sharded `checks` workflow (PRD 1042), read from .github/workflows/checks.yml: `test` and `lint`
// each run as a matrix of shards behind `settle`, and a gathering job keeps each check's name, passing
// only when every shard passed and skipping when settle says stale. Nothing here runs the workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Job = {
  name?: string;
  needs?: string | string[];
  if?: string;
  strategy?: { 'fail-fast'?: boolean; matrix?: { shard?: number[] } };
  steps?: { run?: string }[];
};

const workflow = parse(readFileSync(fileURLToPath(new URL('../.github/workflows/checks.yml', import.meta.url)), 'utf8')) as {
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

/**
 * The concurrency group a run of this event lands in: each `${{ … }}` of the workflow's group read
 * with the little of GitHub's expression language it needs — a context path, a quoted string, `==`,
 * `&&` and `||`, which return an operand as GitHub's do.
 */
function concurrencyGroup(event: { head_ref: string; draft: boolean }): string {
  const context: Record<string, unknown> = {
    'github.head_ref': event.head_ref,
    'github.event.pull_request.draft': event.draft,
  };
  const operand = (text: string): unknown => {
    const term = text.trim();
    const quoted = /^'(.*)'$/.exec(term);
    if (quoted) return quoted[1];
    if (term === 'true' || term === 'false') return term === 'true';
    if (!(term in context)) throw new Error(`concurrencyGroup does not know ${term}`);
    return context[term];
  };
  const equality = (text: string): unknown => {
    const sides = text.split('==');
    return sides.length === 2 ? operand(sides[0] ?? '') === operand(sides[1] ?? '') : operand(text);
  };
  const evaluate = (text: string): unknown =>
    text
      .split('||')
      .map((either) => either.split('&&').reduce<unknown>((left, right, k) => (k === 0 ? equality(right) : left ? equality(right) : left), true))
      .reduce((left, right) => left || right);
  return workflow.concurrency.group.replace(/\$\{\{(.*?)\}\}/g, (_, expression: string) => String(evaluate(expression)));
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
