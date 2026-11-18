// The mission job and its token budget (PRD 3040 s3, AC-1 to AC-8), through the fake store: no database, no GitHub, no clock.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { JobResult } from '../jobs/worker.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { fakeMissionStore } from './store.fake.ts';
import type { MissionRecord } from './store.ts';
import type { PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-26T09:00:00Z');
const MINUTE = 60_000;
const p = (n: number): PrdNumber => parsePrd(n);

const record = (over: Partial<MissionRecord> = {}): MissionRecord => ({
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [p(1), p(2)], roadmaps: [] },
  ...over,
});
const facts = (n: number): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/area-${String(n)}/`] });

const claimed: ClaimedJob = {
  id: 'bg-1',
  kind: MISSION_KIND,
  key: `mission:${ID}`,
  subject: 'acme/widgets',
  payload: { mission: ID },
  tries: 1,
  claim: 'claim-1',
  claimedUntil: new Date(NOW + 5 * MINUTE).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

function setup(mission: MissionRecord = record()) {
  const clock = { now: NOW };
  const fake = fakeMissionStore({ mission, facts: [facts(1), facts(2)], now: () => clock.now });
  const handler = missionHandler({ store: fake.store, refresh: () => Promise.resolve('again'), now: () => clock.now, log: () => undefined });
  const run = (): Promise<JobResult> => handler(claimed);
  const kinds = () => fake.events().map((event) => event.kind);
  return { fake, clock, run, kinds };
}

describe('a mission with no cap (PRD 3040 AC-1)', () => {
  it('sends its next jobs as it does today', async () => {
    const { fake, run } = setup();
    fake.spend({ mission: 9_000_000, fleet: 9_000_000 });
    await run();
    expect(fake.jobs()).toHaveLength(2);
    expect(fake.stops()).toEqual([]);
    expect(fake.mission().status).toBe('running');
  });
});

describe("a mission reaching its budget (PRD 3040 AC-2, AC-8)", () => {
  it('sends nothing, records one stop and pauses, saying whose cap', async () => {
    const { fake, run, kinds } = setup(record({ tokens: 1000 }));
    // 600 input + 300 output + 200 cache writes: the 5000 cache reads count nothing (mission_tokens()).
    fake.spend({ mission: 1100 });
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.jobs()).toEqual([]);
    expect(fake.mission()).toMatchObject({ status: 'paused', waitingOn: "Paused: budget reached · 1.1k of 1k tokens · this mission's budget", nextWakeAt: null });
    expect(fake.stops()).toEqual([expect.objectContaining({ cap: 'mission', capTokens: 1000, spent: 1100, missions: [ID], answer: null })]);
    expect(kinds()).toEqual(['budget-stop']);
    expect(fake.events()[0]).toMatchObject({ role: 'supervisor', actor: 'agent', sentence: "Paused: this mission's budget reached (1k)" });
  });

  it('records no second stop when the run goes again over the same state', async () => {
    const { fake, run, kinds } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    await run();
    expect(fake.stops()).toHaveLength(1);
    expect(kinds()).toEqual(['budget-stop']);
    expect(fake.mission().status).toBe('paused');
  });
});

describe("a fleet reaching its daily cap (PRD 3040 AC-3)", () => {
  it('pauses every mission of the fleet that runs or waits, in one stop that names them', async () => {
    const { fake, run, kinds } = setup();
    fake.fleetCap(1000);
    fake.spend({ fleet: 1200 });
    fake.fleet([{ id: 'm-2', status: 'waiting' }, { id: 'm-3', status: 'paused' }]);
    await run();
    expect(fake.stops()).toEqual([expect.objectContaining({ cap: 'fleet', capTokens: 1000, spent: 1200, missions: [ID, 'm-2'] })]);
    expect(fake.mission().status).toBe('paused');
    expect(fake.fleet()).toEqual([
      { id: 'm-2', status: 'paused', waitingOn: "Paused: budget reached · 1.2k of 1k tokens in the last 24 hours · this fleet's daily cap" },
      { id: 'm-3', status: 'paused', waitingOn: null },
    ]);
    expect(kinds()).toEqual(['budget-stop']);
    expect(fake.events()[0]?.sentence).toBe("Paused: this fleet's daily cap reached (1k)");
  });
});

describe('a cap cancels no running job (PRD 3040 AC-4)', () => {
  it('leaves the running job to end, sends nothing new, and watches the mission while it runs', async () => {
    const { fake, run, clock } = setup(record({ tokens: 1000, parallel: 1 }));
    await run();
    fake.end(p(1), { status: 'running' });
    fake.spend({ mission: 1100 });
    clock.now += MINUTE;
    expect(await run()).toMatchObject({ outcome: 'later', at: new Date(clock.now + MINUTE) });
    expect(fake.jobs().map((job) => job.attempts.at(-1)?.status)).toEqual(['running']);
    expect(fake.mission().status).toBe('paused');
    // Its end is still recorded, and nothing follows it.
    fake.end(p(1), { status: 'done', outcome: 'ready', prUrl: 'https://github.com/acme/widgets/pull/31' });
    clock.now += MINUTE;
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.jobs()).toHaveLength(1);
    expect(fake.events().map((event) => event.kind)).toContain('prd-ready');
  });
});

describe('a person answers the stop (PRD 3040 AC-5, AC-6, AC-7)', () => {
  it('raised: the new budget is saved, and the mission runs again at its next run', async () => {
    const { fake, run, clock, kinds } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    clock.now += MINUTE;
    fake.answer('raised', 5000);
    await run();
    expect(fake.mission()).toMatchObject({ status: 'running', tokens: 5000 });
    expect(fake.jobs()).toHaveLength(2);
    expect(kinds()).toEqual(['budget-stop', 'budget-answer', 'resumed', 'dispatched', 'dispatched']);
    expect(fake.events()[2]).toMatchObject({ actor: 'agent', sentence: "Resumed: this mission's budget was raised to 5k." });
  });

  it("tomorrow: each mission wakes by itself once the fleet's last 24 hours are back under the cap", async () => {
    const { fake, run, clock } = setup();
    fake.fleetCap(1000);
    fake.spend({ fleet: 1200, oldestEnd: '2027-01-25T14:30:00Z' });
    await run();
    clock.now += MINUTE;
    fake.answer('tomorrow');
    expect(await run()).toEqual({ outcome: 'later', at: new Date('2027-01-26T14:30:00Z'), progress: { laters: 1 } });
    expect(fake.mission()).toMatchObject({ status: 'paused', nextWakeAt: '2027-01-26T14:30:00.000Z', waitingOn: "Paused: budget reached · this fleet's daily cap · resumes by itself at 14:30 UTC" });
    expect(fake.jobs()).toEqual([]);
    clock.now = Date.parse('2027-01-26T14:30:00Z');
    fake.spend({ fleet: 300, oldestEnd: '2027-01-26T02:00:00Z' });
    await run();
    expect(fake.mission().status).toBe('running');
    expect(fake.jobs()).toHaveLength(2);
  });

  it('stopped: the mission ends stopped, saying the budget stopped it, once', async () => {
    const { fake, run, clock, kinds } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    clock.now += MINUTE;
    fake.answer('stopped');
    expect(await run()).toEqual({ outcome: 'done' });
    expect(fake.mission()).toMatchObject({ status: 'stopped', waitingOn: "Stopped by the budget: this mission's budget reached (1k), and a person chose Stop the mission.", nextWakeAt: null });
    await run();
    expect(kinds()).toEqual(['budget-stop', 'budget-answer', 'stopped']);
    expect(fake.jobs()).toEqual([]);
  });
});

describe("a person's own Pause and Resume stay as they are (PRD 3040)", () => {
  it('pauses again, by the same stop, a mission resumed by hand while still over its cap', async () => {
    const { fake, run, clock, kinds } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    clock.now += MINUTE;
    fake.byHand('resumed', clock.now);
    clock.now += MINUTE;
    await run();
    expect(fake.mission().status).toBe('paused');
    expect(fake.stops()).toHaveLength(1);
    expect(kinds()).toEqual(['budget-stop', 'resumed', 'paused']);
    expect(fake.jobs()).toEqual([]);
    // Answered, it runs again: the supervisor's pause was the budget's.
    clock.now += MINUTE;
    fake.answer('raised', 5000);
    await run();
    expect(fake.mission().status).toBe('running');
  });

  it('never resumes a mission a person paused after its stop was answered', async () => {
    const { fake, run, clock } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    clock.now += MINUTE;
    fake.answer('raised', 5000);
    await run();
    clock.now += MINUTE;
    fake.byHand('paused', clock.now);
    clock.now += MINUTE;
    await run();
    expect(fake.mission().status).toBe('paused');
    expect(fake.jobs()).toHaveLength(2);
  });
});
