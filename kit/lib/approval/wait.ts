// `omni wait approval <n>` (PRD 1322, s4): waits for a PRD born on the server to be approved. An
// approval already in force answers at once and asks nobody. Otherwise it asks the PRD's approvers
// (`POST /api/dossiers/approval/request`), prints the waiting line, and follows the approval stream
// (`./stream.ts`) until the approval lands, reconnecting with `Last-Event-ID` and never printing an
// event twice. A void prints its line and asks again. Three failed connections in a row print the held
// line; it keeps retrying until the deadline, the `--timeout`.
//
// Its lines, the same on the page, the HUD and the terminal (the spec's §5):
//
// | state      | the line                                                                  | exit |
// |------------|---------------------------------------------------------------------------|------|
// | waiting    | `◌ PRD <n> · waiting for Irisa or Paul` (`… for 4 members` past three)     | —    |
// |            | `◌ PRD <n> · waiting for <author> · <product> has no other approver`       | —    |
// | approved   | `✓ PRD <n> approved by <login> · <time> · <k> files pinned`                 | 0    |
// | voided     | `✗ approval voided by <pusher>'s push <old>→<new> · asked again`            | —    |
// | held       | `server unreachable · held, not failed`                                     | —    |
// | signed out | `no sign-in (omni signin) · held`                                           | 1    |
// | timeout    | `held: still waiting for <names> after <minutes> min`                       | 1    |
// | refused    | `refused (<status>)`: the page answered the request with an error           | 1    |
//
// The HUD reads the current state from the waiting file, `.omni-loop/local/approval-wait/<n>.json`:
// `{ prd, state, line, waiting, at }`, `waiting` being the waiting line (null before anyone is asked)
// and `at` when the state was written. The command owns the file and leaves its last state there.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AskCallError } from '../ask/client.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import type { Layout } from '../layout.ts';
import type { PrdNumber } from '../ids.ts';
import { readApproval, UNREACHABLE_LINE } from './approval.ts';
import { approvalEvent, AskingSchema, sseReader } from './stream.ts';
import type { ApprovalEvent, Asking } from './stream.ts';

/** The calls the wait makes, as the ask client makes them. */
type WaitClient = {
  readApproval(args: { repo: string; prd: PrdNumber }): Promise<unknown>;
  requestApproval(args: { repo: string; prd: PrdNumber }): Promise<unknown>;
  streamApproval(args: { repo: string; prd: PrdNumber; lastEventId: string | null; signal: AbortSignal }): Promise<Response>;
};

/** A state of the wait, as the waiting file names it. */
type WaitState = 'waiting' | 'approved' | 'voided' | 'held' | 'signed-out' | 'timeout' | 'refused';

/** How a wait ended: its exit code and its last state. */
type WaitResult = { code: 0 | 1; state: WaitState };

/** Everything a wait needs; `sleep`, `now` and `idleMs` are a test's to set. */
type WaitOptions = {
  ctx: { root: string; layout: Layout };
  prd: PrdNumber;
  repo: string;
  client: WaitClient;
  print: (line: string) => void;
  /** Aborts once the `--timeout` is reached. */
  deadline: AbortSignal;
  timeoutMinutes: number;
  sleep?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
  now?: (() => Date) | undefined;
  /** How long a connected stream may stay silent before it reads as cut: three missed pings. */
  idleMs?: number | undefined;
};

/** How many failed connections in a row print the held line. */
const HELD_AFTER = 3;
const IDLE_MS = 45_000;
/** The pause before the next try, by how many failed in a row. */
const backoffMs = (failures: number): number => [1000, 2000, 5000][failures - 1] ?? 10_000;

/** The line a waiting file and the terminal show when no sign-in is kept. */
export const SIGNED_OUT_LINE = 'no sign-in (omni signin) · held';

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

/** Who is waited for: one to three names, else how many. */
function namesOf(asking: Asking): string {
  const names = asking.asked.map((person) => person.name ?? person.login);
  if (asking.nobodyElse || names.length === 0) return asking.author;
  if (names.length > 3) return `${names.length} members`;
  return names.length === 1 ? String(names[0]) : `${names.slice(0, -1).join(', ')} or ${String(names.at(-1))}`;
}

