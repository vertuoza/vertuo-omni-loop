import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types';

// The kit token's database calls (PRD 1628, 20261204090000_kit_tokens.sql): making one, acting as the
// fresh sign-in of its round trip, and the exchange's three calls, as the service role. Each runs on
// the client it is handed, as src/ask/kit-token-live.ts decides. No rule lives here: src/ask/kit-token.ts
// reads what comes back.

type Db = SupabaseClient<Database>;

/** A database function's answer, read unparsed. */
type Called = { data: unknown; error: { message: string; code?: string } | null };

/** Makes a kit token for the caller (public.kit_token_make): an empty workspace is their first one. */
export const makeKitToken = (
  db: Db,
  row: { workspace: string | null; name: string; hash: string; lastFour: string; days: number; session: string },
): PromiseLike<Called> =>
  db.rpc('kit_token_make', {
    p_workspace: row.workspace ?? '', p_name: row.name, p_hash: row.hash, p_last_four: row.lastFour, p_days: row.days, p_session: row.session,
  });

/** The exchange's first half (public.kit_token_claim), as the service role. */
export const claimKitToken = (db: Db, hash: string): PromiseLike<Called> => db.rpc('kit_token_claim', { p_hash: hash });

/** The exchange's second half (public.kit_token_renewed), as the service role. */
export const renewedKitToken = (db: Db, token: string, lease: string, session: string): PromiseLike<Called> =>
  db.rpc('kit_token_renewed', { p_token: token, p_lease: lease, p_session: session });

/** Ends a failed exchange's lease (public.kit_token_release), as the service role. */
export const releaseKitToken = (db: Db, token: string, lease: string): PromiseLike<Called> =>
  db.rpc('kit_token_release', { p_token: token, p_lease: lease });
