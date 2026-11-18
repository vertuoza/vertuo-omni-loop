// The stuck counter and the stuck repair's decisions (PRD 3065 s4, spec sections 1, 2 and 4), pure: the mission's job ends since
// something last moved, read from its events in order, and where a stuck mission goes given its stuck repairs.
import { describe, expect, it } from 'vitest';
import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RepairRetro } from 'omni-loop/kit/lib/repair/retro.ts';
import { isStuckRow, MISSION_REPAIRS, NO_REPAIRS, roundOf, type RepairRow, type StuckJob } from './repair.ts';
import {
  beatsOf,
  NO_STUCK,
  pausedEvent,
  pausedWords,
  settleStuck,
  STUCK_JOBS,
  stuckEvents,
  stuckJobsOf,
  stuckKey,
  stuckNext,
  stuckOfKey,
  stuckSince,
  stuckSkillLine,
  stuckWords,
  unreadableStuck,
  type Beat,
  type StuckView,
} from './stuck.ts';
import type { Attempt, RecordedEvent, Run, Step } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const p = (n: number): PrdNumber => parsePrd(n);
const FP = 'a'.repeat(64);

const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'done', outcome: 'held', reason: null, prUrl: null, ...over });
const run = (prd: number, k: number, step: Step, ...attempts: Attempt[]): Run => ({ prd: p(prd), run: k, step, job: attempts[0]?.id ?? 'x', attempts });
const e = (kind: string, job: string | null = null, prd: number | null = null): RecordedEvent => ({ kind, prd: prd === null ? null : p(prd), job });
const ends = (beats: readonly Beat[]): string[] => stuckSince(beats);

const retro = (over: Partial<RepairRetro> = {}): RepairRetro => ({
  cause: 'The preview needs a secret only a person can add.',
  class: 'flake',
  place: 'apps/quotes/preview.ts',
  signature: 'Error: PREVIEW_SECRET is not set',
  evidence: ['The preview job failed five times on the same secret.'],
  proposedFix: 'Add the preview secret to the repository settings.',
  fingerprint: FP,
  ...over,
});
const stuckJob = (k: number, ...attempts: Attempt[]): StuckJob => ({ k, job: attempts[0]?.id ?? `s${String(k)}`, jobs: ['j1', 'j2', 'j3', 'j4', 'j5'], attempts });
const row = (over: Partial<RepairRow> = {}): RepairRow => ({ id: `row-${over.job ?? 's1'}`, prd: null, trigger: 'stuck', fingerprint: FP, round: 1, number: 1, failedJob: 'j5', job: 's1', retro: retro(), fixPr: null, outcome: null, ...over });
const view = (over: Partial<StuckView> = {}): StuckView => ({ round: 1, jobs: [], rows: [], refused: new Map(), landings: new Map(), reports: new Map(), ...over });

describe('the stuck repair job: its key and its line', () => {
  it('is keyed mission:<id>:stuck:<k>, and read back', () => {
    expect(stuckKey(ID, 2)).toBe(`mission:${ID}:stuck:2`);
    expect(stuckOfKey(`mission:${ID}:stuck:2`)).toBe(2);
    expect(stuckOfKey(`mission:${ID}:prd:7:repair:2`)).toBeNull();
  });

  it('is sent as /omni:repair --stuck, naming the mission by its number and the five jobs', () => {
    expect(stuckSkillLine(12, ['a', 'b', 'c', 'd', 'e'])).toBe('/omni:repair --mission 12 --stuck --jobs a,b,c,d,e');
    expect(stuckJobsOf('/omni:repair --mission 12 --stuck --jobs a,b,c,d,e')).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(stuckJobsOf('/omni:repair --mission 12 --prd 7 --job a')).toBeNull();
  });

  it('keeps an unreadable stuck record under one fingerprint of its own', () => {
    expect(unreadableStuck()).toMatch(/^[0-9a-f]{64}$/);
    expect(unreadableStuck()).toBe(unreadableStuck());
  });
});

