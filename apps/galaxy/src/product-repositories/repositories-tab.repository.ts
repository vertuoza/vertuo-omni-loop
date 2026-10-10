import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IsOwner, RosterRow } from '../business/constituents-rows';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import { APPROVER_COLUMNS, StoredApprover, type ApproverState } from '../products/approvers';
import { StoredLinkFields } from './product-link-row';

// The Repositories & approvers tab's storage (PRD 1364 s11; ADR-0095): the reads and writes behind
// /app/products/<id>/repositories, on the client it is given, the signed-in person's, so row-level
// security, product_repository_link(), product_repository_unlink(), product_approver_set() and
// product_approver_remove() have the last word. The product, its links (product_repositories, with who
// added each), the workspace's repositories, whether the caller owns the workspace (is_owner()), its
// members (workspace_roster()) and the product's approvers (product_approvers, PRD 1322). A failed read
// throws, and an answer out of shape too; a refused write answers the database's code and words. No rule
// lives here: what the tab shows and who may change it is repositories-tab.service.ts's.

/** What the tab's reads and writes need: the tables and the database's functions. */
export type RepositoriesTabDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const PRODUCT_COLUMNS = 'id, workspace_id, name';
const StoredTabProductSchema = z.object({ id: z.string(), workspace_id: z.string(), name: z.string() });
export type StoredTabProduct = z.infer<typeof StoredTabProductSchema>;

const LINK_COLUMNS = 'repository, role, knowledge, read_at, read_only, consumes, added_by';
/** One product link, as the tab reads it. */
const StoredTabLinkSchema = StoredLinkFields.extend({ added_by: z.enum(['prd', 'person']) });
export type StoredTabLink = z.infer<typeof StoredTabLinkSchema>;

/** The fields a link write sets, every one of them. */
type LinkFields = z.infer<typeof StoredLinkFields>;

const StoredRepository = z.object({ full_name: z.string() });
const SetAnswer = z.object({ state: z.enum(['asked', 'skipped']) });

/** A refusal, by the database's code and in its words. */
export type Refused = { ok: false; code: string | null; message: string };
type Written<T> = ({ ok: true } & T) | Refused;

type RpcAnswer = { data: unknown; error: { code?: string; message: string } | null };

const refusedOf = (error: { code?: string; message: string }): Refused => ({ ok: false, code: error.code || null, message: error.message });

export function repositoriesTabRepository(db: RepositoriesTabDb) {
  return {
    /** The product by its id, or null when the caller reads no such product. */
    async product(id: string): Promise<StoredTabProduct | null> {
      const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('id', id);
      if (error) throw new Error(`Supabase: could not read the product (${error.message})`);
      return orThrow(parseRows(StoredTabProductSchema, data, 'product-repositories/repositories-tab.repository: products'))[0] ?? null;
    },

    /** The product's links, by repository. */
    async links(product: string): Promise<StoredTabLink[]> {
      const { data, error } = await db.from('product_repositories').select(LINK_COLUMNS).eq('product_id', product).order('repository');
      if (error) throw new Error(`Supabase: could not read the product's repositories (${error.message})`);
      return orThrow(parseRows(StoredTabLinkSchema, data, 'product-repositories/repositories-tab.repository: product_repositories'));
    },

    /** The workspace's repositories, by `owner/name`. */
    async repositories(workspace: string): Promise<string[]> {
      const { data, error } = await db.from('repositories').select('full_name').eq('workspace_id', workspace);
      if (error) throw new Error(`Supabase: could not read the repositories (${error.message})`);
      return orThrow(parseRows(StoredRepository, data, 'product-repositories/repositories-tab.repository: repositories')).map((r) => r.full_name);
    },

    /** Whether the caller owns the workspace. */
    async owner(workspace: string): Promise<boolean> {
      const answer: RpcAnswer = await db.rpc('is_owner', { workspace });
      if (answer.error) throw new Error(`Supabase: could not read your role (${answer.error.message})`);
      return orThrow(parseRow(IsOwner, answer.data, 'product-repositories/repositories-tab.repository: is_owner'));
    },

    /** The workspace's members. */
    async roster(workspace: string): Promise<z.infer<typeof RosterRow>[]> {
      const answer: RpcAnswer = await db.rpc('workspace_roster', { workspace });
      if (answer.error) throw new Error(`Supabase: could not read the members (${answer.error.message})`);
      return orThrow(parseRows(RosterRow, answer.data, 'product-repositories/repositories-tab.repository: workspace_roster'));
    },

    /** The product's approvers. */
    async approvers(product: string): Promise<StoredApprover[]> {
      const { data, error } = await db.from('product_approvers').select(APPROVER_COLUMNS).eq('product_id', product);
      if (error) throw new Error(`Supabase: could not read the approvers (${error.message})`);
      return orThrow(parseRows(StoredApprover, data, 'product-repositories/repositories-tab.repository: product_approvers'));
    },

    /** Links a repository to the product, or sets every field of its link, through product_repository_link(). */
    async link(product: string, link: LinkFields): Promise<Written<{ link: StoredTabLink }>> {
      const answer: RpcAnswer = await db.rpc('product_repository_link', {
        p_product: product,
        p_repository: link.repository,
        p_role: link.role ?? undefined,
        p_knowledge: link.knowledge,
        p_read_at: link.read_at ?? undefined,
        p_read_only: link.read_only,
        p_consumes: link.consumes,
      });
      if (answer.error) return refusedOf(answer.error);
      return { ok: true, link: orThrow(parseRow(StoredTabLinkSchema, answer.data, 'product-repositories/repositories-tab.repository: product_repository_link')) };
    },

    /** Takes a repository out of the product, through product_repository_unlink(): whether it was in it. */
    async unlink(product: string, repository: string): Promise<Written<{ removed: boolean }>> {
      const answer: RpcAnswer = await db.rpc('product_repository_unlink', { p_product: product, p_repository: repository });
      if (answer.error) return refusedOf(answer.error);
      return { ok: true, removed: answer.data === true };
    },

    /** Lists a member as asked or skipped, or changes their state, through product_approver_set(). */
    async setApprover(product: string, member: string, state: ApproverState): Promise<Written<{ state: ApproverState }>> {
      const answer: RpcAnswer = await db.rpc('product_approver_set', { p_product: product, p_member: member, p_state: state });
      if (answer.error) return refusedOf(answer.error);
      return { ok: true, state: orThrow(parseRow(SetAnswer, answer.data, 'product-repositories/repositories-tab.repository: product_approver_set')).state };
    },

    /** Takes a member off the list, through product_approver_remove(): whether they were on it. */
    async removeApprover(product: string, member: string): Promise<Written<{ removed: boolean }>> {
      const answer: RpcAnswer = await db.rpc('product_approver_remove', { p_product: product, p_member: member });
      if (answer.error) return refusedOf(answer.error);
      return { ok: true, removed: answer.data === true };
    },
  };
}

export type RepositoriesTabRepository = ReturnType<typeof repositoriesTabRepository>;
