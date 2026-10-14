import type { Called } from '../runners.client';
import type { Job, JobLines, Runner } from '../runners.contract';
import { poll, type VisibilityDoc } from '../../ask/page/poll';
import { REFRESH_MS } from './model';

// The Terminal panel's rules (PRD 1904 s4, the `runner-terminal` screen), pure or driven through seams,
// so each is tested without a browser: which job a runner's Terminal opens, the `?terminal=` parameter,
// how a read of the lines merges into what the panel shows, which state it says, how a line is drawn,
// when it follows the newest line, and the reads themselves (from the first line while `more`, then
// every 5 s with poll() while the job is queued or running and the tab is visible, once more after it
// ended, then none).

/** The URL parameter that names the job whose panel is open. */
const TERMINAL_PARAM = 'terminal';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The job `?terminal=` names, or null when it names none, or not a job id. */
export const terminalOf = (value: string | null | undefined): string | null => (value && UUID.test(value) ? value : null);

/** `href` with `?terminal=<job>` set, or removed when `job` is null; every other parameter and the hash kept. */
export function withTerminal(href: string, job: string | null): string {
  const url = new URL(href);
  if (job === null) url.searchParams.delete(TERMINAL_PARAM);
  else url.searchParams.set(TERMINAL_PARAM, job);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Whether a job still runs: queued, starting or running. Its panel reads on, with a live dot. */
export const isLive = (status: Job['status']): boolean => status === 'queued' || status === 'claimed' || status === 'running';

const lastAt = (job: Pick<Job, 'endedAt' | 'runningAt' | 'claimedAt' | 'queuedAt'>): number =>
  Date.parse(job.endedAt ?? job.runningAt ?? job.claimedAt ?? job.queuedAt);

/** The job a runner's Terminal opens: the one it is running, else the last one it ran, else null (no job yet). */
export function runnerJob(runner: Pick<Runner, 'id'>, jobs: readonly Job[]): Job | null {
  const its = jobs.filter((job) => job.runner === runner.id);
  const running = its.find((job) => isLive(job.status));
  if (running) return running;
  let last: Job | null = null;
  for (const job of its) if (last === null || lastAt(job) > lastAt(last)) last = job;
  return last;
}

/** What the panel holds: the lines read so far, the job's status as the last read said, the smallest
 * line the job still holds, the old runner's tail, whether a read happened yet, and whether the last
 * one failed. */
export type TerminalState = {
  lines: readonly { seq: number; text: string }[];
  status: Job['status'] | null;
  first: number | null;
  logTail: string | null;
  read: boolean;
  failed: boolean;
};

export const EMPTY_TERMINAL: TerminalState = { lines: [], status: null, first: null, logTail: null, read: false, failed: false };

/** The sequence number to read after: the last line held, or 0 for none. */
const lastSeq = (state: Pick<TerminalState, 'lines'>): number => state.lines.at(-1)?.seq ?? 0;

/** `state` with a read merged in: its lines after the last one held (a line read twice is kept once),
 * and its status, first line and tail. */
export function merged(state: TerminalState, read: JobLines): TerminalState {
  const after = lastSeq(state);
  const fresh = read.lines.filter((line) => line.seq > after);
  return {
    lines: fresh.length === 0 ? state.lines : [...state.lines, ...fresh],
    status: read.status,
    first: read.first,
    logTail: read.logTail,
    read: true,
    failed: false,
  };
}

/** What the panel says over or above its lines, in the spec's words. */
export type TerminalNotice =
  | { kind: 'none' }
  | { kind: 'waiting' }
  | { kind: 'old-runner'; tail: string }
  | { kind: 'cleared' }
  | { kind: 'dropped' };

export const WORDS = {
  waiting: 'Waiting for the first line…',
  oldRunner: 'Update this runner for live logs.',
  cleared: 'This job\'s log was cleared.',
  dropped: 'Earlier lines were dropped.',
  reconnecting: 'Reconnecting…',
  jump: 'Jump to latest',
  noJob: 'No job yet',
} as const;

/** The command an old runner's owner copies to get live logs. */
export const UPDATE_COMMAND = 'omni update';

/** The panel's notice: dropped above the lines when the job no longer holds its first one; with no line,
 * an old runner's tail, waiting while the job runs, or cleared once it ended (or when the job is no
 * longer listed). Nothing before the first read. */
export function noticeOf(state: TerminalState, listed: boolean): TerminalNotice {
  if (!listed) return { kind: 'cleared' };
  if (!state.read || state.status === null) return { kind: 'none' };
  if (state.lines.length > 0) return state.first !== null && state.first > 1 ? { kind: 'dropped' } : { kind: 'none' };
  if (state.logTail !== null && state.logTail !== '') return { kind: 'old-runner', tail: state.logTail };
  return isLive(state.status) ? { kind: 'waiting' } : { kind: 'cleared' };
}

const TIME = /^(\d{2}:\d{2}:\d{2}) (.*)$/s;
const PR = /^PR: (https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+)$/;

/** A line as the panel draws it: its time (when it has one), the rest, and its tone. `error` is a `✗`
 * line and the indented output under it; `done` a `Done:` line; `pr` a `PR:` line, with its link. */
export type DrawnLine = { seq: number; time: string | null; text: string; tone: 'plain' | 'error' | 'done' | 'pr'; href: string | null };

/** A line's tone, from its text after the time. */
function toneOf(text: string, href: string | null): DrawnLine['tone'] {
  if (text.startsWith('✗')) return 'error';
  if (text.startsWith('Done:')) return 'done';
  return href === null ? 'plain' : 'pr';
}

/** One line, on its own: its time split off, its tone and its link. */
function drawnLine(line: { seq: number; text: string }): DrawnLine {
  const timed = TIME.exec(line.text);
  const [time, text] = timed ? [timed[1] ?? null, timed[2] ?? ''] : [null, line.text];
  const href = PR.exec(text)?.[1] ?? null;
  return { seq: line.seq, time, text, tone: toneOf(text, href), href };
}

/** The lines as the panel draws them; a line indented two spaces right after a `✗` line stays in the error colour. */
export function drawn(lines: readonly { seq: number; text: string }[]): DrawnLine[] {
  const out: DrawnLine[] = [];
  for (const line of lines) {
    const one = drawnLine(line);
    const under = out.at(-1)?.tone === 'error' && one.time === null && line.text.startsWith('  ');
    out.push(under ? { ...one, tone: 'error', href: null } : one);
  }
  return out;
}

/** How far from the bottom the panel's scroll may be and still follow. */
const BOTTOM_SLACK_PX = 24;

/** Whether a scroll box is at its bottom, so the panel follows the newest line. */
export const atBottom = (box: { scrollTop: number; scrollHeight: number; clientHeight: number }): boolean =>
  box.scrollHeight - box.scrollTop - box.clientHeight <= BOTTOM_SLACK_PX;

/** Reads every line after `after`, page by page while the route says `more`. Null when a read fails. */
async function readAll(read: (after: number) => Promise<Called<JobLines>>, state: TerminalState): Promise<TerminalState | null> {
  let next = state;
  for (;;) {
    const called = await read(lastSeq(next));
    if (!called.ok) return null;
    next = merged(next, called.value);
    if (!called.value.more || called.value.lines.length === 0) return next;
  }
}

/** Follows one job's lines: reads them all at once, then, while the job is queued or running, the new
 * ones every `every` ms with poll() (a hidden tab rests). The read that finds the job ended is its last.
 * A failed read keeps the lines, says so (`failed`), and the next poll tries again. Returns the stop
 * function. */
export function followJob(
  read: (after: number) => Promise<Called<JobLines>>,
  show: (state: TerminalState) => void,
  doc: VisibilityDoc,
  every = REFRESH_MS,
): () => void {
  let state = EMPTY_TERMINAL;
  let stopped = false;
  let stopPoll: (() => void) | null = null;

  async function tick(): Promise<boolean> {
    const next = await readAll(read, state);
    if (stopped) return false;
    state = next ?? { ...state, failed: true };
    show(state);
    return state.status === null || isLive(state.status);
  }

  void tick().then((live) => {
    if (live && !stopped) stopPoll = poll(tick, doc, every);
  });
  return () => {
    stopped = true;
    stopPoll?.();
  };
}
