// The supervisor's Reviewer hand-offs (PRD 2871 s5): the build sent for review, the Reviewer's two rounds, the fix
// between them, and a person after round 2. Beside `supervisor.test.ts`, which proves BR-PRODUCT-139 and is left as
// it was but for the build's line. Since PRD 3001 a build ready for review meets QA first (`qa.test.ts`): the Reviewer's
// round 1 follows QA's pass.
import { describe, expect, it } from 'vitest';
import { parsePrd, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { qaLine } from 'omni-loop/kit/lib/qa/verdict.ts';
import { conclude, endOf, eventsOf, lineOf, missionKey, outcome, pick, postedOf, prdStates, recordedKeys, runOfKey, type Attempt, type Mission, type PrdFacts, type Posted, type Run, type Step } from './supervisor.ts';

const ID = '7a3e9c10-52b4-4f8d-a1e6-3b0c9d2f4e88';
const AT = Date.parse('2027-01-22T10:00:00Z');
const prd = (n: number): PrdNumber => parsePrd(n);

const PR = 'https://github.com/acme/widgets/pull/9';
const REVIEW = `${PR}#pullrequestreview-41`;

const team = (over: Partial<Mission> = {}): Mission => ({ id: ID, fleet: 'night-shift', status: 'running', parallel: 2, waitingOn: null, level: 'with-you', number: 12, title: 'Faster quotes', ...over });
const one = (n: number, over: Partial<PrdFacts> = {}): PrdFacts => ({ prd: prd(n), approval: 'standing', stage: 'open', blockers: [], territory: [`apps/ground-${String(n)}/`], ...over });
const busy = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'running', outcome: null, reason: null, prUrl: null, ...over });
const done = (id: string, word: string | null, over: Partial<Attempt> = {}): Attempt => busy(id, { status: 'done', outcome: word, ...over });
/** The job of step `step` of run `k` of PRD `n`. */
const job = (n: number, k: number, step: Step, ...attempts: Attempt[]): Run => ({ prd: prd(n), run: k, step, job: attempts[0]?.id ?? `j-${String(n)}-${String(k)}-${step}`, attempts });

/** What a run sends: each PRD, its run and its step. */
const sent = (m: Mission, all: PrdFacts[], runs: Run[] = []) => pick({ mission: m, facts: all, states: prdStates(all, runs) }).map((send) => [Number(send.prd), send.run, send.step]);
const stateOf = (all: PrdFacts[], runs: Run[]) => prdStates(all, runs).get(prd(1));

/** The events a run records, `recorded` read back as keys. */
function recordedNow({ all = [one(1)], runs, recorded = [] }: { all?: PrdFacts[]; runs: Run[]; recorded?: { kind: string; job: string }[] }) {
  const m = team();
  const states = prdStates(all, runs);
  const next = conclude({ mission: m, facts: all, states, sent: 0, now: AT });
  return eventsOf({ mission: m, facts: all, states, runs, next, toFleet: true, recorded: recordedKeys(recorded.map(({ kind, job: id }) => ({ kind, prd: prd(1), job: id }))) });
}
/** The keys of jobs whose dispatch and end are already recorded. */
const seen = (...jobs: string[]) => jobs.flatMap((id) => [{ kind: 'dispatched', job: id }, { kind: 'job-ended', job: id }]);

const built = job(1, 1, 'build', done('a', 'review', { prUrl: PR }));
/** QA's pass of run `k` (PRD 3001): the Reviewer comes after it. */
const qaPassed = (k: number): Run => job(1, k, 'qa:1', done(`q-${String(k)}`, null, { checked: qaLine(`omni qa: posted round 1 (pass) on PR #9: ${PR}#issuecomment-1`) }));

