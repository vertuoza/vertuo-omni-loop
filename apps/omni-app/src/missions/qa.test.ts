// QA checks a mission's PRD before the Reviewer and hands its bugs to the Engineer (PRD 3001 s4): the supervisor's decisions for the
// QA pair, pure, over runs, a QA view and a person's picks. Beside `supervisor.test.ts`, which proves BR-PRODUCT-139 and is left as it
// was, and `supervisor.reviewer.test.ts`, the Reviewer's rounds.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { qaLine } from 'omni-loop/kit/lib/qa/verdict.ts';
import { checkRunnerLine } from 'omni-loop/kit/lib/runner/line.ts';
import { NO_REPAIRS, roundOf } from './repair.ts';
import { bugsOf, checkedWords, featureOf, judgeBugFix, NO_QA, picksOf, withVerdicts, type QaView } from './qa.ts';
import {
  conclude,
  eventsOf,
  featurePrOf,
  lineOf,
  missionKey,
  NO_BRANCH,
  outcome,
  pick,
  prdStates,
  recordedKeys,
  runOfKey,
  type Attempt,
  type Mission,
  type PrdFacts,
  type Run,
  type Step,
} from './supervisor.ts';

const ID = '7a3e9c10-52b4-4f8d-a1e6-3b0c9d2f4e88';
const AT = Date.parse('2027-01-25T10:00:00Z');
const p = (n: number): PrdNumber => parsePrd(n);
const FEATURE = 'feat/faster-quotes';
const PR = 'https://github.com/acme/widgets/pull/9';
const COMMENT = `${PR}#issuecomment-77`;

