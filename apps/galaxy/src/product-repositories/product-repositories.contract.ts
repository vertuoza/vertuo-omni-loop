// What the product links' routes answer (PRD 1364, s4; ADR-0095), as zod schemas both sides share.
// The kit reads the reply with the same schema (kit/lib/product/targets.ts), so the two never drift.
// Browser-safe: zod and the kit's schema only.
//
//   GET /api/products/targets?repo=<owner/name>&product=<name>
//     → 200 { product: { name }, targets: [{ repo, role, knowledge, readAt, readOnly, consumes }] }
//   POST /api/products/import {repo, product, targets}
//     → 200 { product: { name }, added: [repo], changed: [repo], unchanged: [repo] }
//   GET /api/products/which?repo=<owner/name>
//     → 200 { products: [{ name }] }
//
// A refusal is `{ error }` in plain words (ADR-0029): 400 a malformed query or body, 401 no valid
// sign-in, 403 an import by someone who is no owner of the workspace, 404 a repository no workspace of
// the caller lists or no such product, 409 a name two products share, 422 a link the database refuses
// (in its words), 503 no database here, 500 the database failed.
export { ProductTargetsSchema } from 'vertuo-omni-plan/kit/lib/product/targets.ts';
export type { ProductTargetsReply } from 'vertuo-omni-plan/kit/lib/product/targets.ts';
export { ProductImportRequestSchema, ProductImportSchema, ProductsWhichSchema } from 'vertuo-omni-plan/kit/lib/product/import.ts';
export type { ProductImportReply, ProductImportRequest, ProductsWhichReply } from 'vertuo-omni-plan/kit/lib/product/import.ts';
