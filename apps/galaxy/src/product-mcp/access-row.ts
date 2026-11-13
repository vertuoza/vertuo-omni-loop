// What product_mcp_for_key() answers for a key that reads the product (PRD 2707 s3), as a zod schema. It
// lives apart from product-mcp.repository.ts so that another repository building the same access (the eval
// set's, PRD omni-loop-8 s3) names its shape without importing a repository.
import { z } from 'zod';

const PackRef = z.object({
  repo: z.string().min(1),
  pack_id: z.string().nullable(),
  sha: z.string().nullable(),
  committed_at: z.string().nullable(),
});

const LegalRow = z.object({ id: z.string(), statement: z.string(), source: z.string(), owner: z.string().nullable() });
const TermRow = z.object({ term: z.string(), meaning: z.string(), avoid: z.array(z.string()) });

export const AccessRow = z.object({
  product: z.object({ id: z.string(), key: z.string(), name: z.string(), workspace_id: z.string() }),
  /** The id of the key served (PRD omni-loop-6), never the key. */
  key_id: z.string(),
  repositories: z.array(PackRef),
  law_home: PackRef.nullable(),
  // product_knowledge_for_agents() of the product, as the agent link reads it: the Legal entries with each
  // owner's login, and the Glossary. Its other keys are not read here.
  knowledge: z.object({ legal: z.array(LegalRow), glossary: z.array(TermRow) }),
});
/** What product_mcp_for_key() answers for a key that reads the product. */
export type AccessRow = z.infer<typeof AccessRow>;
