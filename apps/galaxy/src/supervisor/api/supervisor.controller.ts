import { z } from 'zod';
import { authenticate, callerOrigin, type TokenCheck } from '../../ask/auth';
import { refuse, reply } from '../../business-api/reply';
import type { AppError } from '../../server-event/app-errors';
import {
  AnswerRequestSchema, CheckInRequestSchema, ClearQuerySchema, ClearReplySchema, FindingsQuerySchema, FindingsReplySchema, LinesQuerySchema, LinesReplySchema,
  MemoryQuerySchema, MemoryReplySchema, MessageReplySchema, MessagesQuerySchema, MessagesReplySchema, NextQuerySchema, NextReplySchema, NoteReplySchema,
  NoteRequestSchema, PlaceRequestSchema, RaiseReplySchema, RaiseRequestSchema, SayRequestSchema, SeatQuerySchema, SeatReplySchema, SeatSchema,
  SeatSetRequestSchema, SnapshotSchema, SUPERVISOR_REFUSALS, WorkspaceQuerySchema,
} from './supervisor.contract';
import type { SupervisorActs } from './supervisor.repository';
import type { Served, SupervisorService, Viewer } from './supervisor.service';

// The Supervisor's routes (PRD omni-loop-34 s3; ADR-0095), as plain functions of a Request, tested with the real
// service on a fake store, each route file one line:
//
//   GET    /api/supervisor/next?runner=&since=         the seat      its look, held up to 40 s: what woke it, or 204
//   GET    /api/supervisor/snapshot?runner=            the seat      the seat, open signals and findings, runners, jobs, missions
//   GET    /api/supervisor/lines?runner=&job=&after=   the seat      a job's lines of its workspace, masked
//   GET    /api/supervisor/findings?state=open|done    either        the findings, with their suggestions, presses and results
//   POST   /api/supervisor/findings?runner=            the seat      raises a finding, its check and figures first
//   GET    /api/supervisor/memory?scope=               either        the notes
//   POST   /api/supervisor/memory?runner=              the seat      writes a note
//   DELETE /api/supervisor/memory?workspace=&note= | &scope=   an owner   deletes a note, or clears a scope or all
//   GET    /api/supervisor/messages?finding=&after=    either        a thread (the general one with no finding)
//   POST   /api/supervisor/messages                    either        the seat answers (?runner=), an owner writes ({workspace, …})
//   GET    /api/supervisor/seat                        either        the workspace's seat, or null
//   POST   /api/supervisor/seat                        either        the seat checks in with its tokens (?runner=), an owner places it ({workspace, runner})
//   PATCH  /api/supervisor/seat                        an owner      pauses or resumes it, sets its daily tokens
//
// "Either": a request with an authorization header is the seat's, by the kit's sign-in and `runner=<id>`; one without
// is a person's, by the page's session and `workspace=<id>`. A header is judged alone, never by the session beside it.
// The caller is checked first: signed out, 401, and nothing else runs. Each answer is checked against the contract
// before it leaves; each refusal is `{error}` in plain words. A failure is 500, logged and written to app_errors
// (masked, ../../server-event/app-errors.ts).

export type SupervisorDeps = {
  /** A client acting as the given access token, for the kit's sign-in; null when no database is configured. */
  connect: ((token: string) => TokenCheck) | null;
  /** The browser's signed-in person, by id, or null; null itself when no database is configured. */
  session: (() => Promise<string | null>) | null;
  /** The rules, as the service role; null when this deployment has no service role. */
  service: SupervisorService | null;
  /** An owner's acts, as the signed-in person. */
  acts: () => Promise<SupervisorActs>;
  log: (line: string) => void;
  /** Records a 5xx of these routes; never throws. */
  failed: (error: AppError) => Promise<void>;
};