describe('the keys and the lines of the Reviewer and the fix', () => {
  it('keys the Reviewer\'s rounds and the fix after round 1 under the run, and reads them back', () => {
    expect(missionKey(ID, prd(2803), 1, 'review:1')).toBe(`mission:${ID}:prd:2803:run:1:review:1`);
    expect(missionKey(ID, prd(2803), 1, 'fix:1')).toBe(`mission:${ID}:prd:2803:run:1:fix:1`);
    expect(missionKey(ID, prd(2803), 2, 'review:2')).toBe(`mission:${ID}:prd:2803:run:2:review:2`);
    expect(missionKey(ID, prd(2803), 1, 'build')).toBe(`mission:${ID}:prd:2803:run:1`);
    expect(runOfKey(`mission:${ID}:prd:2803:run:1:review:1`)).toEqual({ prd: 2803, run: 1, step: 'review:1' });
    expect(runOfKey(`mission:${ID}:prd:2803:run:1:fix:1`)).toEqual({ prd: 2803, run: 1, step: 'fix:1' });
    expect(runOfKey(`mission:${ID}:prd:2803:run:1:review:2`)).toEqual({ prd: 2803, run: 1, step: 'review:2' });
    // A third round, or a fix after round 2, has no key.
    expect(runOfKey(`mission:${ID}:prd:2803:run:1:review:3`)).toBeNull();
    expect(runOfKey(`mission:${ID}:prd:2803:run:1:fix:2`)).toBeNull();
  });

  it('sends the build for review, the Reviewer, and the fix for review', () => {
    expect(lineOf(prd(7), 'build')).toBe('/omni:yolo 7 --for-review');
    expect(lineOf(prd(7), 'review:1')).toBe('/omni:review 7');
    expect(lineOf(prd(7), 'review:2')).toBe('/omni:review 7');
    expect(lineOf(prd(7), 'fix:1')).toBe('/omni:yolo-fix 7 --for-review');
  });

  it('builds a plan repository\'s PRD with /omni:ultra-yolo unchanged, which takes no --for-review (PRD 2873)', () => {
    expect(lineOf(prd(7), 'build', 'ultra-yolo')).toBe('/omni:ultra-yolo 7');
    expect(lineOf(prd(7), 'fix:1', 'ultra-yolo')).toBe('/omni:ultra-yolo-fix 7 --for-review');
    expect(lineOf(prd(7), 'review:1', 'ultra-yolo')).toBe('/omni:review 7');
    expect(lineOf(prd(7), 'build', 'yolo')).toBe(lineOf(prd(7), 'build'));
  });
});

describe('the table, step by step', () => {
  it('reads the two new hand-offs', () => {
    expect(endOf(done('j', 'review'))).toBe('review');
    expect(endOf(done('j', 'changes'))).toBe('changes');
  });

  it('maps each end at its step', () => {
    // A build shipped for review goes to QA first (PRD 3001), a plan repository's straight to the Reviewer; a fix, to round 2.
    expect(outcome('review', 1, null, 'build')).toEqual({ next: 'send', step: 'qa:1' });
    expect(outcome('review', 1, null, 'build', false)).toEqual({ next: 'send', step: 'review:1' });
    expect(outcome('review', 1, null, 'fix:1')).toEqual({ next: 'send', step: 'review:2' });
    // Changes in round 1 send the fix; in round 2 a person decides.
    expect(outcome('changes', 1, null, 'review:1')).toEqual({ next: 'send', step: 'fix:1' });
    expect(outcome('changes', 1, null, 'review:2')).toEqual({ next: 'waits', on: 'decide' });
    // The Reviewer's pass marked the PR ready: it waits for a merge.
    expect(outcome('ready', 1, null, 'review:1')).toEqual({ next: 'waits', on: 'merge' });
    expect(outcome('ready', 2, null, 'review:2')).toEqual({ next: 'waits', on: 'merge' });
    // A stopped Reviewer is sent again once, then the PRD stops.
    expect(outcome('stopped', 1, null, 'review:1')).toEqual({ next: 'again' });
    expect(outcome('stopped', 2, null, 'review:2')).toEqual({ next: 'stops', why: 'it stopped mid-way twice' });
    // A hand-off its step never ends on reads as stopped mid-way.
    expect(outcome('review', 1, null, 'review:1')).toEqual({ next: 'again' });
    expect(outcome('changes', 2, null, 'build')).toEqual({ next: 'stops', why: 'it stopped mid-way twice' });
  });
});

