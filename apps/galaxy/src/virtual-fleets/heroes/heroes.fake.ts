import { roleOf, type HeroRole } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';
import type { Written } from '../virtual-fleets.repository';
import type { AddHeroRequest, Hero, RemoveHeroRequest } from './heroes.contract';
import type { HeroesRepository } from './heroes.repository';

// The Heroes' database in memory (PRD 2842 s6), for the service's and the controller's tests: the rules of
// add_virtual_hero() and remove_virtual_hero() (supabase/migrations/20270122095000_virtual_hero_edit.sql),
// answered with their codes, hints and words, as one person reads it. Northwind's owner is Ada, Ben is a
// member and its virtual fleet NIGHT-SHIFT holds an Engineer and a QA.

export const NORTHWIND = '11111111-1111-4111-8111-111111111111';
export const ADA = 'ada';
export const BEN = 'ben';
export const ENGINEER_ID = '22222222-2222-4222-8222-222222222221';
export const QA_ID = '22222222-2222-4222-8222-222222222222';

const refused = (code: string, message: string, hint: string | null = null) => ({ ok: false as const, code, hint, message });

function heroOf(id: string, fleet: string, role: HeroRole, position: number): Hero {
  const defaults = roleOf(role);
  return { id, fleet, name: defaults.name, role, skills: [...defaults.skills], agent: defaults.agent, model: defaults.model, limits: [...defaults.limits], position };
}

export function fakeHeroesDb(workspace = NORTHWIND) {
  const owners = new Map<string, Set<string>>([[workspace, new Set([ADA])]]);
  const members = new Map<string, Set<string>>([[workspace, new Set([ADA, BEN])]]);
  const heroes: Hero[] = [heroOf(ENGINEER_ID, 'night-shift', 'engineer', 0), heroOf(QA_ID, 'night-shift', 'qa', 1)];
  let made = 0;
  return {
    heroes,
    /** The repository as `person` reads and writes it. */
    as(person: string): Pick<HeroesRepository, 'heroes' | 'owns' | 'add' | 'remove'> {
      const owns = (workspace: string) => owners.get(workspace)?.has(person) === true;
      return {
        heroes: (workspace, fleet) => Promise.resolve(members.get(workspace)?.has(person) ? heroes.filter((h) => h.fleet === fleet).sort((a, b) => a.position - b.position) : []),
        owns: (workspace) => Promise.resolve(owns(workspace)),
        add(request: AddHeroRequest): Promise<Written<Hero>> {
          if (!owns(request.workspace)) return Promise.resolve(refused('42501', 'Only an owner of the workspace adds a hero.'));
          if (request.fleet !== 'night-shift') return Promise.resolve(refused('22023', 'Fleet: not a virtual fleet of this workspace.', 'fleet'));
          if (heroes.some((h) => h.fleet === request.fleet && h.role === request.role)) return Promise.resolve(refused('22023', 'Role: this fleet already has that hero.', 'role'));
          made += 1;
          const hero = heroOf(`33333333-3333-4333-8333-33333333333${made}`, request.fleet, request.role, Math.max(...heroes.filter((h) => h.fleet === request.fleet).map((h) => h.position), -1) + 1);
          heroes.push(hero);
          return Promise.resolve({ ok: true, value: hero });
        },
        remove(request: RemoveHeroRequest): Promise<Written<null>> {
          if (!owns(request.workspace)) return Promise.resolve(refused('42501', 'Only an owner of the workspace removes a hero.'));
          const hero = heroes.find((h) => h.id === request.hero);
          if (!hero) return Promise.resolve(refused('22023', 'Hero: not a hero of this workspace.', 'hero'));
          if (heroes.filter((h) => h.fleet === hero.fleet).length <= 1) return Promise.resolve(refused('22023', 'Hero: a fleet keeps at least one hero.', 'hero'));
          heroes.splice(heroes.indexOf(hero), 1);
          return Promise.resolve({ ok: true, value: null });
        },
      };
    },
  };
}
