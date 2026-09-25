// Checks red again and again (PRD 72, slice s3 builds it): check runs on every sub-PR commit, the
// tails of failed jobs' logs, repeated red, red then green on one commit, and failing tests named from
// Vitest, Jest, Playwright and pytest output. Its findings are `repeated-red:<check>`,
// `flaky:<check>` and `failing-test:<test>`; its thresholds are in `rules`.
//
// Until s3 builds it, it gathers nothing and finds nothing, and its section is left out.

/** @type {import('./index.mjs').Kind} */
export const ci = Object.freeze({
  id: 'ci',
  section: 'Checks',
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
