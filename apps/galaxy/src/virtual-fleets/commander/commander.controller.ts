import { reply } from '../../business-api/reply';
import { AskAnswerSchema, AskRequestSchema, COMMANDER_REFUSALS, ViewAnswerSchema, ViewQuerySchema, type CommanderRefusalKind, type CommanderState, type Message } from './commander.contract';
import type { CommanderService } from './commander.service';

// The Commander tab's route (PRD 3107 s1; ADR-0095), as plain functions of a Request, so they are tested with the real
// service on a fake repository and a fake model, and the route stays two lines:
//
//   GET  /api/virtual-fleets/commander?workspace=<id>&fleet=<key>   200 {view}
//   POST /api/virtual-fleets/commander {workspace, fleet, text}      201 {question, reply}
//
// The caller is checked first: signed out, 401, and nothing else runs. The service then reads as the signed-in person,
// so row-level security decides what they see (a member alone). The answer is checked against the contract before it
// leaves, never cached; each refusal is `{error}` in plain words, with the question kept when the model gave no answer
// and the state when the Commander is off or out of tokens. A failure is 500, logged.

export type CommanderDeps = {
  /** The rules as the signed-in person, or null when nobody is signed in; null itself with no database. */
  service: (() => Promise<CommanderService | null>) | null;
  log: (line: string) => void;
};

const MAX_BODY_CHARS = 8 * 1024;
const NO_DATABASE = 'The Commander is not available here: this deployment has no database.';
const SIGNED_OUT = 'Sign in first.';
const FAILED = 'The Commander could not answer. Try again.';
const BAD_VIEW = 'The query must be ?workspace=<id>&fleet=<a virtual fleet\'s key>.';
const BAD_ASK = 'The body must be {"workspace": "<id>", "fleet": "<a virtual fleet\'s key>", "text": "<1 to 2000 characters>"}.';

type Refusal = { kind: CommanderRefusalKind; error: string; question?: Message; state?: CommanderState };

const refuse = ({ kind, error, question, state }: Refusal) =>
  reply(COMMANDER_REFUSALS[kind], { error, ...(question ? { question } : {}), ...(state ? { state } : {}) });

/** `text` as JSON, or undefined when it is none. */
function jsonOf(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The body as an object, or undefined. */
async function bodyOf(request: Request): Promise<object | undefined> {
  const text = await request.text();
  const json = text.length > MAX_BODY_CHARS ? undefined : jsonOf(text);
  return json === null || typeof json !== 'object' || Array.isArray(json) ? undefined : json;
}

/** Runs `act` as the signed-in person; a failure is a 500, logged. */
async function asPerson(deps: CommanderDeps, act: (service: CommanderService) => Promise<Response>): Promise<Response> {
  if (!deps.service) return refuse({ kind: 'unavailable', error: NO_DATABASE });
  try {
    const service = await deps.service();
    return service ? await act(service) : refuse({ kind: 'signed-out', error: SIGNED_OUT });
  } catch (error) {
    deps.log(`virtual-fleets/commander: ${error instanceof Error ? error.message : String(error)}`);
    return refuse({ kind: 'database', error: FAILED });
  }
}

/** GET /api/virtual-fleets/commander: the tab as it opens, for a member of the fleet's workspace. */
export function getCommander(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const params = new URL(request.url).searchParams;
    const read = ViewQuerySchema.safeParse({ workspace: params.get('workspace'), fleet: params.get('fleet') });
    if (!read.success) return refuse({ kind: 'malformed', error: BAD_VIEW });
    const served = await service.view(read.data);
    if (!served.ok) {
      if (served.cause) deps.log(`virtual-fleets/commander: ${served.cause}`);
      return refuse(served);
    }
    return reply(200, ViewAnswerSchema.parse({ view: served.value }));
  });
}

/** POST /api/virtual-fleets/commander: a member asks; the Commander's reply, or why there is none. */
export function postCommander(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const body = await bodyOf(request);
    if (!body) return refuse({ kind: 'malformed', error: BAD_ASK });
    const read = AskRequestSchema.safeParse(body);
    if (!read.success) return refuse({ kind: 'invalid', error: BAD_ASK });
    const served = await service.ask(read.data);
    if (!served.ok) {
      if (served.cause) deps.log(`virtual-fleets/commander: ${served.cause}`);
      return refuse(served);
    }
    return reply(201, AskAnswerSchema.parse(served.value));
  });
}
