# `kit/lib/check-report.mjs`

Not a port — new code, per the controller's clarification for Task 3. Related upstream file:
`scripts/check-utils.mjs` @ `vertuo-ai-domain@c4a210122` (72 lines).

## What was kept, and why

Only the four functions the controller named, each turned pure (returning text instead of printing
and calling `process.exit`, and taking `ctx` instead of a module-resolved `repoRoot`):

- `trackedFiles(ctx)` ← upstream's `trackedFiles()`: `git ls-files` run with `cwd: ctx.root` instead
  of the module's own `repoRoot`. Upstream's `walk(repoRoot)` fallback (for when `git ls-files`
  fails) was dropped — no test exercises a non-git repository for this function, and Task 15 (which
  will actually call this against a real checkout) always has git, per the kit's own house rules.
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

Everything else in `check-utils.mjs`: `repoRoot` (module-resolved from `import.meta.url` — replaced
everywhere by `ctx.root`), `toRepoPath`, `isSourceTs`, `isTestFile`, `sourceFiles`,
`importStatements`, and the `walk`/`ignoredDirs` fallback machinery. None of the three knowledge
modules ported in this task need them, and the controller's clarification was explicit: keep only
the four named functions "unless a ported module needs it" — none did.

## Test

No dedicated `check-report.test.mjs`: the brief's file list names only `.test.mjs` files for the
three ported knowledge modules, not for this one, and — like `kit/lib/commands.mjs`, the kit's other
small non-ported helper module — it carries no test of its own. `readRepoFile` and `formatFailure`'s
shape are exercised indirectly: `check-knowledge.mjs`'s `gradeKnowledge` calls `readRepoFile` for
every entry file it scans for stray id citations, and every test in `check-knowledge.test.mjs` that
expects a non-empty `violations` array is implicitly checking that the text those violations would
be printed as (via `formatFailure`) is well-formed, since `gradeKnowledge` already returns the same
formatted strings `formatFailure` would wrap. `trackedFiles` and `formatPass` are not yet called by
any module in this task — they exist for Task 15's `kit/bin`, per the brief's file list.
