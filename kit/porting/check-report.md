# `kit/lib/check-report.mjs`

Source: `scripts/check-utils.mjs` @ `vertuo-ai-domain@c4a210122` (72 lines). A reduced port, per the
controller's clarification for Task 3: only four of upstream's functions are kept, each turned pure.

## What was kept, and how it changed

- `trackedFiles(ctx)` ← upstream's `trackedFiles()`: `git ls-files` run with `cwd: ctx.root` instead
  of the module's own `repoRoot`.
- `readRepoFile(ctx, path)` ← upstream's `readRepoFile(path)`: same body, `ctx.root` instead of
  `repoRoot`.
- `formatFailure(title, violations)` ← upstream's `fail(title, violations)`: instead of
  `console.error(...)` + `process.exit(1)`, returns the same two-part text (`title` then every
  violation indented two spaces) as one string, or `''` when `violations` is empty. `kit/bin`
  (Task 15) decides what an empty string means for the exit code.
- `formatPass(message)` ← upstream's `pass(message)`: instead of `console.log(message)`, returns
  `message` unchanged. Kept as a named function (not just using the string directly) so `kit/bin`
  has one symmetric pair to call regardless of outcome, matching the brief's produces list.

## What was dropped

- `repoRoot` (module-resolved from `import.meta.url`): replaced everywhere it was used by `ctx.root`,
  per the Port Protocol's "context, not root" rule.
- `walk(dir, files)` / `ignoredDirs` and `toRepoPath(path)` — the non-git fallback `trackedFiles()`
  used when `git ls-files` fails (walking the filesystem by hand, skipping `.git`/`.turbo`/
  `coverage`/`dist`/`node_modules`). Dropped, not carried into `trackedFiles(ctx)`: the kit requires
  git (`kit/lib/context.mjs`'s `loadContext` already throws when `cwd` is not inside a git
  repository), so a repository this function would ever run against always has `git ls-files`
  available — the fallback has no reachable case to cover.
- `isSourceTs(path)`, `isTestFile(path)`, `sourceFiles(predicate)` — TypeScript-source-file helpers
  specific to `vertuo-ai-domain`'s own guards (e.g. its Zod-first check); no ported module in this
  task, nor any module the brief describes for later tasks, filters files by `.ts`/`.spec.tsx?`.
- `importStatements(source)` — an import-statement scanner used by upstream's own import-hygiene
  guards; no equivalent guard exists yet in the kit.

## Test

No dedicated `check-report.test.mjs`: the brief's file list names only `.test.mjs` files for the
three ported knowledge modules, not for this one, and — like `kit/lib/commands.mjs`, the kit's other
small helper module with no test of its own — it carries none either. `readRepoFile` and
`formatFailure`'s shape are exercised indirectly: `check-knowledge.mjs`'s `gradeKnowledge` calls
`readRepoFile` for every entry file it scans for stray id citations, and every test in
`check-knowledge.test.mjs` that expects a non-empty `violations` array is implicitly checking that
the text those violations would be printed as (via `formatFailure`) is well-formed, since
`gradeKnowledge` already returns the same formatted strings `formatFailure` would wrap.
`trackedFiles` and `formatPass` are not yet called by any module in this task — they exist for
Task 15's `kit/bin`, per the brief's file list.
