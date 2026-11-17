// The virtual fleets migrations (PRD 2842 s1, PRD 2873 s3), read as text: the defaults create_virtual_fleet()
// copies onto each hero are the kit's roles, as the newest migration defining virtual_hero_roles() gives them;
// the colours it picks from are the Settings › Fleets form's swatches, in the same order; and the migration that
// gives every hero its role's skills accepts the Designer and rewrites the heroes already made. The Reviewer's
// migration (PRD 2871), the newest, gives the Reviewer `review` and its six limits, after that one.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { SWATCHES } from '../fleets/model';

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (file: string): string => readFileSync(`${DIR}${file}`, 'utf8');
const MIGRATION = read('20270122090000_virtual_fleets.sql');
const EVERY_SKILL = read('20270122121000_heroes_every_skill.sql');
const REVIEWER = read('20270122122000_reviewer.sql');

type Role = { role: string; skills: string[]; limits: string[] };

/** The roles a `virtual_hero_roles()` body holds between its $json$ markers. */
const rolesIn = (sql: string): Role[] => JSON.parse(/\$json\$([\s\S]*?)\$json\$/.exec(body('virtual_hero_roles', sql))?.[1] ?? '[]') as Role[];

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

  it('is the last definition of the roles before the Reviewer\'s, which changes only the Reviewer', () => {
    const others = (roles: Role[]) => roles.filter((r) => r.role !== 'reviewer');
    expect(others(rolesIn(REVIEWER))).toEqual(others(rolesIn(EVERY_SKILL)));
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

// The PM (PRD 2896 s12): the newest definition of the roles changes only the PM's last limit, and a PM's limits take it only while
// they are still the default it was made with, never a person's.
describe('what the PM never approves (PRD 2896 s12)', () => {
  const PM = read('20270124150000_mission_pm.sql');
  const flat = PM.replace(/\s+/g, ' ');

  it('is the last definition of the roles before a mission\'s repairs\' (PRD 2980), and changes only the PM\'s limits', () => {
    expect(newest('virtual_hero_roles')).toBe(read('20270125140000_mission_repairs.sql'));
    const others = (roles: Role[]) => roles.filter((r) => r.role !== 'pm');
    expect(others(rolesIn(PM))).toEqual(others(rolesIn(REVIEWER)));
    const pm = (roles: Role[]) => roles.find((r) => r.role === 'pm');
    expect(pm(rolesIn(PM))?.skills).toEqual(pm(rolesIn(REVIEWER))?.skills);
    expect(pm(rolesIn(PM))?.limits.at(-1)).toBe('It never approves a PRD it wrote, nor one outside a mission\'s committee.');
  });

  it('replaces a PM\'s limits only while they are its old default', () => {
    const update = /update public\.virtual_heroes h set ([\s\S]*?);/.exec(flat)?.[1] ?? '';
    const old = rolesIn(REVIEWER).find((r) => r.role === 'pm')?.limits ?? [];
    expect(update).toMatch(/^limits = /);
    expect(update).toContain(`and h.limits = array[${old.map((limit) => `'${limit}'`).join(', ')}]`);
  });
});

// The Reviewer (PRD 2871), after every hero listed its role's skills (PRD 2873): `review` joins its skills, and its six
// limits replace a default one, never a person's.
describe('the Reviewer works alone (PRD 2871)', () => {
  const flat = REVIEWER.replace(/\s+/g, ' ');
  const updates = [...flat.matchAll(/update public\.virtual_heroes h set ([\s\S]*?);/g)].map((m) => m[1] ?? '');

  it('gives the Reviewer review then tech-review, and its six limits', () => {
    const reviewer = rolesIn(REVIEWER).find((r) => r.role === 'reviewer');
    expect(reviewer?.skills).toEqual(['review', 'tech-review']);
    expect(reviewer?.limits).toHaveLength(6);
  });

  it('runs after the migration that rewrites every hero\'s skills', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(files.indexOf('20270122122000_reviewer.sql')).toBeGreaterThan(files.indexOf('20270122121000_heroes_every_skill.sql'));
  });

  it('gives every Reviewer already made its role\'s skills, as heroes_every_skill does', () => {
    const skills = updates.find((u) => u.startsWith('skills = '));
    expect(skills).toContain("where d.value ->> 'role' = 'reviewer' and h.role = 'reviewer' and h.skills is distinct from");
    for (const column of ['name', 'agent', 'model', 'limits', 'position']) expect(skills).not.toMatch(new RegExp(`\\b${column} =`));
  });

  it('replaces a Reviewer\'s limits only while they are a default, PRD 2842\'s or PRD 2873\'s', () => {
    const limits = updates.find((u) => u.startsWith('limits = '));
    const old = rolesIn(MIGRATION).find((r) => r.role === 'reviewer')?.limits ?? [];
    const before = rolesIn(EVERY_SKILL).find((r) => r.role === 'reviewer')?.limits ?? [];
    const quoted = (list: readonly string[]) => `array[${list.map((limit) => `'${limit}'`).join(', ')}]`;
    expect(limits).toContain(`and h.limits in (${quoted(old)}, ${quoted(before)})`);
    expect(limits).toContain('from jsonb_array_elements(public.virtual_hero_roles()) as d (value)');
  });
});
