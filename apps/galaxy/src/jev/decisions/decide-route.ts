import { authenticate, withInstallLink, type TokenCheck } from '../../ask/auth';
import { refuse, reply } from '../../business-api/reply';
import { decide, type JevDecideDeps } from '../resolve';
import { jevEntry } from './index';

// A Jev decision asked from a Claude session (PRD 812 s3), as a plain function of a Request, so it is
// tested with injected dependencies and app/api/decide/[decision]/route.ts stays one line:
//
//   POST /api/decide/<decision> {repo, state, old, ref?}   → 200 {answer, confidence, decidedBy}
//
// `omni decide` calls it with the terminal's sign-in. The workspace is the one the caller's calls for
// `repo` go to (repo_workspace(), PRD 459). The decision's registry entry reads the state and the old
// answer (its `terminal`); the resolver runs the workspace's mode: Off answers today's without calling
// Jev, Shadow answers today's and logs Jev's beside it, On answers Jev's when it answered at or above
// the floor. When today's answer counts, the reply carries no answer: the caller keeps its own.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body, 401 no valid bearer
// token, 403 a repository outside the caller's workspaces (the database's reason, and the App's install
// link after its install hint), 404 a decision no terminal may ask, 413 a body past its cap, 503 no
// database here or the sign-in service down, 500 the workspace could not be looked up. A deployment
// without the service role cannot reach Jev: every decision answers as Off.

export type DecideRouteDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => TokenCheck) | null;
  /** The workspace (its id) a call of this person for this repository goes to, or the reason none. */
  place: (userId: string, repo: string) => Promise<{ workspace: string | null; reason: string | null }>;
  /** The resolver's dependencies, or null without the service role: every decision answers as Off. */
  jev: JevDecideDeps | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

/** The body's cap: a decision's text, its options and the paths a slice touches. */
const MAX_BODY_BYTES = 64 * 1024;

const REPO = /^[\w.-]+\/[\w.-]+$/;
const TODAY = { answer: null, confidence: null, decidedBy: 'old' } as const;

type Entry = NonNullable<ReturnType<typeof jevEntry>>;
type Terminal = NonNullable<Entry['terminal']>;
type Asked = { repo: string; input: Exclude<ReturnType<Terminal['input']>, null>; old: Exclude<ReturnType<Terminal['old']>, null>; ref: string | null };

function parsed(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const repoOf = (value: unknown): string | null =>
  typeof value === 'string' && value.length <= 200 && REPO.test(value) ? value : null;

/** The ref as given (blank reads as none), or false when it is not text of 300 characters at most. */
function refOf(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 300) return false;
  return value.trim() ? value : null;
}

/** The body's fields as the decision reads them, or the refusal that says which one is wrong. */
function askedFrom(body: Record<string, unknown>, decision: string, terminal: Terminal): Asked | Response {
  const repo = repoOf(body.repo);
  if (repo === null) return refuse(400, '`repo` must be the repository as owner/name.');
  const input = terminal.input(body.state);
  if (input === null) return refuse(400, `\`state\` is not a state of ${decision}.`);
  const old = typeof body.old === 'string' ? terminal.old(body.old) : null;
  if (old === null) return refuse(400, `\`old\` is not an answer of ${decision}.`);
  const ref = refOf(body.ref);
  if (ref === false) return refuse(400, '`ref`, when given, must be text.');
  return { repo, input, old, ref };
}

/** The body as the decision reads it, or the refusal that says why not. */
function readAsked(text: string, decision: string, terminal: Terminal): Asked | Response {
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A decision carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  const body = parsed(text);
  return body ? askedFrom(body, decision, terminal) : refuse(400, 'The body must be a JSON object.');
}

/** What repo_workspace() returned, as a workspace's id or the reason there is none. */
export function placedFrom(data: unknown): { workspace: string | null; reason: string | null } {
  const row = ((Array.isArray(data) ? data[0] : data) ?? {}) as { workspace_id?: string | null; refusal?: string | null };
  if (row.workspace_id) return { workspace: row.workspace_id, reason: null };
  return { workspace: null, reason: row.refusal ?? null };
}

/** The workspace the caller's calls for `repo` go to, or the refusal that says why none. */
async function placeOf(deps: DecideRouteDeps, userId: string, repo: string): Promise<string | Response> {
  try {
    const placed = await deps.place(userId, repo);
    return placed.workspace ?? refuse(403, withInstallLink(placed.reason ?? `No workspace of yours owns ${repo}.`, deps.installLink));
  } catch (error) {
    console.error(`decide: where ${repo} goes: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, 'The workspace of this repository could not be looked up. Try again.');
  }
}

export async function decideRoute(request: Request, decision: string, deps: DecideRouteDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Jev decisions are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);

  const entry = jevEntry(decision);
  if (!entry?.terminal) return refuse(404, `No decision named ${decision} can be asked from a terminal.`);
  const asked = readAsked(await request.text(), decision, entry.terminal);
  if (asked instanceof Response) return asked;

  if (!deps.jev) return reply(200, TODAY);
  const workspace = await placeOf(deps, auth.caller.id, asked.repo);
  if (workspace instanceof Response) return workspace;

  const counted = await decide(deps.jev, { workspace, entry, input: asked.input, old: async () => asked.old, ref: asked.ref });
  if (counted.decidedBy !== 'jev' || counted.value === null) return reply(200, TODAY);
  return reply(200, { answer: entry.show(counted.value), confidence: counted.confidence, decidedBy: 'jev' });
}
