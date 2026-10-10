import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { parseRow } from '../data/parse-rows';
import { rowOf, SavedRepository, type Phase0, type RepositoryRow } from './model';

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
// home, under Repositories & approvers.

export type Saved = { ok: true; repository: RepositoryRow } | { ok: false; message: string };

export interface RepositoriesPort {
  /** Adds `owner/name`, tracked. Adding one already listed answers it as it is. */
  add(fullName: string): Promise<Saved>;
  setTracked(fullName: string, tracked: boolean): Promise<Saved>;
  /** Turns its ideas board public or private (PRD 1246 s4): any member's to do. */
  setPublicIdeas(fullName: string, on: boolean): Promise<Saved>;
  /** Switches where its phase 0 is approved (PRD 1299 s1): the owner's only. */
  setPhase0(fullName: string, phase0: Phase0): Promise<Saved>;
}

export const NOT_OWNER = 'Only the workspace’s owner can change its repositories.';
const GONE = 'That repository is no longer in this workspace. Reload the page.';
export const NOT_A_BOARD_MEMBER = 'Only a member of the workspace can make its ideas board public or private.';
export const PUBLIC_ELSEWHERE = 'Another workspace already shows this repository’s ideas board in public.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const code = propertyOf(error, 'code');
  if (code === '42501') return NOT_OWNER;
  if (code === 'P0002') return GONE;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function databaseRepositories(db: Rpc, workspace: string): RepositoriesPort {
  const call = async (fn: string, args: Record<string, unknown>, refusal = refusalOf): Promise<Saved> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      if (error || !data) return { ok: false, message: refusal(error) };
      const saved = parseRow(SavedRepository, data, `repositories/store: ${fn}`);
      return saved.ok ? { ok: true, repository: rowOf(saved.value) } : { ok: false, message: COULD_NOT_SAVE };
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
  };
}

/** The two functions' rules on repositories kept in memory. */
export function demoRepositoriesPort(initial: RepositoryRow[]): RepositoriesPort {
  let rows = [...initial];
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
      if (kept) return Promise.resolve({ ok: true, repository: kept });
      const repository: RepositoryRow = { fullName: fullName.trim().toLowerCase(), tracked: true, collectedAt: null, collectError: null, products: [], publicIdeas: false, phase0: 'pr' };
      rows = [...rows, repository];
      return Promise.resolve({ ok: true, repository });
    },
    setTracked: (fullName, tracked) => change(fullName, { tracked }),
    setPublicIdeas: (fullName, publicIdeas) => change(fullName, { publicIdeas }),
    setPhase0: (fullName, phase0) => change(fullName, { phase0 }),
  };
}
