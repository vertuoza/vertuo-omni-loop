import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { BugJob } from './bug-team.ts';
import {
  brainstormLine,
  namedOutside,
  outsideBugLine,
  outsideEvents,
  outsideFixLine,
  outsideLanding,
  outsideLinesOf,
  outsidePicks,
  outsideStateOf,
  outsideStates,
  takenEvent,
  OUTSIDE_JOBS,
  type Naming,
  type Outside,
  type OutsideBug,
  type OutsideView,
} from './outside-bug.ts';
import type { FixLanding } from './repair.ts';
import type { Attempt } from './supervisor.ts';

// The Engineer's outside bugs (PRD omni-loop-21 s11): pure, over the jobs that named them and the bug-fix jobs the mission sent.

const REPO = 'acme/widgets';
const BRANCH = 'mission/7-faster-quotes';
const i = parseIssue;

const line = (issue: number, sentence = 'The quotes page crashes on an empty total.', repo = REPO): string => outsideBugLine({ repo, issue: i(issue), sentence });
const naming = (log: string | null, over: Partial<Naming> = {}): Naming => ({ by: 'qa', prd: parsePrd(1), job: 'qa-job', log, ...over });
const bug = (issue = 40, over: Partial<OutsideBug> = {}): OutsideBug => ({ repo: REPO, issue: i(issue), sentence: 'The quotes page crashes on an empty total.', by: 'qa', prd: parsePrd(1), namedIn: 'qa-job', ...over });
const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const job = (issue: number, k: number, over: Partial<Attempt> = {}): BugJob => ({ issue: i(issue), k, job: `bug-${String(issue)}-${String(k)}`, attempts: [attempt(`bug-${String(issue)}-${String(k)}`, over)] });
const opened = (issue: number, k: number, pr = 15): BugJob => job(issue, k, { outcome: 'pr-opened', prUrl: `https://github.com/${REPO}/pull/${String(pr)}` });
const view = (over: Partial<OutsideView> = {}): OutsideView => ({ repo: REPO, branch: BRANCH, jobs: [], landings: new Map(), ...over });

