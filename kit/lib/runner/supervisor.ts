// The Supervisor's seat (PRD omni-loop-34 s4, spec "1. The seat"): one agent per workspace, a loop the runner starts
// itself when its workspace placed the seat on it, never a job. It talks to the Supervisor API only (./api.ts
// `supervisorApi`), with the runner's sign-in, and reads one workspace: the one whose seat this runner holds.
//
// The loop:
// - wait on `next` (the app holds it up to 40 s, and counts it as the seat's look): it answers at once on a new signal,
//   an owner's message or a pressed suggestion, else nothing; a routine look follows every 2 minutes;
// - read: the snapshot, the memory, and the threads of the general chat and of each open finding;
// - remember: the steps' usual times, kept as long-term notes in the shape the silent-job check reads
//   (./supervisor-baselines.ts), plain code;
// - decide: think only when the look found something to judge (a signal no finding holds, a finding a check wrote
//   alone, an owner's message no answer replies to), with Claude Code headless and the seat's six tools
//   (./supervisor-think.ts), checking in every minute while it thinks so the app never reads it as offline;
// - check in with the tokens it spent: they count on the seat's day (UTC, decision s3-01).
//
// Past the daily token limit (the app answers `thinking: false`), or paused by an owner, the seat checks in and thinks
// nothing until the app says it may again: the plain-code checks write their findings alone meanwhile, marked "No
// Supervisor look yet" (apps/omni-app/src/supervisor/). An owner's message the think left unanswered is tried twice, then
// left for the page.
//
// `keepSeat` is the runner's side: it asks the app whether the seat is on this runner, runs the loop while it is, and
// tells the runner (`onSeat`) so its `next` loop keeps one slot for the seat (./runner.ts).
import { setTimeout as delay } from 'node:timers/promises';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { SeatMessage, SeatSnapshot, SeatWake, SupervisorApi, SupervisorSeat } from './api.ts';
import { baselineNotes, durationBook, keptBaselines, learnDurations } from './supervisor-baselines.ts';
import type { DurationBook } from './supervisor-baselines.ts';
import { hasWork, lookPrompt, raisedLine } from './supervisor-think.ts';
import type { LookWork, Think } from './supervisor-think.ts';

/** How often a routine look is taken when nothing wakes the seat. */
const LOOK_EVERY_MS = 2 * 60_000;
/** How often the seat checks in while it thinks. */
const HEARTBEAT_MS = 60_000;
/** How often a runner with no seat asks whether one was placed on it. */
const SEAT_POLL_MS = 60_000;
/** How many times an owner's message is given to a think before it is left for the page. */
const TRIES = 2;
/** How many finding threads one look reads. */
const THREADS = 20;
/** How far back a look reads the threads for messages waiting for an answer. */
const WAITING_MS = 24 * 3600_000;
const BACKOFF = { firstMs: 5000, maxMs: 60_000 };

export type SeatOptions = {
  api: SupervisorApi;
  runner: string;
  /** How the seat thinks, or the one line saying why it cannot here (no Claude account ready, say). */
  think: Think | string;
  print: (line: string) => void;
  /** Aborted to stop the seat with the runner. */
  halt: AbortSignal;
  now?: (() => number) | undefined;
  sleep?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
  lookEveryMs?: number | undefined;
  heartbeatMs?: number | undefined;
  backoff?: { firstMs: number; maxMs: number } | undefined;
};

/** The seat's state across looks. */
type Seat = Pick<SeatOptions, 'api' | 'runner' | 'think' | 'print' | 'halt'> & {
  now: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  lookEveryMs: number;
  heartbeatMs: number;
  firstMs: number;
  maxMs: number;
  book: DurationBook;
  tried: Map<string, number>;
  /** The line the seat last printed about its thinking: a change is printed once. */
  mode: string;
};

/** Waits `ms`, or less once `signal` aborts. */
const sleepFor = (ms: number, signal?: AbortSignal): Promise<void> => delay(ms, undefined, signal ? { signal } : {}).catch(() => undefined);