const MAX_BODY_CHARS = 64 * 1024;
const NO_DATABASE = 'The Supervisor is not available here: this deployment has no database.';
const NO_SERVICE = 'The Supervisor is not available here: this deployment has no service role.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The Supervisor could not answer. Try again.';
const BAD_RUNNER = 'Name the seat\'s runner as `runner=<id>`.';
const BAD_WORKSPACE = 'Name the workspace as `workspace=<id>`.';
const BAD_QUERY = 'The query is out of shape: see the route\'s shape in its words.';
const BAD_RAISE = 'The body must be {"kind": "stuck" | "bug" | "health", "severity": "high" | "medium", "title", "explanation", "signals"? (up to 10 ids), "fingerprint"?, "evidence"? (up to 50), "suggestions"? (up to 2 {"action", "label", "target"})}.';
const BAD_NOTE = 'The body must be {"scope": "short" | "long", "line": "<one line of 300 characters or fewer>", "cites": [1 to 10 ids]}.';
const BAD_ANSWER = 'The body must be {"body", "finding"?, "replyTo"?, "remembered"?, "tokens"?}.';
const BAD_SAY = 'The body must be {"workspace": "<id>", "finding"?: "<id>" | null, "text": "<1 to 4000 characters>"}.';
const BAD_PLACE = 'The body must be {"workspace": "<id>", "runner": "<id>"}.';
const BAD_SET = 'The body must be {"workspace": "<id>", "paused"?: true | false, "dailyTokens"?: <1 to 1,000,000,000>}.';
const BAD_CHECK_IN = 'The body must be {"tokens": <the tokens used since the last check-in>}.';
const BAD_CLEAR = 'Name the workspace as `workspace=<id>`, and `note=<id>` or `scope=short|long|all`.';
const SEAT_ONLY = 'Only the Supervisor\'s seat reads this, by its runner\'s sign-in.';

const params = (request: Request) => Object.fromEntries(new URL(request.url).searchParams);

function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function bodyAs<T>(request: Request, schema: z.ZodType<T>): Promise<T | null> {
  const text = await request.text();
  const read = text.length > MAX_BODY_CHARS ? null : schema.safeParse(jsonOf(text));
  return read?.success ? read.data : null;
}

const hasHeader = (request: Request) => request.headers.get('authorization') !== null;

/** The seat, by the kit's sign-in and its runner; a Response when refused. */
async function seatViewer(request: Request, deps: SupervisorDeps, service: SupervisorService): Promise<(Viewer & { kind: 'seat' }) | Response> {
  if (!deps.connect) return refuse(SUPERVISOR_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const query = SeatQuerySchema.safeParse({ runner: params(request).runner });
  if (!query.success) return refuse(SUPERVISOR_REFUSALS.malformed, BAD_RUNNER);
  const seat = await service.seat(auth.caller.id, query.data.runner);
  return seat.ok ? seat.value : refuse(SUPERVISOR_REFUSALS[seat.kind], seat.error);
}

/** The seat, on a route only the seat reads; a Response when refused. */
function seatOnly(request: Request, deps: SupervisorDeps, service: SupervisorService): Promise<(Viewer & { kind: 'seat' }) | Response> {
  return hasHeader(request) ? seatViewer(request, deps, service) : Promise.resolve(refuse(SUPERVISOR_REFUSALS.forbidden, SEAT_ONLY));
}

/** The signed-in person; a Response when refused. */
async function sessionUser(deps: SupervisorDeps): Promise<string | Response> {
  if (!deps.session) return refuse(SUPERVISOR_REFUSALS.unavailable, NO_DATABASE);
  return (await deps.session()) ?? refuse(SUPERVISOR_REFUSALS['signed-out'], SIGNED_OUT);
}

/** A person of the workspace `workspace` names; a Response when refused. */
async function personViewer(deps: SupervisorDeps, service: SupervisorService, workspace: unknown): Promise<Viewer | Response> {
  const user = await sessionUser(deps);
  if (user instanceof Response) return user;
  const query = WorkspaceQuerySchema.safeParse({ workspace });
  if (!query.success) return refuse(SUPERVISOR_REFUSALS.malformed, BAD_WORKSPACE);
  const person = await service.person(user, query.data.workspace);
  return person.ok ? person.value : refuse(SUPERVISOR_REFUSALS[person.kind], person.error);
}

/** The seat when the request carries a header, a person otherwise. */
function eitherViewer(request: Request, deps: SupervisorDeps, service: SupervisorService): Promise<Viewer | Response> {
  return hasHeader(request) ? seatViewer(request, deps, service) : personViewer(deps, service, params(request).workspace);
}

/** Runs `serve` on the service and answers its value in `shape`; a refusal in its words, a failure 500, recorded. */
async function answer<T>(
  route: string, deps: SupervisorDeps, shape: z.ZodType,
  serve: (service: SupervisorService) => Promise<Served<T> | Response>, wrap: (value: T) => unknown = (value) => value,
): Promise<Response> {
  if (deps.service === null) return refuse(SUPERVISOR_REFUSALS.unavailable, NO_SERVICE);
  try {
    const served = await serve(deps.service);
    if (served instanceof Response) return served;
    if (!served.ok) return refuse(SUPERVISOR_REFUSALS[served.kind], served.error);
    return reply(200, shape.parse(wrap(served.value)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log(`supervisor: ${route}: ${message}`);
    await deps.failed({ workspace: null, route, status: SUPERVISOR_REFUSALS.database, message });
    return refuse(SUPERVISOR_REFUSALS.database, FAILED);
  }
}

const NO_CONTENT = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

/** GET /api/supervisor/next: the seat's look, held up to 40 s. */
export function supervisorNext(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/next', deps, NextReplySchema, async (service) => {
    const seat = await seatViewer(request, deps, service);
    if (seat instanceof Response) return seat;
    const query = NextQuerySchema.safeParse(params(request));
    if (!query.success) return refuse(SUPERVISOR_REFUSALS.malformed, BAD_QUERY);
    const served = await service.next(seat, query.data.since ?? null);
    return served.ok && served.value === null ? NO_CONTENT() : served;
  });
}

/** GET /api/supervisor/snapshot: what the seat reads on a look. */
export function supervisorSnapshot(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/snapshot', deps, SnapshotSchema, async (service) => {
    const seat = await seatOnly(request, deps, service);
    return seat instanceof Response ? seat : service.snapshot(seat);
  });
}