describe('build, review, fix, review, then a person', () => {
  it('sends the build as run 1, before any review', () => {
    expect(sent(team(), [one(1)])).toEqual([[1, 1, 'build']]);
  });

  it('a build shipped for review goes to QA (PRD 3001), and QA\'s pass sends the Reviewer\'s round 1, under the same run', () => {
    expect(sent(team(), [one(1)], [built])).toEqual([[1, 1, 'qa:1']]);
    expect(sent(team(), [one(1)], [built, qaPassed(1)])).toEqual([[1, 1, 'review:1']]);
  });

  it('changes in round 1 send the fix; the fix shipped for review sends round 2', () => {
    const asked = job(1, 1, 'review:1', done('b', 'changes'));
    expect(sent(team(), [one(1)], [built, asked])).toEqual([[1, 1, 'fix:1']]);
    expect(sent(team(), [one(1)], [built, asked, job(1, 1, 'fix:1', done('c', 'review'))])).toEqual([[1, 1, 'review:2']]);
  });

  it('changes in round 2 make the PRD wait on a person, naming its PR, and nothing more is sent', () => {
    const before = [built, job(1, 1, 'review:1', done('b', 'changes')), job(1, 1, 'fix:1', done('c', 'review'))];
    const runs = [...before, job(1, 1, 'review:2', done('d', 'changes', { prUrl: 'https://github.com/acme/widgets/pull/2817' }))];
    expect(sent(team(), [one(1)], runs)).toEqual([]);
    expect(stateOf([one(1)], runs)).toEqual({ state: 'waits', on: 'decide', pr: 2817 });
    expect(conclude({ mission: team(), facts: [one(1)], states: prdStates([one(1)], runs), sent: 0, now: AT })).toMatchObject({
      status: 'waiting',
      waitingOn: 'PRD 1: decide the Reviewer\'s findings on PR #2817',
    });
    const noLink = [...before, job(1, 1, 'review:2', done('d', 'changes'))];
    expect(conclude({ mission: team(), facts: [one(1)], states: prdStates([one(1)], noLink), sent: 0, now: AT }).waitingOn).toBe('PRD 1: decide the Reviewer\'s findings on its feature PR');
  });

  it('the PR turning ready after round 2 waits for its merge; the mission never sends round 3', () => {
    const runs = [built, job(1, 1, 'review:1', done('b', 'changes')), job(1, 1, 'fix:1', done('c', 'review')), job(1, 1, 'review:2', done('d', 'changes'))];
    expect(stateOf([one(1, { stage: 'ready' })], runs)).toEqual({ state: 'waits', on: 'merge' });
    expect(sent(team(), [one(1, { stage: 'ready' })], runs)).toEqual([]);
  });

  it('the Reviewer\'s pass waits for a person to merge', () => {
    const runs = [built, job(1, 1, 'review:1', done('b', 'ready'))];
    expect(stateOf([one(1)], runs)).toEqual({ state: 'waits', on: 'merge' });
    expect(sent(team(), [one(1)], runs)).toEqual([]);
  });

  it('a Reviewer still at work holds the PRD running, and counts against the mandate', () => {
    const runs = [built, job(1, 1, 'review:1', busy('b'))];
    expect(stateOf([one(1)], runs)).toEqual({ state: 'running', run: 1 });
    expect(sent(team({ parallel: 1 }), [one(1), one(2)], runs)).toEqual([]);
  });

  it('a stopped Reviewer is sent again once, as run 2 of the same round; a second time the PRD stops', () => {
    const once = [built, job(1, 1, 'review:1', done('b', 'stopped'))];
    expect(sent(team(), [one(1)], once)).toEqual([[1, 2, 'review:1']]);
    const twice = [...once, job(1, 2, 'review:1', done('c', 'stopped'))];
    expect(sent(team(), [one(1)], twice)).toEqual([]);
    expect(stateOf([one(1)], twice)).toEqual({ state: 'stopped', why: 'it stopped mid-way twice' });
  });

  it('a held fix is sent again once, as run 2 of the fix, then its round 2 goes under run 2', () => {
    const base = [built, job(1, 1, 'review:1', done('b', 'changes')), job(1, 1, 'fix:1', done('c', 'held'))];
    expect(sent(team(), [one(1)], base)).toEqual([[1, 2, 'fix:1']]);
    expect(sent(team(), [one(1)], [...base, job(1, 2, 'fix:1', done('d', 'review'))])).toEqual([[1, 2, 'review:2']]);
  });

  it('a build sent again after a stop is checked and reviewed under its own run', () => {
    const again = [job(1, 1, 'build', done('a', 'stopped')), job(1, 2, 'build', done('b', 'review'))];
    expect(sent(team(), [one(1)], again)).toEqual([[1, 2, 'qa:1']]);
    expect(sent(team(), [one(1)], [...again, qaPassed(2)])).toEqual([[1, 2, 'review:1']]);
  });

  it('a step after the build never waits on the approval again; a build sent again still does', () => {
    const voided = one(1, { approval: 'voided' });
    expect(sent(team(), [voided], [built])).toEqual([[1, 1, 'qa:1']]);
    expect(sent(team(), [voided], [built, qaPassed(1)])).toEqual([[1, 1, 'review:1']]);
    expect(sent(team(), [voided], [built, job(1, 1, 'review:1', done('b', 'stopped'))])).toEqual([[1, 2, 'review:1']]);
    expect(sent(team(), [voided], [job(1, 1, 'build', done('a', 'stopped'))])).toEqual([]);
  });

  it('a failed or cancelled Reviewer is never sent again', () => {
    const failed = [built, job(1, 1, 'review:1', busy('b', { status: 'failed', reason: 'GitHub refused the review' }))];
    expect(sent(team(), [one(1)], failed)).toEqual([]);
    expect(stateOf([one(1)], failed)).toEqual({ state: 'stopped', why: 'its job failed: GitHub refused the review' });
    expect(stateOf([one(1)], [built, job(1, 1, 'review:1', busy('b', { status: 'cancelled' }))])).toEqual({ state: 'paused' });
  });
});

