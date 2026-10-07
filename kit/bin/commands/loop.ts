// `omni loop push <start|tick|park|stop> …` and `omni loop status [--json]` — PRD 1139, slice s4: where a
// `/omni:drive` loop stands, sent to the Omni page's `POST /api/loops` (the app's loops contract)
// with the terminal's sign-in, and kept in this checkout at `.omni-loop/local/loop.json`
// (`../../lib/loop/local.ts`) beside the loop plan `omni next --plan` keeps (`../../lib/next/store.ts`).
//
// - `push start [--take-over]` opens a loop on this repository with the plan's PRDs and the latest plan
//   version, sent whole, and keeps the id the app answers. A loop of this checkout still live or
//   sleeping is printed and the start refused; a silent one (its session died) is taken over only
//   with `--take-over`, which the app checks again.
// - `push tick --step <k> [--steps <n>] --prd <n> --action <word> --result "<line>" [--link <url>]
//   [--merged <pr,…>] [--items <id,…>] [--wake-in <seconds> | --next-wake <time>]`: one tick of the
//   kept loop. `--steps` is the latest plan's length when left out. A plan version newer than the one
//   the app was sent goes with the tick as its replan, once.
// - `push park --prd <n> --who "<who>" --what "<what>" [--link <url>]` and `push stop`.
// - `status [--json]` prints the kept loop, what it is doing (live, sleeping, parked, stopped or silent,
//   by the app's rule) and its plan, from this checkout alone: a loop whose terminal closed resumes
//   from it with the same id and plan. It calls nothing.
//
// A push never blocks the tick that runs it: the contract's 5-second limit and one token refresh (the
// ask client's), and anything that stops it is exit 1 with one line — `off` (no `ask.url`), `no sign-in
// (omni signin)`, `unreachable`, `refused (<status>)` or `refused (<status>): <the app's reason>`, `no
// loop plan (omni next --plan)`, `no loop (omni loop push start)`, or the loop already here. A flag it
// cannot read is exit 2, before anything is sent.
//
// It runs before a context exists, like `dossier`, so that a test can hand it `tokens`, `home`,
// `fetch`, `callMs` and `now`; it loads the context itself.
import { AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { signedInClient } from '../../lib/ask/credentials.ts';
import { field } from '../../lib/ask/schema.ts';
import { loadContext } from '../../lib/context.ts';
import { OutboxItemIdSchema, PrNumberSchema } from '../../lib/ids.ts';
import type { OutboxItemId, PrNumber } from '../../lib/ids.ts';
import { LINE_MAX, oneLine, parkBody, startBody, stopBody, tickBody, WHO_MAX } from '../../lib/loop/body.ts';
import type { LoopBody } from '../../lib/loop/body.ts';
import { loopState, readLocalLoop, writeLocalLoop } from '../../lib/loop/local.ts';
import type { LocalLoop } from '../../lib/loop/local.ts';
import type { LoopPlan } from '../../lib/next/plan.ts';
import { readLoopPlans } from '../../lib/next/store.ts';
import { list, parseArgs, positiveInt, prdArg, println, usageError } from '../args.ts';
import type { FreeCommand, FreeIo, Out } from '../io.ts';

/** What a test hands `omni loop` beyond `main()`'s own. */
type LoopOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  callMs?: number | undefined;
  now?: () => number;
};

const USAGE = [
  'usage: omni loop push start [--take-over]',
  '       omni loop push tick --step <k> [--steps <n>] --prd <n> --action <word> --result "<line>" [--link <url>] [--merged <pr,…>] [--items <id,…>] [--wake-in <seconds> | --next-wake <time>]',
  '       omni loop push park --prd <n> --who "<who>" --what "<what>" [--link <url>]',
  '       omni loop push stop',
  '       omni loop status [--json]',
].join('\n');

const ACTION = /^[a-z][a-z-]{0,39}$/;
const LINK = /^https?:\/\/\S+$/;
const LINK_MAX = 500;

/** The one line a failed call is reported with; the app's reason after it when it gave one. */
function skipLine(error: unknown): string {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === null) return 'unreachable';
  return error.reason ? `refused (${error.status}): ${error.reason}` : `refused (${error.status})`;
}

/** A line of text a flag must carry, on one line and cut to `max`; empty is a usage error. */
function lineArg(name: string, value: string | undefined, max: number): string {
  const line = oneLine(value ?? '', max);
  if (!line) throw usageError(`omni loop push: --${name} needs a line of text.`);
  return line;
}

