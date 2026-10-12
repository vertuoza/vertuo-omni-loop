// The loops' half of the contract (PRD 1139's spec, "The Loop page"), as a plain function of a Request,
// so it is tested with a stubbed Supabase client and the route under app/api/loops/ stays one line:
//
//   POST /api/loops {event: 'start', repo, prds, plan, reason?, takeOver?}          → 201 {loopId, state, planVersion}
//   POST /api/loops {event: 'tick', loopId, step, steps, prd, action, result, link?,
//                    merged?, items?, repos?, nextWakeAt, replan?: {reason, plan}}  → 200 {loopId, state, planVersion}
//   POST /api/loops {event: 'park', loopId, prd, who, what, link?}                 → 200 {loopId, state, planVersion}
//   POST /api/loops {event: 'stop', loopId}                                        → 200 {loopId, state, planVersion}
//
// The kit's `omni loop push` sends them. Nothing else is taken: an unknown field is refused, so no path,
// prompt or transcript can ever be stored. The database places the loop, keeps it its owner's, refuses a
// second running loop of the caller on the repository and keeps every plan version
// (loop_push(), supabase/migrations/20261108090000_loops.sql).
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid bearer
// token, 403 the database's refusal (another account's loop, or a repository no workspace of the caller
// owns, with the App's install link after its hint), 404 no such loop, 409 a loop already running on the
// repository (naming it) or one that has stopped, 413 a body over its cap, 503 no database here or the
// sign-in service down, 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { OutboxItemIdSchema, PrdNumberSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { withInstallLink, type TokenCheck } from '../ask/auth';
import { Line, receivePush, refuse, WebLink, When } from '../data/kit-push';
import { loopStore, LoopStoreError, type LoopEvent } from './store';

/** The largest push: a plan of every slice of fifty PRDs, with room to spare. */
export const MAX_PUSH_BYTES = 256 * 1024;

/** A Supabase client acting as one access token: the Auth server's check and the function. */
export type LoopClient = TokenCheck & Pick<SupabaseClient, 'rpc'>;

export type LoopDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => LoopClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const NUMBER_MAX = 2 ** 31 - 1;
const Count = z.number().int().min(1).max(NUMBER_MAX);
const LoopId = z.uuid();
const Link = WebLink.nullable();
const Plan = z.record(z.string(), z.unknown());

const Start = z.strictObject({
  event: z.literal('start'),
  repo: z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name'),
  prds: z.array(PrdNumberSchema).min(1).max(50),
  plan: Plan,
  reason: Line(300).optional(),
  takeOver: z.boolean().default(false),
});

const Tick = z.strictObject({
  event: z.literal('tick'),
  loopId: LoopId,
  step: Count,
  steps: Count,
  prd: PrdNumberSchema,
  action: z.string().regex(/^[a-z][a-z-]{0,39}$/, 'a word, such as wave, yolo or wait'),
  result: Line(300),
  link: Link.default(null),
  merged: z.array(PrNumberSchema).max(50).default([]),
  items: z.array(OutboxItemIdSchema).max(50).default([]),
  repos: z.array(z.string().regex(/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/, 'a repository: a target\'s short name or owner/name')).max(20).default([]),
  nextWakeAt: When.nullable(),
  replan: z.strictObject({ reason: Line(300), plan: Plan }).optional(),
}).refine((tick) => tick.step <= tick.steps, { message: 'the step is past the plan\'s end', path: ['step'] });

const Park = z.strictObject({
  event: z.literal('park'),
  loopId: LoopId,
  prd: PrdNumberSchema,
  who: Line(100),
  what: Line(300),
  link: Link.default(null),
});

const Stop = z.strictObject({ event: z.literal('stop'), loopId: LoopId });

const EVENTS = { start: Start, tick: Tick, park: Park, stop: Stop } as const;

const Named = z.looseObject({ event: z.enum(['start', 'tick', 'park', 'stop']) });

/** The first problem zod found, in one line naming the field. */
function problemOf(name: LoopEvent['event'], error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.code === 'unrecognized_keys') return `A ${name} does not carry ${issue.keys.join(', ')}.`;
  return `A ${name}'s \`${issue?.path.join('.') ?? ''}\` is malformed: ${issue?.message ?? 'see the contract'}.`;
}

/** The push a body carries, or the problem with it. */
function eventOf(sent: unknown): LoopEvent | { problem: string } {
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return { problem: 'The body must be a JSON object.' };
  const named = Named.safeParse(sent);
  if (!named.success) return { problem: '`event` is start, tick, park or stop.' };
  const name = named.data.event;
  const parsed = EVENTS[name].safeParse(sent);
  return parsed.success ? parsed.data : { problem: problemOf(name, parsed.error) };
}

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: LoopStoreError, deps: LoopDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === 'P0002') return refuse(404, error.reason);
  if (error.code === '55000') return refuse(409, error.reason);
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`loops: ${error.message}`);
  return refuse(500, 'The loop could not be recorded. Try again.');
}

export async function loopPush(request: Request, deps: LoopDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, {
    unavailable: 'Loops are not available here: this deployment has no database.',
    maxBytes: MAX_PUSH_BYTES,
  });
  if (received instanceof Response) return received;
  const event = eventOf(received.sent);
  if ('problem' in event) return refuse(400, event.problem);

  try {
    const answer = await loopStore(received.client()).push(event);
    return Response.json(answer, { status: event.event === 'start' ? 201 : 200, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (!(error instanceof LoopStoreError)) throw error;
    return refusal(error, deps);
  }
}
