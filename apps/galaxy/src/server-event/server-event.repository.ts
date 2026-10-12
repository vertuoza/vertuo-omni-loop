import { z } from 'zod';

// The server event's one read (PRD 1548 s4): the voids the caller's last push of a dossier left, as
// approval_voids_of_push() lists them (supabase/migrations/20261126090000_approval_voiding.sql), called as
// the caller who pushed so the database checks who reads. A product PRD's void names no repository (its
// dossier has no home repository, supabase/migrations/20261203100000_product_prd_ids.sql). It holds no rule.

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** A Supabase client's functions, as the pusher calls them. */
type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<Raw> };

/** Only what the server event reads of each void: whether its dossier has a home repository. */
const Voids = z.array(z.looseObject({ repo: z.string().nullable() }));

/** The pusher's side: whether their last push of `dossier` voided a product PRD's approval, `unread` when the database said no. */
export function productVoidRepository(db: Rpc) {
  return {
    voidedByPush: async (dossier: string): Promise<boolean | 'unread'> => {
      const { data, error } = await db.rpc('approval_voids_of_push', { p_dossier: dossier });
      if (error) return 'unread';
      const read = Voids.safeParse(data);
      return read.success ? read.data.some((row) => row.repo === null) : 'unread';
    },
  };
}