describe('postedOf: the Reviewer\'s count and its review\'s link, from its job\'s log', () => {
  const LINK = 'https://github.com/acme/widgets/pull/12#pullrequestreview-99';

  it('reads the posted line: its findings and its link', () => {
    expect(postedOf(`working\n10:01:02 omni review: posted round 1 (changes, 2 findings) on PR #12: ${LINK}\n/omni:yolo-fix 7 --for-review`)).toEqual({ findings: 2, url: LINK });
    expect(postedOf(`omni review: posted round 2 (changes, 1 finding) on PR #12: ${LINK}`)).toEqual({ findings: 1, url: LINK });
    expect(postedOf(`omni review: posted round 2 (pass) on PR #12: ${LINK}`)).toEqual({ findings: 0, url: LINK });
  });

  it('reads a round already posted: its link, no count', () => {
    expect(postedOf('omni review: round 1 is already posted on PR #12: https://github.com/acme/widgets/pull/12#pullrequestreview-7. Nothing posted.')).toEqual({ findings: null, url: 'https://github.com/acme/widgets/pull/12#pullrequestreview-7' });
  });

  it('takes the last posted line, and none from a log without one or with a link that is not GitHub\'s', () => {
    expect(postedOf(`omni review: posted round 1 (changes, 3 findings) on PR #12: ${LINK}\nomni review: posted round 1 (changes, 4 findings) on PR #12: ${LINK}`)?.findings).toBe(4);
    expect(postedOf('')).toBeNull();
    expect(postedOf('nothing posted here')).toBeNull();
    expect(postedOf('omni review: posted round 1 (changes, 2 findings) on PR #12: https://evil.example/pull/12')).toEqual({ findings: 2, url: null });
  });
});

