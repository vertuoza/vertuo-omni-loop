// Many tests build real git repositories and run `node` and `git` as child processes, so their wall
// time grows with the machine's load: a test that takes 1 s on a quiet machine takes 20 s beside a
// full suite and other work. The limits catch a hang, not slowness, so they are one generous value for
// the whole suite, and no test sets its own (kit/test/test-timeouts.test.mjs holds that) (#570).
export const TEST_TIMEOUT_MS = 120_000;

export default {
  test: {
    include: ['game/**/*.test.mjs', 'kit/**/*.test.mjs', 'packages/**/*.test.mjs', 'apps/omni-app/**/*.test.mjs', 'apps/*/src/**/*.test.ts', '.claude/hooks/**/*.test.mjs', 'scripts/**/*.test.mjs'],
    exclude: ['**/node_modules/**'],
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: TEST_TIMEOUT_MS,
  },
};
