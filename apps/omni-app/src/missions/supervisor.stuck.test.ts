// A mission that stops moving gets a stuck repair (PRD 3065 s4, AC-1 to AC-4) on fake runners: the real job handler and supervisor,
// against the mission's store in memory (its repairs capped as mission_repairs caps them, stuck ones included), and record lines the
// test hands out as `/omni:repair --stuck` writes them. No database, no runner, no model call, no GitHub.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { fingerprint, type RepairClass } from 'omni-loop/kit/lib/repair/fingerprint.ts';
import { repairRecordLine } from 'omni-loop/kit/lib/repair/line.ts';
import type { ClaimedJob } from '../jobs/ledger.ts';
import type { MissionBranches } from './branch.ts';
import { MISSION_KIND, missionHandler } from './job.ts';
import { halfwayEvent, resumeCap, resumeOf, resumeStep } from './resume.ts';
import { fakeMissionStore } from './store.fake.ts';
import { beatsOf, stuckSince } from './stuck.ts';
import type { MissionRecord } from './store.ts';
import type { Attempt, PrdFacts } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const NOW = Date.parse('2027-01-26T09:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);
const PRDS = [1, 2, 3, 4, 5];

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
  parallel: 5,
  scope: { prds: PRDS.map(p), roadmaps: [] },
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
  claimedUntil: new Date(NOW + 300_000).toISOString(),
  progress: {},
  lane: `mission:${ID}`,
};

/** What `/omni:repair --stuck` ends on: its record line, its cause the mission's own unless it names a PRD. */
function stuckLine(kind: RepairClass, { prd = null as number | null, place = '.omni-loop/missions/12/brief.md' } = {}): string {
  const cause = { class: kind, place, signature: 'Error: PREVIEW_SECRET is not set' };
  const print = fingerprint(cause);
  const retro = { cause: 'The preview needs a secret only a person can add.', ...cause, evidence: ['Five jobs ended on the same missing secret.'], proposedFix: 'Add the preview secret to the repository settings.', fingerprint: print };
  return `12:00:00 reading five jobs…\n12:00:01 ${repairRecordLine({ v: 1, mission: 12, trigger: 'stuck', prd: prd === null ? null : p(prd), fingerprint: print, class: kind, retro, fix: null, report: null })}`;
}