describe('the counter: job ends since something last moved (spec section 1)', () => {
  it('counts each ended job, once, and nothing for a dispatch of the same step', () => {
    const runs = [run(1, 1, 'build', attempt('a')), run(1, 2, 'build', attempt('b')), run(2, 1, 'build', attempt('c'))];
    const events = [e('dispatched', 'a', 1), e('dispatched', 'c', 2), e('held', 'a', 1), e('dispatched', 'b', 1), e('held', 'b', 1), e('held', 'b', 1), e('job-ended', 'c', 2)];
    expect(ends(beatsOf(events, runs))).toEqual(['a', 'b', 'c']);
    expect(ends(beatsOf([...events, e('dispatched', 'c', 2)], runs))).toEqual(['a', 'b', 'c']);
  });

  it('resets on a new step, a ready, a join, a merge, a Resume and a stuck repair', () => {
    const runs = [run(1, 1, 'build', attempt('a', { outcome: 'review' })), run(1, 1, 'qa:1', attempt('b', { status: 'running' }))];
    const ended = [e('job-ended', 'a', 1)];
    expect(ends(beatsOf([e('dispatched', 'a', 1), ...ended], runs))).toEqual(['a']);
    expect(ends(beatsOf([e('dispatched', 'a', 1), ...ended, e('dispatched', 'b', 1)], runs))).toEqual([]);
    for (const reset of [e('prd-ready', null, 1), e('prd-joined', null, 1), e('prd-merged', null, 1), e('resumed'), e('stuck', 's1'), e('stuck')]) {
      expect(ends(beatsOf([...ended, reset], runs)), reset.kind).toEqual([]);
    }
  });

  it('does not reset on a hold, a person\'s Resume of one PRD, a lost runner or a retro job', () => {
    const lost = run(1, 1, 'build', attempt('a', { status: 'failed', reason: 'runner lost' }), attempt('a2'));
    const runs = [lost, run(2, 1, 'build', attempt('c'))];
    const events = [e('job-ended', 'a', 1), e('held', 'a2', 1), e('resumed', null, 2), e('repair-ended', 'r1', 2), e('job-ended', 'c', 2)];
    expect(ends(beatsOf(events, runs))).toEqual(['a2', 'c']);
  });

  it('a ready end moves, never counts', () => {
    const runs = [run(1, 1, 'build', attempt('a')), run(2, 1, 'build', attempt('b', { outcome: 'ready' }))];
    expect(ends(beatsOf([e('held', 'a', 1), e('prd-ready', 'b', 2)], runs))).toEqual([]);
  });

  it('AC-2: a healthy chain (build, QA, a QA fix, QA again, the Reviewer) never reaches the count', () => {
    const steps: Step[] = ['build', 'qa:1', 'qa-fix:1:1', 'qa:2', 'review:1'];
    const runs = steps.map((step, n) => run(1, 1, step, attempt(`j${String(n)}`, { outcome: 'review' })));
    const events = runs.flatMap((one) => [e('dispatched', one.job, 1), e(one.step === 'review:1' ? 'prd-ready' : 'job-ended', one.job, 1)]);
    const beats = beatsOf(events, runs);
    expect(ends(beats)).toEqual([]);
    for (let n = 1; n <= events.length; n += 1) expect(ends(beatsOf(events.slice(0, n), runs)).length).toBeLessThan(STUCK_JOBS);
  });
});

describe('where a stuck mission goes (spec sections 2 and 4)', () => {
  const five: Beat[] = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'].map((job) => ({ beat: 'end', job }));

  it('AC-1: sends one stuck repair at 5 ended jobs, naming the last five', () => {
    expect(stuckNext(view(), five.slice(0, 4), MISSION_REPAIRS)).toEqual({ next: 'none' });
    expect(stuckNext(view(), five, MISSION_REPAIRS, 0)).toEqual({ next: 'none' });
    expect(stuckNext(view(), five.slice(0, 5), MISSION_REPAIRS)).toEqual({ next: 'send', k: 1, jobs: ['j1', 'j2', 'j3', 'j4', 'j5'] });
    expect(stuckNext(view({ jobs: [stuckJob(1, attempt('s1', { status: 'done' }))], rows: [row({ outcome: 'not fixed' })] }), five, MISSION_REPAIRS)).toMatchObject({ next: 'send', k: 2, jobs: ['j2', 'j3', 'j4', 'j5', 'j6'] });
  });

  it('sends no second while one runs, and says so', () => {
    const atWork = view({ jobs: [stuckJob(1, attempt('s1', { status: 'running' }))] });
    expect(stuckNext(atWork, five, 8)).toEqual({ next: 'repairing', number: 1, left: 8, why: null });
    expect(stuckWords({ number: 1, left: 7, why: null })).toBe('Stuck: 5 jobs, nothing moved · repairing (1 of 3) · 7 left in this mission');
  });

  it('a code fix on its way holds it; a flake or a landed fix lets the count go on', () => {
    const ended = stuckJob(1, attempt('s1', { status: 'done' }));
    const code = row({ retro: retro({ class: 'code' }), fixPr: 'https://github.com/acme/widgets/pull/71' });
    expect(stuckNext(view({ jobs: [ended], rows: [code] }), [], 8)).toEqual({ next: 'repairing', number: 1, left: 8, why: 'its fix #71 lands once green' });
    expect(stuckNext(view({ jobs: [ended], rows: [code], landings: new Map([['s1', { state: 'landed' }]]) }), [], 8)).toEqual({ next: 'none' });
    expect(stuckNext(view({ jobs: [ended], rows: [row()] }), [], 8)).toEqual({ next: 'none' });
  });

  it('AC-4: a person class pauses the mission by stuck, with the cause, the repairs tried and the proposed fix', () => {
    const person = view({ jobs: [stuckJob(1, attempt('s1', { status: 'done' }))], rows: [row({ retro: retro({ class: 'person' }), outcome: 'stopped' })] });
    expect(stuckNext(person, [], 8)).toEqual({
      next: 'pause',
      why: 'The preview needs a secret only a person can add. Tried: no fix stopped. Proposed fix: Add the preview secret to the repository settings. Resume gives each cause 3 more (8 of 9 left in this mission)',
    });
  });

  it('a stuck repair a Resume came after is the past: it pauses nothing again', () => {
    const person = view({ round: 2, jobs: [stuckJob(1, attempt('s1', { status: 'done' }))], rows: [row({ retro: retro({ class: 'person' }), outcome: 'stopped' })] });
    const beats: Beat[] = [{ beat: 'stuck', job: 's1' }, { beat: 'stuck', job: null }, { beat: 'resumed' }];
    expect(stuckNext(person, beats, 8)).toEqual({ next: 'none' });
  });

  it('a spent cause pauses it; a spent 9 pauses it at the count, sending nothing (AC-3)', () => {
    const refused = view({ jobs: [stuckJob(4, attempt('s4', { status: 'done' }))], refused: new Map([['s4', { spent: 'cause', fingerprint: FP, retro: retro() }]]) });
    expect(stuckNext(refused, [], 5)).toMatchObject({ next: 'pause', why: expect.stringContaining(`its cause [${FP.slice(0, 8)}] was repaired 3 times`) as unknown });
    expect(stuckNext(view(), five, 0)).toEqual({ next: 'pause', why: '5 jobs ended and nothing moved, and the mission spent its 9 repairs' });
  });

  it('a cancelled stuck repair spends nothing and holds nothing', () => {
    expect(stuckNext(view({ jobs: [stuckJob(1, attempt('s1', { status: 'cancelled' }))] }), five, 9)).toMatchObject({ next: 'send', k: 2 });
  });
});

