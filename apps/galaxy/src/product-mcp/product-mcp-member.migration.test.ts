// The migration that lets a member's kit sign-in read a product's MCP server (PRD 3007 s1), read as text, as
// mcp-search-log.migration.test.ts reads its own: the log row names a person or a key, never both, and never a
// token; a deleted account's id is set to null; the function is the service role's alone; the rollback is named;
// and the database's types carry it. What it answers is proven by supabase/checks/product_mcp.sql, which the
// supabase workflow runs as its own step.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');
const NAME = '20270126090000_product_mcp_member.sql';
const MIGRATION = read(`supabase/migrations/${NAME}`);
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const FLAT_TYPES = read('supabase/database.types.ts').replace(/\s+/g, ' ');
const WORKFLOW = read('.github/workflows/supabase.yml');

describe('the migration of a member\'s sign-in to a product\'s MCP server', () => {
  it('is dated after the MCP search log\'s migration, so supabase db push applies it', () => {
    const versions = readdirSync(root('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
    expect(versions.indexOf(NAME)).toBeGreaterThan(versions.indexOf('20270119090000_mcp_search_log.sql'));
  });

  it('logs the person\'s id, set to null when the account is deleted (L-GDPR-3), and never a token (L-GDPR-2)', () => {
    expect(CODE).toContain('add column user_id uuid references auth.users (id) on delete set null');
    expect(CODE).not.toMatch(/token_hash|access_token|add column \w*token/);
  });

  it('names a person or a key in a row, never both', () => {
    expect(CODE).toContain('check (api_key_id is null or user_id is null)');
  });

  it('answers only for a member of the product\'s workspace now, while the product is on and not archived', () => {
    expect(CODE).toContain('x.archived_at is null and x.mcp_enabled');
    expect(CODE).toContain('exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = p_user)');
  });

  it('is the service role\'s alone', () => {
    expect(CODE).toContain('revoke execute on function public.product_mcp_for_member(uuid, text) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.product_mcp_for_member(uuid, text) to service_role;');
    expect(CODE).toContain('security definer set search_path = \'\'');
  });

  it('names its rollback in its header', () => {
    expect(MIGRATION).toMatch(/^-- Rollback: .*product_mcp_for_member\(\).*public\.mcp_search_log\.user_id\./ms);
  });

  it('is in the database\'s types, and its check runs in the supabase workflow', () => {
    expect(FLAT_TYPES).toMatch(/mcp_search_log: \{ Row: \{[^}]* user_id: string \| null/);
    expect(FLAT_TYPES).toContain('product_mcp_for_member: { Args: { p_key: string; p_user: string } Returns: Json }');
    expect(WORKFLOW).toContain('-f supabase/checks/product_mcp.sql');
  });
});