/** GET /api/supervisor/lines: a job's lines, masked, for the seat of its workspace. */
export function supervisorLines(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/lines', deps, LinesReplySchema, async (service) => {
    const seat = await seatOnly(request, deps, service);
    if (seat instanceof Response) return seat;
    const query = LinesQuerySchema.safeParse(params(request));
    return query.success ? service.lines(seat, query.data.job, query.data.after) : refuse(SUPERVISOR_REFUSALS.malformed, BAD_QUERY);
  }, (lines) => ({ lines }));
}

/** GET /api/supervisor/findings: the open findings, or the done ones. */
export function supervisorFindings(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/findings', deps, FindingsReplySchema, async (service) => {
    const viewer = await eitherViewer(request, deps, service);
    if (viewer instanceof Response) return viewer;
    const query = FindingsQuerySchema.safeParse({ state: params(request).state });
    return query.success ? service.findings(viewer, query.data.state === 'open') : refuse(SUPERVISOR_REFUSALS.malformed, BAD_QUERY);
  }, (findings) => ({ findings }));
}

/** POST /api/supervisor/findings: the seat raises a finding. */
export function supervisorRaise(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('POST /api/supervisor/findings', deps, RaiseReplySchema, async (service) => {
    const seat = await seatOnly(request, deps, service);
    if (seat instanceof Response) return seat;
    const body = await bodyAs(request, RaiseRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_RAISE) : service.raise(seat, body, callerOrigin(request));
  });
}

/** GET /api/supervisor/memory: the notes, of one scope or both. */
export function supervisorMemory(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/memory', deps, MemoryReplySchema, async (service) => {
    const viewer = await eitherViewer(request, deps, service);
    if (viewer instanceof Response) return viewer;
    const query = MemoryQuerySchema.safeParse({ scope: params(request).scope });
    return query.success ? service.memory(viewer, query.data.scope ?? null) : refuse(SUPERVISOR_REFUSALS.malformed, BAD_QUERY);
  }, (notes) => ({ notes }));
}

