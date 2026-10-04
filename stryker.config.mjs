// Mutation testing of the kit's delivery core (PRD 1072): the code whose bugs would merge or block
// the wrong work. `pnpm mutation` runs it; the reports land in `reports/mutation/`, which git ignores.
export default {
  // The delivery core, tests excluded. The scope widens in later PRDs as the floors hold.
  mutate: [
    'kit/lib/outbox/**/*.ts',
    'kit/lib/policy/**/*.ts',
    'kit/lib/inbox/**/*.ts',
    'kit/lib/env/**/*.ts',
    'kit/lib/board.ts',
    'kit/lib/config.ts',
    'kit/lib/layout.ts',
    'kit/lib/ids.ts',
    '!kit/lib/**/*.test.ts',
  ],
  // Named, not globbed: under pnpm, Stryker's own folder cannot see its sibling plugins.
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  testRunner: 'vitest',
  // The repository's own vitest config; `related` (the runner's default) runs only the test files
  // that import a mutated file, those under `kit/bin` and `scripts/` included.
  vitest: { configFile: 'vitest.config.ts', related: true },
  // Per test: a mutant runs only the tests that reach it.
  coverageAnalysis: 'perTest',
  // A mutant that does not compile is left out of the score, never counted as survived.
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  // The sandbox is the whole repository less the reports and the worktrees: it carries
  // `kit/templates`, `kit/plugin` and the root `package.json`, which the kit finds through
  // `import.meta.url`, and the arcade's sources, which some kit tests read.
  ignorePatterns: ['reports', '.claude/worktrees'],
  reporters: ['progress', 'clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/mutation.html' },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
  // The tests spawn git and node, so their time varies with the machine's load: a mutant gets 10 s
  // beyond its tests' measured time before it counts as timed out.
  timeoutMS: 10_000,
};
