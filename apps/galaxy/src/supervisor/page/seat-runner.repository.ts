import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { SeatRunner } from './model';

// The runner that holds the Supervisor's seat, for the page's header (PRD omni-loop-34 s5; ADR-0095): its name and
// slots, read as the signed-in person, so row-level security hands a member their own workspace's runners only.
// Parsed where it comes in; a refusal throws, naming the call.

export type SeatRunnerDb = Pick<SupabaseClient, 'from'>;

const RunnerRow = z.object({ name: z.string(), slots: z.number().int() });

export function seatRunnerRepository(db: SeatRunnerDb) {
  return {
    /** The runner by id, or null when the person cannot read it. */
    runner: async (id: string): Promise<SeatRunner | null> => {
      const { data, error } = await db.from('runners').select('name, slots').eq('id', id).maybeSingle();
      if (error) throw new Error(`runners: ${error.message}`);
      return RunnerRow.nullable().parse(data);
    },
  };
}
