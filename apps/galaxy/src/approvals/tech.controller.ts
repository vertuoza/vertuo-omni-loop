import { z } from 'zod';
import { TechMembersSchema, TechRequestedSchema } from 'omni-loop/kit/lib/approval/tech.ts';
import { PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { callerOrigin, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import { bodyOf, callerOf, refusalOf } from './approvals.controller';
import type { ReachDeps } from './approvals.service';
import type { TechRepository } from './tech.repository';
import { requestTech, techMembersOf, type TechPrd } from './tech.service';

// A Tech Approval's HTTP edge (PRD 2608 s3), as plain functions of a Request, so they are tested with fake
// repositories and the route stays one line each:
//
//   GET  /api/dossiers/approval/tech?repo=<owner/name>&prd=<n>  (or ?dossier=<id>)  → 200 {members: [{login, name}]}
//   POST /api/dossiers/approval/tech {repo, prd, login}  (or {dossier, login})      → 200 {login, state, url}
//
// The kit calls with the terminal's sign-in (a bearer token) and names a PRD by its number; the page calls
// with the person's own session and names its dossier. Replies are checked against the kit's own schemas
// before they leave. Refusals follow ADR-0029, each `{error}` in plain words, the database's own when it
// has some: 400 a malformed query or body, or who may not be named; 401 no valid sign-in; 403 who may not
// request it; 404 no such PRD the caller reads; 503 no database here; 500 the database failed.

/** A client acting as one access token: the Auth server's check and the caller's reads and request. */
type CallerClient = TokenCheck & { tech: TechRepository };

export type TechRouteDeps = ReachDeps & {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => CallerClient) | null;
  /** The signed-in person's own session (the page), or null when nobody is signed in. */
  session: () => Promise<TechRepository | null>;
};

const NOT_ASKED = 'The Tech Approval could not be requested. Try again.';
const NOT_READ = 'The members could not be read. Try again.';

const Uuid = z.uuid();
const Repo = z.string().max(200).regex(/^[\w.-]+\/[\w.-]+$/);
const Login = z.string().min(1).max(200);

const NamedPrd = z.union([
  z.object({ dossier: Uuid }),
  z.object({ repo: Repo, prd: PrdNumberSchema }),
]);

const Body = z.intersection(NamedPrd, z.object({ login: Login }));

const Query = z.union([
  z.object({ dossier: Uuid }),
  z.object({ repo: Repo, prd: z.string().regex(/^\d{1,9}$/).transform(Number).pipe(PrdNumberSchema) }),
]);

/** The PRD as the database's reads name it: its repository in lower case. */
const prdOf = (named: z.infer<typeof NamedPrd>): TechPrd =>
  ('dossier' in named ? { dossier: named.dossier } : { repo: named.repo.toLowerCase(), prd: named.prd });

/** The caller's repository: its bearer token's when it carries one, else the page's session. */
async function techOf(request: Request, deps: TechRouteDeps): Promise<TechRepository | Response> {
  if (!deps.connect) return refuse(503, 'Approvals are not available here: this deployment has no database.');
  if (request.headers.get('authorization')) {
    const client = await callerOf(request, deps.connect);
    return client instanceof Response ? client : client.tech;
  }
  return (await deps.session()) ?? refuse(401, 'Sign in first to request a Tech Approval.');
}

/** POST: names one member for a PRD's Tech Approval, reaches them, and says who it now waits on. */
export async function requestTechApproval(request: Request, deps: TechRouteDeps): Promise<Response> {
  const tech = await techOf(request, deps);
  if (tech instanceof Response) return tech;
  const body = await bodyOf(request, Body, '{"repo": "owner/name", "prd": <number>, "login": "<member>"}');
  if (body instanceof Response) return body;
  const prd = prdOf(body);
  const asked = await requestTech({ ...deps, tech }, prd, body.login, callerOrigin(request));
  if (!asked.ok) {
    if ('missing' in asked) return refuse(404, 'repo' in prd ? `No PRD #${prd.prd} of ${prd.repo} you can read.` : 'No such dossier.');
    return refusalOf(asked.refusal, NOT_ASKED, deps.log);
  }
  const shaped = TechRequestedSchema.safeParse(asked.reply);
  if (!shaped.success) {
    deps.log("approvals: a Tech Approval's reply is out of the kit's shape");
    return refuse(500, NOT_ASKED);
  }
  return reply(200, shaped.data);
}

/** GET: the workspace's members who can be named, for the kit's `omni approval tech request` and the page's picker. */
export async function techMembers(request: Request, deps: TechRouteDeps): Promise<Response> {
  const tech = await techOf(request, deps);
  if (tech instanceof Response) return tech;
  const query = new URL(request.url).searchParams;
  const named = Query.safeParse(query.has('dossier')
    ? { dossier: query.get('dossier') }
    : { repo: query.get('repo') ?? '', prd: query.get('prd') ?? '' });
  if (!named.success) return refuse(400, 'The query must name a PRD: ?repo=<owner/name>&prd=<number>, or ?dossier=<id>.');
  const prd = prdOf(named.data);
  const read = await techMembersOf(tech, prd);
  if (!read.ok) return refusalOf(read.refusal, NOT_READ, deps.log);
  if (read.value === null) return refuse(404, 'repo' in prd ? `No PRD #${prd.prd} of ${prd.repo} you can read.` : 'No such dossier.');
  const shaped = TechMembersSchema.safeParse({ members: read.value });
  if (!shaped.success) {
    deps.log("approvals: the members' reply is out of the kit's shape");
    return refuse(500, NOT_READ);
  }
  return reply(200, shaped.data);
}
