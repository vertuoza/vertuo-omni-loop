import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Called } from '../runners.client';
import type { Job, JobLines } from '../runners.contract';
import { demoRunnersPage } from './demo';
import {
  atBottom, drawn, EMPTY_TERMINAL, followJob, isLive, merged, noticeOf, runnerJob, terminalOf, withTerminal, type TerminalState,
} from './terminal-model';

// The Terminal panel's rules (PRD 1904 s4): the runner's job, the `?terminal=` parameter, merging reads,
// each state of the spec, how a line is drawn, following, and the reads: from the first while `more`,
// every 5 s while the job runs and the tab is visible, once more after it ended, then none.

const JOB = '00000000-0000-4000-8000-00000000d201';
const lines = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ seq: from + i, text: `12:00:00 line ${String(from + i)}` }));
const reply = (over: Partial<JobLines> = {}): JobLines => ({ status: 'running', lines: [], more: false, first: null, logTail: null, ...over });
const ok = (value: JobLines): Called<JobLines> => ({ ok: true, value });

describe('a runner\'s Terminal', () => {
  const board = (() => { const view = demoRunnersPage(new Date('2026-10-13T14:00:00Z')); if (view.kind !== 'board') throw new Error('board'); return view.board; })();
  const job = (over: Partial<Job>): Job => ({ ...(board.jobs[0] as Job), ...over });
  const RUNNER = { id: '00000000-0000-4000-8000-00000000d1aa' };

  it('opens the job the runner is running', () => {
    const running = job({ id: 'r', runner: RUNNER.id, status: 'running' });
    expect(runnerJob(RUNNER, [job({ id: 'd', runner: RUNNER.id, status: 'done', endedAt: '2026-10-13T13:59:00Z' }), running])?.id).toBe('r');
  });

  it('opens its last job when it is idle', () => {
    const jobs = [
      job({ id: 'old', runner: RUNNER.id, status: 'done', endedAt: '2026-10-13T10:00:00Z' }),
      job({ id: 'new', runner: RUNNER.id, status: 'failed', endedAt: '2026-10-13T12:00:00Z' }),
      job({ id: 'other', runner: 'someone else', status: 'running' }),
    ];
    expect(runnerJob(RUNNER, jobs)?.id).toBe('new');
  });

  it('opens nothing when the runner has run no job', () => {
    expect(runnerJob(RUNNER, board.jobs)).toBeNull();
  });
});

describe('the ?terminal= parameter', () => {
  it('names a job id, and nothing else', () => {
    expect(terminalOf(JOB)).toBe(JOB);
    expect(terminalOf('../x')).toBeNull();
    expect(terminalOf(null)).toBeNull();
  });

  it('is set on opening and removed on closing, every other parameter kept', () => {
    expect(withTerminal('https://x.test/app/runners?a=1', JOB)).toBe(`/app/runners?a=1&terminal=${JOB}`);
    expect(withTerminal(`https://x.test/app/runners?terminal=${JOB}&a=1#h`, null)).toBe('/app/runners?a=1#h');
    expect(withTerminal(`https://x.test/app/runners?terminal=${JOB}`, null)).toBe('/app/runners');
  });
});