describe('the outside-bug line', () => {
  it('reads each bug a job names, its first line kept, five at most', () => {
    const log = ['12:00:01 ' + line(40), 'noise', line(41, 'The default branch is red on the sum test.'), line(40, 'Another sentence.')].join('\n');
    expect(outsideLinesOf(log)).toEqual([
      { repo: REPO, issue: 40, sentence: 'The quotes page crashes on an empty total.' },
      { repo: REPO, issue: 41, sentence: 'The default branch is red on the sum test.' },
    ]);
    expect(outsideLinesOf([1, 2, 3, 4, 5, 6].map((n) => line(n)).join('\n'))).toHaveLength(5);
    expect(outsideLinesOf(null)).toEqual([]);
  });

  it('skips a line that does not read whole: no repository, two sentences, a token', () => {
    expect(outsideLinesOf('omni outside-bug: #40 on widgets: It crashes.')).toEqual([]);
    expect(outsideLinesOf(line(40, 'It crashes. It crashes again.'))).toEqual([]);
    // A token-shaped fake, built at runtime so no credential shape is ever committed.
    const token = ['ghp', 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE3fG5'].join('_');
    expect(outsideLinesOf(line(40, `It leaks ${token} in the log.`))).toEqual([]);
    expect(outsideLinesOf('omni outside-bug: #0 on acme/widgets: It crashes.')).toEqual([]);
  });
});

describe('namedOutside', () => {
  it('keeps each bug once, in the order the jobs named them, with who named it', () => {
    const bugs = namedOutside([naming(line(40)), naming(`${line(41)}\n${line(40)}`, { by: 'reviewer', job: 'review-job' })], { repo: REPO, scope: [1] });
    expect(bugs.map((one) => [one.issue, one.by, one.namedIn])).toEqual([
      [40, 'qa', 'qa-job'],
      [41, 'reviewer', 'review-job'],
    ]);
  });

  it("never reads one of the mission's own PRDs as an outside bug, on its own repository", () => {
    expect(namedOutside([naming(`${line(1)}\n${line(1, 'It crashes.', 'acme/other')}`)], { repo: REPO, scope: [1] }).map((one) => one.repo)).toEqual(['acme/other']);
  });
});

describe('where an outside bug stands', () => {
  it("is sent the Engineer's bug fix into the mission branch, never the default branch", () => {
    expect(outsideStateOf(bug(), view())).toEqual({ state: 'send', k: 1, line: `/omni:bug-fix #40 --base ${BRANCH}`, tries: 0 });
    expect(outsideFixLine(i(40), BRANCH)).toBe(`/omni:bug-fix #40 --base ${BRANCH}`);
  });

  it('is listed, never fixed, on another repository or with no mission branch', () => {
    expect(outsideStateOf(bug(40, { repo: 'acme/other' }), view())).toMatchObject({ state: 'listed', job: null, why: "the mission's Engineer works in acme/widgets only" });
    expect(outsideStateOf(bug(), view({ branch: null }))).toMatchObject({ state: 'listed', why: 'the mission has no branch of its own to fix it on' });
  });

  it('is being fixed while its job is at work', () => {
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { status: 'running' })] }))).toEqual({ state: 'fixing', job: 'bug-40-1' });
  });

  it('joins through the merge gate: joining while it waits, fixed once landed, listed when it cannot join', () => {
    const jobs = [opened(40, 1)];
    expect(outsideStateOf(bug(), view({ jobs }))).toEqual({ state: 'joining', job: 'bug-40-1', pr: 15, lacks: [] });
    const waits: FixLanding = { state: 'waits', lacks: ['ci not finished'] };
    expect(outsideStateOf(bug(), view({ jobs, landings: new Map([['bug-40-1', waits]]) }))).toMatchObject({ state: 'joining', lacks: ['ci not finished'] });
    expect(outsideStateOf(bug(), view({ jobs, landings: new Map([['bug-40-1', { state: 'landed' }]]) }))).toEqual({ state: 'fixed', job: 'bug-40-1', pr: 15 });
    expect(outsideStateOf(bug(), view({ jobs, landings: new Map([['bug-40-1', { state: 'refused', why: '#15 is red: ci failed' }]]) }))).toMatchObject({
      state: 'listed',
      why: 'its fix #15 cannot join the mission branch: #15 is red: ci failed',
      brainstorm: null,
    });
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'pr-opened' })] }))).toMatchObject({ state: 'listed', why: 'its bug fix opened no pull request it names' });
  });

  it('is fixed already when its bug fix says so', () => {
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'already-fixed' })] }))).toEqual({ state: 'fixed', job: 'bug-40-1', pr: null });
  });

  it('a fix that stops at the boundary is listed for landing with its /omni:brainstorm line', () => {
    const line = '/omni:brainstorm The quotes page crashes on an empty total (acme/widgets#40)';
    expect(brainstormLine(bug())).toBe(line);
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'needs-brainstorm' })] }))).toEqual({ state: 'listed', job: 'bug-40-1', why: 'its fix is more than a bug fix', brainstorm: line });
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'human' })] }))).toMatchObject({ state: 'listed', brainstorm: line });
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'not-a-bug' })] }))).toMatchObject({ state: 'listed', brainstorm: null });
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { status: 'cancelled' })] }))).toMatchObject({ state: 'listed', why: 'a person stopped its bug fix' });
  });

  it('is sent again after a spent try, and listed on the third, saying what was tried', () => {
    expect(outsideStateOf(bug(), view({ jobs: [job(40, 1, { outcome: 'stuck' })] }))).toEqual({ state: 'send', k: 2, line: `/omni:bug-fix #40 --base ${BRANCH}`, tries: 1 });
    const spent = [job(40, 1, { outcome: 'stuck' }), job(40, 2, { status: 'failed' }), job(40, 3, { outcome: 'blocked' })];
    expect(outsideStateOf(bug(), view({ jobs: spent }))).toEqual({ state: 'listed', job: 'bug-40-3', why: 'its bug fix ended stuck, failed, blocked in 3 tries', brainstorm: null });
  });

  it('is sent again after a lost runner, spending no try, six jobs at most', () => {
    const lost = (k: number) => job(40, k, { status: 'failed', reason: 'runner lost' });
    expect(outsideStateOf(bug(), view({ jobs: [lost(1)] }))).toMatchObject({ state: 'send', k: 2, tries: 0 });
    const all = Array.from({ length: OUTSIDE_JOBS }, (_, n) => lost(n + 1));
    expect(outsideStateOf(bug(), view({ jobs: all }))).toMatchObject({ state: 'listed', why: 'its bug fix was sent 6 times without an end' });
  });
});

