import { z } from 'zod';

// One row of product_repositories (PRD 1364 s1), the fields both of this folder's storages read: the kit's
// targets (product-repositories.repository.ts) and the product home's Repositories & approvers tab
// (repositories-tab.repository.ts), which reads who added it too.
export const StoredLinkFields = z.object({
  repository: z.string(),
  role: z.string().nullable(),
  knowledge: z.enum(['own', 'imported', 'none']),
  read_at: z.string().nullable(),
  read_only: z.boolean(),
  consumes: z.array(z.string()),
});
