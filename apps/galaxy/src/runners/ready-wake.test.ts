import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { acceptanceLine } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import { fakeStore, jobRow, MO, OLGA, RUNNERS, SHARED, T0, WORKSPACE } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';
import { readyWake } from './ready-wake';
import { readyWakeStore, type ReadyWakeStore } from './ready-wake.repository';
import type { RunnersDb } from './runners.repository';
import { runnersService, type AppJobEnded } from './runners.service';

// The e2e fallback's end told to the App (PRD 2898 s8): an acceptance job the Omni App queued that ends tells the App,
// which refreshes the ready check of its pull request; a person's job, a job of another line and a job that has not
// ended tell nothing. No test reaches Supabase: the store's client is a fake that records its calls.

const SHA = 'f6'.repeat(20);
const LINE = acceptanceLine({ prd: parsePrd(2898), pr: parsePr(2927), sha: SHA });

function world(jobs: ReturnType<typeof jobRow>[]) {
  const ended: AppJobEnded[] = [];
  const { store } = fakeStore({ jobs, runners: RUNNERS, lines: [], samples: [], questions: [], skills: [], now: () => T0 });
  const service = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps, undefined, undefined, undefined, undefined, (job) => { ended.push(job); });
  return { service, ended };
}

const claimed = (more: Partial<ReturnType<typeof jobRow>> = {}) => jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString(), sent_by: null, sent_by_app: 'omni-app', line: LINE, ...more });

describe('an App job that ends', () => {
  it.each(['done', 'failed'] as const)('tells the App when an acceptance job it queued ends %s', async (status) => {
    const job = claimed();
    const w = world([job]);
    await w.service.update(OLGA, job.id, { status: 'running', logTail: 'go' });
    expect(w.ended).toEqual([]);
    await w.service.update(OLGA, job.id, { status, exitCode: status === 'done' ? 0 : 1, ...(status === 'failed' ? { reason: 'exit 1' } : {}) });
    expect(w.ended).toEqual([{ workspaceId: WORKSPACE, repo: 'demo-org/app', line: LINE }]);
  });

  it('tells nothing of a person\'s job, nor of the App\'s job of another line', async () => {
    const person = claimed({ sent_by: MO, sent_by_app: null });
    const retro = claimed({ line: '/omni:retro-apply --retro 2360' });
    const w = world([person, retro]);
    await w.service.update(OLGA, person.id, { status: 'done', exitCode: 0 });
    await w.service.update(OLGA, retro.id, { status: 'done', exitCode: 0 });
    expect(w.ended).toEqual([]);
  });
});

describe('readyWake', () => {
  function fakeWakeStore(installation: number | null) {
    const refreshed: unknown[] = [];
    const store: ReadyWakeStore = { installationOf: () => Promise.resolve(installation), refresh: (job) => Promise.resolve(void refreshed.push(job)) };
    return { store, refreshed };
  }

  it('refreshes the pull request\'s pr-ready job, keyed as the App keys it, due at once, its payload naming no token', async () => {
    const { store, refreshed } = fakeWakeStore(5001);
    expect(await readyWake(store)({ workspaceId: WORKSPACE, repo: 'Acme/Widgets', line: LINE })).toBe(true);
    expect(refreshed).toEqual([{
      kind: 'pr-ready', key: 'acme/widgets#2927', subject: 'acme/widgets', delaySeconds: 0,
      payload: { installationId: 5001, owner: 'Acme', repo: 'Widgets', repository: 'Acme/Widgets', prNumber: 2927, headSha: SHA, trigger: 'runner.acceptance' },
    }]);
  });

  it('refreshes nothing for a workspace with no installation, or a line that names no pull request', async () => {
    const none = fakeWakeStore(null);
    expect(await readyWake(none.store)({ workspaceId: WORKSPACE, repo: 'acme/widgets', line: LINE })).toBe(false);
    const odd = fakeWakeStore(5001);
    expect(await readyWake(odd.store)({ workspaceId: WORKSPACE, repo: 'acme/widgets', line: '/omni:acceptance 2898' })).toBe(false);
    expect([none.refreshed, odd.refreshed]).toEqual([[], []]);
  });

  it('reads the workspace\'s installation and calls background_job_refresh as the service role', async () => {
    const calls: unknown[] = [];
    const db = {
      from: (table: string) => ({ select: (columns: string) => ({ eq: (column: string, value: string) => ({ limit: (count: number) => {
        calls.push({ table, columns, column, value, count });
        return Promise.resolve({ data: [{ github_installation_id: 5001 }], error: null });
      } }) }) }),
      rpc: (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return Promise.resolve({ data: 'requeued', error: null });
      },
    } as unknown as RunnersDb;
    expect(await readyWake(readyWakeStore(db))({ workspaceId: WORKSPACE, repo: 'acme/widgets', line: LINE })).toBe(true);
    expect(calls).toEqual([
      { table: 'workspaces', columns: 'github_installation_id', column: 'id', value: WORKSPACE, count: 1 },
      { fn: 'background_job_refresh', args: { p_kind: 'pr-ready', p_key: 'acme/widgets#2927', p_subject: 'acme/widgets', p_payload: expect.objectContaining({ prNumber: 2927, headSha: SHA }) as unknown, p_delay_seconds: 0 } },
    ]);
  });
});
