import { describe, expect, it } from 'vitest';
import { fakeStore, jobRow, MO, OLGA, RUNNERS, SHARED, T0 } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';
import { runnersService } from './runners.service';

// A job of a mission that reports its end wakes the mission at once (PRD 2842 s5); a job of no mission, and
// a job that has not ended, wake nothing.

const MISSION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function world(jobs: ReturnType<typeof jobRow>[]) {
  const woken: string[] = [];
  const { store } = fakeStore({ jobs, runners: RUNNERS, lines: [], samples: [], questions: [], skills: [], now: () => T0 });
  const service = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps, undefined, undefined, undefined, (id) => { woken.push(id); });
  return { service, woken };
}

const claimed = (more: Partial<ReturnType<typeof jobRow>> = {}) => jobRow({ status: 'claimed', runner_id: SHARED, claimed_at: T0.toISOString(), ...more });

describe('a mission\'s job that ends', () => {
  it.each(['done', 'failed'] as const)('wakes its mission when it ends %s', async (status) => {
    const job = claimed({ mission_id: MISSION });
    const w = world([job]);
    await w.service.update(OLGA, job.id, { status: 'running', logTail: 'go' });
    expect(w.woken).toEqual([]);
    await w.service.update(OLGA, job.id, { status, exitCode: status === 'done' ? 0 : 1, ...(status === 'failed' ? { reason: 'exit 1' } : {}) });
    expect(w.woken).toEqual([MISSION]);
  });

  it('wakes its mission when a person cancels it', async () => {
    const job = jobRow({ sent_by: MO, mission_id: MISSION });
    const w = world([job]);
    await w.service.cancel(MO, job.id);
    expect(w.woken).toEqual([MISSION]);
  });

  it('wakes nothing for a job no mission sent', async () => {
    const job = claimed();
    const w = world([job]);
    await w.service.update(OLGA, job.id, { status: 'done', exitCode: 0 });
    expect(w.woken).toEqual([]);
  });
});
