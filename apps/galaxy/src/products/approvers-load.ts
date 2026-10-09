import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { IsOwner, RosterRow } from '../business/constituents-rows';
import { parseRow, parseRows, type Parsed } from '../data/parse-rows';
import { APPROVER_COLUMNS, approversOf, StoredApprover, type Approvers, type Member } from './approvers';

// A product's Approvers list, read for its page (PRD 1322 s1) as the signed-in person, so row-level
// security decides what it returns: whether they own the workspace (is_owner(): only then are the
// controls drawn), its members (workspace_roster()), and the product's rows of product_approvers. A role
// that cannot be read reads as a member's; members or rows that cannot be read leave the section saying
// so, never the page.

type Answer = { data: unknown; error: { message: string } | null };

/** The client, seen through the calls this read makes. */
export interface ApproversDb {
  rpc(fn: 'is_owner' | 'workspace_roster', args: { workspace: string }): PromiseLike<Answer>;
  from(table: 'product_approvers'): { select(columns: typeof APPROVER_COLUMNS): { eq(column: 'product_id', value: string): PromiseLike<Answer> } };
}

/** The signed-in person's client, seen through {@link ApproversDb}. */
export const approversDbOf = (db: SupabaseClient<Database>): ApproversDb => ({
  rpc: (fn, args) => db.rpc(fn, args),
  from: (table) => ({ select: (columns) => ({ eq: (column, value) => db.from(table).select(columns).eq(column, value) }) }),
});

type Read = () => PromiseLike<Answer>;

/** A read's parsed answer, or null (logged) on an error, a throw or an answer out of shape. */
async function settled<T>(where: string, read: Read, parse: (data: unknown, where: string) => Parsed<T>): Promise<T | null> {
  try {
    const { data, error } = await read();
    if (error) throw new Error(error.message);
    const parsed = parse(data, where);
    return parsed.ok ? parsed.value : null;
  } catch (err) {
    console.error(`products: could not read ${where} (${err instanceof Error ? err.message : String(err)})`);
    return null;
  }
}

const rows = <T>(schema: z.ZodType<T>) => (data: unknown, where: string) => parseRows(schema, data, where);

export async function loadApprovers(db: ApproversDb, workspace: string, product: string): Promise<Approvers | null> {
  const [owner, roster, stored] = await Promise.all([
    settled('products/approvers-load: is_owner', () => db.rpc('is_owner', { workspace }), (data, where) => parseRow(IsOwner, data, where)),
    settled('products/approvers-load: workspace_roster', () => db.rpc('workspace_roster', { workspace }), rows(RosterRow)),
    settled('products/approvers-load: product_approvers', () => db.from('product_approvers').select(APPROVER_COLUMNS).eq('product_id', product), rows(StoredApprover)),
  ]);
  if (!roster || !stored) return null;
  const members: Member[] = roster.map((r) => ({ id: r.user_id, name: r.name, login: r.github_login }));
  return { owner: owner ?? false, members, listed: approversOf(members, stored) };
}