/** A web address, or null when the flag is left out. */
function linkArg(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (!LINK.test(value) || value.length > LINK_MAX) throw usageError(`omni loop push: --link is a web address, got "${value}".`);
  return value;
}

function prsArg(value: string | undefined): PrNumber[] {
  return list(value).map((pr) => PrNumberSchema.parse(positiveInt('loop push', '--merged', pr)));
}

function itemsArg(value: string | undefined): OutboxItemId[] {
  return list(value).map((id) => {
    const parsed = OutboxItemIdSchema.safeParse(id);
    if (!parsed.success) throw usageError(`omni loop push: --items names outbox items, got "${id}".`);
    return parsed.data;
  });
}

/** When the loop wakes next: `--wake-in` seconds from now, `--next-wake` as written, or null. */
function wakeArg({ wakeIn, nextWake }: { wakeIn: string | undefined; nextWake: string | undefined }, now: number): string | null {
  if (wakeIn !== undefined && nextWake !== undefined) throw usageError('omni loop push: --wake-in or --next-wake, not both.');
  if (wakeIn !== undefined) return new Date(now + positiveInt('loop push', '--wake-in', wakeIn) * 1000).toISOString();
  if (nextWake === undefined) return null;
  const at = Date.parse(nextWake);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(nextWake) || !Number.isFinite(at)) throw usageError(`omni loop push: --next-wake is a time such as 2026-10-07T10:00:00Z, got "${nextWake}".`);
  return new Date(at).toISOString();
}

/** What a push needs once its flags are read: the body, given the kept loop and plan. */
type Prepared = (
  | { needsLoop: false; body: (plan: LoopPlan) => LoopBody }
  | { needsLoop: true; body: (loop: LocalLoop, plan: LoopPlan | null) => LoopBody }
) & { takeOver: boolean; wake: string | null };

type PrepareOptions = { repo: string; now: number };

function prepareStart(args: string[], { repo }: PrepareOptions): Prepared {
  const { positional, flags } = parseArgs('loop push start', args, { booleans: ['take-over'] });
  if (positional.length) throw usageError(USAGE);
  const takeOver = flags['take-over'] === true;
  return { needsLoop: false, takeOver, wake: null, body: (plan) => startBody({ repo, plan, takeOver }) };
}

/** `--step`, and `--steps` when given, which the step cannot be past. */
function stepArgs(flags: { step?: string | undefined; steps?: string | undefined }): { step: number; given: number | null } {
  const step = positiveInt('loop push tick', '--step', flags.step);
  const given = flags.steps === undefined ? null : positiveInt('loop push tick', '--steps', flags.steps);
  if (given !== null && step > given) throw usageError(`omni loop push tick: step ${step} is past the plan's ${given} steps.`);
  return { step, given };
}

function actionArg(value: string | undefined): string {
  const action = value ?? '';
  if (!ACTION.test(action)) throw usageError(`omni loop push tick: --action is one word, such as wave, yolo or wait, got "${action}".`);
  return action;
}

function prepareTick(args: string[], { now }: PrepareOptions): Prepared {
  const { positional, flags } = parseArgs('loop push tick', args, { values: ['step', 'steps', 'prd', 'action', 'result', 'link', 'merged', 'items', 'wake-in', 'next-wake'] });
  if (positional.length) throw usageError(USAGE);
  const { step, given } = stepArgs(flags);
  const prd = prdArg('loop push tick', '--prd', flags.prd);
  const action = actionArg(flags.action);
  const result = lineArg('result', flags.result, LINE_MAX);
  const link = linkArg(flags.link);
  const merged = prsArg(flags.merged);
  const items = itemsArg(flags.items);
  const wake = wakeArg({ wakeIn: flags['wake-in'], nextWake: flags['next-wake'] }, now);
  return {
    needsLoop: true, takeOver: false, wake,
    body: (loop, plan) => {
      const steps = Math.max(given ?? plan?.steps.length ?? step, step);
      const replan = plan && plan.version > loop.planVersion ? plan : null;
      return tickBody({ loopId: loop.loopId, step, steps, prd, action, result, link, merged, items, nextWakeAt: wake, replan });
    },
  };
}

function preparePark(args: string[]): Prepared {
  const { positional, flags } = parseArgs('loop push park', args, { values: ['prd', 'who', 'what', 'link'] });
  if (positional.length) throw usageError(USAGE);
  const prd = prdArg('loop push park', '--prd', flags.prd);
  const who = lineArg('who', flags.who, WHO_MAX);
  const what = lineArg('what', flags.what, LINE_MAX);
  const link = linkArg(flags.link);
  return { needsLoop: true, takeOver: false, wake: null, body: (loop) => parkBody({ loopId: loop.loopId, prd, who, what, link }) };
}

