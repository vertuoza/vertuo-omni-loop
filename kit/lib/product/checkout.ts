// The product a checkout remembers (PRD 1548, s11): `/omni:mega-brainstorm --product <key>` runs from
// any kitted checkout of a repository the product holds, and the checkout remembers the product it was
// last run for, so a later run, or `/omni:ultra-yolo`, need not be told again.
//
// - `.omni-loop/local/product.json` holds `{ key, usedAt }`, in the checkout it is given (the command
//   hands it the main checkout, so every worktree reads the same), ignored by the local folder's own
//   `.gitignore`. `omni product use <key>` writes it and `omni product which` reads it.
// - A key is what a product PRD id starts with: lowercase kebab-case, each part starting with a
//   letter, at most 40 characters (`../ids.ts`). It is checked by building an id from it, so the two
//   rules are one. The server alone says whether the key names a product the caller reads.
// - A file that is missing, half-written, of another shape or holding no key reads as nothing
//   remembered.
//
// `phase0Line` is the one line a target's phase-0 flag prints for a product PRD: every target of one is
// `phase0: server`, and a target on `pr` is refused by name, with acceptance 10's line.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { FlagReading } from '../approval/flag.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';
import { ProductPrdIdSchema } from '../ids.ts';

export const PRODUCT_FILE = join(LOCAL_DIR, 'product.json');

/** Whether `key` may key a product: whether `<key>-1` reads as a product PRD id. */
export const isProductKey = (key: string): boolean => ProductPrdIdSchema.safeParse(`${key}-1`).success;

const RememberedSchema = z.object({
  key: z.string().refine(isProductKey),
  usedAt: z.iso.datetime(),
});

/** The product a checkout remembers, and when it was named. */
export type Remembered = z.infer<typeof RememberedSchema>;

/** Remembers `key` in the checkout at `root`, at `now`; throws, writing nothing, on a key that is not one. */
export function rememberProduct(root: string, key: string, now: Date): Remembered {
  if (!isProductKey(key)) throw new Error(`not a product key: ${key} (lowercase kebab-case, as mobile)`);
  const remembered = { key, usedAt: now.toISOString() };
  ensureLocalDir(root);
  writeFileSync(join(root, PRODUCT_FILE), `${JSON.stringify(remembered, null, 2)}\n`);
  return remembered;
}

/** The product the checkout at `root` remembers, or null. */
export function rememberedProduct(root: string): Remembered | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, PRODUCT_FILE), 'utf8'));
  } catch {
    return null;
  }
  const parsed = RememberedSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** What `repo`'s phase-0 flag says for a product PRD: through on `server`, refused by name on `pr`, and
 * held, saying why, when the flag could not be read. */
export function phase0Line(repo: string, { flag, why }: FlagReading): { ok: boolean; line: string } {
  if (why !== null) return { ok: false, line: `${repo}: its phase0 could not be read: ${why}` };
  if (flag === 'server') return { ok: true, line: `${repo} is phase0: server` };
  return { ok: false, line: `${repo} is phase0: pr · switch it to server on its Omni page, or leave it out` };
}