const team = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 2, waitingOn: null, level: 'with-you', number: 12, title: 'Faster quotes', ...over });
const one = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: p(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/ground-${String(n)}/`], ...over });
const busy = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const done = (id: string, word: string | null, over: Partial<Attempt> = {}): Attempt => busy(id, { status: 'done', outcome: word, ...over });
const job = (n: number, k: number, step: Step, ...attempts: Attempt[]): Run => ({ prd: p(n), run: k, step, job: attempts[0]?.id ?? `j-${String(n)}-${step}`, attempts });

/** A QA job that ended on the line `/omni:qa` prints, read by the kit as the store reads it. */
const qa = (id: string, line: string): Attempt => done(id, null, { prUrl: PR, checked: qaLine(`working…\n${line}`) });
const passed = (round: 1 | 2) => `omni qa: posted round ${String(round)} (pass) on PR #9: ${COMMENT}`;
const bugs = (round: 1 | 2, ...issues: number[]) => `omni qa: posted round ${String(round)} (bugs, ${String(issues.length)}: ${issues.map((n) => `#${String(n)}`).join(' ')}) on PR #9: ${COMMENT}`;
/** The Engineer's fix job that opened fix pull request `pr`. */
const fixed = (id: string, pr: number) => done(id, 'pr-opened', { prUrl: `https://github.com/acme/widgets/pull/${String(pr)}` });

const built = job(1, 1, 'build', done('a', 'review', { prUrl: PR }));
const view = (over: Partial<QaView> = {}): QaView => ({ ...NO_QA, features: new Map([[p(1), { branch: FEATURE }]]), ...over });
const COMMITTEE = { alone: false, committees: [] };
const ROOM = { room: true, now: AT };

const statesOf = (runs: Run[], qaView: QaView = view(), all: PrdFacts[] = [one(1)]) => prdStates(all, withVerdicts(runs), NO_BRANCH, COMMITTEE, ROOM, NO_REPAIRS, qaView);
const stateOf = (runs: Run[], qaView?: QaView) => statesOf(runs, qaView).get(p(1));
/** What a run sends: each PRD, its run, its step and its bug. */
const sent = (runs: Run[], qaView?: QaView, m: Mission = team()) =>
  pick({ mission: m, facts: [one(1)], states: statesOf(runs, qaView) }).map((send) => [Number(send.prd), send.run, send.step, send.fix ?? null]);

describe('the keys and the lines of the QA pair', () => {
  it('keys QA\'s two rounds and each fix of round 1 under the run, and reads them back; no third round, no sixth bug', () => {
    expect(missionKey(ID, p(3001), 1, 'qa:1')).toBe(`mission:${ID}:prd:3001:run:1:qa:1`);
    expect(missionKey(ID, p(3001), 1, 'qa-fix:1:5')).toBe(`mission:${ID}:prd:3001:run:1:qa-fix:1:5`);
    expect(runOfKey(`mission:${ID}:prd:3001:run:1:qa:2`)).toEqual({ prd: 3001, run: 1, step: 'qa:2' });
    expect(runOfKey(`mission:${ID}:prd:3001:run:2:qa-fix:1:3`)).toEqual({ prd: 3001, run: 2, step: 'qa-fix:1:3' });
    expect(runOfKey(`mission:${ID}:prd:3001:run:1:qa:3`)).toBeNull();
    expect(runOfKey(`mission:${ID}:prd:3001:run:1:qa-fix:1:6`)).toBeNull();
    expect(runOfKey(`mission:${ID}:prd:3001:run:1:qa-fix:2:1`)).toBeNull();
  });

  it('sends QA and the Engineer\'s fix on lines a runner takes', () => {
    expect(lineOf(p(7), 'qa:1')).toBe('/omni:qa 7');
    expect(lineOf(p(7), 'qa:2')).toBe('/omni:qa 7 --round 2');
    expect(lineOf(p(7), 'qa-fix:1:2', 'yolo', null, { issue: parseIssue(13), branch: FEATURE })).toBe(`/omni:bug-fix #13 --base ${FEATURE}`);
    for (const line of ['/omni:qa 7', '/omni:qa 7 --round 2', `/omni:bug-fix #13 --base ${FEATURE}`]) expect(checkRunnerLine(line)).toMatchObject({ ok: true });
    expect(() => lineOf(p(7), 'qa-fix:1:1')).toThrow(/bug/);
  });
});

describe('build, QA, the fixes, QA again, then the Reviewer', () => {
  it('AC-1: a build ready for review sends /omni:qa under qa:1, and no Reviewer', () => {
    expect(outcome('review', 1, null, 'build')).toEqual({ next: 'send', step: 'qa:1' });
    expect(sent([built])).toEqual([[1, 1, 'qa:1', null]]);
  });

  it('a plan repository\'s PRD skips the QA pair: its build goes to the Reviewer, as before', () => {
    expect(outcome('review', 1, null, 'build', false)).toEqual({ next: 'send', step: 'review:1' });
    expect(sent([built], { ...NO_QA, skip: true })).toEqual([[1, 1, 'review:1', null]]);
  });

  it('QA at work holds the PRD running, and its slot', () => {
    expect(stateOf([built, job(1, 1, 'qa:1', busy('b'))])).toEqual({ state: 'running', run: 1 });
  });

  it('AC-2: a pass in round 1 sends the Reviewer\'s round 1, and no qa:2', () => {
    expect(sent([built, job(1, 1, 'qa:1', qa('b', passed(1)))])).toEqual([[1, 1, 'review:1', null]]);
  });

  it('AC-3: bugs in round 1 send the first fix alone, then the next once the first landed', () => {
    const checked = job(1, 1, 'qa:1', qa('b', bugs(1, 12, 13)));
    expect(bugsOf(withVerdicts([checked]), p(1))).toEqual([12, 13]);
    expect(sent([built, checked])).toEqual([[1, 1, 'qa-fix:1:1', { issue: 12, branch: FEATURE }]]);
    const first = job(1, 1, 'qa-fix:1:1', fixed('c', 15));
    // While the fix waits to land, nothing more is sent: one job writes the branch at a time.
    expect(stateOf([built, checked, first], view({ landings: new Map([['c', { state: 'waits', lacks: ['test not finished'] }]]) }))).toEqual({
      state: 'running',
      run: 1,
      waiting: { on: 'fix', words: 'its fix #15 waits: test not finished' },
    });
    expect(sent([built, checked, first])).toEqual([]);
    expect(sent([built, checked, first], view({ landings: new Map([['c', { state: 'landed' }]]) }))).toEqual([[1, 1, 'qa-fix:1:2', { issue: 13, branch: FEATURE }]]);
  });

  it('a fix that cannot land, or a fix job that opened none, is marked and the next bug goes', () => {
    const checked = job(1, 1, 'qa:1', qa('b', bugs(1, 12, 13)));
    const refused = view({ landings: new Map([['c', { state: 'refused', why: '#15 is red: test failed' }]]) });
    expect(sent([built, checked, job(1, 1, 'qa-fix:1:1', fixed('c', 15))], refused)).toEqual([[1, 1, 'qa-fix:1:2', { issue: 13, branch: FEATURE }]]);
    expect(sent([built, checked, job(1, 1, 'qa-fix:1:1', done('c', 'already-fixed'))])).toEqual([[1, 1, 'qa-fix:1:2', { issue: 13, branch: FEATURE }]]);
  });

  it('a fix waits while its feature branch cannot be read, sending nothing', () => {
    const checked = job(1, 1, 'qa:1', qa('b', bugs(1, 12)));
    expect(stateOf([built, checked], { ...NO_QA, features: new Map([[p(1), { why: 'the app has no GitHub access here' }]]) })).toEqual({
      state: 'running',
      run: 1,
      waiting: { on: 'fix', words: 'the fix of #12 waits: the app has no GitHub access here' },
    });
    expect(sent([built, checked], NO_QA)).toEqual([]);
  });

  it('AC-4: once every bug landed or is marked, round 2 goes; its pass sends the Reviewer', () => {
    const before = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 12, 13))), job(1, 1, 'qa-fix:1:1', fixed('c', 15)), job(1, 1, 'qa-fix:1:2', done('d', 'already-fixed'))];
    const landed = view({ landings: new Map([['c', { state: 'landed' }]]) });
    expect(sent(before, landed)).toEqual([[1, 1, 'qa:2', null]]);
    expect(sent([...before, job(1, 1, 'qa:2', qa('e', passed(2)))], landed)).toEqual([[1, 1, 'review:1', null]]);
  });

  it('AC-5: a bug still there after round 2 waits on a person, and nothing is sent until they pick', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 13))), job(1, 1, 'qa-fix:1:1', done('c', 'already-fixed')), job(1, 1, 'qa:2', qa('e', bugs(2, 13)))];
    expect(stateOf(runs)).toEqual({ state: 'waits', on: 'decide-bugs', issues: [13], pr: 9 });
    expect(sent(runs)).toEqual([]);
    expect(conclude({ mission: team(), facts: [one(1)], states: statesOf(runs), sent: 0, now: AT })).toMatchObject({ status: 'waiting', waitingOn: 'PRD 1: decide bug #13' });
    // Send on to the Reviewer: a person's `resumed` of the PRD naming the round-2 job.
    const onward = picksOf([{ kind: 'resumed', prd: p(1), job: 'e' }]);
    expect(sent(runs, view({ picks: onward }))).toEqual([[1, 1, 'review:1', null]]);
    // Stop this PRD: a person's `stopped` of it, never repaired.
    const stop = picksOf([{ kind: 'stopped', prd: p(1), job: 'e' }]);
    expect(stateOf(runs, view({ picks: stop }))).toEqual({ state: 'stopped', why: 'a person stopped it with #13 still there after QA\'s round 2' });
    expect(sent(runs, view({ picks: stop }))).toEqual([]);
  });

  it('a person\'s pick to send a PRD on opens no new round of repairs: only the mission\'s own resume does', () => {
    const stopped = { kind: 'stopped', prd: null, job: null };
    expect(roundOf([stopped, { kind: 'resumed', prd: p(1), job: 'e' }])).toBe(1);
    expect(roundOf([stopped, { kind: 'resumed', prd: null, job: null }])).toBe(2);
  });

  it('reads only a person\'s pick: the mission\'s own resume names no PRD, the supervisor\'s own stop no job', () => {
    expect(picksOf([{ kind: 'resumed', prd: null, job: null }, { kind: 'stopped', prd: p(1), job: null }])).toEqual(new Map());
    expect(picksOf([{ kind: 'stopped', prd: p(1), job: 'e' }, { kind: 'resumed', prd: p(1), job: 'e' }])).toEqual(new Map([['e', 'stop']]));
  });

  it('AC-6: a QA job whose last line names six bugs, or none, ends failed, verdict not read, and is repaired as any failed step', () => {
    const six = `omni qa: posted round 1 (bugs, 6: #1 #2 #3 #4 #5 #6) on PR #9: ${COMMENT}`;
    for (const line of [six, 'no record line at all', passed(2)]) {
      const runs = withVerdicts([built, job(1, 1, 'qa:1', qa('b', line))]);
      expect(runs[1]?.attempts[0]).toMatchObject({ status: 'failed', reason: 'verdict not read' });
      expect(prdStates([one(1)], runs, NO_BRANCH, COMMITTEE, ROOM, NO_REPAIRS, view()).get(p(1))).toEqual({ state: 'stopped', why: 'its job failed: verdict not read' });
      expect(prdStates([one(1)], runs, NO_BRANCH, COMMITTEE, ROOM, { ...NO_REPAIRS, budget: 9 }, view()).get(p(1))).toEqual({ state: 'repairable', k: 1, failedJob: 'b' });
    }
  });

  it('AC-7: a replay over the same state sends none of qa:1, qa-fix:1:1 or qa:2 again', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 12))), job(1, 1, 'qa-fix:1:1', fixed('c', 15)), job(1, 1, 'qa:2', busy('d'))];
    expect(sent(runs, view({ landings: new Map([['c', { state: 'landed' }]]) }))).toEqual([]);
  });

  it('a QA job that failed, or was cancelled, goes as any step: repaired, or paused', () => {
    expect(stateOf([built, job(1, 1, 'qa:1', busy('b', { status: 'failed', reason: 'exit code 1' }))])).toEqual({ state: 'stopped', why: 'its job failed: exit code 1' });
    expect(stateOf([built, job(1, 1, 'qa:1', busy('b', { status: 'cancelled' }))])).toEqual({ state: 'paused' });
  });

  it('a fix sent again after its repair goes under the next run, for the same bug', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 12, 13))), job(1, 1, 'qa-fix:1:1', busy('c', { status: 'failed', reason: 'exit code 1' }))];
    // The repair found a flake: the step goes again, under the next run, for the same bug.
    const retro = { cause: 'A flaky test.', class: 'flake' as const, place: 'x', signature: 'y', evidence: ['z'], proposedFix: 'Retry.', fingerprint: 'f'.repeat(64) };
    const row = { id: 'row', prd: p(1), fingerprint: 'f'.repeat(64), round: 1, number: 1, failedJob: 'c', job: 'r', retro, fixPr: null, outcome: null };
    const flake = { ...NO_REPAIRS, budget: 9, jobs: [{ prd: p(1), k: 1, job: 'r', failedJob: 'c', attempts: [done('r', null)] }], rows: [row] };
    expect(pick({ mission: team(), facts: [one(1)], states: prdStates([one(1)], withVerdicts(runs), NO_BRANCH, COMMITTEE, ROOM, flake, view()) }).map((s) => [s.run, s.step, s.fix])).toEqual([[2, 'qa-fix:1:1', { issue: 12, branch: FEATURE }]]);
  });

  it('fixes the bugs of the latest round 1 QA posted, when QA was sent again', () => {
    const runs = withVerdicts([built, job(1, 1, 'qa:1', qa('b', bugs(1, 12))), job(1, 2, 'qa:1', qa('b2', bugs(1, 14, 15))), job(1, 1, 'qa:1', qa('b3', bugs(1, 16)))]);
    expect(bugsOf(runs, p(1))).toEqual([14, 15]);
  });

  it('the feature pull request is QA\'s, never the Engineer\'s fix pull request', () => {
    const runs = withVerdicts([built, job(1, 1, 'qa:1', qa('b', bugs(1, 12))), job(1, 1, 'qa-fix:1:1', fixed('c', 15))]);
    expect(featurePrOf(runs, p(1))).toBe(9);
  });
});

