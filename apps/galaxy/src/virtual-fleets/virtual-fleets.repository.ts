import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import { VirtualFleetSchema, type CreateVirtualFleetRequest, type VirtualFleet } from './virtual-fleets.contract';

// The Virtual Fleets' reads and writes (PRD 2842 s1; ADR-0095), on the client they are given: the
// signed-in person's own, so create_virtual_fleet() of supabase/migrations/20270122090000_virtual_fleets.sql
// decides who may (any member of the workspace) and row-level security what they read. Each answer is
// parsed where it comes in; a failed read throws, a refused write answers the database's code, hint and
// words. No rule lives here: virtual-fleets.service.ts holds them.

export type VirtualFleetsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A write: its value, or the database's refusal. */
export type Written<T> = { ok: true; value: T } | { ok: false; code: string | null; hint: string | null; message: string };

const WHERE = 'virtual-fleets/virtual-fleets.repository';
const FleetName = z.object({ name: z.string().min(1) });

type Answer = { data: unknown; error: { code?: string; hint?: string; message: string } | null };

export function virtualFleetsRepository(db: VirtualFleetsDb) {
  return {
    /** Makes the fleet and its heroes (create_virtual_fleet()): the fleet as made. */
    async create(request: CreateVirtualFleetRequest): Promise<Written<VirtualFleet>> {
      const answer: Answer = await db.rpc('create_virtual_fleet', {
        p_workspace: request.workspace, p_name: request.name, p_mascot: request.mascot, p_roles: request.roles,
      });
      if (answer.error) return { ok: false, code: answer.error.code || null, hint: answer.error.hint || null, message: answer.error.message };
      return { ok: true, value: orThrow(parseRow(VirtualFleetSchema, answer.data, `${WHERE}: create_virtual_fleet`)) };
    },

    /** The keys of the workspace's virtual fleets, retired ones included. */
    async names(workspace: string): Promise<string[]> {
      const { data, error } = await db.from('teams').select('name').eq('workspace_id', workspace).eq('kind', 'virtual');
      if (error) throw new Error(`Supabase: could not read the virtual fleets (${error.message})`);
      return orThrow(parseRows(FleetName, data, `${WHERE}: teams`)).map((row) => row.name);
    },
  };
}

export type VirtualFleetsRepository = ReturnType<typeof virtualFleetsRepository>;
