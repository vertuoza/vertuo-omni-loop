// How the delivery went (PRD 72, slice s5 builds it): territory breaches through the kit's
// `breaches`, needs-fix and stuck slices and second claims, decisions from the settled file (drift,
// rework, a merge under the override label), and review findings left red or unresolved at merge. Its
// findings carry the kinds `territory`, `friction`, `drift`, `override` and `review`.
//
// Until s5 builds it, it gathers nothing and finds nothing, and its section is left out. The PRD's
// plan and settled file are already in the context `qualify` hands every kind.

/** @type {import('./index.mjs').Kind} */
export const delivery = Object.freeze({
  id: 'delivery',
  section: 'Decisions',
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
