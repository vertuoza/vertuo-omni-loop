// The loops' migration (PRD 1139), read as text: the three tables and their columns, their one writer,
// their reading rules and their grants. What the rules let through is the database's to prove
// (supabase/checks/loops.sql, run by the supabase workflow); this pins that each is there, that the
// store names the columns and the function the migration writes, and that the workflow runs the check.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOOP_COLUMNS, PLAN_COLUMNS, TICK_COLUMNS } from './store';
import { SILENT_AFTER_MS, FIRST_TICK_MS } from './state';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261108090000_loops.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TABLES = { loops: LOOP_COLUMNS, loop_ticks: TICK_COLUMNS, loop_plans: PLAN_COLUMNS };

/** The column list of `create table public.<table> (…);`. */
function columnsOf(table: string): string {
  const match = new RegExp(`create table public\\.${table} \\((.*?)\\);`).exec(CODE);
  if (!match?.[1]) throw new Error(`no table ${table}`);
  return match[1];
}

describe('the loops migration', () => {
  it.each(Object.entries(TABLES))('creates %s with every column the store reads', (table, columns) => {
    const created = columnsOf(table);
    for (const column of columns.split(', ')) {
      expect(created).toMatch(new RegExp(`(^ ?|, )${column} (uuid|text|integer|integer\\[\\]|text\\[\\]|jsonb|timestamptz|bigint)\\b`));
    }
  });

  it('keeps no path, prompt or transcript', () => {
    for (const table of Object.keys(TABLES)) expect(columnsOf(table)).not.toMatch(/\b(path|prompt|transcript|command|content)\b/);
  });

  it('writes only through loop_push(), a security definer only a signed-in account runs', () => {
    expect(CODE).toContain('create function public.loop_push(p_event text, p_loop uuid default null, p_body jsonb default \'{}\'::jsonb) returns jsonb language plpgsql security definer set search_path = \'\'');
    expect(CODE).toContain('caller uuid := (select auth.uid());');
    expect(CODE).toContain('select * into pick from public.repo_workspace(caller, v_repo);');
    expect(CODE).toContain("if v_loop.user_id <> caller then raise exception 'This loop is another account''s.' using errcode = '42501';");
    expect(CODE).toContain('revoke execute on function public.loop_push(text, uuid, jsonb) from public, anon;');
    expect(CODE).toContain('grant execute on function public.loop_push(text, uuid, jsonb) to authenticated;');
  });

  it('refuses a second running loop of the caller on the repository, naming it, unless a silent one is taken over', () => {
    expect(CODE).toContain("where l.user_id = caller and l.repo = v_repo and l.state = 'running'");
    expect(CODE).toContain("raise exception 'A loop already runs on %: %. Stop it first.', v_repo, v_running.id using errcode = '55000';");
    expect(CODE).toContain("if coalesce((body ->> 'takeOver')::boolean, false) is not true then");
  });

  it('reads a loop silent by the rule the page reads: 5 minutes past its next wake, an hour after its last push before any', () => {
    expect(SILENT_AFTER_MS).toBe(5 * 60 * 1000);
    expect(FIRST_TICK_MS).toBe(60 * 60 * 1000);
    expect(CODE).toContain("when l.next_wake_at is not null then at >= l.next_wake_at + interval '5 minutes' else at >= l.seen_at + interval '60 minutes'");
  });

  it('lets a member of the workspace read the three tables, and nobody signed in write them', () => {
    for (const table of Object.keys(TABLES)) expect(CODE).toContain(`alter table public.${table} enable row level security;`);
    expect(CODE).toContain('on public.loops for select to authenticated using (public.is_member(workspace_id));');
    expect(CODE).toContain('on public.loop_ticks for select to authenticated using (exists (select 1 from public.loops l where l.id = loop_id and public.is_member(l.workspace_id)));');
    expect(CODE).toContain('on public.loop_plans for select to authenticated using (exists (select 1 from public.loops l where l.id = loop_id and public.is_member(l.workspace_id)));');
    expect(CODE).toContain('revoke all on public.loops, public.loop_ticks, public.loop_plans from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.loops, public.loop_ticks, public.loop_plans to authenticated;');
    expect(CODE).not.toMatch(/grant (insert|update|delete|all)[^;]* on public\.loop/);
  });

  it('is proved by supabase/checks/loops.sql, which the supabase workflow runs', () => {
    expect(read('supabase/checks/loops.sql')).toContain("select 'loops checks passed' as result;");
    expect(read('.github/workflows/supabase.yml')).toContain('-v ON_ERROR_STOP=1 -f supabase/checks/loops.sql');
  });
});