const words = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Why the seat does not think now, or `null` when it may. */
function notThinking(seat: SupervisorSeat): string | null {
  if (seat.paused) return 'paused by an owner';
  if (!seat.thinking || seat.tokensToday >= seat.dailyTokens) return `thinking paused until midnight (UTC): ${String(seat.tokensToday)} of ${String(seat.dailyTokens)} tokens used`;
  return null;
}

/** Prints the seat's thinking state when it changed. */
function say(seat: Seat, mode: string): void {
  if (mode === seat.mode) return;
  seat.mode = mode;
  seat.print(`Supervisor: ${mode}`);
}

/** The steps' usual times that moved, written as long-term notes. */
async function rememberBaselines(seat: Seat, snapshot: SeatSnapshot): Promise<void> {
  learnDurations(seat.book, snapshot.jobs);
  const longNotes = (await seat.api.memory(seat.runner, 'long')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const note of baselineNotes(seat.book, keptBaselines(longNotes.map((each) => each.line)))) {
    await seat.api.remember(seat.runner, { scope: 'long', line: note.line, cites: note.cites });
  }
}

/** The owners' messages of the general thread and the open findings' that no answer replies to yet, tried less than twice. */
async function waitingMessages(seat: Seat, snapshot: SeatSnapshot): Promise<SeatMessage[]> {
  const after = new Date(Date.parse(snapshot.at) - WAITING_MS).toISOString();
  const threads = [null, ...snapshot.findings.filter((finding) => finding.state === 'open').slice(0, THREADS).map((finding) => finding.id)];
  const waiting: SeatMessage[] = [];
  for (const thread of threads) {
    const messages = await seat.api.messages(seat.runner, thread, after);
    const answered = new Set(messages.flatMap((message) => (message.kind === 'supervisor' && message.replyTo !== null ? [message.replyTo] : [])));
    waiting.push(...messages.filter((message) => message.kind === 'owner' && !answered.has(message.id) && (seat.tried.get(message.id) ?? 0) < TRIES));
  }
  return waiting;
}

/** Runs `think`, checking in every minute until it ends. */
async function thinking(seat: Seat, think: Think, work: LookWork): Promise<number> {
  const done = new AbortController();
  const beat = (async () => {
    for (;;) {
      await seat.sleep(seat.heartbeatMs, AbortSignal.any([done.signal, seat.halt]));
      if (done.signal.aborted || seat.halt.aborted) return;
      await seat.api.checkIn(seat.runner, 0).catch((error: unknown) => {
        seat.print(`Supervisor: check-in not sent (${words(error)})`);
      });
    }
  })();
  try {
    const before = new Set((await seat.api.findings(seat.runner, true)).map((finding) => finding.id));
    const thought = await think({ prompt: lookPrompt(work), signal: seat.halt });
    for (const message of work.messages) seat.tried.set(message.id, (seat.tried.get(message.id) ?? 0) + 1);
    seat.print(`Supervisor: ${thought.line} · ${String(thought.tokens)} tokens`);
    for (const finding of await seat.api.findings(seat.runner, true)) if (!before.has(finding.id)) seat.print(raisedLine(finding));
    return thought.tokens;
  } finally {
    done.abort();
    await beat;
  }
}

/** One look: read, remember, decide, then check in with the tokens spent. */
async function look(seat: Seat): Promise<void> {
  const snapshot = await seat.api.snapshot(seat.runner);
  await rememberBaselines(seat, snapshot);
  let tokens = 0;
  const why = notThinking(snapshot.seat) ?? (typeof seat.think === 'string' ? `cannot think here: ${seat.think}` : null);
  say(seat, why ?? 'watching');
  if (why === null && typeof seat.think !== 'string') {
    const work = {
      seat: snapshot.seat,
      signals: snapshot.signals.filter((signal) => signal.finding === null),
      unlooked: snapshot.findings.filter((finding) => finding.state === 'open' && finding.lookedAt === null),
      messages: await waitingMessages(seat, snapshot),
    };
    if (hasWork(work)) tokens = await thinking(seat, seat.think, { ...work, notes: await seat.api.memory(seat.runner, null) });
  }
  await seat.api.checkIn(seat.runner, tokens);
}

