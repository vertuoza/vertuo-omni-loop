// What product_mcp_for_key() answers for a key that reads the product (PRD 2707 s3), and what
// product_mcp_for_member() answers for a member's kit sign-in (PRD 3007 s1), as zod schemas. It lives apart
// from product-mcp.repository.ts so that another repository building the same access (the eval set's, PRD
// omni-loop-8 s3) names its shape without importing a repository.
import { z } from 'zod';

const PackRef = z.object({
  repo: z.string().min(1),
  pack_id: z.string().nullable(),
  sha: z.string().nullable(),
  committed_at: z.string().nullable(),
});

const LegalRow = z.object({ id: z.string(), statement: z.string(), source: z.string(), owner: z.string().nullable() });
const TermRow = z.object({ term: z.string(), meaning: z.string(), avoid: z.array(z.string()) });

/** What a served caller reads of the product, whoever they are: a key or a member's sign-in. */
const ProductAccess = z.object({
  product: z.object({ id: z.string(), key: z.string(), name: z.string(), workspace_id: z.string() }),
  repositories: z.array(PackRef),
  law_home: PackRef.nullable(),
  // product_knowledge_for_agents() of the product, as the agent link reads it: the Legal entries with each
  // owner's login, and the Glossary. Its other keys are not read here.
  knowledge: z.object({ legal: z.array(LegalRow), glossary: z.array(TermRow) }),
});
/** What a served caller reads of the product. */
export type ProductAccess = z.infer<typeof ProductAccess>;

export const AccessRow = ProductAccess.extend({
  /** The id of the key served (PRD omni-loop-6), never the key. */
  key_id: z.string(),
});
/** What product_mcp_for_key() answers for a key that reads the product. */
export type AccessRow = z.infer<typeof AccessRow>;

export const MemberAccessRow = ProductAccess.extend({
  /** The id of the member served (PRD 3007 s1), never their token. */
  user_id: z.string(),
});
/** What product_mcp_for_member() answers for a member of the product's workspace. */
export type MemberAccessRow = z.infer<typeof MemberAccessRow>;
