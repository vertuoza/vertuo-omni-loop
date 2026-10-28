import { z } from 'zod';
import { authenticate, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import {
  AnswerRequestSchema, AskRequestSchema, FleetRequestSchema, HealthReplySchema, HealthReportSchema, JobLinesQuerySchema, JobLinesSchema, JobQuestionsSchema, JobReplySchema,
  GithubTokenReplySchema, JobUpdateReplySchema, JobUpdateSchema, KitRunnersSchema, NextQuerySchema, PrdJobsQuerySchema, PrdJobsSchema, RegisterReplySchema, RegisterRequestSchema,
  RUNNER_REFUSALS, RunnerJobSchema, RunnerReplySchema, RunnersQuerySchema, SendRequestSchema,
} from './runners.contract';
import type { RunnersService, Served } from './runners.service';

// The runners' routes (PRD 1830 s1; ADR-0095), as plain functions of a Request, so they are tested with
// the real service on a fake store and each route stays one line:
//
//   POST  /api/runners/register            the kit's sign-in   registers the runner
//   GET   /api/runners/next?runner=<id>    the kit's sign-in   holds up to 40 s: the job claimed, or 204
//   POST  /api/runners/jobs/<id>           the kit's sign-in   a report: status, log tail, live lines, PR link, exit code
//   POST  /api/runners/<id>/health         the kit's sign-in   the runner's machine, every 15 s (PRD 2102)
//   POST  /api/runners/jobs/<id>/github-token  the kit's sign-in  a fresh token of the App the job runs as, for the job's own runner (PRD 2433)
//   GET   /api/runners/jobs/<id>/lines     either              a job's live lines after `after` (PRD 1904; the kit's, PRD 2251)
//   GET   /api/runners?repo=               the kit's sign-in   the runners of the repository's workspace (PRD 2251)
//   GET   /api/runners/jobs?repo=&prd=     the kit's sign-in   the PRD's jobs in the repository, newest first (PRD 2251)
//   POST  /api/runners/jobs                either              queues a job (the kit's, PRD 1972)
//   POST  /api/runners/jobs/<id>/cancel    the session         cancels a job
//   PATCH /api/runners/<id>                the session         sets or clears a runner's fleet
//   POST  /api/runners/jobs/<id>/questions the kit's sign-in   a running job asks its questions, once (PRD 2255)
//   GET   /api/runners/jobs/<id>/questions the session or the kit's  a job's questions, and their answers once given
//   POST  /api/runners/jobs/<id>/answers   the session only    answers them: queues the job that resumes the run
//   POST  /api/runners/jobs/<id>/dismiss   the session only    closes them with no answers
//
// The caller is checked first: signed out, 401, and nothing else runs. A runner's routes take a bearer
// access token (`omni signin`, or a traded OMNI_TOKEN), checked with the Auth server; the browser's
// take the page's session. A token never answers or dismisses a question (BR-PRODUCT-94): any bearer
// header on those two routes is a 403. The one reading that widens (PRD 2425 s6) is a workspace's API
// key, which answers and dismisses only a job a key of its workspace sent, and only through the public
// API (../public-api, /api/v1/jobs/<id>/answers and /dismiss): the kit's sign-in and every other bearer
// still get this 403. The service then reads and writes as the service role, holding
// the rules itself (./runners.service.ts). Each answer is checked against the contract before it leaves;
// each refusal is `{error}` in plain words (./runners.contract.ts). A failure is 500, logged.

export type RunnersDeps = {
  /** A client acting as the given access token, for the kit's sign-in; null when no database is configured. */
  connect: ((token: string) => TokenCheck) | null;
  /** The browser's signed-in person, by id, or null; null itself when no database is configured. */
  session: (() => Promise<string | null>) | null;
  /** The rules, as the service role; null when this deployment has no service role. */
  service: RunnersService | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 300 * 1024;
/** A report may carry 2,000 lines of 600 characters beside its tail (PRD 1904): the runner sends at most
 * 256 KB of lines, and this bounds what the contract itself allows. */
const MAX_REPORT_CHARS = 2 * 1024 * 1024;
const NO_DATABASE = 'Runners are not available here: this deployment has no database.';
const NO_SERVICE = 'Runners are not available here: this deployment has no service role.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The runners could not answer. Try again.';
const BAD_REGISTER = 'The body must be {"name": "<name>", "slots": <1 to 8>, "repos": ["owner/name", …], "version": "<kit version>", "githubApp"?: true | false}.';
const BAD_NEXT = 'Name the runner as `runner=<id>`.';
const BAD_REPORT = 'The body must be {"status": "running" | "done" | "failed" | "cancelled", "logTail"?, "from"? with "lines"? (at most 2,000 of 600 characters), "prUrl"?, "exitCode"?, "reason"?}.';
const BAD_HEALTH = 'The body must be {"cpu", "load1", "cores", "memUsed", "memTotal", "diskFree", "diskTotal"}, each a number of 0 or more or null, with "paused"? (80 characters or null), "limits"? ({"maxMemory", "minDiskGb", "maxLoad"}) and "accounts"? (a list of {"id", "agent", "state", "resetsAt"?}), and nothing else.';
const BAD_LINES = 'Ask for the lines as `after=<sequence number>`, or with no query.';
const BAD_SEND = 'The body must be {"line": "/omni:<skill> <arguments>", "repo": "owner/name", "target": {"kind": "any"} | {"kind": "fleet", "fleet": "<fleet>"} | {"kind": "runner", "runner": "<id>"}}.';
const BAD_RUNNERS = 'Name the repository as `repo=owner/name`.';
const BAD_JOBS = 'Name the repository as `repo=owner/name` and the PRD as `prd=<number>`.';
const BAD_FLEET = 'The body must be {"fleet": "<fleet>"} or {"fleet": null}.';
const BAD_ASK = 'The body must be {"issue": <the issue number>, "lead": "<why the job stopped>", "questions": [{"question", "header", "options": [{"label", "description"}, 2 to 4], "multiSelect"}, 1 to 4, each asked once]}.';
const BAD_ANSWERS = 'The body must be {"answers": {"<question>": "<answer>", …}}: one answer of 2,000 characters or fewer to each question, and nothing else.';
const TOKEN_ANSWERS = 'A token never answers: answer on the Runners page, signed in.';
const TOKEN_DISMISS = 'A token never dismisses: dismiss on the Runners page, signed in.';
const BAD_ID = 'No such runner or job.';

const IdSchema = z.uuid();

/** `text` as JSON, or null when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The request's body read by `schema`: its value, or null when it is too large, no JSON, or out of shape. */
async function bodyAs<T>(request: Request, schema: z.ZodType<T>, maxChars = MAX_BODY_CHARS): Promise<T | null> {
  const text = await request.text();
  const read = text.length > maxChars ? null : schema.safeParse(jsonOf(text));
  return read?.success ? read.data : null;
}

/** The runner's owner, by the kit's sign-in; a Response when refused. */
async function kitCaller(request: Request, deps: RunnersDeps): Promise<string | Response> {
  if (!deps.connect) return refuse(RUNNER_REFUSALS.unavailable, NO_DATABASE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  return auth.ok ? auth.caller.id : refuse(auth.status, auth.error);
}

/** The browser's signed-in person; a Response when refused. */
async function sessionCaller(deps: RunnersDeps): Promise<string | Response> {
  if (!deps.session) return refuse(RUNNER_REFUSALS.unavailable, NO_DATABASE);
  return (await deps.session()) ?? refuse(RUNNER_REFUSALS['signed-out'], SIGNED_OUT);
}

/** The caller by the kit's sign-in when the request carries an authorization header, by the browser's
 * session otherwise: a header is judged alone, never by the session beside it. */
async function eitherCaller(request: Request, deps: RunnersDeps): Promise<string | Response> {
  return request.headers.get('authorization') === null ? sessionCaller(deps) : kitCaller(request, deps);
}

/** The browser's signed-in person, for a route a token never reaches: a request that carries a bearer header
 * is refused with `words`, whatever session the browser holds (BR-PRODUCT-94). */
async function personCaller(request: Request, deps: RunnersDeps, words: string): Promise<string | Response> {
  return request.headers.get('authorization') === null ? sessionCaller(deps) : refuse(RUNNER_REFUSALS.forbidden, words);
}

/** Runs `serve` for the caller and answers its value in `shape`; a refusal in its words, a failure 500. */
async function answer<T>(
  caller: string | Response, deps: RunnersDeps, shape: z.ZodType,
  serve: (service: RunnersService, caller: string) => Promise<Served<T> | Response>, wrap: (value: T) => unknown = (value) => value,
): Promise<Response> {
  if (caller instanceof Response) return caller;
  if (!deps.service) return refuse(RUNNER_REFUSALS.unavailable, NO_SERVICE);
  try {
    const served = await serve(deps.service, caller);
    if (served instanceof Response) return served;
    if (!served.ok) return refuse(RUNNER_REFUSALS[served.kind], served.error);
    return reply(200, shape.parse(wrap(served.value)));
  } catch (error) {
    deps.log(`runners: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(RUNNER_REFUSALS.database, FAILED);
  }
}

/** POST /api/runners/register: registers the runner by its name. */
export async function registerRunner(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, RegisterReplySchema, async (service, caller) => {
    const body = await bodyAs(request, RegisterRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_REGISTER) : service.register(caller, body);
  });
}

/** GET /api/runners/next?runner=<id>: the job the runner claimed within 40 s, or 204. */
export async function nextJob(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, RunnerJobSchema, async (service, caller) => {
    const query = NextQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return refuse(RUNNER_REFUSALS.malformed, BAD_NEXT);
    const served = await service.next(caller, query.data.runner);
    return served.ok && served.value === null ? new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } }) : served;
  });
}

/** POST /api/runners/jobs/<id>: a runner's report on a job it claimed; answers whether a cancel waits. */
export async function reportJob(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, JobUpdateReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, JobUpdateSchema, MAX_REPORT_CHARS);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_REPORT) : service.update(caller, id, body);
  });
}

/** POST /api/runners/jobs/<id>/github-token: a fresh token of the App the job runs as, only for the runner that holds the job (PRD 2433). */
export async function refreshGithubToken(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, GithubTokenReplySchema, (service, caller) => (
    IdSchema.safeParse(id).success ? service.githubToken(caller, id) : Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID))
  ));
}

/** POST /api/runners/<id>/health: a runner's machine, from its owner; answers when the server took it. */
export async function reportHealth(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, HealthReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, HealthReportSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_HEALTH) : service.health(caller, id, body);
  });
}

/** GET /api/runners/jobs/<id>/lines?after=<seq>: a job's live lines, for a member of its workspace, from the
 * browser or the terminal (PRD 2251); 404 to anyone else. */
export async function jobLines(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await eitherCaller(request, deps), deps, JobLinesSchema, (service, caller) => {
    if (!IdSchema.safeParse(id).success) return Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID));
    const query = JobLinesQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? service.lines(caller, id, query.data.after) : Promise.resolve(refuse(RUNNER_REFUSALS.malformed, BAD_LINES));
  });
}

/** GET /api/runners?repo=<owner/name>: the runners of the repository's workspace, for a member, from the terminal (PRD 2251). */
export async function listRunners(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, KitRunnersSchema, (service, caller) => {
    const query = RunnersQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? service.runnersFor(caller, query.data.repo) : Promise.resolve(refuse(RUNNER_REFUSALS.malformed, BAD_RUNNERS));
  }, (runners) => ({ runners }));
}

/** GET /api/runners/jobs?repo=<owner/name>&prd=<n>: the PRD's jobs in the repository, newest first, for a
 * member of its workspace, from the terminal (PRD 2251). */
export async function prdJobs(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, PrdJobsSchema, (service, caller) => {
    const query = PrdJobsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    return query.success ? service.prdJobs(caller, query.data.repo, query.data.prd) : Promise.resolve(refuse(RUNNER_REFUSALS.malformed, BAD_JOBS));
  }, (jobs) => ({ jobs }));
}

/** POST /api/runners/jobs: queues a job from the browser, or from a service with the kit's sign-in (the header wins). */
export async function sendJob(request: Request, deps: RunnersDeps): Promise<Response> {
  return answer(await eitherCaller(request, deps), deps, JobReplySchema, async (service, caller) => {
    const body = await bodyAs(request, SendRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_SEND) : service.send(caller, body);
  }, (job) => ({ job }));
}

/** POST /api/runners/jobs/<id>/cancel: the sender or a workspace owner cancels a job. */
export async function cancelJob(id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, JobReplySchema, (service, caller) =>
    IdSchema.safeParse(id).success ? service.cancel(caller, id) : Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID)), (job) => ({ job }));
}

/** POST /api/runners/jobs/<id>/questions: a running job asks its questions, once, from the owner of its runner (PRD 2255). */
export async function askQuestions(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await kitCaller(request, deps), deps, JobQuestionsSchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, AskRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_ASK) : service.ask(caller, id, body);
  });
}

/** GET /api/runners/jobs/<id>/questions: a job's questions, with the answers once given, for a member of its
 * workspace (the session) or a runner's owner (the kit's sign-in, the header wins); 404 to anyone else. */
export async function readQuestions(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  const caller = request.headers.get('authorization') === null ? await sessionCaller(deps) : await kitCaller(request, deps);
  return answer(caller, deps, JobQuestionsSchema, (service, who) =>
    IdSchema.safeParse(id).success ? service.questions(who, id) : Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID)));
}

/** POST /api/runners/jobs/<id>/answers: a member answers a job's questions, with the page's session only: the
 * answers and the job that resumes the run are stored together, and the first answer wins. */
export async function answerQuestions(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await personCaller(request, deps, TOKEN_ANSWERS), deps, JobReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, AnswerRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_ANSWERS) : service.answer(caller, id, body);
  }, (job) => ({ job }));
}

/** POST /api/runners/jobs/<id>/dismiss: a member closes a job's questions with no answers, with the page's session only. */
export async function dismissQuestions(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await personCaller(request, deps, TOKEN_DISMISS), deps, JobQuestionsSchema, (service, caller) =>
    IdSchema.safeParse(id).success ? service.dismiss(caller, id) : Promise.resolve(refuse(RUNNER_REFUSALS.missing, BAD_ID)));
}

/** PATCH /api/runners/<id>: a workspace owner sets or clears a runner's fleet. */
export async function setRunnerFleet(request: Request, id: string, deps: RunnersDeps): Promise<Response> {
  return answer(await sessionCaller(deps), deps, RunnerReplySchema, async (service, caller) => {
    if (!IdSchema.safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, BAD_ID);
    const body = await bodyAs(request, FleetRequestSchema);
    return body === null ? refuse(RUNNER_REFUSALS.malformed, BAD_FLEET) : service.setFleet(caller, id, body.fleet);
  }, (runner) => ({ runner }));
}
