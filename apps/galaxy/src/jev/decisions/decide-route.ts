import { authenticate, withInstallLink, type TokenCheck } from '../../ask/auth';
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
export const MAX_BODY_BYTES = 64 * 1024;

const REPO = /^[\w.-]+\/[\w.-]+$/;
const TODAY = { answer: null, confidence: null, decidedBy: 'old' } as const;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function decideRoute(request: Request, decision: string, deps: DecideRouteDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Jev decisions are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);

  const entry = jevEntry(decision);
  const terminal = entry?.terminal;
  if (!entry || !terminal) return refuse(404, `No decision named ${decision} can be asked from a terminal.`);

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return refuse(413, `A decision carries ${MAX_BODY_BYTES / 1024} KiB at most.`);
  const body = parsed(text);
  if (!isRecord(body)) return refuse(400, 'The body must be a JSON object.');
  const { repo, state, old: oldText, ref } = body;
  if (typeof repo !== 'string' || repo.length > 200 || !REPO.test(repo)) return refuse(400, '`repo` must be the repository as owner/name.');
  const input = terminal.input(state);
  if (input === null) return refuse(400, `\`state\` is not a state of ${decision}.`);
  const old = typeof oldText === 'string' ? terminal.old(oldText) : null;
  if (old === null) return refuse(400, `\`old\` is not an answer of ${decision}.`);
  if (ref !== undefined && ref !== null && (typeof ref !== 'string' || ref.length > 300)) return refuse(400, '`ref`, when given, must be text.');

  if (!deps.jev) return reply(200, TODAY);
  let placed: Awaited<ReturnType<DecideRouteDeps['place']>>;
  try {
    placed = await deps.place(auth.caller.id, repo);
  } catch (error) {
    console.error(`decide: where ${repo} goes: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, 'The workspace of this repository could not be looked up. Try again.');
  }
  if (!placed.workspace) return refuse(403, withInstallLink(placed.reason ?? `No workspace of yours owns ${repo}.`, deps.installLink));

  const counted = await decide(deps.jev, {
    workspace: placed.workspace,
    entry,
    input,
    old: async () => old,
    ref: typeof ref === 'string' && ref.trim() ? ref : null,
  });
  if (counted.decidedBy !== 'jev' || counted.value === null) return reply(200, TODAY);
  return reply(200, { answer: entry.show(counted.value), confidence: counted.confidence, decidedBy: 'jev' });
}