function setup(mission = record(), prds = PRDS) {
  const fake = fakeMissionStore({ mission, facts: prds.map(facts), now: () => NOW, retros: { roadmaps: [] } });
  const run = () => missionHandler({ store: fake.store, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
  const kinds = () => fake.events().map((event) => event.kind);
  return { fake, run, kinds };
}

type Fake = ReturnType<typeof setup>['fake'];

/** Every PRD's latest job ends held: five ends, and the step each is sent again is no new step. */
const allHeld = (fake: Fake): void => {
  for (const n of PRDS) fake.end(p(n), { status: 'done', outcome: 'held' });
};

describe('a mission that stops moving (AC-1)', () => {
  it('sends one stuck repair at the fifth end, first in line, and none while it runs', async () => {
    const { fake, run, kinds } = setup();
    await run();
    expect(fake.jobs()).toHaveLength(5);
    allHeld(fake);
    await run();
    const [stuck] = fake.stuckJobs();
    const fifth = fake.jobs()[4]?.id ?? '';
    expect(fake.stuckJobs()).toHaveLength(1);
    expect(stuck).toMatchObject({ k: 1, key: `mission:${ID}:stuck:1`, toFleet: 'night-shift', line: `/omni:repair --mission 12 --stuck --jobs ${fake.jobs().slice(0, 5).map((job) => job.id.slice(0, 8)).join(',')}` });
    expect(stuck?.jobs.at(-1)).toBe(fifth.slice(0, 8));
    expect(fake.mission()).toMatchObject({ status: 'running', waitingOn: 'Stuck: 5 jobs, nothing moved · repairing (1 of 3) · 8 left in this mission' });
    expect(fake.events().filter((event) => event.kind === 'stuck')).toEqual([
      expect.objectContaining({ role: 'supervisor', actor: 'agent', prd: null, job: stuck?.job, sentence: "Stuck: 5 jobs, nothing moved. Sent /omni:repair --mission 12 --stuck to the night-shift fleet's runners (stuck repair 1)." }),
    ]);
    await run();
    expect(fake.stuckJobs()).toHaveLength(1);
    expect(kinds().filter((kind) => kind === 'stuck')).toHaveLength(1);
  });

  it('a mission whose jobs keep moving sends none', async () => {
    const { fake, run } = setup();
    await run();
    for (const n of PRDS) fake.end(p(n), { status: 'done', outcome: 'ready' });
    await run();
    expect(fake.stuckJobs()).toEqual([]);
  });

  it('a stuck repair that finds a flake lets the mission go on, and ends fixed once something moves', async () => {
    const { fake, run } = setup();
    await run();
    allHeld(fake);
    await run();
    fake.endStuck({ status: 'done' }, stuckLine('flake'));
    await run();
    expect(fake.repairRows()).toEqual([expect.objectContaining({ trigger: 'stuck', prd: null, round: 1, number: 1, outcome: null, failedJob: fake.jobs()[4]?.id })]);
    expect(fake.mission().status).toBe('running');
    fake.end(p(1), { status: 'done', outcome: 'ready' });
    await run();
    expect(fake.repairRows()).toEqual([expect.objectContaining({ trigger: 'stuck', outcome: 'fixed' })]);
    expect(fake.events().map((event) => event.sentence)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^The stuck repair's retro \[[0-9a-f]{8}\] reads flake: The preview needs a secret only a person can add\.$/),
      expect.stringMatching(/^The stuck repair \[[0-9a-f]{8}\] ended fixed\.$/),
    ]));
  });
});

describe('a stuck mission a person must decide (AC-4)', () => {
  it('pauses by stuck and asks once, with the cause, the repairs tried and the proposed fix; a replay asks nothing again', async () => {
    const { fake, run, kinds } = setup();
    await run();
    allHeld(fake);
    await run();
    fake.endStuck({ status: 'done' }, stuckLine('person', { prd: 3 }));
    // Running jobs finish: the paused mission is watched until they end, and nothing new is sent.
    expect(await run()).toMatchObject({ outcome: 'later' });
    expect(fake.jobs()).toHaveLength(10);
    expect(fake.mission()).toMatchObject({ status: 'paused', pausedBy: 'stuck', nextWakeAt: null });
    expect(fake.mission().waitingOn).toBe(
      'Paused: stuck · The preview needs a secret only a person can add. Tried: no fix stopped. Proposed fix: Add the preview secret to the repository settings. Resume gives each cause 3 more (8 of 9 left in this mission)',
    );
    const pauses = () => fake.events().filter((event) => event.kind === 'stuck' && event.job === null);
    expect(pauses()).toEqual([expect.objectContaining({ role: 'supervisor', actor: 'agent', sentence: expect.stringMatching(/^Paused: stuck: The preview needs a secret/) as unknown })]);
    expect(fake.repairRows()).toEqual([expect.objectContaining({ trigger: 'stuck', prd: 3, outcome: 'stopped' })]);
    await run();
    expect(pauses()).toHaveLength(1);
    expect(fake.mission()).toMatchObject({ status: 'paused', pausedBy: 'stuck' });
    expect(kinds().filter((kind) => kind === 'resumed')).toEqual([]);
  });

  it('Resume opens a new round: the count starts again and nothing pauses it a second time', async () => {
    const { fake, run } = setup();
    await run();
    allHeld(fake);
    await run();
    fake.endStuck({ status: 'done' }, stuckLine('person'));
    await run();
    fake.resume();
    await run();
    expect(fake.mission()).toMatchObject({ status: 'running' });
    expect(fake.mission()).not.toHaveProperty('pausedBy');
    expect(fake.stuckJobs()).toHaveLength(1);
    expect(fake.events().filter((event) => event.kind === 'stuck' && event.job === null)).toHaveLength(1);
  });

  it('the budget never resumes a mission paused by stuck', async () => {
    const { fake, run } = setup(record({ tokens: 1000 }));
    fake.spend({ mission: 1100 });
    await run();
    fake.answer('raised', 5000);
    await run();
    allHeld(fake);
    await run();
    fake.endStuck({ status: 'done' }, stuckLine('person'));
    await run();
    expect(fake.mission()).toMatchObject({ status: 'paused', pausedBy: 'stuck' });
    await run();
    expect(fake.mission()).toMatchObject({ status: 'paused', pausedBy: 'stuck' });
  });
});

