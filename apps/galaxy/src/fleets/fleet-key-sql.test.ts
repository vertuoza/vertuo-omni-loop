// The own-fleets migration (PRD 400), read as text: how create_fleet() names a new fleet. No later
// migration redefines it.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const MIGRATION = readFileSync(`${MIGRATIONS}20261003090000_own_fleets.sql`, 'utf8');

/** One function's body, between its $$ markers, on one line. */
function body(name: string): string {
  const match = new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`).exec(MIGRATION);
  if (!match?.[1]) throw new Error(`the migration defines no ${name}()`);
  return match[1].replace(/\s+/g, ' ');
}

describe('a new fleet\'s key', () => {
  // Law BR-PRODUCT-47 (.omni-loop/knowledge/product/rules.md, #1508).
  it('law BR-PRODUCT-47: the key is the label lowercased, each run of non-letters and non-digits a dash, numbered when taken, retired fleets included', () => {
    const definers = readdirSync(MIGRATIONS).filter((f) => readFileSync(`${MIGRATIONS}${f}`, 'utf8').includes('function public.create_fleet('));
    expect(definers).toEqual(['20261003090000_own_fleets.sql']);

    const create = body('create_fleet');
    expect(create).toContain("base := coalesce(nullif(btrim(regexp_replace(lower(look.label), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'fleet');");
    // Taken means any row of the workspace with that name: no filter on retired_at.
    expect(create).toContain('candidate := base; while exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = candidate) loop n := n + 1; candidate := base || \'-\' || n; end loop;');
    expect(create).toContain('insert into public.teams (workspace_id, name, label, color, motto, mascot, sort) values (p_workspace, candidate, look.label,');
  });
});
