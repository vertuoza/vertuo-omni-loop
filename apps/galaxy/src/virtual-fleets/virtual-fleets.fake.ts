import { roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { CreateVirtualFleetRequest, VirtualFleet } from './virtual-fleets.contract';
import type { VirtualFleetsRepository, Written } from './virtual-fleets.repository';

// The Virtual Fleets' database in memory (PRD 2842 s1), for the service's and the controller's tests: the
// rules of create_virtual_fleet() (supabase/migrations/20270122090000_virtual_fleets.sql), answered with
// its codes, hints and words, as one person reads it. Northwind holds a players' fleet BEAVER (whose key
// a new fleet cannot take) and wears the first swatch; Ada and Ben are its members, Dan is not.

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
export const ADA = 'ada';
export const BEN = 'ben';
export const DAN = 'dan';

const SWATCHES = ['#d08a4a', '#b07cff', '#ffd84a', '#9aa3c8', '#2fc6a4', '#4fb0ff', '#ff6b8a', '#8bd450'];
const MASCOTS = ['beaver', 'octopod', 'robot'];

type Team = VirtualFleet & { kind: 'crew' | 'virtual'; heroes: { role: HeroRole; name: string; skills: readonly string[] }[] };

const refused = (code: string, message: string, hint: string | null = null) => ({ ok: false as const, code, hint, message });

/** A fleet's key from its name, as create_virtual_fleet() derives it. */
const keyOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fleet';

/** The first refusal a create meets, in the function's order, or null. */
function checked(request: CreateVirtualFleetRequest, held: readonly Team[]) {
  const label = request.name.trim();
  if (label.length < 1 || label.length > 12) return refused('22023', 'Name: 1 to 12 characters.', 'name');
  if (!MASCOTS.includes(request.mascot)) return refused('22023', `Icon: one of ${MASCOTS.join(', ')}.`, 'mascot');
  if (request.roles.length === 0) return refused('22023', 'Heroes: leave at least one on.', 'heroes');
  return held.some((t) => t.name === keyOf(label)) ? refused('22023', 'Name taken: choose another', 'name') : null;
}

export function fakeVirtualFleetsDb() {
  const members = new Map<string, Set<string>>([[NORTHWIND, new Set([ADA, BEN])]]);
  const teams = new Map<string, Team[]>([[NORTHWIND, [{ name: 'beaver', label: 'BEAVER', color: '#d08a4a', mascot: 'beaver', kind: 'crew', heroes: [] }]]]);
  return {
    teams,
    /** The repository as `person` reads and writes it. */
    as(person: string): Pick<VirtualFleetsRepository, 'create' | 'names'> {
      return {
        create(request: CreateVirtualFleetRequest): Promise<Written<VirtualFleet>> {
          if (!members.get(request.workspace)?.has(person)) return Promise.resolve(refused('42501', 'Only a member of the workspace creates its virtual fleets.'));
          const held = teams.get(request.workspace) ?? [];
          const wrong = checked(request, held);
          if (wrong) return Promise.resolve(wrong);
          const fleet: VirtualFleet = { name: keyOf(request.name), label: request.name.trim(), color: SWATCHES.find((c) => !held.some((t) => t.color === c)) ?? '#d08a4a', mascot: request.mascot };
          const heroes = [...new Set(request.roles)].map((role) => ({ role, name: roleOf(role).name, skills: roleOf(role).skills }));
          teams.set(request.workspace, [...held, { ...fleet, kind: 'virtual', heroes }]);
          return Promise.resolve({ ok: true, value: fleet });
        },
        names(workspace: string): Promise<string[]> {
          if (!members.get(workspace)?.has(person)) return Promise.resolve([]);
          return Promise.resolve((teams.get(workspace) ?? []).filter((t) => t.kind === 'virtual').map((t) => t.name));
        },
      };
    },
  };
}
