// Fourteen days later (PRD 72, slice s8 builds it): the `bug` issues naming the PRD within the days
// after the merge, the churn ranges their fixes touched, and the merge commit's checks. Its findings
// carry the kind `bug`; it takes part only in the day-14 run, and its section closes `retro.md`.
//
// Until s8 builds it, it gathers nothing and finds nothing, and its section is left out.

/** @type {import('./index.mjs').Kind} */
export const afterMerge = Object.freeze({
  id: 'after-merge',
  section: 'After merge',
  runs: Object.freeze(['day-14']),
  async gather() {
    return null;
  },
  detect() {
    return { facts: null, findings: [] };
  },
  describe() {
    return null;
  },
});
