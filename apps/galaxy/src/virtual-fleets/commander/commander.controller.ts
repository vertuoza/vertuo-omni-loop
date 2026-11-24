import type { z } from 'zod';
import { reply } from '../../business-api/reply';
import {
  AskAnswerSchema, AskRequestSchema, CardAnswerRequestSchema, CardAnswerSchema, COMMANDER_REFUSALS, NoteDeletedSchema, NoteDeleteRequestSchema, SendAnswerSchema, SendRequestSchema,
  ViewAnswerSchema, ViewQuerySchema,
  type Card, type CommanderRefusalKind, type CommanderState, type Message,
} from './commander.contract';
import type { CommanderService } from './commander.service';

// The Commander tab's route (PRD 3107 s1; ADR-0095), as plain functions of a Request, so they are tested with the real
// service on a fake repository and a fake model, and the route stays two lines:
//
//   GET  /api/virtual-fleets/commander?workspace=<id>&fleet=<key>   200 {view}
//   POST /api/virtual-fleets/commander {workspace, fleet, text}      201 {question, reply}
//   POST /api/virtual-fleets/commander/answer {workspace, fleet, source, id, choice}   200 {card} (s2)
//   POST /api/virtual-fleets/commander/message {workspace, fleet, text}   201 {message} (s3)
//   POST /api/virtual-fleets/commander/notes {workspace, fleet, note}   200 {note} (s4)
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
const BAD_VIEW = 'The query must be ?workspace=<id>&fleet=<an AI fleet\'s key>.';
const BAD_ANSWER = 'The body must be {"workspace": "<id>", "fleet": "<an AI fleet\'s key>", "source": "job" or "item", "id": "<the card\'s id>", "choice": "<one of its choices>"}.';
const BAD_MESSAGE = 'The body must be {"workspace": "<id>", "fleet": "<an AI fleet\'s key>", "text": "<1 to 2000 characters>"}.';
const BAD_NOTE = 'The body must be {"workspace": "<id>", "fleet": "<an AI fleet\'s key>", "note": "<a line\'s id>"}.';
const BAD_ASK = 'The body must be {"workspace": "<id>", "fleet": "<an AI fleet\'s key>", "text": "<1 to 2000 characters>"}.';

type Refusal = { kind: CommanderRefusalKind; error: string; question?: Message; state?: CommanderState; card?: Card };

const refuse = ({ kind, error, question, state, card }: Refusal) =>
  reply(COMMANDER_REFUSALS[kind], { error, ...(question ? { question } : {}), ...(state ? { state } : {}), ...(card ? { card } : {}) });

type Read<T> = { ok: true; data: T } | { ok: false; kind: 'malformed' | 'invalid' };

/** The body read in `schema`: malformed when it is no JSON object of at most MAX_BODY_CHARS, invalid when it breaks the schema. */
async function bodyIn<T>(request: Request, schema: z.ZodType<T>): Promise<Read<T>> {
  const text = await request.text();
  let json: unknown;
  try {
    json = text.length > MAX_BODY_CHARS ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return { ok: false, kind: 'malformed' };
  const read = schema.safeParse(json);
  return read.success ? { ok: true, data: read.data } : { ok: false, kind: 'invalid' };
}

type Served<T> = { ok: true; value: T } | (Refusal & { ok: false; cause?: string });

/** What a route answers once served: `status` and the contract's body, or the refusal, its cause logged. */
function answerOf<T>(served: Served<T>, deps: CommanderDeps, status: number, body: (value: T) => unknown): Response {
  if (served.ok) return reply(status, body(served.value));
  if (served.cause) deps.log(`virtual-fleets/commander: ${served.cause}`);
  return refuse(served);
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
    return answerOf(await service.view(read.data), deps, 200, (view) => ViewAnswerSchema.parse({ view }));
  });
}

/** POST /api/virtual-fleets/commander: a member asks; the Commander's reply, or why there is none. */
export function postCommander(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const read = await bodyIn(request, AskRequestSchema);
    if (!read.ok) return refuse({ kind: read.kind, error: BAD_ASK });
    return answerOf(await service.ask(read.data), deps, 201, (asked) => AskAnswerSchema.parse(asked));
  });
}

/** POST /api/virtual-fleets/commander/answer: a member answers a card of the rail, as themselves; the card as it then stands
 * (s2). A card answered elsewhere is 409 with the card, a route that refused is 502 with the card left open. */
export function postCommanderAnswer(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const read = await bodyIn(request, CardAnswerRequestSchema);
    if (!read.ok) return refuse({ kind: read.kind, error: BAD_ANSWER });
    return answerOf(await service.answer(read.data), deps, 200, (card) => CardAnswerSchema.parse({ card }));
  });
}

/** POST /api/virtual-fleets/commander/message: a member messages the fleet's agents, as themselves (s3); the message as stored,
 * which no job has read yet. No model is asked. */
export function postCommanderMessage(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const read = await bodyIn(request, SendRequestSchema);
    if (!read.ok) return refuse({ kind: read.kind, error: BAD_MESSAGE });
    return answerOf(await service.send(read.data), deps, 201, (message) => SendAnswerSchema.parse({ message }));
  });
}

/** POST /api/virtual-fleets/commander/notes: a member deletes a line of the fleet's notebooks, as themselves (s4); who deleted
 * it and when. The line leaves the Commander's memory. No model is asked. */
export function postCommanderNote(request: Request, deps: CommanderDeps): Promise<Response> {
  return asPerson(deps, async (service) => {
    const read = await bodyIn(request, NoteDeleteRequestSchema);
    if (!read.ok) return refuse({ kind: read.kind, error: BAD_NOTE });
    return answerOf(await service.deleteNote(read.data), deps, 200, (note) => NoteDeletedSchema.parse({ note }));
  });
}
