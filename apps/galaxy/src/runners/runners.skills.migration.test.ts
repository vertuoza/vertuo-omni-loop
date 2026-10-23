// The runner skills' migration (PRD 2313, spec "The data"), read as text, as runners.migration.test.ts
// reads the runners' own: the allowance table, its key and limits, its reading rule, the owner's switch
// and its refusals, the read queue() and the claim make, and the database's types that name them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RUNNER_SKILLS } from './runners.contract';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261222090000_repository_runner_skills.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TYPES = read('supabase/database.types.ts');

/** The body of a function the migration creates, from its `create function` to its closing `$$;`. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(CODE);
  if (!match?.[1]) throw new Error(`no function ${name}`);
  return match[1];
}

describe('the repository_runner_skills table', () => {
  const created = /create table public\.repository_runner_skills \((.*?)\);/.exec(CODE)?.[1] ?? '';

  it('holds one row per workspace, repository and skill, with who allowed it and when', () => {
    expect(created).toContain('workspace_id uuid not null');
    expect(created).toContain('full_name text not null');
    expect(created).toContain('allowed_by uuid references auth.users on delete set null');
    expect(created).toContain('allowed_at timestamptz not null default now()');
    expect(created).toContain('primary key (workspace_id, full_name, skill)');
  });

  it('goes with its repository, and its repository with its workspace', () => {
    expect(created).toContain('foreign key (workspace_id, full_name) references public.repositories (workspace_id, full_name) on delete cascade');
  });

  it('takes a skill\'s name only: a lower-case letter, then letters, digits and dashes, 64 characters at most', () => {
    expect(created).toContain("skill text not null check (skill ~ '^[a-z][a-z0-9-]*$' and char_length(skill) <= 64)");
  });

  it('lets a member of the workspace read it, and nobody signed in write it', () => {
    expect(CODE).toContain('alter table public.repository_runner_skills enable row level security;');
    expect(CODE).toContain('on public.repository_runner_skills for select to authenticated using (workspace_id in (select public.my_workspaces()));');
    expect(CODE).not.toMatch(/create policy [^;]* using \([^;]*is_member\(/);
    expect(CODE).toContain('revoke all on public.repository_runner_skills from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.repository_runner_skills to authenticated, service_role;');
    expect(CODE).not.toMatch(/grant [^;]*(insert|update|delete|all)[^;]* on public\.repository_runner_skills/);
    expect(CODE).not.toMatch(/create policy [^;]* on public\.repository_runner_skills for (insert|update|delete|all)/);
  });
});

describe('set_repository_runner_skill()', () => {
  const fn = body('set_repository_runner_skill');

  it('runs as the signed-in person, an owner only, as set_repository_phase0()', () => {
    expect(CODE).toContain('create function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void language plpgsql security definer set search_path = \'\'');
    expect(fn.trim().startsWith('declare')).toBe(true);
    expect(fn).toMatch(/^ declare [^;]*;[^;]*; begin perform public\.repository_owner_only\(p_workspace\);/);
  });

  it('refuses a malformed name, a fixed skill\'s name and no answer with 22023', () => {
    expect(fn).toContain("if p_skill is null or p_skill !~ '^[a-z][a-z0-9-]*$' or char_length(p_skill) > 64 then raise exception 'Skill: a skill''s name, as its folder under .claude/skills/ spells it.' using errcode = '22023', hint = 'skill';");
    expect(fn).toContain("if p_skill = any (fixed) then raise exception 'Skill: /% is the loop''s own skill, which a runner runs as /omni:%.', p_skill, p_skill using errcode = '22023', hint = 'skill';");
    expect(fn).toContain("if p_allowed is null then raise exception 'Allow on runner: on or off.' using errcode = '22023', hint = 'allowed';");
  });

  it('holds the runners\' fixed list, the contract\'s and the kit\'s, so a fixed skill\'s name is never allowed', () => {
    const fixed = /fixed text\[\] := array\[([^\]]*)\]/.exec(fn)?.[1] ?? '';
    // retro-apply (PRD 2338), rewind and knowledge-add (PRD 2410) joined the list after this migration
    // shipped; a later migration adds them to the database's.
    const addedLater: readonly string[] = ['retro-apply', 'rewind', 'knowledge-add'];
    expect(fixed.split(',').map((name) => name.trim().replace(/^'|'$/g, ''))).toEqual(RUNNER_SKILLS.filter((skill) => !addedLater.includes(skill)));
  });

  it('refuses a repository the workspace does not list, or removed, with P0002', () => {
    expect(fn).toContain('if not exists (select 1 from public.repositories r where r.workspace_id = p_workspace and r.full_name = name and r.removed_at is null) then');
    expect(fn).toContain("raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';");
  });

  it('on, records who allowed it and when, keeping the first; off, deletes the row', () => {
    expect(fn).toContain('insert into public.repository_runner_skills (workspace_id, full_name, skill, allowed_by) values (p_workspace, name, p_skill, auth.uid()) on conflict (workspace_id, full_name, skill) do nothing;');
    expect(fn).toContain('delete from public.repository_runner_skills s where s.workspace_id = p_workspace and s.full_name = name and s.skill = p_skill;');
  });

  it('is run by a signed-in person only', () => {
    expect(CODE).toContain('revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;');
    expect(CODE).toContain('grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;');
  });
});

describe('repository_runner_skills_of()', () => {
  it('answers the allowed names of a repository, in order, an empty list when none', () => {
    expect(CODE).toContain('create function public.repository_runner_skills_of(p_workspace uuid, p_full_name text) returns text[] language sql stable set search_path = \'\'');
    expect(body('repository_runner_skills_of')).toContain("select coalesce(array_agg(s.skill order by s.skill), '{}') from public.repository_runner_skills s where s.workspace_id = p_workspace and s.full_name = lower(btrim(coalesce(p_full_name, '')));");
  });

  it('runs as its caller, so a member reads only their own workspace\'s, and the routes\' service role reads any', () => {
    expect(CODE).not.toMatch(/repository_runner_skills_of\([^)]*\) returns text\[\] [^$]*security definer/);
    expect(CODE).toContain('revoke execute on function public.repository_runner_skills_of(uuid, text) from public, anon;');
    expect(CODE).toContain('grant execute on function public.repository_runner_skills_of(uuid, text) to authenticated, service_role;');
  });
});

describe('the database\'s types', () => {
  it('name the table, the switch and the read', () => {
    expect(TYPES).toMatch(/repository_runner_skills: \{\n\s+Row: \{\n\s+allowed_at: string\n\s+allowed_by: string \| null\n\s+full_name: string\n\s+skill: string\n\s+workspace_id: string\n/);
    expect(TYPES).toContain('foreignKeyName: "repository_runner_skills_workspace_id_full_name_fkey"');
    expect(TYPES).toContain('set_repository_runner_skill: {\n        Args: {\n          p_allowed: boolean\n          p_full_name: string\n          p_skill: string\n          p_workspace: string\n        }\n        Returns: undefined\n      }');
    expect(TYPES).toContain('repository_runner_skills_of: {\n        Args: { p_full_name: string; p_workspace: string }\n        Returns: string[]\n      }');
  });
});
