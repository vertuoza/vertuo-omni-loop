// The client's store in memory (PRD 902, s1): the tests' store, and the shape every store follows.
// Times are epoch milliseconds.

export function memoryGithubStore() {
  const etags = new Map();
  const budgets = new Map();
  const key = (installation, what) => `${installation} ${what}`;
  return {
    /** The stored ETag of (installation, url): { etag, body, contentType, readAt }, or null. */
    async etag(installation, url) {
      return etags.get(key(installation, url)) ?? null;
    },
    async saveEtag(installation, url, { etag, body, contentType = null, at }) {
      etags.set(key(installation, url), { etag, body, contentType, readAt: at });
    },
    /** A stored ETag answered a 304 at `at`. */
    async touchEtag(installation, url, at) {
      const kept = etags.get(key(installation, url));
      if (kept) kept.readAt = at;
    },
    /** The budget of (installation, resource): { limit, remaining, resetAt, pausedUntil, updatedAt }, or null. */
    async budget(installation, resource) {
      return budgets.get(key(installation, resource)) ?? null;
    },
    /** What an answer reported; a pause already set is kept. */
    async saveBudget(installation, resource, { limit, remaining, resetAt, at }) {
      const kept = budgets.get(key(installation, resource));
      budgets.set(key(installation, resource), { limit, remaining, resetAt, pausedUntil: kept?.pausedUntil ?? null, updatedAt: at });
    },
    async pause(installation, resource, until, at) {
      const kept = budgets.get(key(installation, resource));
      budgets.set(key(installation, resource), {
        limit: kept?.limit ?? 0, remaining: kept?.remaining ?? 0, resetAt: kept?.resetAt ?? until, pausedUntil: until, updatedAt: at,
      });
    },
  };
}
