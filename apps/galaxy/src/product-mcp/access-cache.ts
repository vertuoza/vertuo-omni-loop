// What product_mcp_for_key() answered for a key and a product, kept a short while in this server (bug #2954).
// An agent session sends many requests (initialize, the tool list, each call), and each used to rebuild the
// whole answer in the database: the product, its repositories, the law home and its knowledge. Now a key's
// access is built once a minute at most, per key and product. A member's kit sign-in (PRD 3007 s1) is kept the
// same way in a cache of its own, per person and product.
//
// - **By the hash, never the key** (L-GDPR-2): the entry's id is the key's SHA-256 the route already computes,
//   or the signed-in person's id, never their token; and nothing here is logged.
// - **Only what was served.** A refusal is never kept, so a key just made, or a server just turned on, works on
//   its next call.
// - **Never trusted alone.** The service checks a kept access against the database on every call before it
//   serves it (product-mcp.service.ts): the key still works (or the person is still a member), the product is
//   still on, and each repository's newest pack is still the one kept. The minute only bounds how old the rest
//   may be: the product's name, its repositories, the law home, the Legal entries and the Glossary.
// - **Bounded.** At most `max` entries; the oldest goes first.
import type { AccessRow } from './access-row';

/** How long a served access is kept: a minute (bug #2954). */
export const ACCESS_TTL_MS = 60_000;

/** How many accesses one server keeps at most. */
const MAX_KEPT = 500;

export type AccessCacheOptions = { ttlMs?: number; max?: number; now?: () => number };

/** The accesses kept for each caller (a key's hash, or a person's id) and product. */
export type AccessCache<T = AccessRow> = {
  /** The access kept for the caller `id` and the product `key`, or null once it is a minute old. */
  get(id: string, key: string): T | null;
  /** Keeps `access` for a minute, dropping the oldest entry when full. */
  put(id: string, key: string, access: T): void;
  /** Forgets the access kept for that caller and product. */
  drop(id: string, key: string): void;
  /** How many accesses are kept now. */
  size(): number;
};

export function accessCache<T = AccessRow>({ ttlMs = ACCESS_TTL_MS, max = MAX_KEPT, now = Date.now }: AccessCacheOptions = {}): AccessCache<T> {
  const kept = new Map<string, { access: T; until: number }>();
  const idOf = (id: string, key: string): string => `${id}/${key}`;

  return {
    get(id, key) {
      const at = idOf(id, key);
      const entry = kept.get(at);
      if (entry === undefined) return null;
      if (now() < entry.until) return entry.access;
      kept.delete(at);
      return null;
    },

    put(id, key, access) {
      const at = idOf(id, key);
      kept.delete(at);
      if (kept.size >= max) {
        const oldest = kept.keys().next();
        if (oldest.done !== true) kept.delete(oldest.value);
      }
      kept.set(at, { access, until: now() + ttlMs });
    },

    drop(id, key) {
      kept.delete(idOf(id, key));
    },

    size: () => kept.size,
  };
}
