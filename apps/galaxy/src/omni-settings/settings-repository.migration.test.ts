// The settings repository's migration (PRD 2543, spec › Solution 1), read as text, as
// runners.skills.migration.test.ts reads the runner skills': the nullable column and its comment, the
// owner's function and its refusals, who may run it, and the database's types that name them. What the
// function does to rows is supabase/checks/settings_repository.sql's to prove.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');
const NAME = readdirSync(root('supabase/migrations')).filter((file) => file.endsWith('_settings_repository.sql'));
const MIGRATION = NAME.length === 1 ? read(`supabase/migrations/${NAME[0] ?? ''}`) : '';
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TYPES = read('supabase/database.types.ts');

/** The body of a function the migration creates, from its `create function` to its closing `$$;`. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(CODE);
  if (!match?.[1]) throw new Error(`no function ${name}`);
  return match[1];
}

describe('the settings repository migration', () => {
  it('is one migration, whose header names its rollback', () => {
    expect(NAME).toHaveLength(1);
    expect(MIGRATION).toMatch(/^-- Rollback: /m);
  });

  it('adds a nullable column, filled by nothing, with its comment', () => {
    expect(CODE).toContain('alter table public.workspaces add column settings_repository text;');
    expect(CODE).toMatch(/comment on column public\.workspaces\.settings_repository is '[^']+/);
    // Outside a function's body, nothing writes a workspace: every workspace reads what it read before.
    expect(CODE.replace(/\$\$.*?\$\$/g, '')).not.toMatch(/update public\.workspaces/);
  });
});

describe('set_workspace_settings_repository()', () => {
  const fn = body('set_workspace_settings_repository');

  it('runs as the signed-in person, an owner only, as set_repository_phase0()', () => {
    expect(CODE).toContain(
      'create function public.set_workspace_settings_repository(p_workspace uuid, p_full_name text) returns public.workspaces language plpgsql security definer set search_path = \'\'',
    );
    expect(fn).toMatch(/^ declare [^;]*;( [^;]*;)* begin perform public\.repository_owner_only\(p_workspace\);/);
  });

  it('keeps the name trimmed and in lower case, and reads an empty one as no choice', () => {
    expect(fn).toContain("chosen text := nullif(lower(btrim(coalesce(p_full_name, ''))), '');");
  });

  it('refuses a repository the workspace does not list, or removed, with P0002 and the hint full_name', () => {
    expect(fn).toContain('if chosen is not null and not exists ( select 1 from public.repositories r where r.workspace_id = p_workspace and r.full_name = chosen and r.removed_at is null ) then');
    expect(fn).toContain("raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';");
  });

  it('stores the choice, or clears it, and answers the workspace it saved', () => {
    expect(fn).toContain('update public.workspaces w set settings_repository = chosen where w.id = p_workspace returning * into changed;');
    expect(fn).toContain('return changed;');
  });

  it('is run by a signed-in person only', () => {
    expect(CODE).toContain('revoke execute on function public.set_workspace_settings_repository(uuid, text) from public, anon;');
    expect(CODE).toContain('grant execute on function public.set_workspace_settings_repository(uuid, text) to authenticated;');
    expect(CODE).not.toMatch(/grant execute on function public\.set_workspace_settings_repository\(uuid, text\) to [^;]*(anon|service_role)/);
  });
});

describe('the database\'s types', () => {
  it('name the column and the function', () => {
    expect(TYPES).toMatch(/workspaces: \{\n\s+Row: \{[^}]*\n\s+settings_repository: string \| null\n/);
    expect(TYPES).toMatch(/set_workspace_settings_repository: \{\n\s+Args: \{ p_full_name: string; p_workspace: string \}\n/);
  });
});