function waitingLine(prd: PrdNumber, asking: Asking): string {
  const head = `◌ PRD ${Number(prd)} · waiting for ${namesOf(asking)}`;
  return asking.nobodyElse ? `${head} · ${asking.product ?? 'this repository'} has no other approver` : head;
}

const approvedLine = (prd: PrdNumber, login: string, at: string, pinned: number): string =>
  `✓ PRD ${Number(prd)} approved by ${login} · ${at} · ${pinned} ${pinned === 1 ? 'file' : 'files'} pinned`;

const short = (sha: string): string => sha.slice(0, 7);

/** Resolves once `signal` aborts. */
function aborted(signal: AbortSignal): Promise<'aborted'> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve('aborted');
    else signal.addEventListener('abort', () => { resolve('aborted'); }, { once: true });
  });
}

/** The stream's messages as they arrive, until it ends, `signal` aborts or it stays silent `idleMs`. */
async function* messages(body: ReadableStream<Uint8Array> | null, signal: AbortSignal, idleMs: number) {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const sse = sseReader();
  const quiet = new AbortController();
  const stop = AbortSignal.any([signal, quiet.signal]);
  let timer = setTimeout(() => { quiet.abort(); }, idleMs);
  try {
    for (;;) {
      const next = await Promise.race([reader.read().catch(() => ({ done: true, value: undefined })), aborted(stop)]);
      if (next === 'aborted' || next.done) return;
      clearTimeout(timer);
      timer = setTimeout(() => { quiet.abort(); }, idleMs);
      yield* sse.push(decoder.decode(next.value, { stream: true }));
    }
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => {});
  }
}

/** One wait as it runs: its options, who it waits for, and how many tries failed in a row. */
type Run = {
  options: WaitOptions;
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  now: () => Date;
  idleMs: number;
  waiting: string | null;
  asking: Asking | null;
  failures: number;
};

/** Where a stream resumes: the last event id, and every id already acted on. */
type Cursor = { lastEventId: string | null; seen: Set<string> };

/** Read through a call: the deadline aborts while the wait awaits. */
const over = (run: Run): boolean => run.options.deadline.aborted;

/** The waiting file of PRD `prd` under the checkout at `root`. */
const waitFile = (root: string, prd: PrdNumber): string => join(root, LOCAL_DIR, 'approval-wait', `${Number(prd)}.json`);

function write(run: Run, state: WaitState, line: string): void {
  const { ctx, prd } = run.options;
  ensureLocalDir(ctx.root);
  mkdirSync(join(ctx.root, LOCAL_DIR, 'approval-wait'), { recursive: true });
  const file = { prd: Number(prd), state, line, waiting: run.waiting, at: run.now().toISOString() };
  writeFileSync(waitFile(ctx.root, prd), `${JSON.stringify(file, null, 2)}\n`);
}

/** Forgets PRD `prd`'s waiting file, so the HUD stops showing a wait that was interrupted. */
export function forgetWait(root: string, prd: PrdNumber): void {
  rmSync(waitFile(root, prd), { force: true });
}

function say(run: Run, state: WaitState, line: string): void {
  run.options.print(line);
  write(run, state, line);
}

function end(run: Run, code: 0 | 1, state: WaitState, line: string): WaitResult {
  say(run, state, line);
  return { code, state };
}

const timedOut = (run: Run): WaitResult =>
  end(run, 1, 'timeout', `held: still waiting for ${run.asking ? namesOf(run.asking) : 'approval'} after ${run.options.timeoutMinutes} min`);

/** Who is asked now: the waiting line, printed when it changed. */
function ask(run: Run, asking: Asking): void {
  run.asking = asking;
  const line = waitingLine(run.options.prd, asking);
  if (line === run.waiting) return;
  run.waiting = line;
  say(run, 'waiting', line);
}

/** One more failed try: the held line on the third in a row, then the pause. */
async function failed(run: Run): Promise<void> {
  run.failures += 1;
  if (run.failures === HELD_AFTER) say(run, 'held', UNREACHABLE_LINE);
  await run.sleep(backoffMs(run.failures), run.options.deadline);
}

/** A try went through: the waiting line again after the held one. */
function recovered(run: Run): void {
  if (run.failures >= HELD_AFTER && run.waiting) say(run, 'waiting', run.waiting);
  run.failures = 0;
}

