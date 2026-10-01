// Many tests build real git repositories and run `node` and `git` as child processes, so their wall
// time grows with the machine's load: a test that takes 1 s on a quiet machine takes 20 s beside a
// full suite and other work. The limits catch a hang, not slowness, so they are one generous value for
// the whole suite, and no test sets its own (kit/test/test-timeouts.test.mjs holds that) (#570).
export const TEST_TIMEOUT_MS = 120_000;

export default {
  test: {
    // Every folder runs `*.test.ts` beside `*.test.mjs` (PRD 725): the rename turns one into the other.
    include: ['game/**/*.test.{mjs,ts}', 'kit/**/*.test.{mjs,ts}', 'packages/**/*.test.{mjs,ts}', 'apps/omni-app/**/*.test.{mjs,ts}', 'apps/*/src/**/*.test.ts', '.claude/hooks/**/*.test.{mjs,ts}', 'scripts/**/*.test.{mjs,ts}'],
    exclude: ['**/node_modules/**'],
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: TEST_TIMEOUT_MS,
  },
};
