// The knowledge-graph workflow (PRD 1798 s7), read from .github/workflows/knowledge-graph.yml: every
// push to main pushes the repository's graph with the kit's `kb graph push`, behind the kit token
// secret, and a release commit is skipped. Nothing here runs the workflow.
//
// In this repository every `omni` runs the kit's TypeScript source: `.omni-loop/bin/omni.mjs` is a
// shim onto `kit/bin/omni.ts`, and `kit/dist/omni.mjs`, the launcher, hands over to it (PRD 420). So
// the job installs the workspace before it calls omni, or it stops on the first package the source
// imports (#2228).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Step = { uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = { if?: string; steps?: Step[] };

const workflow = parse(
  readFileSync(fileURLToPath(new URL('../.github/workflows/knowledge-graph.yml', import.meta.url)), 'utf8'),
) as {
  name: string;
  on: { push: { branches?: string[] } & Record<string, unknown> };
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};

const push = workflow.jobs.push;
const steps = push?.steps ?? [];

describe('when the knowledge graph is pushed', () => {
  it('runs on every push to main and nothing else', () => {
    expect(workflow.name).toBe('knowledge-graph');
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on.push).not.toHaveProperty('paths');
    expect(workflow.on.push).not.toHaveProperty('paths-ignore');
  });

  it('may read the repository and nothing else', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('skips a release head, as the release workflow does', () => {
    expect(push?.if).toBe("${{ !startsWith(github.event.head_commit.message, 'chore(release): ') }}");
  });
});

describe('what the knowledge-graph job runs', () => {
  it('checks out the repository, sets up pnpm and node 22, and installs the workspace', () => {
    expect(steps[0]?.uses?.startsWith('actions/checkout@')).toBe(true);
    expect(steps[1]?.uses?.startsWith('pnpm/action-setup@')).toBe(true);
    expect(steps[2]?.uses?.startsWith('actions/setup-node@')).toBe(true);
    expect(steps[2]?.with?.['node-version']).toBe(24);
    expect(steps[3]?.run).toBe('pnpm install --frozen-lockfile');
  });

  it('installs the workspace before omni runs, since this repository runs the kit source (#2228)', () => {
    const install = steps.findIndex((candidate) => candidate.run === 'pnpm install --frozen-lockfile');
    const omni = steps.findIndex((candidate) => candidate.run?.includes('kb graph push'));
    expect(install).toBeGreaterThanOrEqual(0);
    expect(install).toBeLessThan(omni);
  });

  it('passes the kit token from the secret, and does nothing when it is unset', () => {
    const step = steps.find((candidate) => candidate.run?.includes('kb graph push'));
    expect(step?.env?.OMNI_TOKEN).toBe('${{ secrets.OMNI_TOKEN }}');
    expect(step?.run).toContain('[ -z "$OMNI_TOKEN" ]');
    expect(step?.run).toContain('exit 0');
  });

  it("pushes the graph with the repository's own omni, after the token check", () => {
    const run = steps.find((candidate) => candidate.run?.includes('kb graph push'))?.run ?? '';
    expect(run.trimEnd().split('\n').at(-1)).toBe('node .omni-loop/bin/omni.mjs kb graph push');
    expect(run.indexOf('[ -z "$OMNI_TOKEN" ]')).toBeLessThan(run.indexOf('kb graph push'));
  });
});
