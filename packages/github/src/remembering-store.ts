// The client's store with a memory in front (#2953): every GitHub read asked the database for its ETag
// and wrote the whole body back after each 200, two or three round-trips per GitHub request. The memory
// is one server instance's, bounded (least recently used out first), by installation and URL; the store
// it wraps (Supabase) stays the layer every instance shares.
//
// - An ETag in memory is answered without the database. One older than the shared row is still right:
//   its body is the one its ETag names, and GitHub checks the ETag. A URL with no stored ETag is
//   remembered too, so a body never stored (over its size, no ETag) is not looked up on every read.
// - A 200 that repeats the known body under another ETag (an ETag only matches the token that read it,
//   and each instance mints its own) keeps the new ETag in memory and writes nothing, save once a day,
//   so the sync's prune of ETags not read for 7 days (dropEtags) keeps the row.
// - The budget and the pause go through to the shared store untouched: another instance must see them.
import { TOUCH_EVERY_MS, type GithubStore, type StoredEtag } from './client.ts';

/** How much one instance remembers: this many URLs, and this many UTF-16 units of bodies in all. */
export interface EtagMemoryLimits { entries: number; bodyChars: number }
export const ETAG_MEMORY_LIMITS: EtagMemoryLimits = { entries: 2_000, bodyChars: 16 * 1024 * 1024 };

/** A bounded memory of ETags by key; `null` remembers a URL with no stored ETag, `undefined` is unknown. */
export interface EtagMemory {
  get(key: string): StoredEtag | null | undefined;
  set(key: string, value: StoredEtag | null): void;
}

/** A least-recently-used memory: a Map keeps its keys in the order they were set, the oldest first. */
export function etagMemory(limits: EtagMemoryLimits = ETAG_MEMORY_LIMITS): EtagMemory {
  const kept = new Map<string, StoredEtag | null>();
  let chars = 0;
  const sizeOf = (value: StoredEtag | null | undefined) => value?.body.length ?? 0;
  const drop = (key: string) => {
    chars -= sizeOf(kept.get(key));
    kept.delete(key);
  };
  return {
    get(key) {
      const value = kept.get(key);
      if (value === undefined) return undefined;
      kept.delete(key);
      kept.set(key, value);
      return value;
    },
    set(key, value) {
      drop(key);
      if (sizeOf(value) > limits.bodyChars) return;
      kept.set(key, value);
      chars += sizeOf(value);
      for (const oldest of kept.keys()) {
        if (kept.size <= limits.entries && chars <= limits.bodyChars) break;
        drop(oldest);
      }
    },
  };
}

const copy = (value: StoredEtag | null): StoredEtag | null => (value ? { ...value } : null);

/** `shared` with `memory` in front of its ETags. */
export function rememberingGithubStore(shared: GithubStore, memory: EtagMemory = etagMemory()): GithubStore {
  const keyOf = (installation: number, url: string) => `${String(installation)} ${url}`;
  return {
    async etag(installation, url) {
      const key = keyOf(installation, url);
      const known = memory.get(key);
      if (known !== undefined) return copy(known);
      const read = await shared.etag(installation, url);
      memory.set(key, copy(read));
      return read;
    },
    async saveEtag(installation, url, { etag, body, contentType = null, at }) {
      const key = keyOf(installation, url);
      const known = memory.get(key);
      if (known && known.body === body && known.contentType === contentType && at - known.readAt < TOUCH_EVERY_MS) {
        memory.set(key, { etag, body, contentType, readAt: known.readAt });
        return;
      }
      await shared.saveEtag(installation, url, { etag, body, contentType, at });
      memory.set(key, { etag, body, contentType, readAt: at });
    },
    async touchEtag(installation, url, at) {
      await shared.touchEtag(installation, url, at);
      const key = keyOf(installation, url);
      const known = memory.get(key);
      if (known) memory.set(key, { ...known, readAt: at });
    },
    budget: (...args) => shared.budget(...args),
    saveBudget: (...args) => shared.saveBudget(...args),
    pause: (...args) => shared.pause(...args),
  };
}
