// The virtual fleets migration (PRD 2842 s1), read as text: the defaults create_virtual_fleet() copies
// onto each hero are the kit's roles, and the colours it picks from are the Settings › Fleets form's
// swatches, in the same order.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROLES } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import { SWATCHES } from '../fleets/model';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20270122090000_virtual_fleets.sql', import.meta.url)), 'utf8');

/** One function's body, between its $$ markers. */
function body(name: string): string {
  const match = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`).exec(MIGRATION);
  if (!match?.[1]) throw new Error(`the migration defines no ${name}()`);
  return match[1];
}

describe('what a new virtual fleet starts with', () => {
  it('copies the kit\'s roles onto its heroes, in the drawer\'s order', () => {
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(body('virtual_hero_roles'))?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json ?? 'null')).toEqual(ROLES.map((r) => ({ ...r, skills: [...r.skills], limits: [...r.limits] })));
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
