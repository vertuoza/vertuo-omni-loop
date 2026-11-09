// `/api/github` and the ledger (PRD 2676 s2): a merge adds its job before Inngest is called, the jobs due run after
// the answer, Inngest refusing an event never loses the job, and a database failure never fails the delivery.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { readEnv } from '../env.ts';
import type { NewJob } from '../jobs/ledger.ts';
import { githubRoute, type RouteJobs } from './github-route.ts';

const SECRET = 'route-secret';
const SHA = 'a'.repeat(40);
const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

const merged = JSON.stringify({
  action: 'closed',
  number: 9,
  installation: { id: 7 },
  repository: { name: 'r', full_name: 'o/r', owner: { login: 'o' }, default_branch: 'main' },
  pull_request: { number: 9, merged: true, merged_at: '2026-10-16T09:00:00Z', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: 'b'.repeat(40) } },
});

/** The route over `jobs`, one signed merge delivered; the work kept alive after the answer, and the answer. */
async function deliver(jobs: RouteJobs | null, send: () => Promise<unknown>) {
  const kept: Promise<unknown>[] = [];
  const { POST } = githubRoute(readEnv({ GITHUB_WEBHOOK_SECRET: SECRET }), { send, jobs, keepAlive: (work) => kept.push(work) });
  const response = await POST(new Request('https://omni-loop.example/api/github', { method: 'POST', body: merged, headers: { 'x-github-event': 'pull_request', 'x-hub-signature-256': sign(merged) } }));
  await Promise.all(kept);
  return { response, kept };
}

describe('/api/github — the knowledge pack job (PRD 2676 s2)', () => {
  it('adds the job before Inngest is called, then runs the jobs due after the answer', async () => {
    const order: string[] = [];
    const jobs: RouteJobs = {
      add: () => {
        order.push('add');
        return Promise.resolve(true);
      },
      run: () => {
        order.push('run');
        return Promise.resolve();
      },
    };
    const { response, kept } = await deliver(jobs, () => {
      order.push('send');
      return Promise.resolve();
    });
    expect(response.status).toBe(200);
    expect(order[0]).toBe('add');
    expect(order.at(-1)).toBe('run');
    expect(order.indexOf('send')).toBe(1);
    expect(kept).toHaveLength(1);
  });

  it('adds one job for the merge, keyed by repository and commit', async () => {
    const added: NewJob[] = [];
    const jobs: RouteJobs = { add: (job) => Promise.resolve(added.push(job) > 0), run: () => Promise.resolve() };
    await deliver(jobs, () => Promise.resolve());
    expect(added.map((job) => job.key)).toEqual([`o/r@${SHA}`]);
  });

  it('keeps the job when Inngest refuses the event', async () => {
    const added: NewJob[] = [];
    const jobs: RouteJobs = { add: (job) => Promise.resolve(added.push(job) > 0), run: () => Promise.resolve() };
    const { response } = await deliver(jobs, () => Promise.reject(new Error('inngest is out')));
    expect(response.status).toBe(502);
    expect(added).toHaveLength(1);
  });

  it('does not fail the delivery when the database fails, and runs nothing', async () => {
    const jobs: RouteJobs = { add: () => Promise.reject(new Error('the database refused: down')), run: () => Promise.resolve() };
    const { response, kept } = await deliver(jobs, () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('runs nothing when no job was added, as for a repository no product holds', async () => {
    const jobs: RouteJobs = { add: () => Promise.resolve(false), run: () => Promise.resolve() };
    const { response, kept } = await deliver(jobs, () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });

  it('adds nothing and runs nothing where the App has no database', async () => {
    const { response, kept } = await deliver(null, () => Promise.resolve());
    expect(response.status).toBe(200);
    expect(kept).toEqual([]);
  });
});
