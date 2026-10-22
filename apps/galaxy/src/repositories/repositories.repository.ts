import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { StoredRepository } from './model';

// Settings → Repositories's reads from the database (PRD 612 s1; ADR-0095), as the signed-in person, so
// row-level security decides what they return: the workspace's repositories, whether the person owns it
// (is_owner()), its GitHub org and installation, and (PRD 1364 s11) its products and their links to
// repositories (product_repositories), so each row names the products that link it. A failed read
// throws. No rule lives here: which product a chip names is load.ts's. PRD 2188 s1 reads when each
// repository was removed and each product's plan repository, for the confirm before a remove.

type Db = SupabaseClient<Database>;

/** A product's link to a repository, as the chips read it. */
export interface StoredProductLink {
  product_id: string;
  repository: string;
}

/** A product of the workspace, with the plan repository it plans in, if any. */
export interface StoredProduct {
  id: string;
  name: string;
  plan_repository: string | null;
}

export type GithubOf = { github_org: string | null; github_installation_id: number | string | null };

export function repositoriesRepository(db: Db) {
  return {
    /** Whether the person owns the workspace: only a true is an owner. */
    async owner(workspace: string): Promise<boolean> {
      // `data` is widened to unknown: is_owner's answer is read here unparsed, so only a true is an owner.
      const { data, error }: { data: unknown; error: Error | null } = await db.rpc('is_owner', { workspace });
      if (error) throw error;
      return data === true;
    },

    /** The workspace's repositories. */
    async rows(workspace: string): Promise<StoredRepository[]> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: StoredRepository[] | null; error: Error | null } = await db
        .from('repositories')
        .select('full_name, tracked, collected_at, collect_error, public_ideas, phase0, fix_when_answered, removed_at')
        .eq('workspace_id', workspace);
      if (error) throw new Error(`Supabase: could not read the repositories (${error.message})`);
      return data ?? [];
    },

    /** The workspace that lists the repository (not removed) among the signed-in person's, or null (PRD 2313 s3). */
    async workspaceOf(fullName: string): Promise<string | null> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: { workspace_id: string }[] | null; error: Error | null } =
        await db.from('repositories').select('workspace_id').eq('full_name', fullName).is('removed_at', null).limit(1);
      if (error) throw new Error(`Supabase: could not read the repository (${error.message})`);
      return data?.[0]?.workspace_id ?? null;
    },

    /** The skills of the repository the workspace's owner allowed on its runners (PRD 2313 s3). */
    async allowedSkills(workspace: string, fullName: string): Promise<{ skill: string; allowed_by: string | null; allowed_at: string }[]> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: { skill: string; allowed_by: string | null; allowed_at: string }[] | null; error: Error | null } =
        await db.from('repository_runner_skills').select('skill, allowed_by, allowed_at').eq('workspace_id', workspace).eq('full_name', fullName);
      if (error) throw new Error(`Supabase: could not read the allowed skills (${error.message})`);
      return data ?? [];
    },

    /** The GitHub logins of those users in the workspace; a person without one is left out (PRD 2313 s3). */
    async logins(workspace: string, users: string[]): Promise<Map<string, string>> {
      if (users.length === 0) return new Map();
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: { user_id: string; github_login: string | null }[] | null; error: Error | null } =
        await db.from('players').select('user_id, github_login').eq('workspace_id', workspace).in('user_id', users);
      if (error) throw new Error(`Supabase: could not read the players (${error.message})`);
      return new Map((data ?? []).flatMap((p) => (p.github_login ? [[p.user_id, p.github_login] as const] : [])));
    },

    /** The workspace's GitHub org and the installation it stored. */
    async github(workspace: string): Promise<GithubOf> {
      // `data` is widened to null: the row is read here unparsed.
      const { data, error }: { data: GithubOf | null; error: Error | null } =
        await db.from('workspaces').select('github_org, github_installation_id').eq('id', workspace).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the workspace's GitHub installation (${error.message})`);
      return data ?? { github_org: null, github_installation_id: null };
    },

    /** The workspace's products, first first, each with its plan repository. */
    async products(workspace: string): Promise<StoredProduct[]> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: StoredProduct[] | null; error: Error | null } =
        await db.from('products').select('id, name, plan_repository').eq('workspace_id', workspace).order('ordinal');
      if (error) throw error;
      return (data ?? []).map(({ id, name, plan_repository }) => ({ id, name, plan_repository: plan_repository ?? null }));
    },

    /** Every link of the workspace's products to a repository. */
    async links(workspace: string): Promise<StoredProductLink[]> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: StoredProductLink[] | null; error: Error | null } =
        await db.from('product_repositories').select('product_id, repository').eq('workspace_id', workspace);
      if (error) throw error;
      return data ?? [];
    },
  };
}