/** Waits on `next`: what woke it, `null` for nothing (or a failure, after its wait), `moved` once the seat left. */
async function waitNext(seat: Seat, since: string | null, wait: { ms: number }): Promise<SeatWake | null | 'moved'> {
  try {
    const woke = await seat.api.next(seat.runner, since, seat.halt);
    wait.ms = seat.firstMs;
    return woke;
  } catch (error) {
    if (seat.halt.aborted) return null;
    if (!(error instanceof RunnerUnreachable) && !(error instanceof RunnerRefused)) throw error;
    seat.print(`Supervisor: the app did not answer (${error.message}): trying again in ${String(Math.round(wait.ms / 1000))} s`);
    await seat.sleep(wait.ms, seat.halt);
    wait.ms = Math.min(wait.ms * 2, seat.maxMs);
    return null;
  }
}

/** Runs the seat until the runner stops (`stopped`) or the seat leaves this runner (`moved`). */
export async function runSeat(options: SeatOptions): Promise<'moved' | 'stopped'> {
  const { firstMs, maxMs } = options.backoff ?? BACKOFF;
  const seat: Seat = {
    api: options.api, runner: options.runner, think: options.think, print: options.print, halt: options.halt, now: options.now ?? Date.now, sleep: options.sleep ?? sleepFor, lookEveryMs: options.lookEveryMs ?? LOOK_EVERY_MS,
    heartbeatMs: options.heartbeatMs ?? HEARTBEAT_MS, firstMs, maxMs, book: durationBook(), tried: new Map(), mode: '',
  };
  const wait = { ms: firstMs };
  const at = { since: null as string | null, lastLook: Number.NEGATIVE_INFINITY };
  while (!seat.halt.aborted) {
    const woke = await waitNext(seat, at.since, wait);
    if (woke === 'moved') return 'moved';
    if (woke !== null) at.since = woke.at;
    if (dueLook(seat, woke, at)) await lookOnce(seat);
  }
  return 'stopped';
}

/** Whether a look is due: on a wake, or 2 min after the last one; once due, the look is counted from now. */
function dueLook(seat: Seat, woke: SeatWake | null, at: { lastLook: number }): boolean {
  if (seat.halt.aborted || (woke === null && seat.now() - at.lastLook < seat.lookEveryMs)) return false;
  at.lastLook = seat.now();
  return true;
}

/** One look, a failure printed in one line. */
async function lookOnce(seat: Seat): Promise<void> {
  try {
    await look(seat);
  } catch (error) {
    if (!seat.halt.aborted) seat.print(`Supervisor: look not finished (${words(error)})`);
  }
}

/** The seat when this runner holds it, `null` otherwise or when the app cannot say. */
export async function seatHere(api: SupervisorApi, runner: string, print: (line: string) => void): Promise<SupervisorSeat | null> {
  try {
    return await api.seat(runner);
  } catch (error) {
    print(`Supervisor: whether the seat is here is unknown (${words(error)})`);
    return null;
  }
}

export type KeepSeatOptions = SeatOptions & {
  /** Whether the seat was on this runner when it started (`seatHere`, read before the slots open). */
  first: SupervisorSeat | null;
  /** Told when the seat comes to this runner or leaves it. */
  onSeat: (here: boolean) => void;
  pollMs?: number | undefined;
};

/** Runs the seat while this runner holds it, and asks again every minute while it does not, until the runner stops. */
export async function keepSeat(options: KeepSeatOptions): Promise<void> {
  const sleep = options.sleep ?? sleepFor;
  let seat = options.first;
  while (!options.halt.aborted) {
    if (seat !== null) {
      options.onSeat(true);
      options.print('Supervisor seat placed on this runner: one slot is kept for it');
      const ended = await runSeat(options);
      options.onSeat(false);
      if (ended === 'stopped') return;
      options.print('Supervisor seat moved off this runner: every slot takes jobs again');
    } else {
      await sleep(options.pollMs ?? SEAT_POLL_MS, options.halt);
    }
    seat = await seatHere(options.api, options.runner, options.print);
  }
}
