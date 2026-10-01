// What wakes the weekly recheck (PRD 774, s4): .github/workflows/business-recheck.yml, every Sunday at
// 22:00 UTC and by hand, one run at a time, calling galaxy's route with the bearer secret and failing on
// a reply that is not 2xx.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../../${path}`, import.meta.url)), 'utf8');
const workflow = parse(read('.github/workflows/business-recheck.yml'));

type Step = { run?: string; uses?: string; env?: Record<string, string> };
type Job = { if: string; concurrency: Record<string, unknown>; steps: Step[] };

describe('the business recheck workflow', () => {
  const jobs = Object.values(workflow.jobs) as Job[];
  const [job] = jobs;

  it('runs every Sunday at 22:00 UTC and by hand', () => {
    expect(workflow.on.schedule).toEqual([{ cron: '0 22 * * 0' }]);
    expect(workflow.on).toHaveProperty('workflow_dispatch');
    expect(Object.keys(workflow.on)).toEqual(['schedule', 'workflow_dispatch']);
  });

  it('is one job, off while GALAXY_URL is unset, one run at a time', () => {
    expect(jobs).toHaveLength(1);
    expect(job!.if).toBe("vars.GALAXY_URL != ''");
    expect(job!.concurrency).toEqual({ group: 'business-recheck', 'cancel-in-progress': false });
  });

  it('calls POST /api/business/recheck with BUSINESS_RECHECK_SECRET as a bearer, and fails on a reply that is not 2xx', () => {
    expect(job!.steps).toHaveLength(1);
    const [step] = job!.steps;
    expect(step!.uses).toBeUndefined();
    expect(step!.env).toEqual({ GALAXY_URL: '${{ vars.GALAXY_URL }}', BUSINESS_RECHECK_SECRET: '${{ secrets.BUSINESS_RECHECK_SECRET }}' });
    expect(step!.run).toContain('-X POST "${GALAXY_URL%/}/api/business/recheck"');
    expect(step!.run).toContain('Authorization: Bearer ${BUSINESS_RECHECK_SECRET}');
    expect(step!.run).toContain('--fail-with-body');
  });

  it('reads nothing of the repository', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(job!.steps.some((s) => s.uses?.startsWith('actions/checkout'))).toBe(false);
  });
});
