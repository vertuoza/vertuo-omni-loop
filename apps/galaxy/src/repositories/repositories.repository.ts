import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { RepositoryProduct, StoredRepository } from './model';

// Settings → Repositories's reads from the database (PRD 612 s1; ADR-0095), as the signed-in person, so
// row-level security decides what they return: the workspace's repositories, whether the person owns it
// (is_owner()), its GitHub org and installation, and (PRD 1364 s11) its products and their links to
// repositories (product_repositories), so each row names the products that link it. A failed read
// throws. No rule lives here: which product a chip names is load.ts's.

type Db = SupabaseClient<Database>;

/** A product's link to a repository, as the chips read it. */
export interface StoredProductLink {
  product_id: string;
  repository: string;
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
        .select('full_name, tracked, collected_at, collect_error, public_ideas, phase0')
        .eq('workspace_id', workspace);
      if (error) throw new Error(`Supabase: could not read the repositories (${error.message})`);
      return data ?? [];
    },

    /** The workspace's GitHub org and the installation it stored. */
    async github(workspace: string): Promise<GithubOf> {
      // `data` is widened to null: the row is read here unparsed.
      const { data, error }: { data: GithubOf | null; error: Error | null } =
        await db.from('workspaces').select('github_org, github_installation_id').eq('id', workspace).maybeSingle();
      if (error) throw new Error(`Supabase: could not read the workspace's GitHub installation (${error.message})`);
      return data ?? { github_org: null, github_installation_id: null };
    },

    /** The workspace's products, first first. */
    async products(workspace: string): Promise<RepositoryProduct[]> {
      // `data` is widened to null: the rows are read here unparsed.
      const { data, error }: { data: RepositoryProduct[] | null; error: Error | null } =
        await db.from('products').select('id, name').eq('workspace_id', workspace).order('ordinal');
      if (error) throw error;
      return (data ?? []).map(({ id, name }) => ({ id, name }));
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