/** POST /api/supervisor/memory: the seat writes a note. */
export function supervisorRemember(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('POST /api/supervisor/memory', deps, NoteReplySchema, async (service) => {
    const seat = await seatOnly(request, deps, service);
    if (seat instanceof Response) return seat;
    const body = await bodyAs(request, NoteRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_NOTE) : service.remember(seat, body);
  }, (note) => ({ note }));
}

/** DELETE /api/supervisor/memory: an owner deletes a note, or clears a scope or all, as themselves. */
export function supervisorForget(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('DELETE /api/supervisor/memory', deps, ClearReplySchema, async (service) => {
    const { workspace, ...rest } = params(request);
    const viewer = await personViewer(deps, service, workspace);
    if (viewer instanceof Response) return viewer;
    const what = ClearQuerySchema.safeParse(rest);
    return what.success ? service.forget(await deps.acts(), viewer.workspace, what.data) : refuse(SUPERVISOR_REFUSALS.malformed, BAD_CLEAR);
  }, (cleared) => ({ cleared }));
}

/** GET /api/supervisor/messages: a thread. */
export function supervisorMessages(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/messages', deps, MessagesReplySchema, async (service) => {
    const viewer = await eitherViewer(request, deps, service);
    if (viewer instanceof Response) return viewer;
    const { finding, after } = params(request);
    const query = MessagesQuerySchema.safeParse({ finding, after });
    return query.success ? service.messages(viewer, query.data.finding ?? null, query.data.after ?? null) : refuse(SUPERVISOR_REFUSALS.malformed, BAD_QUERY);
  }, (messages) => ({ messages }));
}

/** POST /api/supervisor/messages: the seat answers, or an owner writes, as themselves. */
export function supervisorSay(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('POST /api/supervisor/messages', deps, MessageReplySchema, async (service) => {
    if (hasHeader(request)) {
      const seat = await seatViewer(request, deps, service);
      if (seat instanceof Response) return seat;
      const body = await bodyAs(request, AnswerRequestSchema);
      return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_ANSWER) : service.answer(seat, body);
    }
    const user = await sessionUser(deps);
    if (user instanceof Response) return user;
    const body = await bodyAs(request, SayRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_SAY) : service.say(await deps.acts(), body.workspace, body.finding, body.text);
  }, (message) => ({ message }));
}

/** GET /api/supervisor/seat: the workspace's seat, or null. */
export function supervisorSeat(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('GET /api/supervisor/seat', deps, SeatReplySchema, async (service) => {
    const viewer = await eitherViewer(request, deps, service);
    return viewer instanceof Response ? viewer : service.seatRead(viewer);
  }, (seat) => ({ seat }));
}

/** POST /api/supervisor/seat: the seat checks in with its tokens, or an owner places the seat on a runner. */
export function supervisorSeatPost(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('POST /api/supervisor/seat', deps, z.object({ seat: SeatSchema }), async (service) => {
    if (hasHeader(request)) {
      const seat = await seatViewer(request, deps, service);
      if (seat instanceof Response) return seat;
      const body = await bodyAs(request, CheckInRequestSchema);
      return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_CHECK_IN) : service.checkIn(seat, body.tokens);
    }
    const user = await sessionUser(deps);
    if (user instanceof Response) return user;
    const body = await bodyAs(request, PlaceRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_PLACE) : service.place(await deps.acts(), body.workspace, body.runner);
  }, (seat) => ({ seat }));
}

/** PATCH /api/supervisor/seat: an owner pauses or resumes the seat, or sets its daily tokens. */
export function supervisorSeatSet(request: Request, deps: SupervisorDeps): Promise<Response> {
  return answer('PATCH /api/supervisor/seat', deps, z.object({ seat: SeatSchema }), async (service) => {
    const user = await sessionUser(deps);
    if (user instanceof Response) return user;
    const body = await bodyAs(request, SeatSetRequestSchema);
    return body === null ? refuse(SUPERVISOR_REFUSALS.malformed, BAD_SET) : service.setSeat(await deps.acts(), body.workspace, body.paused ?? null, body.dailyTokens ?? null);
  }, (seat) => ({ seat }));
}
