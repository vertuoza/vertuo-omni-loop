# Plan: a status line in Claude Code

PRD #324, spec beside this plan (`spec.md`). The feature branch `feat/statusline` merges into `main`
through the feature PR, whose body says `Closes #324`. Each slice is a sub-PR from
`feat/statusline--<slice>` into the feature branch, whose body says `Part of #324`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni statusline` prints the session line. Covers: Claude Code's JSON read with every field optional; line 1 (the model, the 10-cell context bar and its colours, `context —`, the 5-hour usage and its reset time, `ask on` from the launch folder's ask mode); line 2 as `no PRD · /omni:brainstorm to start` wherever the loop is installed, and no line 2 where it is not; the width rule and `NO_COLOR`; always exit 0, `omni` for unreadable JSON; the command in the table; the rebuilt bundle | `kit/lib/statusline/` `kit/bin/commands/statusline.mjs` `kit/bin/commands/index.mjs` `kit/bin/statusline` `kit/dist/omni.mjs` | — | 1 |
| s2 | `omni init` switches the status line on. Covers: the `statusLine` key merged into `.claude/settings.json` (created when missing, other keys kept in order), the kit's own line kept or rewritten with `--force`, anyone else's never touched, a file that is not JSON left alone; init's printed lines, its closing steps (`.claude/settings.local.json`, the new removal line) and its rule; the kit README's paragraph; the rebuilt bundle | `kit/lib/init/` `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/README.md` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | This repository shows the status line, and HOME says what `omni init` writes. Covers: the `statusLine` key in this repository's `.claude/settings.json`, beside its hooks; HOME's GET IN step and GET OUT line, and their test | `.claude/settings.json` `apps/galaxy/src/home/spreads/InOut` | s1 | 2 |
| s4 | Line 2 names the PRD of the session's branch, with its stage and open items. Covers: the slice, feature and phase-0 templates (a slice branch read as a slice first); the topic to its folder in the checkout or on the base; the base (remote ref, else the local default branch, else no stage); the stage rule with built and open items; `1 open item` / `k open items`; the shipped line; the topic cut first when the line is too wide; the rebuilt bundle | `kit/lib/statusline/` `kit/bin/commands/statusline.mjs` `kit/bin/statusline` `kit/dist/omni.mjs` | s1 | 3 |
| s5 | A session on `main` shows the PRD it last worked on. Covers: the record written by every command that names a PRD while `CLAUDE_CODE_SESSION_ID` is set and safe, in the main checkout, before the command runs, output and exit unchanged; the 7-day prune; the status line reading the record of the stdin `session_id` when the branch names no PRD; a record whose PRD has no folder reading `no PRD`; the rebuilt bundle | `kit/lib/statusline/` `kit/bin/commands/statusline.mjs` `kit/bin/statusline` `kit/bin/omni.mjs` `kit/bin/omni.test.mjs` `kit/dist/omni.mjs` | s4 | 4 |
| s6 | In the outbox, line 2 shows the wave and the slices from a board refreshed in the background. Covers: `board.mjs`'s board-building part exported with `omni board`'s output unchanged; `omni statusline --refresh <n>` with its lock and its file replaced by a rename; the status line starting one detached refresh when the board is missing or 60 seconds old, never waiting; the error entry and its 60-second retry; a board over 10 minutes old not shown; the slices wording and the red stuck count; a board with a slice merged or in flight reading outbox; the rebuilt bundle | `kit/lib/statusline/` `kit/bin/commands/statusline.mjs` `kit/bin/commands/board.mjs` `kit/bin/statusline` `kit/dist/omni.mjs` | s4 | 5 |

**Shared ground.** Four prefixes are declared by more than one slice, and the waves keep each group
apart:

- `kit/dist/omni.mjs`: s1, s2, s4, s5 and s6, in waves 1, 2, 3, 4 and 5. Every slice that changes
  `kit/bin` or `kit/lib` rebuilds it with `node kit/build.mjs` from its own merged source, never by
  hand, because `kit/test/dist.test.mjs` fails when it differs from a fresh build. s3 changes no
  kit source, so it rebuilds nothing.
- `kit/lib/statusline/`, `kit/bin/commands/statusline.mjs` and `kit/bin/statusline` (the new
  `kit/bin/statusline.test.mjs`): s1, s4, s5 and s6, one per wave, each adding its rules to the
  modules the spec names (`input.mjs`, `facts.mjs`, `which-prd.mjs`, `stage.mjs`, `render.mjs`,
  `board-cache.mjs`, `sessions.mjs`) and its cases to the same tests.
- `kit/bin/commands/index.mjs` is s1's alone: the one line adding `statusline` to the table.

Wave 2 runs s2 and s3 together: s2 owns `kit/lib/init/`, init's command and test, the kit README and
the bundle; s3 owns this repository's `.claude/settings.json` and HOME's spread. They do not meet.

The ordering has reasons behind it:

- s2 and s3 follow s1: the setting they write runs `omni statusline`, which s1 makes exist.
- s4 follows s1: it fills line 2 in the command s1 builds. It waits for wave 3 only because s2 holds
  the bundle in wave 2.
- s5 follows s4: the record is the fallback of the PRD lookup s4 builds, and it shows through s4's
  line 2.
- s6 follows s4: the slices part sits in s4's outbox line, and the board's in-flight rule extends
  s4's stage rule. It waits for wave 5 only because s5 holds the status line modules in wave 4.

## Per slice: done when

**s1: `omni statusline` prints the session line**
- In a `makeRepo()` fixture with a config, `omni statusline` given a full Claude Code payload on
  stdin prints `Opus 5.5 · context ██████░░░░ 58% · usage 25%, resets in 1h30 · ask on` (with
  `used_percentage` 58.9, a five-hour window at 25.4 % resetting 90 minutes after an injected
  `now`, and ask mode on in the payload's `workspace.project_dir`), then
  `no PRD · /omni:brainstorm to start`, and exits 0.
- `render.test.mjs`: the bar at 0, 49, 50, 79, 80, 100 and 130 %: its filled cells (0, 4, 5, 7, 8,
  10, 10), its colour (green, green, yellow, yellow, red, red, red), the percentage rounded down;
  `context —` for a null or missing percentage; the usage part absent without a five-hour window
  and when its reset has passed, `45m` under an hour, `1h05` above; `ask on` absent while ask mode
  is off.
- With `NO_COLOR=1` no output line holds an escape code; with `COLUMNS` at 40, 80 and 200 no line is
  wider, colour codes not counted, and a line too wide ends in `…`; an unset or non-numeric
  `COLUMNS` reads as 80.
- In a folder with no config, only line 1 prints. Text that is not JSON prints `omni`. A reader that
  throws (injected) prints line 1 from the JSON alone. Every case exits 0 with nothing on stderr.
- The injected `exec` sees no `git fetch` and no `gh`.
- `statusline` is in `COMMAND_TABLE`; `kit/test/dist.test.mjs` passes on the rebuilt bundle.

**s2: `omni init` switches the status line on**
- `kit/lib/init/settings.test.mjs`: a missing `.claude/settings.json` is created holding exactly the
  spec's `statusLine` key, with two-space indentation and a final newline; a file holding other keys
  keeps them, in their order, and gains the key; a file holding the kit's own line is kept, and
  rewritten with `--force`; a file holding someone else's line is kept even with `--force`; a file
  that is not JSON is left byte-identical.
- `kit/bin/init.test.mjs`, through `main()`: init prints `wrote   .claude/settings.json  (statusLine)`,
  `kept    .claude/settings.json  (statusLine)`, `kept    .claude/settings.json  (its statusLine is
  not the kit's)` or `skipped .claude/settings.json: not valid JSON, no status line added` for the
  four cases, and exits 0 in each.
- The closing steps say the status line is on for everyone who opens Claude Code in the repository
  and that a person keeps their own in `.claude/settings.local.json`; the removal line names
  `.omni-loop/` and the `statusLine` key of `.claude/settings.json`.
- `init.mjs`'s header states the new rule; `kit/README.md` has one paragraph on the status line; the
  existing init tests pass; `kit/test/dist.test.mjs` passes on the rebuilt bundle.

**s3: this repository shows it, and HOME says so**
- This repository's `.claude/settings.json` holds the spec's `statusLine` key, and every key it held
  before, unchanged.
- HOME's GET IN first step reads "`omni init` adds one folder to your repository, `.omni-loop/`, and
  a status line to `.claude/settings.json`." and its GET OUT line reads "Delete `.omni-loop/` and the
  `statusLine` in `.claude/settings.json`, and commit. That's it.", each path in `<code>`, the GET OUT
  line still bold; `InOut.test.ts` asserts both, and `lingo.test.ts` stays green.

**s4: line 2 names the PRD of the session's branch**
- On a `makeRepo({ git: true })` fixture cloned from a local bare repository, holding on `main` a
  shipped folder `0003-alpha`, inbox folders `0007-bravo` and `0009-charlie`; a remote feature
  branch `feat/bravo` with a source file and two outbox items; a remote `feat/charlie` that is only
  its phase-0 copy; a phase-0 branch `docs/phase-0-delta` holding `0011-delta`, a folder not on
  `main`:
  - on `feat/bravo--s2`: `PRD 7 bravo · s2 · outbox · 2 open items`;
  - on `feat/bravo`: `PRD 7 bravo · outbox · 2 open items`;
  - on `feat/charlie`: `PRD 9 charlie · inbox`;
  - on `docs/phase-0-delta`: `PRD 11 delta · in review`;
  - on a branch naming `alpha`: `PRD 3 alpha · shipped`;
  - on `main`, and on a branch whose topic has no folder: `no PRD · /omni:brainstorm to start`.
- `which-prd.test.mjs`: `feat/x--s1` reads as slice `s1` of `x`, never as feature `x--s1`.
- `stage.test.mjs`: one case per row of the spec's table; open items alone read outbox; a
  path changed then reverted on the feature branch is not built; with no remote-tracking `main` the
  local `main` is the base; with neither, line 2 has no stage.
- `1 open item` for one item; the open items part absent at zero; with `COLUMNS=40` the topic is cut
  to 8 characters ending in `…` before anything else.
- Every run exits 0 and the injected `exec` sees no `git fetch` and no `gh`; the bundle is rebuilt.

**s5: a session on `main` shows the PRD it last worked on**
- `kit/bin/omni.test.mjs`: with `CLAUDE_CODE_SESSION_ID=abc`, each command form in the spec's
  record table (`omni prd 7`, `omni board 7`, `omni status 7`, `omni phase0 7`, `omni ship 7`,
  `omni harvest 7`, `omni dossier push 7`, `omni plan check 7`, `omni rework plan 7`, and
  `omni check --prd 7`) writes `{ "prd": 7, "at": … }` to `.omni-loop/local/sessions/abc.json` in the
  main checkout, including when run from a worktree of the fixture; its stdout, stderr and exit code
  equal a run without the variable.
- Nothing is written without the variable, with an id `isSafeId` refuses, or for `omni prd seven`.
- `sessions.test.mjs`: writing a record deletes the records in that folder older than 7 days, and
  keeps the younger ones.
- On `main`, with a payload whose `session_id` is `abc` and a record naming PRD 7, line 2 reads
  `PRD 7 bravo · outbox · 2 open items`; on `feat/charlie` with that same record, line 2 names
  PRD 9 (the branch wins); a record naming a PRD with no folder reads `no PRD`.
- The bundle is rebuilt.

**s6: the wave and the slices, from a board refreshed in the background**
- `board-cache.test.mjs`, with an injected clock and spawn: a file 59 seconds old starts nothing; a
  missing file, or one 60 seconds old, starts exactly one detached refresh whose folder is the
  session's; a lock under 2 minutes old starts none; a lock 2 minutes old is taken over; an error
  entry hides the slices and starts the next refresh 60 seconds after it; slices 10 minutes old are
  not shown; the file is written under a temporary name and renamed into place.
- `omni statusline --refresh 7` on the fixture, with `gh` stubbed through the injected `exec`,
  writes `board-7.json` holding each slice's id, wave and state, and removes the lock; with the lock
  held, it exits 0 and writes nothing; with `gh` failing, it writes the error entry.
- `render.test.mjs`: `wave 2 of 4 · 3/5 slices merged`; `, 1 in flight` counting `in-flight` and
  `claimed-stale`; `, 1 stuck` in red; both absent at zero; `all slices merged` when every slice is
  merged; no slices part without a board, on an error, or on a board over 10 minutes old.
- `stage.test.mjs`: a PRD reading inbox by git reads outbox when its board shows a slice merged,
  in flight or claimed-stale.
- The status line itself still never runs `gh`: the injected `exec` sees none, and the spawn is the
  only way a refresh starts.
- The existing `omni board` tests pass unchanged; the bundle is rebuilt; `pnpm test` passes on the
  feature branch.
