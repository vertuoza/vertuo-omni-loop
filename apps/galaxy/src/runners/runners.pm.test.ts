import { describe, expect, it } from 'vitest';
import { PM_SKILLS } from 'omni-loop/kit/lib/runner/line.ts';
import { runnersService } from './runners.service';
import { sendable } from './send/targets';
import { API_KEY, fakeStore, jobRow, OLGA, SHARED, T0, WORKSPACE } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';

// The PM's four writing skills on a runner (PRD 2896 s12, criterion 21): a mission at `alone` sends them, and nobody else. Send and
// Send to terminal refuse them, since a person's or a key's job belongs to no mission; a claimed job carries its mission's level,
// so the runner refuses one sent by a mission below `alone` (kit/lib/runner/runner.ts). The service on the store's fake.

const MISSION = '00000000-0000-4000-8000-000028960012';
const KEY = { id: API_KEY, name: 'Missions', workspace: WORKSPACE, maker: OLGA };

function world(jobs = [jobRow()], missions: Record<string, string> = {}) {
  const { store, state } = fakeStore({ jobs, missions, now: () => T0 });
  const service = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps);
  return { service, state };
}

describe('a PM skill sent by a person or a key', () => {
  it.each(PM_SKILLS)('/omni:%s is refused, naming why, and nothing is queued', async (skill) => {
    const w = world([]);
    const line = `/omni:${skill} --mission 12 --cap 2`;
    const error = `/omni:${skill} runs on a runner for a mission's PM only: it is sent by a mission at Works alone, never from here.`;
    expect(await w.service.send(OLGA, { line, repo: 'demo-org/app', target: { kind: 'any' } })).toEqual({ ok: false, kind: 'malformed', error });
    expect(await w.service.sendByKey(KEY, { repo: 'demo-org/app', line })).toEqual({ ok: false, kind: 'malformed', error });
    expect(w.state.jobs).toEqual([]);
  });

  it.each(PM_SKILLS)('/omni:%s is not offered by Send to terminal', (skill) => {
    expect(sendable(`/omni:${skill} --mission 12 --cap 2`)).toBe(false);
  });
});

describe('a claimed job', () => {
  it('carries the level of the mission that sent it', async () => {
    const job = jobRow({ line: '/omni:roadmap --mission 12 --cap 2', sent_by: null, sent_by_app: 'omni-app', mission_id: MISSION });
    const { service } = world([job], { [MISSION]: 'alone' });
    const claimed = await service.next(OLGA, SHARED);
    expect(claimed.ok && claimed.value).toMatchObject({ id: job.id, mission: { level: 'alone' } });
  });

  it('carries no mission when no mission sent it', async () => {
    const { service } = world();
    const claimed = await service.next(OLGA, SHARED);
    expect(claimed.ok && claimed.value).not.toHaveProperty('mission');
  });
});