function prepareStop(args: string[]): Prepared {
  if (args.length) throw usageError(USAGE);
  return { needsLoop: true, takeOver: false, wake: null, body: (loop) => stopBody(loop.loopId) };
}

/** How each push event reads its flags. */
const PREPARERS = new Map<string, (args: string[], options: PrepareOptions) => Prepared>([
  ['start', prepareStart],
  ['tick', prepareTick],
  ['park', preparePark],
  ['stop', prepareStop],
]);

/** Reads one push's flags into the body it sends, or a usage error: nothing is sent yet. */
function prepare(event: string, args: string[], options: PrepareOptions): Prepared {
  const read = PREPARERS.get(event);
  if (!read) throw usageError(USAGE);
  return read(args, options);
}

/** The line a loop of this checkout is printed with when a start meets it. */
function standingLine(loop: LocalLoop, state: string): string {
  const hint = state === 'silent' ? 'take it over with --take-over' : 'stop it first (omni loop push stop)';
  return `${state}: ${loop.loopId} on ${loop.repo}, plan v${loop.planVersion} — ${hint}`;
}

/** What the app answered: the loop, its stored state and plan version, or null when it is not that. */
function answerOf(reply: unknown): { loopId: string; state: LocalLoop['state']; planVersion: number } | null {
  const loopId = field(reply, 'loopId');
  const state = field(reply, 'state');
  const planVersion = field(reply, 'planVersion');
  if (typeof loopId !== 'string' || !loopId) return null;
  if (state !== 'running' && state !== 'parked' && state !== 'stopped') return null;
  return typeof planVersion === 'number' && Number.isInteger(planVersion) ? { loopId, state, planVersion } : null;
}

type PushIo = FreeIo & LoopOptions & { now: () => number };

type Answer = NonNullable<ReturnType<typeof answerOf>>;

/** One push once its body is made: what it sends and what the kept loop is rebuilt from. */
type Sending = { askUrl: string; root: string; repo: string; body: LoopBody; plan: LoopPlan | null; kept: LocalLoop | null; wake: string | null; at: number };

/** Prints the one line a push stops with: exit 1. */
function refuse(stderr: Out, line: string): number {
  println(stderr, line);
  return 1;
}

/** Whether a loop of this checkout, standing so, refuses a start. */
function blocksStart(standing: string, takeOver: boolean): boolean {
  return standing === 'live' || standing === 'sleeping' || (standing === 'silent' && !takeOver);
}

/** The body a tick, park or stop sends on the kept running loop, or the line it stops with. */
function loopBody(body: (loop: LocalLoop, plan: LoopPlan | null) => LoopBody, kept: LocalLoop | null, plan: LoopPlan | null): LoopBody | string {
  if (!kept || kept.state !== 'running') return 'no loop (omni loop push start)';
  return body(kept, plan);
}

/** The body a start sends with the plan, or the line it stops with. */
function startingBody(prepared: Prepared & { needsLoop: false }, kept: LocalLoop | null, plan: LoopPlan | null, at: number): LoopBody | string {
  if (!plan) return 'no loop plan (omni next --plan)';
  if (!kept) return prepared.body(plan);
  const standing = loopState(kept, at);
  return blocksStart(standing, prepared.takeOver) ? standingLine(kept, standing) : prepared.body(plan);
}

/** Sends `body`: the app's answer, or the line the push stops with. */
async function sendBody(client: NonNullable<ReturnType<typeof signedInClient>>, body: LoopBody): Promise<Answer | string> {
  let reply: unknown;
  try {
    reply = await client.pushLoop(body);
  } catch (error) {
    return skipLine(error);
  }
  return answerOf(reply) ?? 'refused (no loop in the reply)';
}

/** The plan version the app holds after the push. */
function sentVersionOf(plan: LoopPlan | null, kept: LocalLoop | null): number {
  return plan?.version ?? kept?.planVersion ?? 1;
}

/** When the kept loop wakes next after the push. */
function nextWakeAfter(event: LoopBody['event'], wake: string | null, kept: LocalLoop | null): string | null {
  if (event === 'tick') return wake;
  if (event === 'stop') return null;
  return kept?.nextWakeAt ?? null;
}

/** The plan version the kept loop records after the push. */
function planVersionAfter(event: LoopBody['event'], sentVersion: number, kept: LocalLoop | null): number {
  return event === 'tick' ? Math.max(sentVersion, kept?.planVersion ?? 1) : (kept?.planVersion ?? sentVersion);
}

