// The `quick` workflow (PRD 1814), read from .github/workflows/quick.yml: every pull request `checks`
// does not grade (a draft, or a base other than main) gets one `quick` check, behind the same settle
// gate, running `pnpm check:changed` against its base. Nothing here runs the workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = { needs?: string | string[]; if?: string; steps?: Step[] };

const workflow = parse(readFileSync(fileURLToPath(new URL('../.github/workflows/quick.yml', import.meta.url)), 'utf8')) as {
  name: string;
  on: { pull_request: { branches?: unknown; types?: string[] } & Record<string, unknown> };
  concurrency: { group: string; 'cancel-in-progress': boolean };
  jobs: Record<string, Job>;
};

function job(id: string): Job {
  const found = workflow.jobs[id];
  if (!found) throw new Error(`quick.yml has no job ${id}`);
  return found;
}

const steps = (id: string): Step[] => job(id).steps ?? [];

describe('when quick runs', () => {
  it('listens to every pull request event that changes what is graded, into any branch', () => {
    expect(workflow.name).toBe('quick');
    expect(workflow.on.pull_request.types).toEqual(['opened', 'synchronize', 'reopened', 'ready_for_review']);
    expect(workflow.on.pull_request).not.toHaveProperty('branches');
    // Never filtered by path: a docs-only pull request reports quick as skipped, through settle.
    expect(workflow.on.pull_request).not.toHaveProperty('paths');
    expect(workflow.on.pull_request).not.toHaveProperty('paths-ignore');
  });

  it('settles only a draft or a pull request whose base is not main, and never a phase-0 one', () => {
    expect(job('settle').if).toBe(
      "(github.event.pull_request.draft == true || github.base_ref != 'main') && !startsWith(github.head_ref, 'docs/phase-0-')",
    );
  });

  it('settles through the same gate as checks, handing it the pull request number for docs-only', () => {
    const gate = steps('settle').find((step) => step.run === 'bash scripts/settle-head.sh');
    expect(gate?.env?.SETTLE_PR).toBe('${{ github.event.pull_request.number }}');
    expect(gate?.env?.SETTLE_HEAD_SHA).toBe('${{ github.event.pull_request.head.sha }}');
  });

  it('lets a newer push on the same branch cancel the run before it, in a group of its own', () => {
    expect(workflow.concurrency.group).toBe('quick-${{ github.head_ref }}');
    expect(workflow.concurrency['cancel-in-progress']).toBe(true);
  });
});

describe('what quick runs', () => {
  it('waits for settle and runs only when settle says the run is current', () => {
    expect(job('quick').needs).toBe('settle');
    expect(job('quick').if).toBe("needs.settle.outputs.stale == 'false'");
  });

  it('fetches the whole history, so check:changed finds the merge-base with the base branch', () => {
    const checkout = steps('quick').find((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkout?.with?.['fetch-depth']).toBe(0);
  });

  it('installs from the lockfile, then runs check:changed against the base branch', () => {
    const runs = steps('quick').flatMap((step) => (step.run === undefined ? [] : [step.run]));
    expect(runs).toEqual(['pnpm install --frozen-lockfile', 'pnpm check:changed --base origin/${{ github.base_ref }}']);
  });
});
