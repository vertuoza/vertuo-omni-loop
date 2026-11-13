// The MCP search log's migration (PRD omni-loop-6 s1), read as text, as main-watch.migration.test.ts reads
// its own: the row holds the key's id and never the key, the retention runs every night, the rollback is named,
// and the database's types carry the table. The rows themselves are proven by supabase/checks/mcp_search_log.sql,
// which the supabase workflow runs as its own step.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');
const NAME = '20270119090000_mcp_search_log.sql';
const MIGRATION = read(`supabase/migrations/${NAME}`);
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const FLAT_TYPES = read('supabase/database.types.ts').replace(/\s+/g, ' ');
const WORKFLOW = read('.github/workflows/supabase.yml');

describe('the MCP search log\'s migration', () => {
  it('is dated after the knowledge vectors\' migration, so supabase db push applies it', () => {
    const versions = readdirSync(root('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
    expect(versions.indexOf(NAME)).toBeGreaterThan(versions.indexOf('20270118090000_knowledge_vectors.sql'));
  });

  it('holds the key\'s id, never a key or a hash (L-GDPR-2)', () => {
    expect(CODE).toContain('api_key_id uuid references public.agent_tokens (id) on delete set null');
    expect(CODE).not.toMatch(/token_hash|key_hash|\bsecret\b/);
  });

  it('files each row under its product\'s workspace, and leaves the opened id and rank empty, together', () => {
    expect(CODE).toContain('foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade');
    expect(CODE).toContain('check ((opened_id is null) = (opened_rank is null))');
  });

  it('deletes the rows older than 90 days every night (L-GDPR-4)', () => {
    expect(CODE).toContain("delete from public.mcp_search_log l where l.asked_at < now() - interval '90 days'");
    expect(CODE).toContain("select cron.schedule('mcp-search-log-forget', '51 3 * * *', 'select public.mcp_search_log_forget()')");
  });

  it('lets members read through a policy, and only the service role write', () => {
    expect(CODE).toContain('using (workspace_id in (select public.my_workspaces()))');
    expect(CODE).toContain('grant select on public.mcp_search_log to authenticated;');
    expect(CODE).toContain('grant select, insert on public.mcp_search_log to service_role;');
    expect(CODE).toContain('grant update (opened_id, opened_rank) on public.mcp_search_log to service_role;');
  });

  it('names its rollback in its header', () => {
    expect(MIGRATION).toMatch(/^-- Rollback: .*cron\.unschedule\('mcp-search-log-forget'\).*public\.mcp_search_log\./ms);
  });

  it('is in the database\'s types, and its check runs in the supabase workflow', () => {
    expect(FLAT_TYPES).toMatch(/mcp_search_log: \{ Row: \{ api_key_id: string \| null/);
    expect(FLAT_TYPES).toContain('mcp_search_log_forget: { Args: never; Returns: number }');
    expect(WORKFLOW).toContain('-f supabase/checks/mcp_search_log.sql');
  });
});
