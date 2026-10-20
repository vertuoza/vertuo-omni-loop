import { callerOrigin, type TokenCheck } from '../ask/auth';
import { reply } from '../business-api/reply';
import { bodyOf, receivePush, refuse } from '../data/kit-push';
import { CHANGE_REFUSALS, CHANGES, ChangeHeadSchema, KnowledgeChangeReplySchema, MAX_CHANGE_BYTES, type KnowledgeChange } from './knowledge-api.contract';
import type { KnowledgeApiService } from './knowledge-api.service';

// A terminal's change to its product's knowledge, at its HTTP edge (PRD 2268 s1; ADR-0095), as a plain
// function of a Request, so it is tested with a fake repository and the route under app/api/knowledge/
// stays one line:
//
//   POST /api/knowledge/changes {repo, product?, kind, action, entry?, fields}
//     → 200 {done: 'applied' | 'proposed', id, url, waitsFor}
//
// The kit's `omni kb legal|glossary add|edit` and `omni constituents add|edit` send it with the terminal's
// sign-in (a bearer token, `omni signin`). The sign-in is checked first: signed out, 401, and nothing is
// read. Then the size, then the body, read by the contract's schema for its kind and action. Only then does
// the service change anything, as the caller's access token, never a service key, so the database checks
// who may, as it does for the Knowledge tab, and records the change as theirs. The url is the item's page
// on this deployment (the section's list for a proposal).
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid sign-in, 403
// not allowed, 404 no such product or item, 409 a repository in several products and none named, 413 a
// body over 16 KiB, 422 the database's refusal, 503 no database here or the sign-in service down, 500 the
// database failed, logged.

/** A client acting as one access token: the Auth server's check and the change as that person. */
type CallerClient = TokenCheck & { service: KnowledgeApiService };

export type KnowledgeChangesDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  log: (line: string) => void;
};

const NO_DATABASE = 'Knowledge changes are not available here: this deployment has no database.';
const COULD_NOT_SAVE = 'The change could not be saved. Try again.';
const UNKNOWN = 'A knowledge change names its kind (legal, glossary or constituent) and its action (add or edit).';

/** The change a body sends, or the problem with it, in one line naming the field. */
function changeOf(sent: unknown): KnowledgeChange | { problem: string } {
  const head = ChangeHeadSchema.safeParse(sent);
  if (!head.success) return { problem: UNKNOWN };
  return bodyOf(CHANGES[head.data.kind][head.data.action], sent, 'A knowledge change');
}

/** POST /api/knowledge/changes: adds or edits one item of the product's knowledge, as the caller. */
export async function postKnowledgeChange(request: Request, deps: KnowledgeChangesDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, { unavailable: NO_DATABASE, maxBytes: MAX_CHANGE_BYTES });
  if (received instanceof Response) return received;
  const change = changeOf(received.sent);
  if ('problem' in change) return refuse(CHANGE_REFUSALS.malformed, change.problem);
  const where = `${change.repo} ${change.kind} ${change.action}`;
  try {
    const done = await received.client().service.change(change);
    if (!done.ok) {
      if (done.cause !== null) deps.log(`knowledge-changes: ${where}: ${done.cause}`);
      return refuse(CHANGE_REFUSALS[done.kind], done.error);
    }
    const { path, ...answer } = done.value;
    return reply(200, KnowledgeChangeReplySchema.parse({ ...answer, url: `${callerOrigin(request)}${path}` }));
  } catch (error) {
    deps.log(`knowledge-changes: ${where}: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(CHANGE_REFUSALS.database, COULD_NOT_SAVE);
  }
}
