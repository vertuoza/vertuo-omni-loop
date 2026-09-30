// The heartbeats' migration (PRD 757), read as text: the table's columns, its one writer, its reading
// rule and its grants. What the rules let through is the database's to prove
// (supabase/checks/working_pings.sql); this pins that each is there, and that the store names the
// columns and the function the migration writes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PING_COLUMNS } from './store';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261020090000_working_pings.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

describe('the working-pings migration', () => {
  it('holds one row per Claude session, with every column the store reads', () => {
    expect(oneLine).toContain('create table public.working_pings ( claude_session_id text primary key');
    for (const column of PING_COLUMNS.split(', ')) expect(oneLine).toMatch(new RegExp(`\\b${column}\\s+(text|uuid|integer|timestamptz)\\b`));
  });

  it('keeps no tool, path or text: only the session, the repository, the work and the time', () => {
    const columns = [...oneLine.matchAll(/^.*?create table public\.working_pings \((.*?)\);/g)][0][1];
    expect(columns).not.toMatch(/\b(tool|path|command|transcript|content)\b/);
  });

  it('writes only through working_ping(), which refuses another account\'s session', () => {
    expect(oneLine).toContain('create function public.working_ping(');
    expect(oneLine).toContain('security definer');
    expect(oneLine).toContain("if v_owner is not null and v_owner <> caller then raise exception 'This Claude session is another account''s.' using errcode = '42501';");
    expect(oneLine).toContain('select * into pick from public.repo_workspace(caller, v_repo);');
    expect(oneLine).toContain('revoke execute on function public.working_ping(text, text, text, integer, uuid, boolean) from public, anon;');
    expect(oneLine).toContain('grant execute on function public.working_ping(text, text, text, integer, uuid, boolean) to authenticated;');
  });

  it('resolves the dossier from the draft, or from the repository, the kind and the number', () => {
    expect(oneLine).toContain('where d.id = p_draft and d.workspace_id = pick.workspace_id');
    expect(oneLine).toContain('where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = p_work_kind and d.prd = p_work_number');
  });

  it('lets a member of the workspace read, and nobody signed in write', () => {
    expect(oneLine).toContain('alter table public.working_pings enable row level security;');
    expect(oneLine).toContain('for select to authenticated using (public.is_member(workspace_id));');
    expect(oneLine).toContain('revoke all on public.working_pings from public, anon, authenticated, service_role;');
    expect(oneLine).toContain('grant select on public.working_pings to authenticated;');
    expect(oneLine).not.toMatch(/grant (insert|update|delete)[^;]* on public\.working_pings/);
  });
});
