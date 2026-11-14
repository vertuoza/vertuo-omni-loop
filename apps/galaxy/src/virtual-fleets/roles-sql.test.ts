// The virtual fleets migration (PRD 2842 s1), read as text: the defaults create_virtual_fleet() copies
// onto each hero are the kit's roles, and the colours it picks from are the Settings › Fleets form's
// swatches, in the same order. The defaults are read from the newest migration that defines
// virtual_hero_roles(): the Reviewer's took its skill and limits in 20270122120000_reviewer.sql (PRD 2871).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { SWATCHES } from '../fleets/model';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (name: string): string => readFileSync(`${MIGRATIONS}${name}`, 'utf8');
const MIGRATION = read('20270122090000_virtual_fleets.sql');
const REVIEWER = read('20270122120000_reviewer.sql');

type Role = { role: string; skills: string[]; limits: string[] };

/** The newest migration that defines `name`(), by its version. */
function newestDefining(name: string): string {
  const defining = readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort()
    .filter((file) => read(file).includes(`create or replace function public.${name}(`));
  const newest = defining.at(-1);
  if (newest === undefined) throw new Error(`no migration defines ${name}()`);
  return read(newest);
}

/** One function's body, between its $$ markers, in `text`. */
function body(name: string, text: string = MIGRATION): string {
  const match = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`).exec(text);
  if (!match?.[1]) throw new Error(`the migration defines no ${name}()`);
  return match[1];
}

/** The roles a `virtual_hero_roles()` body holds between its $json$ markers. */
const rolesIn = (text: string): Role[] => JSON.parse(/\$json\$([\s\S]*?)\$json\$/.exec(body('virtual_hero_roles', text))?.[1] ?? '[]') as Role[];

describe('what a new virtual fleet starts with', () => {
  it('copies the kit\'s roles onto its heroes, in the drawer\'s order', () => {
    expect(rolesIn(newestDefining('virtual_hero_roles'))).toEqual(ROLES.map((r) => ({ ...r, skills: [...r.skills], limits: [...r.limits] })));
  });

  it('gives the Reviewer its review and its six limits, the other roles as they were (PRD 2871)', () => {
    const others = (roles: Role[]) => roles.filter((r) => r.role !== 'reviewer');
    expect(others(rolesIn(REVIEWER))).toEqual(others(rolesIn(MIGRATION)));
    const reviewer = rolesIn(REVIEWER).find((r) => r.role === 'reviewer');
    expect(reviewer?.skills).toEqual(['review']);
    expect(reviewer?.limits).toHaveLength(6);
  });

  it('picks its colour from the Settings › Fleets swatches, in their order', () => {
    const listed = /array\[([^\]]*)\]/.exec(body('virtual_fleet_colors'))?.[1] ?? '';
    expect([...listed.matchAll(/'(#[0-9a-f]{6})'/g)].map((m) => m[1])).toEqual([...SWATCHES]);
  });

  it('derives its key as a players\' fleet\'s is derived (BR-PRODUCT-47), and refuses a taken one rather than numbering it', () => {
    const create = body('create_virtual_fleet').replace(/\s+/g, ' ');
    expect(create).toContain("v_key := coalesce(nullif(btrim(regexp_replace(lower(v_label), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'fleet');");
    expect(create).toContain("if exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = v_key) then raise exception 'Name taken: choose another'");
  });
});

// The Reviewer heroes of fleets made before PRD 2871 take its defaults, unless a person changed them: the
// update matches the old defaults exactly, the ones 20270122090000_virtual_fleets.sql gave.
describe('the Reviewer heroes already made (PRD 2871)', () => {
  const update = /update public\.virtual_heroes h([\s\S]*?);/.exec(REVIEWER)?.[1]?.replace(/\s+/g, ' ') ?? '';
  const old = rolesIn(MIGRATION).find((r) => r.role === 'reviewer');

  it('updates only a Reviewer whose skills and limits are still the old defaults', () => {
    expect(old?.skills).toEqual([]);
    expect(update).toContain("where d.value ->> 'role' = 'reviewer' and h.role = 'reviewer' and h.skills = '{}'::text[]");
    expect(update).toContain(`and h.limits = array[${(old?.limits ?? []).map((limit) => `'${limit}'`).join(', ')}]`);
  });

  it('copies the new defaults from virtual_hero_roles(), as a new hero does', () => {
    expect(update).toContain("set skills = array(select jsonb_array_elements_text(d.value -> 'skills')), limits = array(select jsonb_array_elements_text(d.value -> 'limits'))");
    expect(update).toContain('from jsonb_array_elements(public.virtual_hero_roles()) as d (value)');
  });
});
