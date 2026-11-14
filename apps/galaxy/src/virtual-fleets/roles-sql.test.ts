// The virtual fleets migrations (PRD 2842 s1, PRD 2873 s3), read as text: the defaults create_virtual_fleet()
// copies onto each hero are the kit's roles, as the newest migration defining virtual_hero_roles() gives them;
// the colours it picks from are the Settings › Fleets form's swatches, in the same order; and the migration that
// gives every hero its role's skills accepts the Designer and rewrites the heroes already made.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { SWATCHES } from '../fleets/model';

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (file: string): string => readFileSync(`${DIR}${file}`, 'utf8');
const MIGRATION = read('20270122090000_virtual_fleets.sql');
const EVERY_SKILL = read('20270122121000_heroes_every_skill.sql');

/** One function's body, between its $$ markers. */
function body(name: string, sql = MIGRATION): string {
  const match = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`).exec(sql);
  if (!match?.[1]) throw new Error(`the migration defines no ${name}()`);
  return match[1];
}

/** The newest migration that defines `name()`: the one the database runs. */
function newest(name: string): string {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const found = files.filter((f) => read(f).includes(`create or replace function public.${name}(`)).at(-1);
  if (found === undefined) throw new Error(`no migration defines ${name}()`);
  return read(found);
}

describe('what a new virtual fleet starts with', () => {
  it('copies the kit\'s roles onto its heroes, in the drawer\'s order', () => {
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(body('virtual_hero_roles', newest('virtual_hero_roles')))?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? 'null')).toEqual(ROLES.map((r) => ({ ...r, skills: [...r.skills], limits: [...r.limits] })));
  });

  it('picks its colour from the Settings › Fleets swatches, in their order', () => {
    const listed = /array\[([^\]]*)\]/.exec(body('virtual_fleet_colors'))?.[1] ?? '';
    expect([...listed.matchAll(/'(#[0-9a-f]{6})'/g)].map((m) => m[1])).toEqual([...SWATCHES]);
  });

  it('derives its key as a players\' fleet\'s is derived (BR-PRODUCT-47), and refuses a taken one rather than numbering it', () => {
    const create = body('create_virtual_fleet', newest('create_virtual_fleet')).replace(/\s+/g, ' ');
    expect(create).toContain("v_key := coalesce(nullif(btrim(regexp_replace(lower(v_label), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'fleet');");
    expect(create).toContain("if exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = v_key) then raise exception 'Name taken: choose another'");
  });
});

describe('every hero lists its role\'s skills (PRD 2873 s3)', () => {
  const flat = EVERY_SKILL.replace(/\s+/g, ' ');

  it('is the newest definition of the roles, so a new hero starts with every skill of its role', () => {
    expect(newest('virtual_hero_roles')).toBe(EVERY_SKILL);
  });

  it('accepts the Designer for a hero and for a mission event', () => {
    expect(flat).toContain("add constraint virtual_heroes_role check (role in ('engineer', 'qa', 'reviewer', 'pm', 'architect', 'designer'))");
    expect(flat).toMatch(/add constraint mission_events_role_check check \(role in \([^)]*'designer'[^)]*'supervisor'\)\)/);
  });

  it('names the six roles when create_virtual_fleet() or add_virtual_hero() refuses an unknown one', () => {
    expect(body('create_virtual_fleet', EVERY_SKILL)).toContain("'Heroes: each one of engineer, qa, reviewer, pm, architect or designer.'");
    expect(body('add_virtual_hero', EVERY_SKILL)).toContain("'Role: one of engineer, qa, reviewer, pm, architect or designer.'");
  });

  it('rewrites only the skills of every hero already made', () => {
    const update = /update public\.virtual_heroes h set ([\s\S]*?) from /.exec(flat)?.[1] ?? '';
    expect(update).toMatch(/^skills = /);
    for (const column of ['name', 'agent', 'model', 'limits', 'position', 'role']) expect(update).not.toMatch(new RegExp(`\\b${column} =`));
  });
});
