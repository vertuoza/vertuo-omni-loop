# `kit/bin/commands/*.mjs` (and `kit/bin/args.mjs`)

Every upstream script's CLI half (`if (process.argv[1] === fileURLToPath(import.meta.url)) { … }`,
plus its `main`/`parseArgs`/`USAGE`), deleted from the library ports by the Port Protocol, rebuilt as
one `omni` subcommand each. Source sha: `vertuo-ai-domain@c4a210122`.

| Command file | Upstream CLI half |
|---|---|
| `status.mjs` | `scripts/outbox-status.mjs` (`parseArgs`, `main`) |
| `settle.mjs` | `scripts/outbox-settle.mjs` (`parseArgv`, `main`, settle branch) |
| `adopt.mjs` | `scripts/outbox-settle.mjs` (`main`, `adopt` branch) |
| `replies.mjs` | `scripts/outbox-replies.mjs` (CLI block) |
| `comment.mjs` | `scripts/outbox-comment.mjs` (CLI block) |
| `knowledge.mjs` | `scripts/knowledge.mjs` (`main`) |
| `check.mjs` | `scripts/check-inbox.mjs`, `check-outbox.mjs`, `check-registers.mjs`, `check-decision-coverage.mjs` (`main`s) |
| `config.mjs`, `prd.mjs`, `ship.mjs` | new (no upstream CLI) |

## Changes common to every command

- `process.exit(n)` / `console.log` / `console.error` → the command returns the exit code and writes to
  the `stdout` / `stderr` `main` hands it. Exit codes: 0 ok, 1 red, 2 usage (`UsageError`) or config.
- Flag parsing: every command names the flags its upstream CLI half read, through one strict parser
  (`kit/bin/args.mjs`). Upstream silently ignored an unknown flag; here it is a `UsageError` (exit 2,
  one line), per the task's ruling. A value flag with no value is also a `UsageError`.
- `--repo` defaults to `ctx.config.repo.slug` (upstream: `DEFAULT_REPO`, a repository literal).
- `--root <dir>` (settle/adopt) dropped: the root is `ctx.root`. Every path argument (`<item-file>`,
  `--answer-file`, `--result`, `--slack-note`, `--pr-comment`, the adopt text file) resolves against
  `ctx.root`.
- Messages say `omni <command>` instead of `outbox-settle` / `outbox-comment` / `check:inbox` …, and
  name `ctx.layout.knowledgeRoot` instead of the upstream knowledge path. The library-produced report
  lines (`formatReport`'s `outbox-status — …`, `summarize`'s `outbox-replies: …`) are unchanged.

## Per command

- **status**: upstream's `branchChanges(base)` (a private copy of the range diff, `--no-renames`) →
  `kit/lib/git.mjs`'s `rangeChanges({ ctx, base, exec })`, the kit's one range diff. It passes
  `--no-renames` exactly as upstream did (outbox-status.mjs and outbox-comment.mjs): since git 2.9 a
  bare `git diff` detects renames, and an `R` would let a `git mv` of a test file escape the
  `test-removed` rule. Pinned by `kit/lib/git.test.mjs`. New `--changes` flag (the brief's table):
  shorthand for `--base <repo.remote>/<repo.defaultBranch>`. An unreadable base is a `UsageError`
  (exit 2) instead of an uncaught throw. `$GITHUB_OUTPUT` / `$GITHUB_STEP_SUMMARY` appends kept, read
  from the `env` `main` is given (default `process.env`). A missing `<prd>` is exit 2 (upstream: 1).
- **settle / adopt**: `adopt` is its own command (`omni adopt <file>`) rather than `outbox-settle adopt`.
  Giving both `--answer` and `--answer-file` is now a usage error (upstream silently preferred the file).
- **replies**: `ghClient` → `githubClientFor` (`kit/bin/github.mjs`), which adds the `github.user`
  token. Exit 1 when any reply failed to settle, as upstream.
- **comment**: every upstream flag kept (`--prd --pr --repo --result --branch --ref --base --labels
  --slack-note --title --owner-slack-id --owner-login --pr-comment`). `rangeChanges(base)` →
  `rangeChanges({ ctx, base, exec })`; `maybeWriteSlackNote` receives `ctx` (it is a no-op when
  `notify.slack` is null).
- **knowledge**: `readKnowledge()` → `readKnowledge({ ctx })`.
- **check**: one command with a guard argument (default `all`).
  - `inbox` / `outbox`: upstream's `main`s, `fail`/`pass` → `formatFailure`/`formatPass` from
    `kit/lib/check-report.mjs`; the counts are `ctx.layout.specFiles().length` and
    `outboxItemFiles({ ctx }).length`.
  - `knowledge` (upstream `check-registers.mjs`): no knowledge folder → pass with a note line, unless
    `laws.source` is `knowledge`, which makes it a violation. Otherwise `gradeKnowledge({ ctx, files })`
    with `files` = the tracked `.md` files under `ctx.layout.knowledgeRoot` (upstream passed every
    tracked file's text for the deleted old-register scan). Wishes print as `warning:` lines on stderr
    and never fail.
  - `coverage` (upstream `check-decision-coverage.mjs [<base> <prd>]`): positional `<base> <prd>` →
    `--base <ref>` (default `<repo.remote>/<repo.defaultBranch>`) and `--prd <n>`. Runs the format
    check always; grades the range for `--prd` when given. When the base ref does not exist, `check
    coverage` exits 2 naming it and `check all` prints `coverage: skipped — no <ref>` and does not fail.

## Tests

`kit/bin/omni.test.mjs` is new (the brief's five cases, the bundle case, and one per command/guard
path above). No upstream test covered a CLI half, so none is ported or deleted.

## Fix round 1

- `check`: an explicit `--base <ref>` that does not resolve is a `UsageError` (exit 2, naming it) for
  every guard, `all` included — only the *default* base is skipped silently by `check all`. `--prd <n>`
  when the coverage guard does not run prints `omni check: --prd <n> ignored — …` on stderr.
- `adopt` / `settle`: a path the user typed that cannot be read (`<item-text-file>`, `--answer-file`)
  and the library's `PRD <n> has no inbox or shipped folder` become one-line `UsageError`s (exit 2),
  caught in the command (`readUserFile`, `withPrdFolder` in `kit/bin/args.mjs`), not in the dispatcher.
  Upstream let both escape as a stack trace.
