// A product's targets (PRD 1364, s4): with `plan.product` in the config, a plan repository's targets
// are the product's repository links on the Omni page, read through `GET /api/products/targets`, in
// the shape `plan.targets` gives them: `repo`, `role`, `knowledge`, `readAt`, `readOnly` and `consumes`
// (short names, as the config writes them).
//
// - A link with no role is refused by name: `<repo> has no role in product <name>: set it on the
//   product page`. A reply of any other shape is refused, naming the product.
// - Each read is kept in `.omni-loop/local/product-targets.json` (`{ product, readAt, targets }`), in
//   the checkout it is given, ignored by the local folder's own `.gitignore`. When the server cannot be
//   reached (no answer within the client's 5 seconds, or a 5xx), the copy is read instead, said by
//   `lastReadLine`; with no copy for this product, the read stops with
//   `no targets: the server is unreachable and nothing was read yet`.
// - A refusal (a 4xx: no sign-in, not a member, no such product) is never hidden behind the copy: the
//   read stops with the server's reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { TARGET_KNOWLEDGE } from '../config.ts';
import type { Config } from '../types.ts';

/** One target, as `plan.targets` holds it. */
export type ProductTarget = NonNullable<Config['plan']>['targets'][number];

export const PRODUCT_TARGETS_FILE = join(LOCAL_DIR, 'product-targets.json');

const SLUG = /^[\w.-]+\/[\w.-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;

/** One link of the reply: `consumes` names whole `owner/name` slugs. */
export const ProductLinkSchema = z.object({
  repo: z.string().regex(SLUG),
  role: z.string().min(1).nullable(),
  knowledge: z.enum(TARGET_KNOWLEDGE),
  readAt: z.string().regex(COMMIT).nullable(),
  readOnly: z.boolean(),
  consumes: z.array(z.string().regex(SLUG)),
});

/** `GET /api/products/targets?repo=<owner/name>&product=<name>`'s reply. Shared with the app's contract. */
export const ProductTargetsSchema = z.object({
  product: z.object({ name: z.string().min(1) }),
  targets: z.array(ProductLinkSchema),
});
export type ProductTargetsReply = z.infer<typeof ProductTargetsSchema>;

const TargetSchema = z.object({
  repo: z.string().regex(SLUG),
  role: z.string().min(1),
  knowledge: z.enum(TARGET_KNOWLEDGE),
  readAt: z.string().regex(COMMIT).nullable(),
  readOnly: z.boolean(),
  consumes: z.array(z.string()),
});

const CopySchema = z.object({
  product: z.string(),
  readAt: z.iso.datetime(),
  targets: z.array(TargetSchema),
});

/** What a read gives: the targets, and whether they came from the server or the last copy. */
export type ProductTargetsRead = { from: 'server'; targets: ProductTarget[] } | { from: 'copy'; readAt: string; targets: ProductTarget[] };

const NOTHING_READ = 'no targets: the server is unreachable and nothing was read yet';

const shortName = (slug: string): string => slug.slice(slug.indexOf('/') + 1);

/** The reply's links as `plan.targets` entries, in its order; throws, naming the product, on a link
 * with no role or a reply of another shape. */
export function targetsOfProduct(reply: unknown, product: string): ProductTarget[] {
  const parsed = ProductTargetsSchema.safeParse(reply);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`the server answered no targets for product ${product}: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'out of shape'}`);
  }
  return parsed.data.targets.map(({ repo, role, knowledge, readAt, readOnly, consumes }) => {
    if (role === null) throw new Error(`${repo} has no role in product ${product}: set it on the product page`);
    return { repo, role, knowledge, readAt, readOnly, consumes: consumes.map(shortName) };
  });
}

/** The copy kept for `product` under `root`, or null when there is none for it. */
function readCopy(root: string, product: string): { readAt: string; targets: ProductTarget[] } | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, PRODUCT_TARGETS_FILE), 'utf8'));
  } catch {
    return null;
  }
  const kept = CopySchema.safeParse(value);
  return kept.success && kept.data.product === product ? { readAt: kept.data.readAt, targets: kept.data.targets } : null;
}

function writeCopy(root: string, copy: { product: string; readAt: string; targets: ProductTarget[] }): void {
  ensureLocalDir(root);
  writeFileSync(join(root, PRODUCT_TARGETS_FILE), `${JSON.stringify(copy, null, 2)}\n`);
}

/** Whether a failed call means the server did not answer: no reply in time, or a failure on its side. */
const unanswered = (error: AskCallError): boolean => error.status === null || error.status >= 500;

/**
 * `product`'s targets: the server's (`fetchTargets` calls it), kept under `root` at `now`, or the last
 * copy when the server does not answer. Throws with the one line to print otherwise.
 */
export async function productTargets({ product, root, now, fetchTargets }: {
  product: string;
  root: string;
  now: () => Date;
  fetchTargets: () => Promise<unknown>;
}): Promise<ProductTargetsRead> {
  let reply: unknown;
  try {
    reply = await fetchTargets();
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    if (unanswered(error)) {
      const copy = readCopy(root, product);
      if (copy === null) throw new Error(NOTHING_READ);
      return { from: 'copy', ...copy };
    }
    throw new Error(`the server refused the targets of product ${product} (${error.status}): ${error.reason ?? error.message}`);
  }
  const targets = targetsOfProduct(reply, product);
  writeCopy(root, { product, readAt: now().toISOString(), targets });
  return { from: 'server', targets };
}

/** The line that says the targets are the last read's, and when it was. */
export function lastReadLine(readAt: string): string {
  return `targets from the last read, ${readAt.slice(0, 10)} ${readAt.slice(11, 16)} UTC · server unreachable`;
}