describe('a read merged in', () => {
  it('adds the lines after the last one held, once each', () => {
    const one = merged(EMPTY_TERMINAL, reply({ lines: lines(1, 3), first: 1 }));
    const two = merged(one, reply({ lines: lines(3, 3), first: 1, status: 'done' }));
    expect(two.lines.map((l) => l.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(two.status).toBe('done');
    expect(two.read).toBe(true);
  });

  it('clears a failure', () => {
    expect(merged({ ...EMPTY_TERMINAL, failed: true }, reply()).failed).toBe(false);
  });
});

describe('the states', () => {
  const state = (over: Partial<TerminalState>): TerminalState => ({ ...EMPTY_TERMINAL, read: true, status: 'running', ...over });

  it('says nothing before the first read', () => {
    expect(noticeOf(EMPTY_TERMINAL, true)).toEqual({ kind: 'none' });
  });

  it('waits for the first line while the job runs with none', () => {
    expect(noticeOf(state({}), true)).toEqual({ kind: 'waiting' });
    expect(noticeOf(state({ status: 'queued' }), true)).toEqual({ kind: 'waiting' });
  });

  it('shows an old runner\'s tail', () => {
    expect(noticeOf(state({ logTail: 'tail' }), true)).toEqual({ kind: 'old-runner', tail: 'tail' });
  });

  it('says the log was cleared for an ended job with no line and no tail, or a job no longer listed', () => {
    expect(noticeOf(state({ status: 'done' }), true)).toEqual({ kind: 'cleared' });
    expect(noticeOf(state({ lines: lines(1, 1), first: 1 }), false)).toEqual({ kind: 'cleared' });
  });

  it('says earlier lines were dropped when the job no longer holds its first', () => {
    expect(noticeOf(state({ lines: lines(5, 1), first: 5 }), true)).toEqual({ kind: 'dropped' });
    expect(noticeOf(state({ lines: lines(1, 1), first: 1 }), true)).toEqual({ kind: 'none' });
  });

  it('reads on while a job is queued, starting or running only', () => {
    expect(['queued', 'claimed', 'running'].every((s) => isLive(s as Job['status']))).toBe(true);
    expect(['done', 'failed', 'cancelled'].some((s) => isLive(s as Job['status']))).toBe(false);
  });
});

describe('a line drawn', () => {
  it('splits its time off', () => {
    expect(drawn([{ seq: 1, text: '12:04:31 Bash: pnpm test' }])[0]).toEqual({ seq: 1, time: '12:04:31', text: 'Bash: pnpm test', tone: 'plain', href: null });
  });

  it('draws a ✗ line and its indented output in the error colour, and nothing after', () => {
    const tones = drawn([
      { seq: 1, text: '12:05:02 ✗ FAIL log.test.ts' },
      { seq: 2, text: '  expected 200' },
      { seq: 3, text: '  received 201' },
      { seq: 4, text: '12:05:40 Edit: log.ts' },
      { seq: 5, text: '  not an error' },
    ]).map((l) => l.tone);
    expect(tones).toEqual(['error', 'error', 'error', 'plain', 'plain']);
  });

  it('links a PR: line, and bolds a Done: line', () => {
    const [pr, done, result] = drawn([
      { seq: 1, text: '12:07:33 PR: https://github.com/acme/widgets/pull/1841' },
      { seq: 2, text: '12:09:05 Done: ok · 48 turns · $3.12 · 8m' },
      { seq: 3, text: 'Slice s1 merged.' },
    ]);
    expect(pr).toMatchObject({ tone: 'pr', href: 'https://github.com/acme/widgets/pull/1841' });
    expect(done?.tone).toBe('done');
    expect(result).toMatchObject({ time: null, tone: 'plain' });
  });

  it('links no PR: line whose link is not a pull request', () => {
    expect(drawn([{ seq: 1, text: '12:00:00 PR: javascript:alert(1)' }])[0]).toMatchObject({ tone: 'plain', href: null });
  });
});

describe('following', () => {
  it('follows at the bottom, and not scrolled up', () => {
    expect(atBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(atBottom({ scrollTop: 590, scrollHeight: 1000, clientHeight: 400 })).toBe(true);
    expect(atBottom({ scrollTop: 300, scrollHeight: 1000, clientHeight: 400 })).toBe(false);
  });
});

describe('the reads', () => {
  type Listener = () => void;
  const doc = (visible = true) => {
    const listeners = new Set<Listener>();
    return {
      visibilityState: visible ? 'visible' : 'hidden',
      addEventListener: (_: 'visibilitychange', l: Listener) => listeners.add(l),
      removeEventListener: (_: 'visibilitychange', l: Listener) => listeners.delete(l),
    };
  };

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('reads from the first line while more follow', async () => {
    const read = vi.fn((after: number) => Promise.resolve(ok(after === 0
      ? reply({ status: 'done', lines: lines(1, 2), more: true, first: 1 })
      : reply({ status: 'done', lines: lines(3, 1), more: false, first: 1 }))));
    const shown: TerminalState[] = [];
    followJob(read, (s) => shown.push(s), doc(), 5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(read.mock.calls.map((c) => c[0])).toEqual([0, 2]);
    expect(shown.at(-1)?.lines.map((l) => l.seq)).toEqual([1, 2, 3]);
  });

  it('reads after the last line every 5 s while the job runs, once more when it ended, then stops', async () => {
    let status: Job['status'] = 'running';
    let seq = 0;
    const read = vi.fn(() => { seq += 1; return Promise.resolve(ok(reply({ status, lines: lines(seq, 1), first: 1 }))); });
    followJob(read, () => undefined, doc(), 5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenLastCalledWith(1);
    status = 'done';
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('reads an ended job once', async () => {
    const read = vi.fn(() => Promise.resolve(ok(reply({ status: 'failed', lines: lines(1, 1), first: 1 }))));
    followJob(read, () => undefined, doc(), 5000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('rests while the tab is hidden', async () => {
    const read = vi.fn(() => Promise.resolve(ok(reply())));
    followJob(read, () => undefined, doc(false), 5000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps the lines and says so when a read fails, and the next poll tries again', async () => {
    const answers: Called<JobLines>[] = [ok(reply({ lines: lines(1, 2), first: 1 })), { ok: false, error: 'down' }, ok(reply({ lines: lines(3, 1), first: 1 }))];
    const read = vi.fn(() => Promise.resolve(answers.shift() ?? ok(reply())));
    const shown: TerminalState[] = [];
    followJob(read, (s) => shown.push(s), doc(), 5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(shown.at(-1)).toMatchObject({ failed: true });
    expect(shown.at(-1)?.lines).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(shown.at(-1)).toMatchObject({ failed: false });
    expect(shown.at(-1)?.lines).toHaveLength(3);
  });

  it('reads nothing more once stopped', async () => {
    const read = vi.fn(() => Promise.resolve(ok(reply())));
    const stop = followJob(read, () => undefined, doc(), 5000);
    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