describe('a fix lands on the feature branch only', () => {
  const pull = { number: 15, url: 'u', title: 't', state: 'open', draft: false, merged: false, base: FEATURE, defaultBranch: 'main', head: 'f'.repeat(40), runs: [{ id: 1, name: 'test', status: 'completed', conclusion: 'success', title: null }], statuses: [], reviews: [], items: { ranks: [] } };

  it('merges a green fix into the feature branch, never one into the default branch, and never a draft', () => {
    expect(judgeBugFix(pull, FEATURE)).toEqual({ state: 'merge' });
    expect(judgeBugFix({ ...pull, base: 'main' }, FEATURE)).toEqual({ state: 'refused', why: `#15 targets main, not ${FEATURE}` });
    expect(judgeBugFix({ ...pull, draft: true }, FEATURE)).toEqual({ state: 'refused', why: '#15 is still a draft' });
    expect(judgeBugFix({ ...pull, merged: true, state: 'closed' }, FEATURE)).toEqual({ state: 'landed' });
  });

  it('reads the feature branch from the feature pull request, never the default branch, never one a line cannot carry', () => {
    expect(featureOf({ number: 9, branch: FEATURE, defaultBranch: 'main' })).toEqual({ branch: FEATURE });
    expect(featureOf({ number: 9, branch: 'main', defaultBranch: 'main' })).toEqual({ why: '#9 is built on main, the default branch' });
    expect(featureOf({ number: 9, branch: 'feat/a;rm', defaultBranch: 'main' })).toEqual({ why: 'the branch of #9 cannot be read' });
    expect(featureOf({ number: 9, defaultBranch: 'main' })).toEqual({ why: 'the branch of #9 cannot be read' });
  });
});

