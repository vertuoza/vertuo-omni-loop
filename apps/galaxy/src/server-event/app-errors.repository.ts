import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppErrorRow, AppErrorStore } from './app-errors';

// Where a galaxy 5xx is kept (PRD omni-loop-34 s3): one insert into `app_errors`, as the service role, the only role that
// writes it. A refusal throws, naming the table; the writer logs it. It holds no rule.

export function appErrorsRepository(db: Pick<SupabaseClient, 'from'>): AppErrorStore {
  return {
    write: async (row: AppErrorRow) => {
      const { error } = await db.from('app_errors').insert(row);
      if (error) throw new Error(`app_errors: ${error.message}`);
    },
  };
}
