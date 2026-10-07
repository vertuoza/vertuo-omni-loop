// The roadmaps' migration (PRD 1162), read as text: the two tables and their columns, their one writer,
// their reading rules and their grants, the product key that keeps a roadmap in its own workspace, and
// the repositories a loop's tick gains. What the rules let through is the database's to prove
// (supabase/checks/roadmaps.sql, run by the supabase workflow); this pins that each is there, that the
// stores name the columns and the functions the migration writes, and that the workflow runs the check.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROADMAP_COLUMNS, ROADMAP_PRD_COLUMNS, ROADMAP_PRD_STATES } from './store';
import { TICK_ADDED_COLUMNS, TICK_READ_COLUMNS } from '../loop/store';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261110090000_roadmaps.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TABLES = { roadmaps: ROADMAP_COLUMNS, roadmap_prds: ROADMAP_PRD_COLUMNS };

/** The column list of `create table public.<table> (…);`. */
function columnsOf(table: string): string {
  const match = new RegExp(`create table public\\.${table} \\((.*?)\\);`).exec(CODE);
  if (!match?.[1]) throw new Error(`no table ${table}`);
  return match[1];
}

describe('the roadmaps migration', () => {
  it.each(Object.entries(TABLES))('creates %s with every column the store reads', (table, columns) => {
    const created = columnsOf(table);
    for (const column of columns.split(', ')) {
      expect(created).toMatch(new RegExp(`(^ ?|, )${column} (uuid|text|integer|text\\[\\]|jsonb|timestamptz|date)\\b`));
    }
  });

  it('keeps no path, prompt or transcript', () => {
    for (const table of Object.keys(TABLES)) expect(columnsOf(table)).not.toMatch(/\b(path|prompt|transcript|command|content)\b/);
  });

  it('stores exactly the states the API takes', () => {
    expect(columnsOf('roadmap_prds')).toContain(`state text not null check (state in (${ROADMAP_PRD_STATES.map((s) => `'${s}'`).join(', ')}))`);
  });

  it('keys a roadmap by its workspace, repository and number, and its product among its workspace\'s own', () => {
    expect(CODE).toContain('create unique index products_id_workspace_key on public.products (id, workspace_id);');
    expect(columnsOf('roadmaps')).toContain('constraint roadmaps_number_key unique (workspace_id, repo, number)');
    expect(columnsOf('roadmaps')).toContain('foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete set null (product_id)');
    expect(CODE).toContain('where p.workspace_id = pick.workspace_id and lower(p.name) = lower(v_named)');
  });

  it('writes only through roadmap_push(), a security definer only a signed-in account runs', () => {
    expect(CODE).toContain('create function public.roadmap_push(p_body jsonb) returns jsonb language plpgsql security definer set search_path = \'\'');
    expect(CODE).toContain('caller uuid := (select auth.uid());');
    expect(CODE).toContain('select * into pick from public.repo_workspace(caller, v_repo);');
    expect(CODE).toContain('delete from public.roadmap_prds where roadmap_id = v_roadmap.id;');
    expect(CODE).toContain("'unknownProduct', case when v_named is not null and v_product.id is null then v_named end");
    expect(CODE).toContain('revoke execute on function public.roadmap_push(jsonb) from public, anon;');
    expect(CODE).toContain('grant execute on function public.roadmap_push(jsonb) to authenticated;');
  });

  it('lets a member of the workspace read both tables, and nobody signed in write them', () => {
    for (const table of Object.keys(TABLES)) expect(CODE).toContain(`alter table public.${table} enable row level security;`);
    expect(CODE).toContain('on public.roadmaps for select to authenticated using (public.is_member(workspace_id));');
    expect(CODE).toContain('on public.roadmap_prds for select to authenticated using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and public.is_member(r.workspace_id)));');
    expect(CODE).toContain('revoke all on public.roadmaps, public.roadmap_prds from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.roadmaps, public.roadmap_prds to authenticated;');
    expect(CODE).not.toMatch(/grant (insert|update|delete|all)[^;]* on public\.roadmap/);
  });

  it('adds the repositories of a loop\'s tick, which loop_push() stores and the loop store reads', () => {
    expect(TICK_READ_COLUMNS.endsWith(`, ${TICK_ADDED_COLUMNS}`)).toBe(true);
    expect(CODE).toContain(`alter table public.loop_ticks add column ${TICK_ADDED_COLUMNS} text[] not null default '{}'`);
    expect(CODE).toContain('create or replace function public.loop_push(p_event text, p_loop uuid default null, p_body jsonb default \'{}\'::jsonb) returns jsonb language plpgsql security definer set search_path = \'\'');
    expect(CODE).toContain('insert into public.loop_ticks (loop_id, step, steps, prd, action, result, link, merged, items, repos, next_wake_at)');
    expect(CODE).toContain("coalesce(array(select lower(jsonb_array_elements_text(coalesce(body -> 'repos', '[]'::jsonb)))), '{}')");
  });

  it('is proved by supabase/checks/roadmaps.sql, which the supabase workflow runs', () => {
    expect(read('supabase/checks/roadmaps.sql')).toContain("select 'roadmaps checks passed' as result;");
    expect(read('.github/workflows/supabase.yml')).toContain('-v ON_ERROR_STOP=1 -f supabase/checks/roadmaps.sql');
  });
});
