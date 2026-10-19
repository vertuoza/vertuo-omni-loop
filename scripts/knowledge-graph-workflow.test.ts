// The knowledge-graph workflow (PRD 1798 s7), read from .github/workflows/knowledge-graph.yml: every
// push to main pushes the repository's graph with the kit's `kb graph push`, behind the kit token
// secret, and a release commit is skipped. Nothing here runs the workflow.
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
  it('checks out the repository and sets up node 22', () => {
    expect(steps[0]?.uses?.startsWith('actions/checkout@')).toBe(true);
    expect(steps[1]?.uses?.startsWith('actions/setup-node@')).toBe(true);
    expect(steps[1]?.with?.['node-version']).toBe(22);
  });

  it('passes the kit token from the secret, and does nothing when it is unset', () => {
    const step = steps.find((candidate) => candidate.run?.includes('kb graph push'));
    expect(step?.env?.OMNI_TOKEN).toBe('${{ secrets.OMNI_TOKEN }}');
    expect(step?.run).toContain('[ -z "$OMNI_TOKEN" ]');
    expect(step?.run).toContain('exit 0');
  });

  it('pushes the graph with the built kit, after the token check', () => {
    const run = steps.find((candidate) => candidate.run?.includes('kb graph push'))?.run ?? '';
    expect(run.trimEnd().split('\n').at(-1)).toBe('node kit/dist/omni.mjs kb graph push');
    expect(run.indexOf('[ -z "$OMNI_TOKEN" ]')).toBeLessThan(run.indexOf('kb graph push'));
  });
});
