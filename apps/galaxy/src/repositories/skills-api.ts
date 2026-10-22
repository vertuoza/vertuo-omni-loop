// A repository's runner skills, read for Settings → Repositories (PRD 2313 s3), as a plain function of a
// Request, so it is tested with a stubbed store and the route stays one line:
//
//   GET /api/repositories/skills?repo=<owner/name>   → 200 {skills, branch, error}
//
// The skills are read live from the default branch, as the Omni App (./skills.ts), and met with the
// allowances the workspace stored (public.repository_runner_skills, read as the signed-in person, so only a
// member reads them): each skill is allowed or not, with who and when; an allowed skill no longer on the
// branch is listed `gone`. A read that fails answers its reason in `error` and still lists the allowed
// skills. The browser gets names and descriptions only, never the App's token (N-PRODUCT-17). Refusals are
// each `{error}` in plain words (ADR-0029): 400 a malformed repository, 401 signed out, 403 a repository
// the person's workspaces do not list, 500 the database failed, 503 no database here.
// A repository as owner/name, in lower case (GitHub's own limits; the caller's spelling is lowered first).
const REPO = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;
import { refuse, reply } from '../business-api/reply';
import type { RunnerSkillRow, SkillsRead } from './model';
import type { SkillsListing } from './skills';

/** A stored allowance, as the table keeps it. */
export interface AllowedRow {
  skill: string;
  allowed_by: string | null;
  allowed_at: string;
}

/** What the route reads as the signed-in person. */
export interface SkillsStore {
  /** The workspace that lists the repository for this person, or null when none does. */
  workspaceOf(repository: string): Promise<string | null>;
  allowed(workspace: string, repository: string): Promise<AllowedRow[]>;
  /** GitHub logins by user id: a person without one is left out. */
  logins(workspace: string, users: string[]): Promise<Map<string, string>>;
}

export type SkillsDeps = {
  /** The signed-in person's store, null when nobody is signed in; the whole `connect` is null when no database is configured. */
  connect: (() => Promise<SkillsStore | null>) | null;
  /** The workspace's Omni App installation, or null when it has none. */
  installation(workspace: string): Promise<number | null>;
  read(installation: number, repository: string): Promise<SkillsListing>;
};

const BAD_REPO = '`repo` must be the repository as owner/name.';
const NOT_READ = 'The runner skills could not be read. Try again.';
const NO_INSTALLATION = 'the Omni App is not installed for this workspace';

/** The rows of the live listing and the stored allowances, met: the listing's order, then the gone ones. */
function meet(listing: SkillsListing, allowed: AllowedRow[], logins: Map<string, string>): SkillsRead {
  const stored = new Map(allowed.map((row) => [row.skill, { by: row.allowed_by ? (logins.get(row.allowed_by) ?? null) : null, at: row.allowed_at }]));
  const row = (name: string, description: string | null, gone: boolean): RunnerSkillRow => ({ name, description, allowed: stored.get(name) ?? null, gone });
  if (!listing.ok) {
    return { skills: [...stored.keys()].sort().map((name) => row(name, null, false)), branch: null, error: listing.reason };
  }
  const listed = new Set(listing.skills.map((s) => s.name));
  const gone = [...stored.keys()].filter((name) => !listed.has(name)).sort();
  return {
    skills: [...listing.skills.map((s) => row(s.name, s.description, false)), ...gone.map((name) => row(name, null, true))],
    branch: listing.branch,
    error: null,
  };
}

export async function readRepositorySkills(request: Request, deps: SkillsDeps): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Runner skills are not available here: this deployment has no database.');
  const repo = (new URL(request.url).searchParams.get('repo') ?? '').toLowerCase();
  if (repo.length > 200 || !REPO.test(repo)) return refuse(400, BAD_REPO);
  const store = await deps.connect();
  if (!store) return refuse(401, 'Sign in to read the runner skills.');
  try {
    const workspace = await store.workspaceOf(repo);
    if (!workspace) return refuse(403, 'Not a member of the workspace that lists this repository.');
    const allowed = await store.allowed(workspace, repo);
    const logins = await store.logins(workspace, [...new Set(allowed.flatMap((a) => (a.allowed_by ? [a.allowed_by] : [])))]);
    const installation = await deps.installation(workspace).catch(() => null);
    const listing: SkillsListing = installation === null ? { ok: false, reason: NO_INSTALLATION } : await deps.read(installation, repo);
    return reply(200, meet(listing, allowed, logins));
  } catch (error) {
    console.error(`runner skills: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(500, NOT_READ);
  }
}