describe('outsidePicks', () => {
  it('sends one bug at a time, the first named', () => {
    const states = outsideStates([bug(40), bug(41)], view());
    expect(outsidePicks(states).map((one) => one.issue)).toEqual([40]);
    expect(outsidePicks(outsideStates([bug(40), bug(41)], view({ jobs: [job(40, 1, { status: 'running' })] })))).toEqual([]);
    expect(outsidePicks(outsideStates([bug(40), bug(41)], view({ jobs: [opened(40, 1)] })))).toEqual([]);
    expect(outsidePicks(outsideStates([bug(40), bug(41)], view({ jobs: [job(40, 1, { outcome: 'already-fixed' })] }))).map((one) => one.issue)).toEqual([41]);
  });
});

describe('the events', () => {
  const at = (jobs: BugJob[], landings: [string, FixLanding][] = []): Outside[] => outsideStates([bug()], view({ jobs, landings: new Map(landings) }));

  it('tells the room a bug-fix job was sent, naming who named the bug', () => {
    const [sent] = outsidePicks(outsideStates([bug()], view()));
    expect(sent).toBeDefined();
    if (sent === undefined) return;
    expect(takenEvent(sent, 'job-9')).toEqual({
      kind: 'bug-taken',
      role: 'supervisor',
      prd: null,
      job: 'job-9',
      link: `https://github.com/${REPO}/issues/40`,
      sentence: `QA named acme/widgets#40 outside the mission's PRDs: sent /omni:bug-fix #40 --base ${BRANCH}, try 1 of 3.`,
    });
  });

  it('says a fix opened, then joined, keyed by its job, linking the pull request', () => {
    expect(outsideEvents(at([opened(40, 1)]))).toEqual([
      { kind: 'job-ended', role: 'engineer', prd: null, job: 'bug-40-1', link: `https://github.com/${REPO}/pull/15`, sentence: 'acme/widgets#40: fix PR #15 is open into the mission branch; it joins once green.' },
    ]);
    expect(outsideEvents(at([opened(40, 1)], [['bug-40-1', { state: 'landed' }]])).map((one) => [one.kind, one.sentence])).toEqual([
      ['job-ended', 'acme/widgets#40: fix PR #15 joined the mission branch.'],
      ['bug-fixed', 'acme/widgets#40 is fixed on the mission branch by #15.'],
    ]);
  });

  it('says a bug is listed once its job ended, and nothing for one listed before any job or still at work', () => {
    expect(outsideEvents(at([job(40, 1, { outcome: 'needs-brainstorm' })])).map((one) => [one.kind, one.role, one.sentence])).toEqual([
      ['bug-asked', 'supervisor', 'acme/widgets#40: its bug fix ended, and the bug is listed for the person: its fix is more than a bug fix.'],
    ]);
    expect(outsideEvents(outsideStates([bug(40, { repo: 'acme/other' })], view()))).toEqual([]);
    expect(outsideEvents(at([job(40, 1, { status: 'running' })]))).toEqual([]);
    expect(outsideEvents(at([]))).toEqual([]);
  });
});

describe('landing', () => {
  it('lists every outside bug, fixed or not, with its brainstorm line when it crossed the boundary', () => {
    const states = [
      ...outsideStates([bug(40)], view({ jobs: [opened(40, 1)], landings: new Map([['bug-40-1', { state: 'landed' }]]) })),
      ...outsideStates([bug(41, { by: 'reviewer' })], view({ jobs: [job(41, 1, { outcome: 'needs-brainstorm' })] })),
      ...outsideStates([bug(42, { repo: 'acme/other', by: 'repair' })], view()),
      ...outsideStates([bug(43)], view({ jobs: [job(43, 1, { status: 'running' })] })),
      ...outsideStates([bug(44)], view({ jobs: [opened(44, 1, 16)] })),
      ...outsideStates([bug(45)], view({ jobs: [job(45, 1, { outcome: 'already-fixed' })] })),
    ];
    expect(outsideLanding(states)).toEqual([
      'Fixed by #15 · acme/widgets#40 (named by QA): The quotes page crashes on an empty total',
      'Not fixed, its fix is more than a bug fix · acme/widgets#41 (named by the Reviewer): The quotes page crashes on an empty total · design it first: `/omni:brainstorm The quotes page crashes on an empty total (acme/widgets#41)`',
      "Not fixed, the mission's Engineer works in acme/widgets only · acme/other#42 (named by a repair): The quotes page crashes on an empty total",
      'Being fixed · acme/widgets#43 (named by QA): The quotes page crashes on an empty total',
      'Fix #16 not joined yet · acme/widgets#44 (named by QA): The quotes page crashes on an empty total',
      'Fixed already · acme/widgets#45 (named by QA): The quotes page crashes on an empty total',
    ]);
  });
});
