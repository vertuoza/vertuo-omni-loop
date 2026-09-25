// Code rewritten again and again (PRD 72, slice s4 builds it): every commit's patches, churn per file
// and per line range followed through the hunks, generated files and lockfiles left out, a file
// without a patch counted by its totals. Its findings are `churn:<path>` and
// `churn:<path>:<from>-<to>`; its thresholds are in `rules`.
//
// Until s4 builds it, it gathers nothing and finds nothing, and its section is left out.

/** @type {import('./index.mjs').Kind} */
export const churn = Object.freeze({
  id: 'churn',
  section: 'Churn',
  runs: Object.freeze(['merge']),
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
