import { orThrow, parseRow, parseRows } from '../../data/parse-rows';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HeroSchema, type AddHeroRequest, type Hero, type RemoveHeroRequest } from './heroes.contract';

// The Heroes tab's reads and writes (PRD 2842 s6; ADR-0095), on the client they are given: the signed-in
// person's own, so add_virtual_hero() and remove_virtual_hero() of
// supabase/migrations/20270122095000_virtual_hero_edit.sql decide who may (an owner of the workspace) and
// row-level security what they read. Each answer is parsed where it comes in; a failed read throws, a
// refused write answers the database's code, hint and words. No rule lives here: heroes.service.ts does.

export type HeroesDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A write: its value, or the database's refusal. */
export type Written<T> = { ok: true; value: T } | { ok: false; code: string | null; hint: string | null; message: string };

const WHERE = 'virtual-fleets/heroes/heroes.repository';
const COLUMNS = 'id, fleet, name, role, skills, agent, model, limits, position';

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

const refusedBy = (error: NonNullable<Answer['error']>) => ({ ok: false as const, code: error.code || null, hint: error.hint || null, message: error.message });

export function heroesRepository(db: HeroesDb) {
  return {
    /** A virtual fleet's heroes, in the order the fleet keeps them. */
    async heroes(workspace: string, fleet: string): Promise<Hero[]> {
      const { data, error } = await db.from('virtual_heroes').select(COLUMNS).eq('workspace_id', workspace).eq('fleet', fleet).order('position');
      if (error) throw new Error(`Supabase: could not read the heroes (${error.message})`);
      return orThrow(parseRows(HeroSchema, data, `${WHERE}: virtual_heroes`));
    },

    /** True when the person owns the workspace: only an owner adds or removes a hero. */
    async owns(workspace: string, person: string): Promise<boolean> {
      const { data, error } = await db.from('workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', person);
      if (error) throw new Error(`Supabase: could not read your membership (${error.message})`);
      return Array.isArray(data) && data.some((row: unknown) => typeof row === 'object' && row !== null && 'role' in row && row.role === 'owner');
    },

    /** Adds a hero of the role, with its defaults (add_virtual_hero()): the hero as made. */
    async add(request: AddHeroRequest): Promise<Written<Hero>> {
      const answer: Answer = await db.rpc('add_virtual_hero', { p_workspace: request.workspace, p_fleet: request.fleet, p_role: request.role });
      if (answer.error) return refusedBy(answer.error);
      return { ok: true, value: orThrow(parseRow(HeroSchema, answer.data, `${WHERE}: add_virtual_hero`)) };
    },

    /** Removes a hero (remove_virtual_hero()), a fleet's last one never. */
    async remove(request: RemoveHeroRequest): Promise<Written<null>> {
      const answer: Answer = await db.rpc('remove_virtual_hero', { p_workspace: request.workspace, p_hero: request.hero });
      return answer.error ? refusedBy(answer.error) : { ok: true, value: null };
    },
  };
}

export type HeroesRepository = ReturnType<typeof heroesRepository>;