describe('a stuck repair spends from the repair budget (AC-3)', () => {
  it('the ninth repair is the stuck one; the next time it is stuck it pauses by stuck, sending nothing', async () => {
    // A sixth PRD keeps working all along: the mission runs, and is stuck, rather than stopped.
    const { fake, run } = setup(record({ parallel: 6, scope: { prds: [...PRDS, 6].map(p), roadmaps: [] } }), [...PRDS, 6]);
    for (let n = 1; n <= 8; n += 1) {
      await fake.store.keepRepair(record(), { prd: p(7), fingerprint: String(n).repeat(64).slice(0, 64), round: 1, failedJob: `f${String(n)}`, job: `r${String(n)}`, retro: null, fixPr: null });
    }
    await run();
    allHeld(fake);
    await run();
    expect(fake.mission().waitingOn).toContain('repairing (1 of 3) · 0 left in this mission');
    fake.endStuck({ status: 'done' }, stuckLine('flake'));
    await run();
    expect(fake.repairRows()).toHaveLength(9);
    expect(fake.repairRows().at(-1)).toMatchObject({ trigger: 'stuck' });
    // The PRDs sent again end held a second time: five more ends with nothing moved, and no repair left for them.
    allHeld(fake);
    await run();
    expect(fake.stuckJobs()).toHaveLength(1);
    expect(fake.mission()).toMatchObject({ status: 'paused', pausedBy: 'stuck', waitingOn: 'Paused: stuck · 5 jobs ended and nothing moved, and the mission spent its 9 repairs' });
  });
});

// ── The resume step (PRD omni-loop-21 s10) ──────────────────────────────────────
// The resume step's decisions (./resume.ts) over the jobs the mission's store reads back: the build the real job handler sent at
// `alone`, then each fresh job sent through the store under its `:resume:<k>` key, as the supervisor sends it.

