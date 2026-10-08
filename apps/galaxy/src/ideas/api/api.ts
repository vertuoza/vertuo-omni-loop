// The ideas board's half of the terminal's contract (PRD 1246, s2), as plain functions of a Request, so
// they are tested with the sign-in and the storage faked and the route under app/api/ideas/ stays one
// line each:
//
//   POST /api/ideas {repo, title, pitch, lane?}  → 201 {id, url}
//   GET  /api/ideas?repo=<owner/name>            → 200 {repo, url, ideas: [{id, title, pitch, lane, prd, votes}]}
//
// The kit's `omni idea add` and `omni idea list` call them with the terminal's sign-in. An idea goes in
// `later` when it names no lane; its title holds 1 to 120 characters, its pitch 1 to 600, both trimmed.
// The list is the board as its page shows it: Now, Next then Later, each lane by votes then by age, with
// no archived idea (../model.ts, `lanesOf`). `url` is the board's page, /ideas/<owner>/<repo>.
//
// Both are for a member of a workspace that lists the repository (./store.ts). Refusals follow
// ADR-0029, each `{error}` in plain words: 400 a malformed body or query, 401 no valid bearer token, 403
// a caller who is no member of a workspace listing the repository (the same answer for a private board,
// a public one and none, so it never tells which private repositories exist), 413 a body over its cap,
// 503 no database here or the sign-in service down, 500 the database failed.
import { z } from 'zod';
import { authenticate, callerOrigin, type TokenCheck } from '../../ask/auth';
import { receivePush, refuse } from '../../data/kit-push';
import { boardPath, fullNameOf, lanesOf, LANES } from '../model';
import { IdeasRefusal, type IdeasPort, type NewIdeaRow } from './store';

/** The largest idea a call sends: a title, a pitch and a repository, with room to spare. */
export const MAX_ADD_BYTES = 16 * 1024;

/** A client acting as one access token: the Auth server's check, and the board's storage as that caller. */
export type IdeasClient = TokenCheck & { ideas: IdeasPort };

export type IdeasApiDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => IdeasClient) | null;
};

const UNAVAILABLE = 'Ideas boards are not available here: this deployment has no database.';
const NOT_A_MEMBER = (repo: string) => `No workspace of yours lists ${repo}.`;

const Repo = z.string().max(200).transform((value, ctx) => {
  const [owner = '', name = '', ...more] = value.trim().split('/');
  const fullName = more.length ? null : fullNameOf(owner, name);
  if (!fullName) {
    ctx.addIssue({ code: 'custom', message: 'owner/name' });
    return z.NEVER;
  }
  return fullName;
});

const NewIdea = z.strictObject({
  repo: Repo,
  title: z.string().trim().min(1).max(120),
  pitch: z.string().trim().min(1).max(600),
  lane: z.enum(LANES).default('later'),
});

const answer = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

/** The first problem zod found, in one line naming the field. */
function problemOf(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.code === 'unrecognized_keys') return `An idea does not carry ${issue.keys.join(', ')}.`;
  return `An idea's \`${issue?.path.join('.') ?? ''}\` is malformed: ${issue?.message ?? 'see the contract'}.`;
}

/** The idea a body carries, or the problem with it. */
function ideaOf(sent: unknown): NewIdeaRow | { problem: string } {
  if (typeof sent !== 'object' || sent === null || Array.isArray(sent)) return { problem: 'The body must be a JSON object.' };
  const parsed = NewIdea.safeParse(sent);
  return parsed.success ? parsed.data : { problem: problemOf(parsed.error) };
}

/** The refusal a store's error earns: its own words, or a 500 that says nothing of why. */
function failed(error: unknown, what: string): Response {
  if (error instanceof IdeasRefusal) return refuse(error.status, error.message);
  console.error(`ideas: ${error instanceof Error ? error.message : String(error)}`);
  return refuse(500, `The ${what} could not be ${what === 'idea' ? 'added' : 'read'}. Try again.`);
}

export async function addIdea(request: Request, deps: IdeasApiDeps): Promise<Response> {
  const received = await receivePush(request, deps.connect, { unavailable: UNAVAILABLE, maxBytes: MAX_ADD_BYTES });
  if (received instanceof Response) return received;
  const idea = ideaOf(received.sent);
  if ('problem' in idea) return refuse(400, idea.problem);
  try {
    const { id } = await received.client().ideas.add(idea);
    return answer(201, { id, url: `${callerOrigin(request)}${boardPath(idea.repo)}` });
  } catch (error) {
    return failed(error, 'idea');
  }
}

export async function listIdeas(request: Request, deps: IdeasApiDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, UNAVAILABLE);
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  const asked = Repo.safeParse(new URL(request.url).searchParams.get('repo') ?? '');
  if (!asked.success) return refuse(400, 'Name the board\'s repository: ?repo=<owner/name>.');
  const repo = asked.data;
  try {
    const board = await deps.connect(auth.caller.token).ideas.board(repo);
    if (!board?.member) return refuse(403, NOT_A_MEMBER(repo));
    const ideas = lanesOf(board.ideas).flatMap((lane) => lane.ideas)
      .map(({ id, title, pitch, lane, prd, votes }) => ({ id, title, pitch, lane, prd, votes }));
    return answer(200, { repo: board.repo, url: `${callerOrigin(request)}${boardPath(board.repo)}`, ideas });
  } catch (error) {
    return failed(error, 'board');
  }
}
