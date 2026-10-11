import { z } from 'zod';

// Terminal tokens on your own profile (PRD 1628 s4, spec section 5), the shapes that cross a boundary
// (ADR-0095): what kit_tokens_mine() answers (20261204090000_kit_tokens.sql), and what the made-token
// route answers once the sign-in round trip comes back (POST /api/ask/token/made, src/ask/kit-token.ts).
// Browser-safe: the page's server and its browser part both read them.

/** A kit token as listed: never its hash, never its session. */
export const KitTokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  lastFour: z.string().length(4),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string(),
});
export type KitToken = z.infer<typeof KitTokenSchema>;

/** kit_tokens_mine(): your live kit tokens in the workspace, and how many live tokens you hold, both
 * scopes together, against the limit. */
export const KitTokensMineSchema = z.object({
  tokens: z.array(KitTokenSchema),
  live: z.number().int().min(0),
  limit: z.number().int().min(1),
});
export type KitTokensMine = z.infer<typeof KitTokensMineSchema>;

/** The token just made, as POST /api/ask/token/made answers it, once. */
export const MadeTokenSchema = z.object({
  token: z.string().regex(/^omk_[A-Za-z0-9_-]{43}$/),
  name: z.string().min(1).max(40),
  expires_at: z.string(),
});
export type MadeTokenAnswer = z.infer<typeof MadeTokenSchema>;
