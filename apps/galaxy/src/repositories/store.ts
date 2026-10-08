import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { parseRow } from '../data/parse-rows';
import { rowOf, SavedRepository, type RepositoryRow } from './model';

// Settings → Repositories's two calls (PRD 612 s1). In production, the owner-only functions of
// supabase/migrations/20261008090000_repositories.sql, add_repository() and set_repository_tracked(),
// called as the signed-in person: each answers the public.repositories row it saved, or refuses. In
// the demo, the same rules kept in memory, so the page can be tried with no database. PRD 748 s4 adds
// a third, repository_set_product() of supabase/migrations/20261019090000_business_store.sql, any
// member's: it points a repository at a product of the business, whose claims its agents then read.
// PRD 1246 s4 adds a fourth, set_repository_public_ideas() of
// supabase/migrations/20261114090000_ideas.sql, any member's too: it turns the repository's ideas board
// public or private. At most one workspace makes a given repository's board public.

export type Saved = { ok: true; repository: RepositoryRow } | { ok: false; message: string };

export interface RepositoriesPort {
  /** Adds `owner/name`, tracked. Adding one already listed answers it as it is. */
  add(fullName: string): Promise<Saved>;
  setTracked(fullName: string, tracked: boolean): Promise<Saved>;
  /** Points the repository at a product of the business (PRD 748 s4): any member's to do. */
  setProduct(fullName: string, product: string): Promise<Saved>;
  /** Turns its ideas board public or private (PRD 1246 s4): any member's to do. */
  setPublicIdeas(fullName: string, on: boolean): Promise<Saved>;
}

export const NOT_OWNER = 'Only the workspace’s owner can change its repositories.';
export const NOT_MEMBER = 'Only a member of the workspace can change what a repository serves.';
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
  // repository_set_product() is a member's, not only the owner's: its 42501 says so.
  const memberRefusal = (error: unknown) => (propertyOf(error, 'code') === '42501' ? NOT_MEMBER : refusalOf(error));
  // set_repository_public_ideas() is a member's too; 23505: another workspace's board for it is public.
  const boardRefusal = (error: unknown) => {
    const code = propertyOf(error, 'code');
    return code === '42501' ? NOT_A_BOARD_MEMBER : code === '23505' ? PUBLIC_ELSEWHERE : refusalOf(error);
  };
  return {
    add: (fullName) => call('add_repository', { p_full_name: fullName }),
    setTracked: (fullName, tracked) => call('set_repository_tracked', { p_full_name: fullName, p_tracked: tracked }),
    setProduct: (fullName, product) => call('repository_set_product', { p_full_name: fullName, p_product: product }, memberRefusal),
    setPublicIdeas: (fullName, on) => call('set_repository_public_ideas', { p_full_name: fullName, p_public: on }, boardRefusal),
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
      const repository: RepositoryRow = { fullName: fullName.trim().toLowerCase(), tracked: true, collectedAt: null, collectError: null, product: null, publicIdeas: false };
      rows = [...rows, repository];
      return Promise.resolve({ ok: true, repository });
    },
    setTracked: (fullName, tracked) => change(fullName, { tracked }),
    setProduct: (fullName, product) => change(fullName, { product }),
    setPublicIdeas: (fullName, publicIdeas) => change(fullName, { publicIdeas }),
  };
}
