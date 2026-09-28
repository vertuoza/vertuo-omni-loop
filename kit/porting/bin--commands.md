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
- **status, bare** (PRD 315): `omni status [--fetch]` with no `<prd>` is the repository's overview (new, `kit/lib/status/`, no upstream); the gate, `omni status <prd>`, is unchanged.
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

## Final review fixes

- `omni status` writes `unreworked=<true|false>` to `GITHUB_OUTPUT` next to `open_items=` and
  `unaccounted=`. Test: "status writes open_items and unreworked to GITHUB_OUTPUT".
- `omni comment` / `omni replies`: a `--repo` (or `repo.slug`) that is not `owner/name` is a
  one-line `UsageError` (exit 2) before any GitHub call (`repoSlug` in `kit/bin/args.mjs`).
  `omni comment --base <ref>` that cannot be read is a one-line `UsageError`, as `omni status`
  does. Tests: "comment and replies with a --repo that is not owner/name", "comment with a --base
  that does not exist".

## `item` (PRD 50, slice s1): the intro and the punchline

`kit/bin/commands/item.mjs` is new (no upstream CLI half, like `config`, `prd` and `ship`). This
records its change for PRD 50.

- The `--file` JSON gains two optional fields, `introFun` and `punchlineFun`, passed through to
  `renderOutboxItem`.
- Each is held to `funLineProblems` (`kit/lib/outbox/outbox.mjs`: the plain-words rules, 120
  characters at most) inside the input schema, so a bad line is a one-line `UsageError` naming its
  field (`omni item new: <file>: "introFun" — introFun is 125 characters long — keep it to 120
  characters at most.`): exit 2, nothing written, nothing adopted, `--json` or not, before the
  recording policy runs. Giving one without the other is the same kind of error, naming the missing
  field. The pre-write `checkItemText` pass would have named the section rather than the field, and
  answered in JSON under `--json` — see PRD 50's outbox item `s1-02-fun-line-refusal-shape`.
- Header comment: a paragraph on the two fields.

### Tests (`kit/bin/item.test.mjs`)

**Added** `omni item new — the intro and the punchline (PRD #50, slice s1)`, all through `main()`:
both fields write both sections in place; neither writes neither; `--adopt --json` embeds both in
the settled entry and writes no open file; an intro over 120 characters, and a punchline holding a
backticked code name, each exit 2 naming the field with nothing written; the same under `--adopt
--json`; an intro without a punchline, and a punchline without an intro, each exit 2 naming the
missing field. RED: seven of the eight failed before the command took the fields. No existing
assertion changed; none deleted.
