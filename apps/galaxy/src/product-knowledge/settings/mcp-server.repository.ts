import type { SupabaseClient } from '@supabase/supabase-js';

// The MCP server card's storage (PRD 2707 s4; ADR-0095), on the client it is given, the signed-in person's, so
// row-level security decides what each read returns. The switch is product_mcp_set(): only a workspace owner
// may call it (42501 anyone else), and an archived product refuses it. No rule lives here.

/** The columns of the product the card draws. */
export interface McpProductRow {
  key: string | null;
  mcp_enabled: boolean;
  archived_at: string | null;
}

/** The product's key, switch and archive mark; null when it cannot be read or is none of the caller's. */
export async function mcpProductOf(db: Pick<SupabaseClient, 'from'>, product: string): Promise<McpProductRow | null> {
  const { data, error } = await db.from('products').select('key, mcp_enabled, archived_at').eq('id', product).maybeSingle();
  return error ? null : data;
}

/** The caller's role in the workspace; null when it cannot be read. */
export async function roleIn(db: Pick<SupabaseClient, 'from'>, workspace: string, user: string): Promise<unknown> {
  const { data, error } = await db.from('workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', user).maybeSingle();
  const row: { role?: unknown } | null = data;
  return error ? null : row?.role;
}

/** Turns the product's server on or off as the caller; whether the database accepted it. */
export async function setMcp(db: Pick<SupabaseClient, 'rpc'>, product: string, on: boolean): Promise<boolean> {
  const { error } = await db.rpc('product_mcp_set', { p_product: product, p_on: on });
  return !error;
}