/** What a failed call does: an exit when the page refused, else `retry` once the pause is over. */
async function afterError(run: Run, error: unknown): Promise<WaitResult | 'retry'> {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === 401) return end(run, 1, 'signed-out', SIGNED_OUT_LINE);
  if (over(run)) return timedOut(run);
  if (error.status !== null && error.status < 500) return end(run, 1, 'refused', `refused (${error.status})`);
  await failed(run);
  return 'retry';
}

/** One request: null once the approvers are asked, an exit, or `retry`. */
async function requestOnce(run: Run): Promise<WaitResult | 'retry' | null> {
  const { client, repo, prd } = run.options;
  let body: unknown;
  try {
    body = await client.requestApproval({ repo, prd });
  } catch (error) {
    return afterError(run, error);
  }
  const reply = AskingSchema.safeParse(body);
  if (!reply.success) return end(run, 1, 'refused', 'refused (malformed reply)');
  recovered(run);
  ask(run, reply.data);
  return null;
}

/** Asks the approvers, retrying while the server cannot answer: an exit when it ends the wait. */
async function request(run: Run): Promise<WaitResult | null> {
  for (;;) {
    if (over(run)) return timedOut(run);
    const result = await requestOnce(run);
    if (result !== 'retry') return result;
  }
}

/** What one event does: an exit when it ends the wait. */
async function on(run: Run, event: ApprovalEvent): Promise<WaitResult | null> {
  if (event.type === 'asked' || event.type === 're-asked') ask(run, event.asking);
  if (event.type === 'approved') return end(run, 0, 'approved', approvedLine(run.options.prd, event.approver, event.approvedAt, event.pinned));
  if (event.type !== 'voided') return null;
  say(run, 'voided', `✗ approval voided by ${event.pusher}'s push ${short(event.from)}→${short(event.to)} · asked again`);
  return request(run);
}

/** Whether a message was acted on already; else it is marked seen. */
function seenBefore(cursor: Cursor, id: string | null): boolean {
  if (id === null) return false;
  if (cursor.seen.has(id)) return true;
  cursor.seen.add(id);
  cursor.lastEventId = id;
  return false;
}

/** Follows one connected stream: an exit, or null once it closed (`heard`: it said something). */
async function follow(run: Run, response: Response, cursor: Cursor): Promise<{ result: WaitResult | null; heard: boolean }> {
  let heard = false;
  for await (const message of messages(response.body, run.options.deadline, run.idleMs)) {
    if (!heard) recovered(run);
    heard = true;
    if (seenBefore(cursor, message.id)) continue;
    const event = approvalEvent(message);
    if (event?.type === 'reconnect') break;
    const result = event ? await on(run, event) : null;
    if (result) return { result, heard };
  }
  return { result: null, heard };
}

/** Follows the stream, connection after connection, until the wait ends. */
async function stream(run: Run): Promise<WaitResult> {
  const { client, repo, prd, deadline } = run.options;
  const cursor: Cursor = { lastEventId: null, seen: new Set() };
  for (;;) {
    if (over(run)) return timedOut(run);
    let response: Response;
    try {
      response = await client.streamApproval({ repo, prd, lastEventId: cursor.lastEventId, signal: deadline });
    } catch (error) {
      const after = await afterError(run, error);
      if (after === 'retry') continue;
      return after;
    }
    const { result, heard } = await follow(run, response, cursor);
    if (result) return result;
    // A stream that closed before saying anything counts as a failed try.
    if (!heard && !over(run)) await failed(run);
  }
}

/** Waits for PRD `prd`'s approval, printing each line, and says how it ended. */
export async function waitForApproval(options: WaitOptions): Promise<WaitResult> {
  const { ctx, prd, repo, client } = options;
  const run: Run = {
    options,
    sleep: options.sleep ?? pause,
    now: options.now ?? (() => new Date()),
    idleMs: options.idleMs ?? IDLE_MS,
    waiting: null,
    asking: null,
    failures: 0,
  };
  const before = await readApproval(ctx, prd, () => client.readApproval({ repo, prd }));
  if (before.state === 'approved' && before.approval) {
    const { approver, approvedAt, files } = before.approval;
    return end(run, 0, 'approved', approvedLine(prd, approver.login, approvedAt, files.length));
  }
  return (await request(run)) ?? stream(run);
}