describe("a stuck repair's end, by what happened after it", () => {
  const beats: Beat[] = [{ beat: 'stuck', job: 's1' }, { beat: 'end', job: 'j7' }];

  it('fixed once something moved, not fixed once the mission is stuck again, unknown before', () => {
    expect(settleStuck([row()], beats, new Map())).toEqual(new Map());
    expect(settleStuck([row()], [...beats, { beat: 'moved' }], new Map())).toEqual(new Map([['row-s1', 'fixed']]));
    expect(settleStuck([row()], [...beats, { beat: 'stuck', job: 's2' }], new Map())).toEqual(new Map([['row-s1', 'not fixed']]));
  });

  it('a code repair settles only once its fix landed; one ended already is left as it is', () => {
    const code = row({ retro: retro({ class: 'code' }), fixPr: 'https://github.com/acme/widgets/pull/71' });
    const moved: Beat[] = [...beats, { beat: 'moved' }];
    expect(settleStuck([code], moved, new Map())).toEqual(new Map());
    expect(settleStuck([code], moved, new Map([['s1', { state: 'landed' }]]))).toEqual(new Map([['row-s1', 'fixed']]));
    expect(settleStuck([row({ outcome: 'stopped' })], moved, new Map())).toEqual(new Map());
  });
});

describe('the stuck events: one sentence each, never a log', () => {
  it('says each stuck repair sent, its retro and its end', () => {
    const stuck = view({ jobs: [stuckJob(1, attempt('s1', { status: 'done' }))], rows: [row({ outcome: 'fixed' })] });
    expect(stuckEvents(stuck, { where: "the night-shift fleet's runners", mission: 12 }).map(({ kind, role, prd, job, sentence }) => [kind, role, prd, job, sentence])).toEqual([
      ['stuck', 'supervisor', null, 's1', "Stuck: 5 jobs, nothing moved. Sent /omni:repair --mission 12 --stuck to the night-shift fleet's runners (stuck repair 1)."],
      ['retro', 'engineer', null, 's1', "The stuck repair's retro [aaaaaaaa] reads flake: The preview needs a secret only a person can add."],
      ['repair-ended', 'supervisor', null, 's1', 'The stuck repair [aaaaaaaa] ended fixed.'],
    ]);
    const unread = view({ rows: [row({ retro: null, outcome: 'not fixed', prd: p(3) })] });
    expect(stuckEvents(unread, { where: 'any runner of the workspace', mission: 12 }).map(({ sentence }) => sentence)).toEqual(['The stuck repair ended not fixed: its record line could not be read.']);
    expect(stuckEvents(NO_STUCK, { where: 'any runner of the workspace', mission: 12 })).toEqual([]);
  });

  it('the pause is the mission\'s own stuck event, naming no job, and what it waits on says so', () => {
    expect(pausedEvent('the cause.')).toEqual({ kind: 'stuck', role: 'supervisor', prd: null, job: null, link: null, sentence: 'Paused: stuck: the cause.' });
    expect(pausedWords('the cause.')).toBe('Paused: stuck · the cause.');
    expect(isStuckRow(row())).toBe(true);
    expect(isStuckRow(row({ trigger: 'failure' }))).toBe(false);
  });
});

describe('a Resume of a mission paused by stuck opens a new round', () => {
  it('counts a round per Resume after a stuck pause, never after a stuck repair sent', () => {
    expect(roundOf([e('stuck', 's1'), e('resumed')])).toBe(1);
    expect(roundOf([e('stuck', 's1'), e('stuck'), e('resumed'), e('stuck'), e('resumed')])).toBe(3);
    expect(NO_REPAIRS.stuck).toEqual([]);
  });
});
