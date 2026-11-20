import { describe, expect, it } from 'vitest';
import { fakeStore, jobRow, OLGA, SHARED, T0 } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';
import { MAX_FLEET_MESSAGES, RunnerJobSchema } from './runners.contract';
import { runnersService } from './runners.service';

// A mission job's claim carries the fleet messages its mission was told that its role had not read (PRD 3107 s3, AC-5): oldest
// first, each with its author, time and words; nothing for a job no mission sent or with nothing unread; a read that fails never
// costs the claim; and no more than MAX_FLEET_MESSAGES. The service on the store's fake, whose `fleetMessagesFor` stands for
// commander_claim_messages() (proven in supabase/checks/commander_messaged.sql).

const MISSION = '00000000-0000-4000-8000-000031070003';
const TOLD = [
  { author: 'mira-k', at: '2026-11-21T09:20:00Z', text: 'the design review moved to Thursday' },
  { author: 'paul-n', at: '2026-11-21T09:21:00Z', text: 'and the demo is at ten' },
];

function world(job: ReturnType<typeof jobRow>, fleetMessages: Record<string, typeof TOLD> = {}) {
  const { store } = fakeStore({ jobs: [job], missions: { [MISSION]: 'alone' }, fleetMessages, now: () => T0 });
  return runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps);
}

const missionJob = () => jobRow({ line: '/omni:yolo 2817', sent_by: null, sent_by_app: 'omni-app', mission_id: MISSION });

describe('a claimed job', () => {
  it('AC-5: carries the fleet\'s messages, oldest first, each with its author, time and words', async () => {
    const job = missionJob();
    const claimed = await world(job, { [job.id]: TOLD }).next(OLGA, SHARED);
    expect(claimed.ok && claimed.value).toMatchObject({ id: job.id, messages: TOLD });
    expect(RunnerJobSchema.safeParse(claimed.ok && claimed.value).success).toBe(true);
  });

  it('carries no messages when none is unread, and none for a job no mission sent', async () => {
    const quiet = await world(missionJob()).next(OLGA, SHARED);
    expect(quiet.ok && quiet.value).not.toHaveProperty('messages');
    const alone = jobRow();
    const none = await world(alone, { [alone.id]: TOLD }).next(OLGA, SHARED);
    expect(none.ok && none.value).not.toHaveProperty('messages');
  });

  it('carries only the newest messages when a role was away for long', async () => {
    const job = missionJob();
    const many = Array.from({ length: MAX_FLEET_MESSAGES + 5 }, (_, n) => ({ author: 'mira-k', at: '2026-11-21T09:20:00Z', text: `word ${String(n)}` }));
    const claimed = await world(job, { [job.id]: many }).next(OLGA, SHARED);
    const messages = claimed.ok && claimed.value !== null && 'messages' in claimed.value ? claimed.value.messages : [];
    expect(messages).toHaveLength(MAX_FLEET_MESSAGES);
    expect(messages?.at(-1)?.text).toBe(`word ${String(MAX_FLEET_MESSAGES + 4)}`);
  });

  it('is still claimed when reading the messages fails', async () => {
    const job = missionJob();
    const { store } = fakeStore({ jobs: [job], missions: { [MISSION]: 'alone' }, now: () => T0 });
    const failing = { ...store, fleetMessagesFor: () => Promise.reject(new Error('database down')) };
    const claimed = await runnersService(failing, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps).next(OLGA, SHARED);
    expect(claimed.ok && claimed.value).toMatchObject({ id: job.id });
    expect(claimed.ok && claimed.value).not.toHaveProperty('messages');
  });
});
