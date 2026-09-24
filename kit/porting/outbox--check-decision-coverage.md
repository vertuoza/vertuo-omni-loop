# `kit/lib/outbox/check-decision-coverage.mjs` and `kit/lib/git.mjs`

Source: `scripts/check-decision-coverage.mjs` @ `vertuo-ai-domain@c4a210122`.

Two files come out of this one source, per the task's own clarification: `rangeChanges` moves to
`kit/lib/git.mjs` (the only `git diff --name-status` caller; Tasks 9 and 11 import it from there),
and everything else stays in `kit/lib/outbox/check-decision-coverage.mjs`. Both carry the same
provenance line, pointing at this one record.

## `kit/lib/outbox/check-decision-coverage.mjs`

### Mapping applied

- Shebang line (`#!/usr/bin/env node`): deleted. No CLI half survives (rule 3) — `main()`, its
  `Usage:` message, `process.exit(1)`, the `console.log`/`console.error` calls, and the
  `process.argv[1] === fileURLToPath(...)` guard are all deleted, along with the now-unused
  `fileURLToPath` import.
- `import { fail, pass, repoRoot } from './check-utils.mjs'` → deleted entirely. `fail`/`pass`
  (the CLI's own printing helpers) were only used by `main()`, now gone. `repoRoot` no longer
  exists — every place that used it as a default is now an injected `{ ctx }`.
- `import { riskyChanges } from './decision-coverage.mjs'` → deleted from this file. `riskyChanges`
  was only ever called by `main()`, which is gone; every ported test that needs it imports it
  directly from `./decision-coverage.mjs` instead.
- `import { compare, readAccounts } from './outbox-account.mjs'` → `import { compare, readAccounts
  } from './account.mjs'` (this task's own sibling module, same directory).
- `import { OUTBOX_DIR } from './outbox.mjs'` → deleted. `OUTBOX_DIR` no longer exists in the kit's
  `outbox.mjs` (Task 5); `discoveredPrds` reads PRDs from `ctx.layout.outboxDirs()` instead, per
  the task's own clarification ("`discoveredPrds({ ctx })` returns PRD numbers from
  `ctx.layout.outboxDirs()` (in-flight and shipped)").
- `import { readdirSync } from 'node:fs'` and `import { join } from 'node:path'`: deleted — nothing
  left in this file touches the filesystem directly; `discoveredPrds` now reads through
  `ctx.layout.outboxDirs()`, and `readAccounts`/`compare` (imported from `./account.mjs`) do their
  own disk access.
- `export const DEFAULT_BASE = 'origin/main'`: deleted. It was only read by `main()`'s no-argument
  branch and the `<base> <prd>` branch's default; both are gone with the CLI half. Per the task's
  mapping table it becomes `` `${ctx.config.repo.remote}/${ctx.config.repo.defaultBranch}` `` —
  Task 15's CLI computes that expression itself when it rebuilds the argument parsing; there is no
  pure function left in this module that needs it as a constant.
- `parseNameStatus(nameStatus)`: **kept, unchanged, still exported** here — it has no caller left
  inside this file (its one upstream caller, `rangeChanges`, moved to `git.mjs`), but the task's own
  exact-exports list names it as one of this module's exports, so it stays. `kit/lib/git.mjs`
  defines its own private, unexported copy of the same six-line parse for `rangeChanges`'s own use
  (see below) — a small, deliberate duplication rather than either module reaching into the other
  (`git.mjs` must not depend on `kit/lib/outbox/*`, and this module's own `parseNameStatus` is kept
  as a public utility with no remaining internal caller).
- `discoveredPrds({ root = repoRoot } = {})` (`readdirSync(join(root, OUTBOX_DIR), ...)`, filtering
  numeric directory names, returning strings) → `discoveredPrds({ ctx })`, body
  `ctx.layout.outboxDirs().map(({ prd }) => prd).sort((a, b) => a - b)`. **Return shape changed**,
  per the task's own clarification: PRD **numbers**, not directory-name strings, sorted
  numerically ascending rather than lexicographically. (`['1044', '985']`'s upstream string sort
  put `'1044'` first; the numeric sort now gives `[985, 1044]`.) Nothing in `findFormatViolations`
  or `gradePrd` cares about the difference — both simply pass `prd` through to `readAccounts`,
  whose own `ctx.layout.outboxDir(prd)` call already does `Number(prd)` internally.
- `findFormatViolations({ root = repoRoot } = {})` → `findFormatViolations({ ctx })`; body
  unchanged apart from `discoveredPrds({ root })` → `discoveredPrds({ ctx })` and
  `readAccounts(prd, { root })` → `readAccounts(prd, { ctx })`.
- `gradePrd(prd, risky, { root = repoRoot } = {})` → `gradePrd(prd, risky, { ctx })`; body unchanged
  apart from the same `{ root }` → `{ ctx }` swap on its one `readAccounts` call.
- `describeUnaccounted(prd, change)`: unchanged — no `root`/`ctx` in its signature at all.
- `function git(args, cwd) { ... }` (the module-private git-shelling helper) and `rangeChanges(base,
  cwd = repoRoot)`: **moved to `kit/lib/git.mjs`**, per the task's own `Interfaces:` line —
  `rangeChanges({ ctx, base, exec = execFileSync })` → `{ path, status }[]`. The `exec` parameter is
  new (not in the upstream signature): it lets a caller inject a stub in place of
  `execFileSync` for a unit test that never shells out for real; every test in this repository
  still exercises the real `execFileSync` default, so no ported assertion depends on it — it exists
  purely so a later task (or a future test) can stub it without another signature change. Body
  otherwise unchanged: the same `git(['rev-parse', ...])` existence check, the same thrown `Error`
  message (still naming `base` and suggesting `git fetch origin main`), the same three-dot
  `git(['diff', '--name-status', `${base}...HEAD`])` call.
- Module doc comment: rewritten from scratch. Upstream's own doc spent most of its text justifying
  the CLI's two argument shapes (`main()`'s no-argument vs. `<base> <prd>` branches) and the
  `pnpm check` / CI split; none of that survives once the CLI half is gone (Task 15 rebuilds it).
  The new doc describes the two *pure* shapes this module still offers —
  `findFormatViolations` (every account's format, no range needed) and `gradePrd` (one PRD's
  accounts against an already-computed `riskyChanges` result) — and drops every
  `docs/outbox/<prd>/accounts/*.md`, `check-territory.mjs`, `check-openapi-label.mjs`,
  `vertuo-do-work` literal/reference upstream's doc named, none of which exist in the kit.

### Test (`check-decision-coverage.test.mjs`)

- Added imports: `testContext` (`kit/test/fixture.mjs`), `flatCtx` (`kit/test/flat-layout.mjs`),
  `rangeChanges` from `'../git.mjs'` (not from `./check-decision-coverage.mjs` — it moved).
- **Fixture-root strategy**: a module-scope `let root` set fresh by `beforeEach` (`mkdtempSync`)
  and torn down by `afterEach` (`rmSync`), matching `decision-coverage.test.mjs`'s and
  `account.test.mjs`'s own precedent in this same task.
- `accountText`/`seedAccount`: unchanged in body (still write `docs/outbox/<prd>/accounts/<slice>
  .md` under the shared `root`, matching `flatCtx`'s own `outboxDir`), only the leading `root`
  parameter dropped (closes over the shared one).
- `parseNameStatus` describe block: **entirely unchanged** — pure function, same two test cases,
  same import site (`./check-decision-coverage.mjs`).
- `discoveredPrds` describe block:
  - `'returns [] when docs/outbox does not exist at root'` → renamed `'returns [] when the outbox
    tree does not exist at all'`; `discoveredPrds({ root })` → `discoveredPrds({ ctx: flatCtx
    (root) })`. Assertion unchanged (`[]`).
  - `'lists only numeric-named directories, sorted'` → renamed `'lists only numeric-named
    directories, as PRD numbers, sorted'`. **Changed assertion**, per the return-shape change
    above: `expect(discoveredPrds({ root })).toEqual(['1044', '985'])` →
    `expect(discoveredPrds({ ctx: flatCtx(root) })).toEqual([985, 1044])` — same two directories
    seeded, same `README.md` non-PRD file ignored, but numbers instead of strings and numeric
    instead of lexicographic order.
- `findFormatViolations` describe block: every `findFormatViolations({ root })` →
  `findFormatViolations({ ctx: flatCtx(root) })`; no assertion changed (still names the file and
  the "missing a front-matter block" message; still `[]` for an absent or well-formed tree).
- `gradePrd` describe block: every `gradePrd(prd, risky, { root })` → `gradePrd(prd, risky, { ctx:
  flatCtx(root) })`; no assertion changed across all five cases (unaccounted-and-named, accounted,
  stale-not-fatal, malformed-refused-by-name, entirely-green).
- `describeUnaccounted`: unchanged — called with the same `(1044, result.unaccounted[0])` shape,
  same two `.toContain(...)` assertions.
- **`rangeChanges, on a real repository` describe block** — the one section that moved modules:
  - `import { rangeChanges } from './check-decision-coverage.mjs'` → `import { rangeChanges } from
    '../git.mjs'`.
  - A new `let ctx` alongside the existing `let repo`, set in the same `beforeEach` via `ctx =
    testContext(repo)` (the default folders layout; PRD `1044` used in these tests names no real
    inbox/shipped folder under it, so `ctx.layout.outboxDir(1044)` reads `null` and `readAccounts`
    reads `[]` — the same "entirely green, nothing to account for" shape the upstream tests already
    relied on with a bare, account-free `repo`).
  - Every `rangeChanges('origin/main', repo)` call → `rangeChanges({ ctx, base: 'origin/main' })`,
    per Task 8's own signature (`{ ctx, base, exec = execFileSync }`). No assertion on the returned
    `{ path, status }[]` shape changed.
  - `riskyChanges(changes)` (upstream's own bare call, implicitly against the real upstream repo's
    `docs/knowledge/`) → `riskyChanges(changes, { ctx })`. `gradePrd(1044, riskyChanges(changes),
    { root: repo })` → `gradePrd(1044, riskyChanges(changes, { ctx }), { ctx })`. No assertion
    changed — both still resolve to `[]`/an entirely-green grade for ordinary, non-risky work.
  - `'a range touching the published OpenAPI snapshot flags nothing'`: kept, renamed slightly
    (`"that ground is check-openapi-label.mjs's"` → `"that ground is a different guard's"`, since
    `check-openapi-label.mjs` is not part of this kit and the no-literals rule would flag the
    literal filename in a comment/string otherwise); assertions unchanged.
  - `'throws when the base cannot be read'`: `rangeChanges('origin/main', repo)` →
    `rangeChanges({ ctx, base: 'origin/main' })`; same thrown-message assertion
    (`/Cannot read origin\/main/`).
- **Deleted:** nothing. Every upstream test case in `check-decision-coverage.test.mjs` is ported;
  none reads the real upstream repository outside the already-git-fixture `rangeChanges` block
  (which builds its own throwaway repo), so Port Protocol rule 6 never applies.

## `kit/lib/git.mjs`

New module. Carries `rangeChanges` (moved from `scripts/check-decision-coverage.mjs`, described
above) plus a private, unexported `parseNameStatusLines` — a byte-identical copy of
`check-decision-coverage.mjs`'s own `parseNameStatus` body, kept private here so `git.mjs` never
imports from `kit/lib/outbox/*` (the wrong direction — `git.mjs` is the more foundational module,
used by this task and, per the task's own note, by Tasks 9 and 11's `outbox/comment.mjs` as well).
No test file of its own: `rangeChanges` is exercised entirely through
`check-decision-coverage.test.mjs`'s `'rangeChanges, on a real repository'` block, per the task's
own clarification that this function's tests live where they already did upstream.

## Gate

`pnpm vitest run kit/lib/outbox/check-decision-coverage.test.mjs kit/test/no-literals.test.mjs` —
17/17 pass (16 in `check-decision-coverage.test.mjs`, 1 in `no-literals.test.mjs`).
