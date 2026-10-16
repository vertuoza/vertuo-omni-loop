// The plan archive's database (PRD 2011 s17), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair): the App has no person's session. It reads
// what an owner decided, `products.plan_repository` and `products.plan_archived_at`, which only
// product_plan_repository_set() and product_plan_archive() write (supabase/migrations/20261212090000_knowledge_packs.sql);
// the App writes nothing there. Throws when the database refuses or answers out of shape.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';

/** A plan repository (owner/name, lower case) and whether its product says it is archived. */
export type PlanRepository = { repository: string; archived: boolean };

export type PlanStore = {
  /** Every product's plan repository, once each, by name. */
  plans: () => Promise<PlanRepository[]>;
};

const RowSchema = z.object({ plan_repository: z.string().regex(/^[^/\s]+\/[^/\s]+$/), plan_archived_at: z.string().nullable() });

/** The store, as the service role on `connection`. */
export function planArchiveStore(connection: Connection): PlanStore {
  const db = serviceDb(connection);
  return {
    plans: async () => {
      const answer = await db.from('products').select('plan_repository, plan_archived_at').not('plan_repository', 'is', null);
      const byName = new Map<string, boolean>();
      for (const row of rowsOf(RowSchema, answer)) {
        const repository = row.plan_repository.toLowerCase();
        // Two products naming one repository: archived only when every one of them says so.
        byName.set(repository, (byName.get(repository) ?? true) && row.plan_archived_at !== null);
      }
      return [...byName].map(([repository, archived]) => ({ repository, archived })).sort((a, b) => a.repository.localeCompare(b.repository));
    },
  };
}
