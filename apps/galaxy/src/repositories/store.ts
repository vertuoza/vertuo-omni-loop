import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { parseRow } from '../data/parse-rows';
import { repositoryRowOf, SavedRepository, SkillsReadSchema, type Phase0, type RepositoryRow, type SkillsRead } from './model';

// Settings → Repositories's two calls (PRD 612 s1). In production, the owner-only functions of
// supabase/migrations/20261008090000_repositories.sql, add_repository() and set_repository_tracked(),
// called as the signed-in person: each answers the public.repositories row it saved, or refuses. In
// the demo, the same rules kept in memory, so the page can be tried with no database. PRD 1246 s4 adds
// a third, set_repository_public_ideas() of
// supabase/migrations/20261115090000_ideas.sql, any member's too: it turns the repository's ideas board
// public or private. At most one workspace makes a given repository's board public. PRD 1299 s1 adds a
// fourth, set_repository_phase0() of supabase/migrations/20261122090000_phase0_flag.sql, the owner's
// only: it switches where the repository's phase 0 is approved, a phase-0 pull request or the PRD page.
// PRD 1364 s11 drops the product select's call: a repository's products are changed on each product's
// home, under Repositories & approvers. PRD 2188 s1 adds remove_repository() of
// supabase/migrations/20261215090000_remove_repository.sql, the owner's only: the repository is hidden,
// untracked, its board private, out of every product, and keeps its history; add_repository() lists it
// again, tracked. PRD 2270 s3 adds set_repository_fix_when_answered() of
// supabase/migrations/20261220090000_fix_when_answered.sql, the owner's only: it switches whether a runner
// job that waited on answers is fixed by itself once they are in. PRD 2313 s3 adds the Runner skills block:
// the live read of a repository's skills (GET /api/repositories/skills) and set_repository_runner_skill()
// of supabase/migrations/20261222090000_repository_runner_skills.sql, the owner's only: it allows a skill
// on the runners or takes the allowance back.

export type Saved = { ok: true; repository: RepositoryRow } | { ok: false; message: string };

/** A switch of the Runner skills block: the block read again, or the refusal. */
export type SkillSaved = { ok: true; read: SkillsRead } | { ok: false; message: string };

export interface RepositoriesPort {
  /** Adds `owner/name`, tracked. Adding one already listed answers it as it is. */
  add(fullName: string): Promise<Saved>;
  setTracked(fullName: string, tracked: boolean): Promise<Saved>;
  /** Turns its ideas board public or private (PRD 1246 s4): any member's to do. */
  setPublicIdeas(fullName: string, on: boolean): Promise<Saved>;
  /** Switches where its phase 0 is approved (PRD 1299 s1): the owner's only. */
  setPhase0(fullName: string, phase0: Phase0): Promise<Saved>;
  /** Switches its Fix on a runner once answered (PRD 2270 s3): the owner's only. */
  setFixWhenAnswered(fullName: string, on: boolean): Promise<Saved>;
  /** Removes it (PRD 2188 s1): the owner's only. Removing one already removed answers it as it is. */
  remove(fullName: string): Promise<Saved>;
  /** The repository's own skills on its default branch, each allowed or not (PRD 2313 s3). Never fails: a read that failed says why in `error`. */
  skills(fullName: string): Promise<SkillsRead>;
  /** Allows a skill on the runners, or takes it back (PRD 2313 s3): the owner's only. Answers the block read again. */
  setSkill(fullName: string, skill: string, allowed: boolean): Promise<SkillSaved>;
}

export const NOT_OWNER = 'Only the workspace’s owner can change its repositories.';
export const GONE = 'That repository is no longer in this workspace. Reload the page.';
export const NOT_A_BOARD_MEMBER = 'Only a member of the workspace can make its ideas board public or private.';
export const PUBLIC_ELSEWHERE = 'Another workspace already shows this repository’s ideas board in public.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';
const SKILLS_RETRY = 'try again in a moment.';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  if (code === '42501') return NOT_OWNER;
  if (code === 'P0002') return GONE;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

type Fetch = (url: string) => Promise<Pick<Response, 'ok' | 'json'>>;

/** The skills route's answer, or why it could not be read, as the block says it. */
async function readSkills(fetchImpl: Fetch, fullName: string): Promise<SkillsRead> {
  const unread = (why: string): SkillsRead => ({ skills: [], branch: null, error: why });
  try {
    const response = await fetchImpl(`/api/repositories/skills?repo=${encodeURIComponent(fullName)}`);
    const body: unknown = await response.json();
    if (!response.ok) return unread(propertyOf(body, 'error') === undefined ? SKILLS_RETRY : String(propertyOf(body, 'error')));
    const read = SkillsReadSchema.safeParse(body);
    return read.success ? read.data : unread(SKILLS_RETRY);
  } catch {
    return unread(SKILLS_RETRY);
  }
}

/** set_repository_runner_skill()'s refusal, as the page says it: 22023 carries its own words. */
function skillRefusal(error: unknown): string {
  const message = propertyOf(error, 'message');
  return propertyOf(error, 'code') === '22023' && typeof message === 'string' ? message : refusalOf(error);
}

