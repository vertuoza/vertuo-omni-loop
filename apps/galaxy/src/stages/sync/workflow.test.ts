// What wakes the sync (PRD 587, s2): .github/workflows/stages.yml, every 15 minutes and by hand, one run
// at a time, calling galaxy's route with the bearer secret and failing on a reply that is not 2xx. And
// the galaxy env example names both of PRD 587's secrets.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../../${path}`, import.meta.url)), 'utf8');
const workflow = parse(read('.github/workflows/stages.yml'));

type Step = { run?: string; uses?: string; env?: Record<string, string> };
type Job = { if: string; concurrency: Record<string, unknown>; steps: Step[] };

describe('the stages workflow', () => {
  const jobs = Object.values(workflow.jobs) as Job[];
  const [job] = jobs;

  it('runs every 15 minutes and by hand', () => {
    expect(workflow.on.schedule).toEqual([{ cron: '*/15 * * * *' }]);
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(Object.keys(workflow.on)).toEqual(['schedule', 'workflow_dispatch']);
  });

  it('is one job, off while GALAXY_URL is unset, one run at a time', () => {
    expect(jobs).toHaveLength(1);
    expect(job!.if).toBe("vars.GALAXY_URL != ''");
    expect(job!.concurrency).toEqual({ group: 'stages-sync', 'cancel-in-progress': false });
  });

  it('calls POST /api/stages/sync with STAGES_SYNC_SECRET as a bearer, and fails on a reply that is not 2xx', () => {
    expect(job!.steps).toHaveLength(1);
    const [step] = job!.steps;
    expect(step!.uses).toBeUndefined();
    expect(step!.env).toEqual({ GALAXY_URL: '${{ vars.GALAXY_URL }}', STAGES_SYNC_SECRET: '${{ secrets.STAGES_SYNC_SECRET }}' });
    expect(step!.run).toContain('-X POST "${GALAXY_URL%/}/api/stages/sync"');
    expect(step!.run).toContain('Authorization: Bearer ${STAGES_SYNC_SECRET}');
    expect(step!.run).toContain('--fail-with-body');
  });

  it('reads nothing of the repository', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job!.steps.some((s) => s.uses?.startsWith('actions/checkout'))).toBe(false);
  });
});

describe('the galaxy env example', () => {
  it('lists STAGES_SYNC_SECRET and STAGE_EVENT_SECRET', () => {
    const example = read('apps/galaxy/.env.example');
    expect(example).toMatch(/^STAGES_SYNC_SECRET=$/m);
    expect(example).toMatch(/^STAGE_EVENT_SECRET=$/m);
  });
});
