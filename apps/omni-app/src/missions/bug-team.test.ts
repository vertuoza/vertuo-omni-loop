// The Omni Loop bug team's decisions (PRD 3088 s3): the pick, each job's end to the bug's next state, and what the room is told.
// Pure: no database, no GitHub, no clock.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import { askedWords, bugAfter, bugEndOf, bugFixLine, bugKey, bugOfKey, BUG_TRIES, nextK, pickBugs, takenEvent, triedOf, type Bug, type BugJob, type IssueRead } from './bug-team.ts';
import type { Attempt } from './supervisor.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const REPO = 'vertuoza/vertuo-omni-loop';
const i = (n: number): IssueNumber => parseIssue(n);

const bug = (issue: number, over: Partial<Bug> = {}): Bug => ({
  fingerprint: String(issue).padStart(64, 'a'),
  issue: i(issue),
  count: 1,
  createdAt: '2027-01-20T09:00:00Z',
  state: 'open',
  attempts: 0,
  fixPr: null,
  fixedIn: null,
  askedJob: null,
  ...over,
});

const attempt = (id: string, over: Partial<Attempt> = {}): Attempt => ({ id, status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const job = (issue: number, k: number, ...attempts: Attempt[]): BugJob => ({ issue: i(issue), k, job: attempts[0]?.id ?? `job-${String(k)}`, attempts });
const open: IssueRead = { open: true, openFix: null };
const read = (...pairs: [number, IssueRead][]): Map<IssueNumber, IssueRead> => new Map(pairs.map(([n, one]) => [i(n), one]));

describe('a bug job\'s key and line', () => {
  it('keys the k-th job of a bug under the mission, and reads it back', () => {
    expect(bugKey(ID, i(3100), 2)).toBe(`mission:${ID}:bug:3100:run:2`);
    expect(bugOfKey(`mission:${ID}:bug:3100:run:2`)).toEqual({ issue: 3100, k: 2 });
    expect(bugOfKey(`mission:${ID}:prd:7:run:1`)).toBeNull();
    expect(bugOfKey(`mission:${ID}:bug:0:run:1`)).toBeNull();
  });

  it('sends the bug fix of the public issue, and nothing else (AC-9)', () => {
    expect(bugFixLine(i(3100))).toBe('/omni:bug-fix #3100');
  });

  it('numbers a bug\'s next job one past its last', () => {
    expect(nextK([], i(5))).toBe(1);
    expect(nextK([job(5, 1, attempt('a')), job(5, 3, attempt('b')), job(6, 7, attempt('c'))], i(5))).toBe(4);
  });
});

describe('pickBugs', () => {
  it('AC-1: takes the most-reported open bug first, as many as parallel allows', () => {
    const bugs = [bug(1, { count: 2 }), bug(2, { count: 7 })];
    expect(pickBugs({ bugs, jobs: [], issues: read([1, open], [2, open]), parallel: 1 }).map((one) => one.issue)).toEqual([2]);
    expect(pickBugs({ bugs, jobs: [], issues: read([1, open], [2, open]), parallel: 2 }).map((one) => one.issue)).toEqual([2, 1]);
  });

  it('takes the oldest first between two bugs reported as often', () => {
    const bugs = [bug(1, { count: 3, createdAt: '2027-01-21T09:00:00Z' }), bug(2, { count: 3, createdAt: '2027-01-19T09:00:00Z' })];
    expect(pickBugs({ bugs, jobs: [], issues: read([1, open], [2, open]), parallel: 1 }).map((one) => one.issue)).toEqual([2]);
  });

  it('AC-2: leaves alone a bug whose issue has an open pull request that closes it, or is closed, or was not read', () => {
    const bugs = [bug(1, { count: 9 }), bug(2, { count: 8 }), bug(3, { count: 7 }), bug(4, { count: 1 })];
    const issues = read([1, { open: true, openFix: parsePr(40) }], [2, { open: false, openFix: null }], [4, open]);
    expect(pickBugs({ bugs, jobs: [], issues, parallel: 4 }).map((one) => one.issue)).toEqual([4]);
  });

  it('takes only open bugs, and counts the ones being fixed against parallel', () => {
    const states = ['fixing', 'pr-opened', 'asked', 'merged', 'fixed', 'wont-fix'] as const;
    const bugs = [...states.map((state, n) => bug(n + 10, { state, count: 50 })), bug(1), bug(2)];
    const issues = read(...bugs.map((one): [number, IssueRead] => [one.issue, open]));
    expect(pickBugs({ bugs, jobs: [], issues, parallel: 2 }).map((one) => one.issue)).toEqual([1]);
    expect(pickBugs({ bugs, jobs: [], issues, parallel: 1 })).toEqual([]);
  });

  it('never takes an open bug whose job is still at work, and counts it running', () => {
    const bugs = [bug(1, { count: 5 }), bug(2)];
    const jobs = [job(1, 1, attempt('a', { status: 'queued' }))];
    expect(pickBugs({ bugs, jobs, issues: read([1, open], [2, open]), parallel: 1 })).toEqual([]);
    expect(pickBugs({ bugs, jobs, issues: read([1, open], [2, open]), parallel: 2 }).map((one) => one.issue)).toEqual([2]);
  });
});

describe('bugEndOf', () => {
  it('reads each bug fix ending, the runner\'s stored `human` as need-human', () => {
    const url = `https://github.com/${REPO}/pull/45`;
    expect(bugEndOf(attempt('a', { outcome: 'pr-opened', prUrl: url }))).toEqual({ end: 'pr-opened', pr: 45 });
    expect(bugEndOf(attempt('a', { outcome: 'already-fixed', prUrl: url }))).toEqual({ end: 'already-fixed', pr: 45 });
    expect(bugEndOf(attempt('a', { outcome: 'already-fixed' }))).toEqual({ end: 'already-fixed', pr: null });
    expect(bugEndOf(attempt('a', { outcome: 'human' }))).toEqual({ end: 'asked', word: 'need-human' });
    expect(bugEndOf(attempt('a', { outcome: 'needs-brainstorm' }))).toEqual({ end: 'asked', word: 'needs-brainstorm' });
    expect(bugEndOf(attempt('a', { outcome: 'not-a-bug' }))).toEqual({ end: 'asked', word: 'not-a-bug' });
    expect(bugEndOf(attempt('a', { outcome: 'stuck' }))).toEqual({ end: 'spent', word: 'stuck' });
    expect(bugEndOf(attempt('a', { outcome: 'blocked' }))).toEqual({ end: 'spent', word: 'blocked' });
  });

  it('reads a done job with no word it knows and a failure as spending a try', () => {
    expect(bugEndOf(attempt('a', { outcome: null }))).toEqual({ end: 'spent', word: 'unreadable' });
    expect(bugEndOf(attempt('a', { outcome: 'ready' }))).toEqual({ end: 'spent', word: 'unreadable' });
    expect(bugEndOf(attempt('a', { status: 'failed', reason: 'exit 1' }))).toEqual({ end: 'spent', word: 'failed' });
  });

  it('reads a cancel as a person\'s: set aside for a person, never sent again on the team\'s own (P-PRODUCT-114)', () => {
    expect(bugEndOf(attempt('a', { status: 'cancelled' }))).toEqual({ end: 'asked', word: 'cancelled' });
  });

  it('reads a lost runner and a provider limit as lost', () => {
    expect(bugEndOf(attempt('a', { status: 'failed', reason: 'runner lost' }))).toEqual({ end: 'lost' });
    expect(bugEndOf(attempt('a', { status: 'failed', reason: 'the worktree could not be made' }))).toEqual({ end: 'lost' });
    expect(bugEndOf(attempt('a', { status: 'failed', reason: 'no tokens left', limitedUntil: '2027-01-26T10:00:00Z' }))).toEqual({ end: 'lost' });
  });
});

describe('bugAfter', () => {
  const fixing = bug(12, { state: 'fixing', count: 7 });
  const after = (one: Bug, jobs: BugJob[]) => bugAfter(one, { repo: REPO, jobs });

  it('says nothing while the bug\'s job is at work, a resume of it included', () => {
    expect(after(fixing, [job(12, 1, attempt('a', { status: 'running' }))])).toBeNull();
    expect(after(fixing, [job(12, 1, attempt('a', { status: 'failed', reason: 'runner lost' }), attempt('b', { status: 'queued' }))])).toBeNull();
  });

  it('turns pr-opened, keeping its fix pull request, linking it', () => {
    const ended = after(fixing, [job(12, 1, attempt('a', { outcome: 'pr-opened', prUrl: `https://github.com/${REPO}/pull/45` }))]);
    expect(ended?.move).toEqual({ state: 'pr-opened', attempts: 0, fixPr: 45, askedJob: null });
    expect(ended?.event).toEqual({ kind: 'job-ended', role: 'engineer', prd: null, job: 'a', link: `https://github.com/${REPO}/pull/45`, sentence: "Omni Loop bug #12 (reported 7×): fix PR #45 is open; it waits for a person's merge." });
  });

  it('turns merged when the bug fix proved it already fixed', () => {
    const ended = after(fixing, [job(12, 1, attempt('a', { outcome: 'already-fixed', prUrl: `https://github.com/${REPO}/pull/30` }))]);
    expect(ended?.move).toEqual({ state: 'merged', attempts: 0, fixPr: 30, askedJob: null });
    expect(ended?.event?.sentence).toBe('Omni Loop bug #12 (reported 7×) is already fixed by PR #30: it waits for its release.');
  });

  it('AC-3: sets a need-human bug aside as asked, keeping the job whose question waits', () => {
    const ended = after(fixing, [job(12, 1, attempt('job-9', { outcome: 'human' }))]);
    expect(ended?.move).toEqual({ state: 'asked', attempts: 0, fixPr: null, askedJob: 'job-9' });
    expect(ended?.event).toEqual({
      kind: 'bug-asked',
      role: 'supervisor',
      prd: null,
      job: 'job-9',
      link: `https://github.com/${REPO}/issues/12`,
      sentence: 'Omni Loop bug #12 (reported 7×) is set aside: its bug fix needs a person, and its question waits for a person.',
    });
  });

  it('sets aside needs-brainstorm and not-a-bug as asked too: an agent never closes a report alone', () => {
    expect(after(fixing, [job(12, 1, attempt('a', { outcome: 'needs-brainstorm' }))])?.move.state).toBe('asked');
    expect(after(fixing, [job(12, 1, attempt('a', { outcome: 'not-a-bug' }))])?.move.state).toBe('asked');
  });

  it('sets aside a bug whose bug fix a person cancelled, spending no try', () => {
    const ended = after({ ...fixing, attempts: 1 }, [job(12, 2, attempt('job-4', { status: 'cancelled' }))]);
    expect(ended?.move).toEqual({ state: 'asked', attempts: 1, fixPr: null, askedJob: 'job-4' });
    expect(ended?.event?.sentence).toBe('Omni Loop bug #12 (reported 7×) is set aside: its bug fix was cancelled, and a person decides what comes next.');
  });

  it('spends a try on stuck, blocked or an unreadable end, and puts the bug back in line', () => {
    const ended = after(fixing, [job(12, 1, attempt('a', { outcome: 'stuck' }))]);
    expect(ended?.move).toEqual({ state: 'open', attempts: 1, fixPr: null, askedJob: null });
    expect(ended?.event?.sentence).toBe('Omni Loop bug #12 (reported 7×): its bug fix ended stuck, 1 of 3 tries spent; it goes back in line.');
    expect(after({ ...fixing, attempts: 1 }, [job(12, 2, attempt('a', { status: 'failed', reason: 'exit 1' }))])?.move).toEqual({ state: 'open', attempts: 2, fixPr: null, askedJob: null });
  });

  it('AC-4: sets the bug aside as asked on its third try with no pull request, saying what was tried, and never counts a fourth', () => {
    const jobs = [job(12, 1, attempt('a', { outcome: 'stuck' })), job(12, 2, attempt('b', { outcome: 'stuck' })), job(12, 3, attempt('c', { outcome: 'stuck' }))];
    const ended = after({ ...fixing, attempts: 2 }, jobs);
    expect(ended?.move).toEqual({ state: 'asked', attempts: BUG_TRIES, fixPr: null, askedJob: 'c' });
    expect(ended?.event).toMatchObject({ kind: 'bug-asked', job: 'c', sentence: 'Omni Loop bug #12 (reported 7×) is set aside after 3 tries (stuck, stuck, stuck): it waits for a person.' });
    // A bug a person sent back with its 3 tries spent: one more failure sets it aside again, its tries never past 3.
    expect(after({ ...fixing, attempts: 3 }, [...jobs, job(12, 4, attempt('d', { outcome: 'blocked' }))])?.move).toEqual({ state: 'asked', attempts: 3, fixPr: null, askedJob: 'd' });
  });

  it('spends no try on a lost job and puts the bug back in line', () => {
    const ended = after({ ...fixing, attempts: 1 }, [job(12, 2, attempt('a', { status: 'failed', reason: 'runner lost' }))]);
    expect(ended?.move).toEqual({ state: 'open', attempts: 1, fixPr: null, askedJob: null });
    expect(ended?.event?.sentence).toBe("Omni Loop bug #12 (reported 7×): its bug fix's runner was lost; it goes back in line, no try spent.");
  });

  it('puts a fixing bug with no job back in line, saying nothing', () => {
    expect(after(fixing, [job(13, 1, attempt('a'))])).toEqual({ move: { state: 'open', attempts: 0, fixPr: null, askedJob: null }, event: null });
  });

  it('reads only the bug\'s latest job', () => {
    const jobs = [job(12, 2, attempt('b', { outcome: 'pr-opened', prUrl: `https://github.com/${REPO}/pull/45` })), job(12, 1, attempt('a', { outcome: 'stuck' }))];
    expect(after({ ...fixing, attempts: 1 }, jobs)?.move.state).toBe('pr-opened');
  });
});

describe('what the room is told', () => {
  it('AC-9: a bug taken names its issue and its count, links the public issue, and names no workspace, repository or login', () => {
    const event = takenEvent(bug(12, { count: 2 }), 'job-1', REPO);
    expect(event).toEqual({ kind: 'bug-taken', role: 'supervisor', prd: null, job: 'job-1', link: `https://github.com/${REPO}/issues/12`, sentence: 'Took Omni Loop bug #12 (reported 2×): sent /omni:bug-fix #12, try 1 of 3.' });
    expect(event.sentence).not.toMatch(/vertuoza|acme|@/);
  });

  it('lists what each tried job ended on, and the bugs that wait on a person', () => {
    expect(triedOf([job(12, 2, attempt('b', { outcome: 'blocked' })), job(12, 1, attempt('a', { outcome: 'stuck' })), job(12, 3, attempt('c', { status: 'running' }))], i(12))).toEqual(['stuck', 'blocked']);
    expect(askedWords([bug(1, { state: 'asked', count: 1 }), bug(2, { state: 'open' }), bug(3, { state: 'asked', count: 4 })])).toEqual(['Omni Loop bug #3: answer its question', 'Omni Loop bug #1: answer its question']);
  });
});