export function databaseRepositories(db: Rpc, workspace: string, fetchImpl: Fetch = (url) => fetch(url)): RepositoriesPort {
  const call = async (fn: string, args: Record<string, unknown>, refusal = refusalOf): Promise<Saved> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, message: refusal(error) };
      const saved = parseRow(SavedRepository, data, `repositories/store: ${fn}`);
      return saved.ok ? { ok: true, repository: repositoryRowOf(saved.value) } : { ok: false, message: COULD_NOT_SAVE };
    } catch (err) {
      return { ok: false, message: refusal(err) };
    }
  };
  // set_repository_public_ideas() is a member's too; 23505: another workspace's board for it is public.
  const boardRefusal = (error: unknown) => {
    const code = propertyOf(error, 'code');
    return code === '42501' ? NOT_A_BOARD_MEMBER : code === '23505' ? PUBLIC_ELSEWHERE : refusalOf(error);
  };
  return {
    add: (fullName) => call('add_repository', { p_full_name: fullName }),
    setTracked: (fullName, tracked) => call('set_repository_tracked', { p_full_name: fullName, p_tracked: tracked }),
    setPublicIdeas: (fullName, on) => call('set_repository_public_ideas', { p_full_name: fullName, p_public: on }, boardRefusal),
    setPhase0: (fullName, phase0) => call('set_repository_phase0', { p_full_name: fullName, p_phase0: phase0 }),
    setFixWhenAnswered: (fullName, on) => call('set_repository_fix_when_answered', { p_full_name: fullName, p_on: on }),
    remove: (fullName) => call('remove_repository', { p_full_name: fullName }),
    skills: (fullName) => readSkills(fetchImpl, fullName),
    async setSkill(fullName, skill, allowed) {
      try {
        const { error } = await db.rpc('set_repository_runner_skill', { p_workspace: workspace, p_full_name: fullName, p_skill: skill, p_allowed: allowed });
        if (error) return { ok: false, message: skillRefusal(error) };
      } catch (err) {
        return { ok: false, message: skillRefusal(err) };
      }
      return { ok: true, read: await readSkills(fetchImpl, fullName) };
    },
  };
}

/** The functions' rules on repositories kept in memory. */
export function demoRepositoriesPort(initial: RepositoryRow[]): RepositoriesPort {
  let rows = [...initial];
  // The demo has no GitHub: every repository holds two skills, allowed per repository as the owner switches them.
  const demoSkills = [
    { name: 'validate-prd', description: 'Checks a PRD’s criteria on its preview, with a clip per criterion.' },
    { name: 'release-notes', description: 'Drafts the release notes of a merged PR.' },
  ];
  const allowedAt = new Map<string, string>();
  const demoRead = (fullName: string): SkillsRead => ({
    skills: demoSkills.map((s) => {
      const at = allowedAt.get(`${fullName.toLowerCase()} ${s.name}`);
      return { ...s, allowed: at ? { by: 'ada', at } : null, gone: false };
    }),
    branch: 'main',
    error: null,
  });
  const find = (name: string) => rows.find((r) => r.fullName === name.trim().toLowerCase());
  const change = (fullName: string, to: Partial<RepositoryRow>): Promise<Saved> => {
    const kept = find(fullName);
    if (!kept) return Promise.resolve({ ok: false, message: GONE });
    const repository = { ...kept, ...to };
    rows = rows.map((r) => (r === kept ? repository : r));
    return Promise.resolve({ ok: true, repository });
  };
  return {
    add(fullName) {
      const kept = find(fullName);
      if (kept?.removedAt) return change(fullName, { removedAt: null, tracked: true });
      if (kept) return Promise.resolve({ ok: true, repository: kept });
      const repository: RepositoryRow = { fullName: fullName.trim().toLowerCase(), tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, phase0: 'pr', fixWhenAnswered: true, removedAt: null };
      rows = [...rows, repository];
      return Promise.resolve({ ok: true, repository });
    },
    setTracked: (fullName, tracked) => change(fullName, { tracked }),
    setPublicIdeas: (fullName, publicIdeas) => change(fullName, { publicIdeas }),
    setPhase0: (fullName, phase0) => change(fullName, { phase0 }),
    setFixWhenAnswered: (fullName, fixWhenAnswered) => change(fullName, { fixWhenAnswered }),
    remove(fullName) {
      const kept = find(fullName);
      if (kept?.removedAt) return Promise.resolve({ ok: true, repository: kept });
      return change(fullName, { removedAt: new Date().toISOString(), tracked: false, publicIdeas: false, products: [], planProducts: [] });
    },
    skills: (fullName) => Promise.resolve(demoRead(fullName)),
    setSkill(fullName, skill, allowed) {
      if (!find(fullName)) return Promise.resolve({ ok: false, message: GONE });
      const id = `${fullName.toLowerCase()} ${skill}`;
      if (allowed) allowedAt.set(id, new Date().toISOString());
      else allowedAt.delete(id);
      return Promise.resolve({ ok: true, read: demoRead(fullName) });
    },
  };
}
