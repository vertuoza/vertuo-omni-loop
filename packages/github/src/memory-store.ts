// The client's store in memory (PRD 902, s1): the tests' store, and the shape every store follows.
// Times are epoch milliseconds.
import type { GithubStore, StoredBudget, StoredEtag } from './client.ts';

export function memoryGithubStore(): GithubStore {
  const etags = new Map<string, StoredEtag>();
  const budgets = new Map<string, StoredBudget>();
  const key = (installation: number, what: string) => `${installation} ${what}`;
  return {
    /** The stored ETag of (installation, url), or null. */
    etag(installation, url) {
      return Promise.resolve(etags.get(key(installation, url)) ?? null);
    },
    saveEtag(installation, url, { etag, body, contentType = null, at }) {
      etags.set(key(installation, url), { etag, body, contentType, readAt: at });
      return Promise.resolve();
    },
    /** A stored ETag answered a 304 at `at`. */
    touchEtag(installation, url, at) {
      const kept = etags.get(key(installation, url));
      if (kept) kept.readAt = at;
      return Promise.resolve();
    },
    /** The budget of (installation, resource), or null. */
    budget(installation, resource) {
      return Promise.resolve(budgets.get(key(installation, resource)) ?? null);
    },
    /** What an answer reported; a pause already set is kept. */
    saveBudget(installation, resource, { limit, remaining, resetAt, at }) {
      const kept = budgets.get(key(installation, resource));
      budgets.set(key(installation, resource), { limit, remaining, resetAt, pausedUntil: kept?.pausedUntil ?? null, updatedAt: at });
      return Promise.resolve();
    },
    pause(installation, resource, until, at) {
      const kept = budgets.get(key(installation, resource));
      budgets.set(key(installation, resource), {
        limit: kept?.limit ?? 0, remaining: kept?.remaining ?? 0, resetAt: kept?.resetAt ?? until, pausedUntil: until, updatedAt: at,
      });
      return Promise.resolve();
    },
  };
}
