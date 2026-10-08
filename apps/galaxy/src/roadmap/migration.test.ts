// The roadmaps' migration (PRD 1162), read as text: the two tables and their columns, their one writer,
// their reading rules and their grants, the product key that keeps a roadmap in its own workspace, and
// the repositories a loop's tick gains. What the rules let through is the database's to prove
// (supabase/checks/roadmaps.sql, run by the supabase workflow); this pins that each is there, that the
// stores name the columns and the functions the migration writes, and that the workflow runs the check.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PREREQUISITE_CATEGORIES, PREREQUISITE_STATES, PREREQUISITE_WHO, ROADMAP_ADDED_COLUMNS, ROADMAP_COLUMNS, ROADMAP_PRD_COLUMNS, ROADMAP_PRD_STATES,
  ROADMAP_PREREQUISITE_COLUMNS, ROADMAP_READ_COLUMNS,
} from './store';
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

// PRD 1218, slice s5: the prerequisites' migration, read the same way. It only adds: a table, two
// nullable columns and a function of its own, so roadmap_push() stays as the migrations before it wrote it.
const PREREQUISITES = read('supabase/migrations/20261114090000_roadmap_prerequisites.sql');
const PREREQUISITES_CODE = PREREQUISITES.replace(/--.*$/gm, '').replace(/\s+/g, ' ');

/** The column list of `create table public.<table> (…);` in the prerequisites' migration. */
function prerequisiteColumnsOf(table: string): string {
  const match = new RegExp(`create table public\\.${table} \\((.*?)\\);`).exec(PREREQUISITES_CODE);
  if (!match?.[1]) throw new Error(`no table ${table}`);
  return match[1];
}

const quoted = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

describe('the roadmap prerequisites migration', () => {
  it('creates roadmap_prerequisites with every column the store reads', () => {
    const created = prerequisiteColumnsOf('roadmap_prerequisites');
    for (const column of ROADMAP_PREREQUISITE_COLUMNS.split(', ')) {
      expect(created).toMatch(new RegExp(`(^ ?|, )${column} (uuid|text|integer|boolean|text\\[\\]|jsonb)\\b`));
    }
  });

  it('stores exactly the categories, the who and the states the API takes', () => {
    const created = prerequisiteColumnsOf('roadmap_prerequisites');
    expect(created).toContain(`category text not null check (category in (${quoted(PREREQUISITE_CATEGORIES)}))`);
    expect(created).toContain(`who text not null check (who in (${quoted(PREREQUISITE_WHO)}))`);
    expect(created).toContain(`state text check (state is null or state in (${quoted(PREREQUISITE_STATES)}))`);
  });

  it('adds the last result\'s machine and time to a roadmap, nullable, which the store reads', () => {
    expect(ROADMAP_READ_COLUMNS).toBe(`${ROADMAP_COLUMNS}, ${ROADMAP_ADDED_COLUMNS}`);
    expect(PREREQUISITES_CODE).toContain('alter table public.roadmaps add column prerequisites_machine text check');
    expect(PREREQUISITES_CODE).toContain('add column prerequisites_checked_at timestamptz,');
    expect(PREREQUISITES_CODE).toContain('check ((prerequisites_machine is null) = (prerequisites_checked_at is null))');
  });

  it('is additive: no drop, no rename, and roadmap_push() is not redefined', () => {
    expect(PREREQUISITES_CODE).not.toMatch(/\b(drop|rename)\b/i);
    expect(PREREQUISITES_CODE).not.toMatch(/function public\.roadmap_push\(/);
  });

  it('writes only through roadmap_prerequisites_push(), a security definer only a signed-in account runs', () => {
    expect(PREREQUISITES_CODE).toContain('create function public.roadmap_prerequisites_push(p_body jsonb) returns jsonb language plpgsql security definer set search_path = \'\'');
    expect(PREREQUISITES_CODE).toContain('select * into pick from public.repo_workspace(caller, v_repo);');
    expect(PREREQUISITES_CODE).toContain('delete from public.roadmap_prerequisites where roadmap_id = v_roadmap.id;');
    expect(PREREQUISITES_CODE).toContain('revoke execute on function public.roadmap_prerequisites_push(jsonb) from public, anon;');
    expect(PREREQUISITES_CODE).toContain('grant execute on function public.roadmap_prerequisites_push(jsonb) to authenticated;');
  });

  it('lets a member of the workspace read the prerequisites, and nobody signed in write them', () => {
    expect(PREREQUISITES_CODE).toContain('alter table public.roadmap_prerequisites enable row level security;');
    expect(PREREQUISITES_CODE).toContain('on public.roadmap_prerequisites for select to authenticated using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and public.is_member(r.workspace_id)));');
    expect(PREREQUISITES_CODE).toContain('revoke all on public.roadmap_prerequisites from public, anon, authenticated, service_role;');
    expect(PREREQUISITES_CODE).toContain('grant select on public.roadmap_prerequisites to authenticated;');
    expect(PREREQUISITES_CODE).not.toMatch(/grant (insert|update|delete|all)[^;]* on public\.roadmap/);
  });

  it('is proved by supabase/checks/roadmaps.sql', () => {
    const checks = read('supabase/checks/roadmaps.sql');
    expect(checks).toContain('public.roadmap_prerequisites_push(');
    expect(checks).toContain("select 'roadmaps checks passed' as result;");
  });
});
