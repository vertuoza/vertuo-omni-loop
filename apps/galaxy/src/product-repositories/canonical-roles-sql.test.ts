// The canonical roles of a repository in a product (PRD 2346), read from the migration as text: the alias
// table is mapped once, a role the table does not hold is left alone, and product_repository_link()
// refuses a new role outside the nine while still accepting null and a row's own unchanged old role.
// What the database does with it is supabase/checks/product_repositories.sql's to prove.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ROLES, ROLE_ALIASES } from 'omni-loop/kit/lib/layers/layers.ts';
import { describe, expect, it } from 'vitest';

const FILE = fileURLToPath(new URL('../../../../supabase/migrations/20261224090000_canonical_roles.sql', import.meta.url));
const sql = readFileSync(FILE, 'utf8').replace(/\s+/g, ' ');

describe('the canonical roles migration', () => {
  it('maps every alias of the table to its role, and only those rows', () => {
    for (const [old, role] of Object.entries(ROLE_ALIASES)) expect(sql).toContain(`when '${old}' then '${role}'`);
    const list = Object.keys(ROLE_ALIASES).map((a) => `'${a}'`).join(', ');
    expect(sql).toContain(`where role in (${list});`);
    expect(sql).not.toContain('else role');
  });

  it('refuses a new role outside the nine (22023, hint role), keeping null and a row\'s own old role', () => {
    const nine = Object.keys(CANONICAL_ROLES).map((r) => `'${r}'`).join(', ');
    expect(sql).toContain(`v_role not in (${nine})`);
    expect(sql).toContain('and not exists (select 1 from public.product_repositories l where l.product_id = owned.id and l.repository = repo and l.role = v_role)');
    expect(sql).toContain("using errcode = '22023', hint = 'role'");
    expect(sql).toContain('if v_role is not null and');
  });
});