describe('the Reviewer\'s rows on the ledger', () => {
  const verdict = (id: string, word: 'changes' | 'ready', posted?: Posted): Attempt => done(id, word, posted === undefined ? { prUrl: PR } : { prUrl: PR, posted });

  it('records the build shipped for review, then the Reviewer sent, by the supervisor', () => {
    const list = recordedNow({ runs: [built, job(1, 1, 'review:1', busy('b', { status: 'queued' }))], recorded: [{ kind: 'dispatched', job: 'a' }] });
    expect(list.map((e) => [e.kind, e.role, e.job, e.link, e.sentence])).toEqual([
      ['job-ended', 'engineer', 'a', PR, 'Shipped; waits for review.'],
      ['dispatched', 'supervisor', 'b', null, 'Sent /omni:review 1 to the night-shift fleet\'s runners (run 1, round 1).'],
    ]);
  });

  it('records each verdict as reviewed, by the Reviewer, linking its review', () => {
    const runs = [built, job(1, 1, 'review:1', verdict('b', 'changes', { findings: 2, url: REVIEW })), job(1, 1, 'fix:1', done('c', 'review', { prUrl: PR })), job(1, 1, 'review:2', verdict('d', 'ready', { findings: 0, url: REVIEW }))];
    const list = recordedNow({ runs, recorded: seen('a') });
    expect(list.filter((e) => e.kind !== 'waits').map((e) => [e.kind, e.role, e.job, e.link, e.sentence])).toEqual([
      ['dispatched', 'supervisor', 'b', null, 'Sent /omni:review 1 to the night-shift fleet\'s runners (run 1, round 1).'],
      ['reviewed', 'reviewer', 'b', REVIEW, 'Changes asked: 2 findings, round 1/2.'],
      ['dispatched', 'supervisor', 'c', null, 'Sent /omni:yolo-fix 1 --for-review to the night-shift fleet\'s runners (run 1).'],
      ['job-ended', 'engineer', 'c', PR, 'Fixed 2 findings; shipped again.'],
      ['dispatched', 'supervisor', 'd', null, 'Sent /omni:review 1 to the night-shift fleet\'s runners (run 1, round 2).'],
      ['reviewed', 'reviewer', 'd', REVIEW, 'Passed, round 2 of 2: marked ready.'],
    ]);
  });

  it('says the fix fixed the findings when round 1\'s count is unknown, and one finding as one', () => {
    const fixAfter = (posted?: Posted) => {
      const runs = [built, job(1, 1, 'review:1', verdict('b', 'changes', posted)), job(1, 1, 'fix:1', done('c', 'review'))];
      return recordedNow({ runs, recorded: [...seen('a', 'b'), { kind: 'dispatched', job: 'c' }] }).find((e) => e.job === 'c')?.sentence;
    };
    expect(fixAfter()).toBe('Fixed the findings; shipped again.');
    expect(fixAfter({ findings: 1, url: null })).toBe('Fixed 1 finding; shipped again.');
    // A fix sent again as run 2 still counts round 1's findings.
    const again = [built, job(1, 1, 'review:1', verdict('b', 'changes', { findings: 3, url: null })), job(1, 1, 'fix:1', done('c', 'stopped')), job(1, 2, 'fix:1', done('d', 'review'))];
    expect(recordedNow({ runs: again, recorded: [...seen('a', 'b', 'c'), { kind: 'dispatched', job: 'd' }] }).find((e) => e.job === 'd')?.sentence).toBe('Fixed 3 findings; shipped again.');
  });

  it('says one finding as one, links the PR when the log named no review, and leaves the count out when it gave none', () => {
    const oneFinding = recordedNow({ runs: [built, job(1, 1, 'review:1', verdict('b', 'changes', { findings: 1, url: null }))], recorded: [...seen('a'), { kind: 'dispatched', job: 'b' }] });
    expect(oneFinding.find((e) => e.kind === 'reviewed')).toMatchObject({ link: PR, sentence: 'Changes asked: 1 finding, round 1/2.' });
    const unknown = recordedNow({ runs: [built, job(1, 1, 'review:1', verdict('b', 'changes'))], recorded: seen('a') });
    expect(unknown.find((e) => e.kind === 'reviewed')?.sentence).toBe('Changes asked, round 1/2.');
  });

  it('records round 2\'s changes, and the wait on a person', () => {
    const runs = [built, job(1, 1, 'review:1', done('b', 'changes')), job(1, 1, 'fix:1', done('c', 'review')), job(1, 1, 'review:2', verdict('d', 'changes', { findings: 3, url: REVIEW }))];
    const list = recordedNow({ runs, recorded: [...seen('a', 'b', 'c'), { kind: 'dispatched', job: 'd' }] });
    expect(list.map((e) => [e.kind, e.role, e.sentence])).toEqual([
      ['reviewed', 'reviewer', 'Changes asked: 3 findings, round 2/2.'],
      ['waits', 'supervisor', 'Waits on a person: PRD 1: decide the Reviewer\'s findings on PR #9'],
    ]);
  });

  it('signs a Reviewer job that failed or was lost as the Reviewer\'s', () => {
    const runs = [built, job(1, 1, 'review:1', busy('b', { status: 'failed', reason: 'runner lost' }), busy('b2', { status: 'failed', reason: 'GitHub refused the review' }))];
    const list = recordedNow({ runs, recorded: [...seen('a'), { kind: 'dispatched', job: 'b' }] });
    expect(list.filter((e) => e.kind === 'job-ended').map((e) => [e.role, e.job, e.sentence])).toEqual([
      ['reviewer', 'b', 'PRD 1\'s runner was lost: its resume carries the work on.'],
      ['reviewer', 'b2', 'PRD 1\'s job failed: GitHub refused the review.'],
    ]);
  });

  it('records each verdict once: a replay finds it', () => {
    const runs = [built, job(1, 1, 'review:1', verdict('b', 'changes', { findings: 2, url: REVIEW }))];
    const first = recordedNow({ runs, recorded: seen('a') });
    expect(first.filter((e) => e.kind === 'reviewed')).toHaveLength(1);
    const again = recordedNow({ runs, recorded: [...seen('a'), ...first.flatMap((e) => (e.job === null ? [] : [{ kind: e.kind, job: e.job }]))] });
    expect(again.filter((e) => e.kind === 'reviewed')).toEqual([]);
  });
});
