import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../../supabase/database.types.ts';
import { CHANNELS_DEFAULT } from './device';
import { alertStore } from './store';

// A person with no alert row reads as Email on and Phone alerts off (PRD 2608 s2), the same default the
// database gives approval_recipients(); a row they have is read as stored, email off included.

const dbHolding = (rows: unknown[]) =>
  ({ from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }) }) }) as unknown as SupabaseClient<Database>;

describe('alertStore.channels', () => {
  it('reads a person with no row as email on, phone alerts off', async () => {
    expect(await alertStore(dbHolding([])).channels('u1')).toEqual({ push: false, email: true });
    expect(CHANNELS_DEFAULT).toEqual({ push: false, email: true });
  });

  it('reads a row with email off as off', async () => {
    expect(await alertStore(dbHolding([{ push: false, email: false }])).channels('u1')).toEqual({ push: false, email: false });
  });

  it('reads a row with email on as on', async () => {
    expect(await alertStore(dbHolding([{ push: true, email: true }])).channels('u1')).toEqual({ push: true, email: true });
  });
});