describe('a step that ended halfway at alone (AC-6)', () => {
  const BRANCH = 'mission/12-faster-quotes';
  const branches: MissionBranches = { prepare: () => Promise.resolve({ ok: true, cut: false }) };
  const LIMITED = { limitedUntil: '2027-01-26T10:00:00Z' };

  async function alone(over: Partial<MissionRecord> = {}) {
    const mission = record({ level: 'alone', parallel: 1, scope: { prds: [p(1)], roadmaps: [] }, ...over });
    const fake = fakeMissionStore({ mission, facts: [facts(1)], now: () => NOW });
    await missionHandler({ store: fake.store, branches, refresh: () => Promise.resolve('again'), now: () => NOW, log: () => undefined })(claimed);
    const cap = resumeCap(mission);
    /** The PRD's latest job ends done with no result line (a hand-back, the machine asleep), and the resume step reads it. */
    const halfway = async (change: Partial<Attempt> = {}) => {
      fake.end(p(1), { status: 'done', outcome: null, ...change });
      const runs = await fake.store.runs(ID);
      const latest = runs.reduce((last, one) => (resumeOf(one) > resumeOf(last) ? one : last));
      return { next: resumeStep(runs, latest, cap), event: halfwayEvent(p(1), latest, runs, cap) };
    };
    /** The fresh job the resume step names, sent as the supervisor sends it: the same PRD, run and step, with its `resume`. */
    const resume = (k: number) => fake.store.send({ mission, prd: p(1), run: 1, step: 'build', toFleet: true, skill: 'yolo', resume: k });
    return { fake, halfway, resume };
  }

  it('AC-6: a step whose job ended without its result line gets one fresh job of the same skill', async () => {
    const { fake, halfway, resume } = await alone();
    const { next, event } = await halfway();
    expect(next).toEqual({ next: 'resume', resume: 1, count: 1, cap: 3, counted: true });
    expect(event).toMatchObject({ kind: 'held', role: 'supervisor', sentence: 'PRD 1 ended without its result line: the mission sends it a fresh job (resume 1 of 3).' });
    expect(await resume(1)).not.toBeNull();
    expect(await resume(1)).toBeNull();
    expect(fake.jobs().map(({ key, line }) => [key, line])).toEqual([
      [`mission:${ID}:prd:1:run:1`, `/omni:yolo 1 --for-review --base ${BRANCH}`],
      [`mission:${ID}:prd:1:run:1:resume:1`, `/omni:yolo 1 --for-review --base ${BRANCH}`],
    ]);
    expect(await fake.store.runs(ID)).toEqual([expect.not.objectContaining({ resume: expect.anything() as unknown }), expect.objectContaining({ run: 1, step: 'build', resume: 1 })]);
  });

  it('AC-6: after mandate.resumes resumes the step goes to repair instead', async () => {
    const { halfway, resume } = await alone();
    for (let k = 1; k <= 3; k += 1) {
      expect((await halfway()).next).toMatchObject({ next: 'resume', resume: k, count: k });
      await resume(k);
    }
    const { next, event } = await halfway();
    expect(next).toEqual({ next: 'repair', why: 'it ended without its result line 4 times', count: 4 });
    expect(event?.sentence).toBe('PRD 1 ended without its result line 4 times: the mission sends a repair, while it has one left.');
  });

  it('AC-6: a mandate of 0 resumes sends the first halfway end to repair', async () => {
    const { halfway } = await alone({ resumes: 0 });
    expect((await halfway()).next).toMatchObject({ next: 'repair', count: 1 });
  });

  it('AC-6: a spend or rate limit counts no resume', async () => {
    const { halfway, resume } = await alone({ resumes: 1 });
    expect((await halfway()).next).toMatchObject({ next: 'resume', resume: 1, count: 1 });
    await resume(1);
    const limited = await halfway(LIMITED);
    expect(limited.next).toMatchObject({ next: 'resume', resume: 2, count: 1, counted: false });
    expect(limited.event?.sentence).toBe('PRD 1 ended without its result line: the mission sends it a fresh job (a spend or rate limit counts none).');
    await resume(2);
    expect((await halfway()).next).toMatchObject({ next: 'repair', count: 2 });
  });

  it('reads nothing below alone, nor for an end with its result line', async () => {
    expect((await (await alone({ level: 'with-you' })).halfway()).next).toBeNull();
    expect((await (await alone()).halfway({ outcome: 'held' })).next).toBeNull();
  });

  it('a resume moves nothing in the stuck count: its dispatch is no further step, and its end counts one', () => {
    const runs = [
      { prd: p(1), run: 1, step: 'build' as const, job: 'job-1', attempts: [{ id: 'job-1', status: 'done' as const, outcome: null, reason: null, prUrl: null }] },
      { prd: p(1), run: 1, step: 'build' as const, job: 'job-2', resume: 1, attempts: [{ id: 'job-2', status: 'done' as const, outcome: null, reason: null, prUrl: null }] },
    ];
    const at = (kind: string, job: string) => ({ kind, prd: p(1), job });
    const beats = beatsOf([at('dispatched', 'job-1'), at('held', 'job-1'), at('dispatched', 'job-2'), at('held', 'job-2')], runs);
    expect(beats).toEqual([{ beat: 'moved' }, { beat: 'end', job: 'job-1' }, { beat: 'end', job: 'job-2' }]);
    expect(stuckSince(beats)).toEqual(['job-1', 'job-2']);
  });
});
