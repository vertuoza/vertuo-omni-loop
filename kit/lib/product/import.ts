// A product's links from a config (PRD 1364, s5): `omni product import --product <name>` sends a plan
// repository's `plan.targets[]` to the product of that name on the Omni page, once, through
// `POST /api/products/import`, and `omni product which` reads the products this repository is in,
// through `GET /api/products/which`. The two replies' schemas are shared with the app's contract, so
// the two sides never drift.
//
// - Each target becomes one link with its fields; `consumes`, short names in the config, is sent as
//   whole `owner/name` slugs, read from the other targets.
// - The server adds a link that is missing, changes one whose fields differ and leaves one that is the
//   same, and answers which repository went where: a second run changes nothing.
// - Nothing here writes the config: the person swaps `targets` for `product` themselves.
import { z } from 'zod';
import { ProductLinkSchema, type ProductTarget } from './targets.ts';

const SLUG = /^[\w.-]+\/[\w.-]+$/;

/** One link to import: a target, every `consumes` a whole slug, and a role always set (the database
 * says which role it refuses, and why). */
const ImportLinkSchema = ProductLinkSchema.extend({ role: z.string().trim().min(1).max(40) });
type ImportLink = z.infer<typeof ImportLinkSchema>;

/** `POST /api/products/import`'s body: the plan repository, the product's name and the links. */
export const ProductImportRequestSchema = z.object({
  repo: z.string().regex(SLUG).max(200),
  product: z.string().trim().min(1).max(200),
  targets: z.array(ImportLinkSchema).min(1).max(200),
});
export type ProductImportRequest = z.infer<typeof ProductImportRequestSchema>;

/** Its reply: the product, and each repository added, changed or left as it was, in the body's order. */
export const ProductImportSchema = z.object({
  product: z.object({ name: z.string().min(1) }),
  added: z.array(z.string()),
  changed: z.array(z.string()),
  unchanged: z.array(z.string()),
});
export type ProductImportReply = z.infer<typeof ProductImportSchema>;

/** `GET /api/products/which?repo=<owner/name>`'s reply: the products the repository is in, by name. */
export const ProductsWhichSchema = z.object({
  products: z.array(z.object({ name: z.string().min(1) })),
});
export type ProductsWhichReply = z.infer<typeof ProductsWhichSchema>;

const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/** `plan.targets` as the links to import, in config order: each short name in `consumes` becomes the
 * slug of the target it names (the config has already checked that one does). */
export function linksOfTargets(targets: readonly ProductTarget[]): ImportLink[] {
  const slugOf = (name: string): string => targets.find((target) => shortName(target.repo) === name)?.repo ?? name;
  return targets.map(({ repo, role, knowledge, readAt, readOnly = false, consumes = [] }) => ({
    repo,
    role,
    knowledge,
    readAt,
    readOnly,
    consumes: consumes.map(slugOf),
  }));
}

/** What `omni product import` prints of the server's reply; throws, naming the product, on another shape. */
export function importLines(reply: unknown, product: string): string[] {
  const parsed = ProductImportSchema.safeParse(reply);
  if (!parsed.success) throw new Error(`the server answered no import for product ${product}`);
  const { product: { name }, added, changed, unchanged } = parsed.data;
  if (added.length === 0 && changed.length === 0) {
    return [`product ${name}: nothing changed, ${unchanged.length} ${unchanged.length === 1 ? 'link' : 'links'} already as plan.targets says`];
  }
  return [
    `product ${name}: ${added.length} added, ${changed.length} changed, ${unchanged.length} unchanged`,
    ...added.map((repo) => `  added    ${repo}`),
    ...changed.map((repo) => `  changed  ${repo}`),
  ];
}

/** What `omni product which` prints: one product per line, or `none`; throws on another shape. */
export function whichLines(reply: unknown): string[] {
  const parsed = ProductsWhichSchema.safeParse(reply);
  if (!parsed.success) throw new Error('the server answered no products for this repository');
  const names = parsed.data.products.map((product) => product.name);
  return names.length ? names : ['none'];
}
