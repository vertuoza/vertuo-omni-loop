// What product_mcp_for_key() answered for a key and a product, kept a short while in this server (bug #2954).
// An agent session sends many requests (initialize, the tool list, each call), and each used to rebuild the
// whole answer in the database: the product, its repositories, the law home and its knowledge. Now a key's
// access is built once a minute at most, per key and product.
//
// - **By the hash, never the key** (L-GDPR-2): the entry's id is the key's SHA-256 the route already computes,
//   and nothing here is logged.
// - **Only what was served.** A refusal is never kept, so a key just made, or a server just turned on, works on
//   its next call.
// - **Never trusted alone.** The service checks a kept access against the database on every call before it
//   serves it (product-mcp.service.ts): the key still works, the product is still on, and each repository's
//   newest pack is still the one kept. The minute only bounds how old the rest may be: the product's name, its
//   repositories, the law home, the Legal entries and the Glossary.
// - **Bounded.** At most `max` entries; the oldest goes first.
import type { AccessRow } from './access-row';

/** How long a served access is kept: a minute (bug #2954). */
export const ACCESS_TTL_MS = 60_000;

/** How many accesses one server keeps at most. */
const MAX_KEPT = 500;

export type AccessCacheOptions = { ttlMs?: number; max?: number; now?: () => number };

export function accessCache({ ttlMs = ACCESS_TTL_MS, max = MAX_KEPT, now = Date.now }: AccessCacheOptions = {}) {
  const kept = new Map<string, { access: AccessRow; until: number }>();
  const idOf = (hash: string, key: string): string => `${hash}/${key}`;

  return {
    /** The access kept for the key whose SHA-256 is `hash` and the product `key`, or null once it is a minute old. */
    get(hash: string, key: string): AccessRow | null {
      const id = idOf(hash, key);
      const entry = kept.get(id);
      if (entry === undefined) return null;
      if (now() < entry.until) return entry.access;
      kept.delete(id);
      return null;
    },

    /** Keeps `access` for a minute, dropping the oldest entry when full. */
    put(hash: string, key: string, access: AccessRow): void {
      const id = idOf(hash, key);
      kept.delete(id);
      if (kept.size >= max) {
        const oldest = kept.keys().next();
        if (oldest.done !== true) kept.delete(oldest.value);
      }
      kept.set(id, { access, until: now() + ttlMs });
    },

    /** Forgets the access kept for that key and product. */
    drop(hash: string, key: string): void {
      kept.delete(idOf(hash, key));
    },

    /** How many accesses are kept now. */
    size: (): number => kept.size,
  };
}

export type AccessCache = ReturnType<typeof accessCache>;