/** The loop this checkout keeps once the app answered. */
function loopAfter({ body, plan, kept, repo, wake, at }: Sending, answer: Answer): LocalLoop {
  const seenAt = new Date(at).toISOString();
  if (body.event === 'start' && plan) {
    return { loopId: answer.loopId, repo, prds: [...plan.prds], state: answer.state, startedAt: seenAt, seenAt, nextWakeAt: null, planVersion: plan.version };
  }
  const sentVersion = sentVersionOf(plan, kept);
  return {
    ...(kept ?? { loopId: answer.loopId, repo, prds: [], startedAt: seenAt, nextWakeAt: null, planVersion: sentVersion }),
    state: answer.state, seenAt,
    nextWakeAt: nextWakeAfter(body.event, wake, kept),
    planVersion: planVersionAfter(body.event, sentVersion, kept),
  };
}

/** The line a push that went through prints. */
function pushedLine(body: LoopBody, answer: Answer, loop: LocalLoop): string {
  const stepPart = body.event === 'tick' ? ` · step ${body.step}/${body.steps}` : '';
  return `${body.event}: ${answer.loopId} ${answer.state}${stepPart} · plan v${loop.planVersion}`;
}

/** Sends the push with the terminal's sign-in and keeps the loop the app answered. */
async function sendAndKeep(sending: Sending, io: PushIo): Promise<number> {
  const client = signedInClient({ askUrl: sending.askUrl, tokens: io.tokens, home: io.home, fetch: io.fetch ?? globalThis.fetch, callMs: io.callMs });
  if (!client) return refuse(io.stderr, 'no sign-in (omni signin)');
  const answer = await sendBody(client, sending.body);
  if (typeof answer === 'string') return refuse(io.stderr, answer);
  const loop = loopAfter(sending, answer);
  writeLocalLoop(sending.root, loop);
  println(io.stdout, pushedLine(sending.body, answer, loop));
  return 0;
}

/** This checkout's context and its repository's slug, or a usage error without one. */
function repoContext({ cwd, exec }: PushIo): { ctx: ReturnType<typeof loadContext>; repo: string } {
  const ctx = loadContext(cwd, { exec });
  const repo = ctx.config.repo.slug;
  if (!repo) throw usageError('omni loop: no repository slug — set repo.slug in the config.');
  return { ctx, repo };
}

async function push(args: string[], io: PushIo): Promise<number> {
  const [event = '', ...rest] = args;
  const { ctx, repo } = repoContext(io);
  const at = io.now();
  const prepared = prepare(event, rest, { repo, now: at });
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return refuse(io.stderr, 'off');
  const plan = readLoopPlans(ctx.root).at(-1) ?? null;
  const kept = readLocalLoop(ctx.root);
  const body = prepared.needsLoop ? loopBody(prepared.body, kept, plan) : startingBody(prepared, kept, plan, at);
  if (typeof body === 'string') return refuse(io.stderr, body);
  return sendAndKeep({ askUrl, root: ctx.root, repo, body, plan, kept, wake: prepared.wake, at }, io);
}

function status(args: string[], { cwd, stdout, exec, now }: PushIo): number {
  const { positional, flags } = parseArgs('loop status', args, { booleans: ['json'] });
  if (positional.length) throw usageError(USAGE);
  const ctx = loadContext(cwd, { exec });
  const kept = readLocalLoop(ctx.root);
  const plan = readLoopPlans(ctx.root).at(-1) ?? null;
  const state = kept ? loopState(kept, now()) : null;
  if (flags.json) {
    println(stdout, JSON.stringify({ loop: kept ? { ...kept, state } : null, plan }, null, 2));
    return 0;
  }
  if (!kept || !state) {
    println(stdout, 'none');
    return 0;
  }
  const planPart = plan ? `plan v${plan.version}, ${plan.steps.length} steps` : `plan v${kept.planVersion}`;
  println(stdout, `${state}: ${kept.loopId} on ${kept.repo} · PRDs ${kept.prds.join(', ')} · ${planPart}`);
  return 0;
}

function usage(stderr: Out): number {
  println(stderr, USAGE);
  return 2;
}

export const loop = {
  withoutContext: true,
  async run(args: string[], io: FreeIo & LoopOptions) {
    const [verb = '', ...rest] = args;
    const withClock: PushIo = { ...io, now: io.now ?? Date.now };
    if (verb === 'push') return push(rest, withClock);
    if (verb === 'status') return status(rest, withClock);
    return usage(io.stderr);
  },
} satisfies FreeCommand;