describe('the QA pair\'s rows on the ledger', () => {
  /** The events a run records, `recorded` read back as keys. */
  function recordedNow(runs: Run[], { recorded = [] as { kind: string; job: string }[], qaView = view() } = {}) {
    const m = team();
    const read = withVerdicts(runs);
    const states = prdStates([one(1)], read, NO_BRANCH, COMMITTEE, ROOM, NO_REPAIRS, qaView);
    const next = conclude({ mission: m, facts: [one(1)], states, sent: 0, now: AT });
    return eventsOf({ mission: m, facts: [one(1)], states, runs: read, next, toFleet: true, recorded: recordedKeys(recorded.map(({ kind, job: id }) => ({ kind, prd: p(1), job: id }))), qa: qaView });
  }
  const seen = (...jobs: string[]) => jobs.flatMap((id) => [{ kind: 'dispatched', job: id }, { kind: 'job-ended', job: id }]);

  it('says each verdict in the room\'s words', () => {
    const read = (line: string) => {
      const posted = qaLine(line);
      if (posted === null) throw new Error('unread');
      return checkedWords(posted);
    };
    expect(read(bugs(1, 3012, 3013))).toBe('2 bugs found · Round 1 of 2 · #3012 #3013');
    expect(read(bugs(2, 3013))).toBe('1 bug still there · Round 2 of 2 · #3013');
    expect(read(passed(2))).toBe('pass · Round 2 of 2');
  });

  it('records QA sent, its verdict as checked by QA linking its comment, the fixes sent and how each ended, then round 2', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 12, 13))), job(1, 1, 'qa-fix:1:1', fixed('c', 15)), job(1, 1, 'qa-fix:1:2', done('d', 'already-fixed')), job(1, 1, 'qa:2', qa('e', passed(2)))];
    const list = recordedNow(runs, { recorded: seen('a'), qaView: view({ landings: new Map([['c', { state: 'landed' }]]) }) });
    expect(list.filter((e) => e.kind !== 'waits').map((e) => [e.kind, e.role, e.job, e.link, e.sentence])).toEqual([
      ['dispatched', 'supervisor', 'b', null, 'Sent /omni:qa 1 to the night-shift fleet\'s runners (run 1, round 1).'],
      ['checked', 'qa', 'b', COMMENT, '2 bugs found · Round 1 of 2 · #12 #13'],
      ['dispatched', 'supervisor', 'c', null, `Sent /omni:bug-fix #12 --base ${FEATURE} to the night-shift fleet's runners (run 1, bug 1 of 2).`],
      ['job-ended', 'engineer', 'c', 'https://github.com/acme/widgets/pull/15', 'fixed #12 · PR #15'],
      ['dispatched', 'supervisor', 'd', null, `Sent /omni:bug-fix #13 --base ${FEATURE} to the night-shift fleet's runners (run 1, bug 2 of 2).`],
      ['job-ended', 'engineer', 'd', null, 'not fixed #13: its reproduction passed on the branch'],
      ['dispatched', 'supervisor', 'e', null, 'Sent /omni:qa 1 --round 2 to the night-shift fleet\'s runners (run 1, round 2).'],
      ['checked', 'qa', 'e', COMMENT, 'pass · Round 2 of 2'],
    ]);
  });

  it('records a fix only once it landed or was marked, and each verdict once: a replay finds them', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 12))), job(1, 1, 'qa-fix:1:1', fixed('c', 15))];
    const waiting = recordedNow(runs, { recorded: seen('a'), qaView: view({ landings: new Map([['c', { state: 'waits', lacks: ['test not finished'] }]]) }) });
    expect(waiting.filter((e) => e.job === 'c').map((e) => e.kind)).toEqual(['dispatched']);
    const refused = recordedNow(runs, { recorded: seen('a'), qaView: view({ landings: new Map([['c', { state: 'refused', why: '#15 is red: test failed' }]]) }) });
    expect(refused.find((e) => e.job === 'c' && e.kind === 'job-ended')?.sentence).toBe('not fixed #12: #15 is red: test failed');
    const again = recordedNow(runs, { recorded: [...seen('a'), ...refused.flatMap((e) => (e.job === null ? [] : [{ kind: e.kind, job: e.job }]))], qaView: view({ landings: new Map([['c', { state: 'refused', why: '#15 is red: test failed' }]]) }) });
    expect(again.filter((e) => e.kind === 'checked' || e.kind === 'job-ended' || e.kind === 'dispatched')).toEqual([]);
  });

  it('signs a QA job that failed as QA\'s, saying its verdict was not read', () => {
    const list = recordedNow([built, job(1, 1, 'qa:1', qa('b', 'nothing'))], { recorded: seen('a') });
    expect(list.filter((e) => e.kind === 'job-ended').map((e) => [e.role, e.job, e.sentence])).toEqual([['qa', 'b', 'PRD 1\'s job failed: verdict not read.']]);
  });

  it('records the wait on a person to decide the bugs', () => {
    const runs = [built, job(1, 1, 'qa:1', qa('b', bugs(1, 13))), job(1, 1, 'qa-fix:1:1', done('c', 'already-fixed')), job(1, 1, 'qa:2', qa('e', bugs(2, 13)))];
    const list = recordedNow(runs, { recorded: [...seen('a', 'b', 'c'), { kind: 'dispatched', job: 'e' }] });
    expect(list.map((e) => [e.kind, e.role, e.sentence])).toEqual([
      ['checked', 'qa', '1 bug still there · Round 2 of 2 · #13'],
      ['waits', 'supervisor', 'Waits on a person: PRD 1: decide bug #13'],
    ]);
  });
});
