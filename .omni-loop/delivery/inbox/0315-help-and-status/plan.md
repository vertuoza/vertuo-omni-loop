# Plan: omni help and omni status

PRD #315, spec beside this plan (`spec.md`). The feature branch `feat/help-and-status` merges into
`main` through the feature PR, whose body says `Closes #315`. Each slice is a sub-PR from
`feat/help-and-status--<slice>` into the feature branch, whose body says `Part of #315`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A bare `omni status` shows the shipped and inbox counts and the bar, read from the default branch. Covers: the git reader for the base (remote ref, else the local default branch, else exit 2), its `inbox/` and `shipped/` folders and the `FETCH_HEAD` time; `--fetch` and its failure line; the header; the counts line and the 30-cell bar with `nothing yet`; the flag rules and the new usage line; the gate left as it is; the porting note's line; the rebuilt bundle | `kit/lib/status/` `kit/bin/commands/status.mjs` `kit/bin/status` `kit/porting/bin--commands.md` `kit/dist/omni.mjs` | — | 1 |
| s2 | The outbox and the PRDs in review show. Covers: reading the remote feature and phase-0 branches by `branches.feature` and `branches.phase0`; the built check; the open items on the feature branch; the in-review rule; the branches ignored; the outbox count with its open items, and in review kept out of the bar; the rebuilt bundle | `kit/lib/status/` `kit/bin/status` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | Your PRDs show, each with where it stands. Covers: `git config user.email`; authorship on the PRD's folder and on its feature branch beyond the base; the no-email, shallow and `none yet` lines; the rows by stage with their words; the wrapped shipped list; the 80-column cut; the rebuilt bundle | `kit/lib/status/` `kit/bin/status` `kit/dist/omni.mjs` | s2 | 3 |
| s4 | `/omni:status` runs the overview inside Claude. Covers: the skill, and its assertions in the plugin test | `kit/plugin/skills/status/` `kit/test/plugin.test.mjs` | s1 | 2 |
| s5 | `omni help` explains the loop and every command, in the terminal and inside Claude. Covers: the help table and its renderer; `omni help` and `omni help <name>`; `--help`, `-h` and the line added under a bare `omni`; the entries guard against the command table and the skill folders; `/omni:help` and its assertions in the plugin test; the kit README's paragraph on `omni help` and `omni status`; the rebuilt bundle | `kit/lib/help/` `kit/bin/commands/help.mjs` `kit/bin/commands/index.mjs` `kit/bin/omni.mjs` `kit/bin/omni.test.mjs` `kit/bin/help` `kit/plugin/skills/help/` `kit/test/plugin.test.mjs` `kit/README.md` `kit/dist/omni.mjs` | s3, s4 | 4 |

**Shared ground.** Three prefixes are declared by more than one slice, and the waves keep each pair
apart:

- `kit/dist/omni.mjs`: s1, s2, s3 and s5, in waves 1, 2, 3 and 4. Every slice that changes
  `kit/bin` or `kit/lib` rebuilds it with `node kit/build.mjs` from its own merged source, never by
  hand, because `kit/test/dist.test.mjs` fails when it differs from a fresh build. s4 changes only a
  skill and a test, which the bundle does not carry, so it rebuilds nothing.
- `kit/lib/status/` and `kit/bin/status` (the new `kit/bin/status.test.mjs`): s1, s2 and s3, one
  per wave, each adding its rules to the same three modules (`facts.mjs`, `overview.mjs`,
  `format.mjs`) and its cases to the same tests.
- `kit/test/plugin.test.mjs`: s4 in wave 2 and s5 in wave 4, each adding its own block.

Wave 2 runs s2 and s4 together: s2 owns the status modules and the bundle, s4 a skill folder and the
plugin test, and they do not meet.

The ordering has reasons behind it:

- s2 follows s1: the outbox and in-review rules extend s1's reader, overview and text.
- s3 follows s2: a PRD of yours can be in the outbox or in review, so its rows need both stages.
- s4 follows s1: the skill runs a bare `omni status`, which s1 makes exist.
- s5 comes last: its entries guard needs every skill folder the PRD adds (`status/` from s4, and
  its own `help/`), and its help text describes the finished `omni status`. It ends the PRD.

## Per slice: done when

**s1: a bare `omni status` shows the shipped and inbox counts and the bar**
- On a `makeRepo({ git: true })` fixture cloned from a local bare repository whose `main` holds three
  shipped folders and two inbox folders, `omni status` prints the header naming `repo.slug`,
  `origin/main` and when it was fetched, the line `SHIPPED 3     INBOX 2`, and a bar
  `3 of 5 · 60%` of 30 cells with 18 filled, then `2 in progress: 2 in the inbox`, and exits 0.
- The counts come from `origin/main`, not the working tree: a folder added only to the working tree,
  or only on a checked-out branch, is not counted.
- With no remote-tracking `origin/main`, it reads the local `main`; with neither, it exits 2 with
  `omni status: cannot read origin/main or main; run omni status --fetch`.
- `omni status --fetch` counts a shipped folder pushed to the bare repository after the clone; a
  fetch from a remote that does not exist prints `fetch failed: …; showing your last fetch`, then
  the overview, and exits 0. Without `--fetch`, no `git fetch` runs (the injected `exec` sees none).
- The header says `never fetched` when the checkout has no `FETCH_HEAD`, and a relative time
  (`just now`, `N minutes ago`, `N hours ago`, `N days ago`) otherwise, computed with an injected
  `now` in `format.test.mjs`.
- With no PRD at all, the bar line reads `nothing yet: /omni:brainstorm to start`.
- The percentage and the filled cells round down: 29 of 30 shipped reads `96%` and 29 cells.
- `omni status --fetch 7`, `omni status --labels a`, `omni status --base x` and
  `omni status --changes` exit 2 with the usage line
  `usage: omni status [--fetch] | omni status <prd> [--labels a,b] [--base <ref> | --changes]`.
- Every existing `omni status <prd>` test in `kit/bin/omni.test.mjs` and `kit/bin/*.test.mjs` passes
  unchanged.
- `kit/porting/bin--commands.md` records, in one line, that a bare `omni status` is the overview and
  the gate is unchanged.
- `kit/test/dist.test.mjs`, `kit/test/no-literals.test.mjs` and `kit/test/no-game-words.test.mjs`
  pass; `pnpm test` is green.

**s2: the outbox and the PRDs in review show**
- On the fixture: a feature branch `origin/feat/<topic>` for an inbox PRD, carrying a file outside
  the delivery folder and two open items under `outbox/<folder>/` (plus a `settled.md` and an
  `accounts/` file, which do not count), makes that PRD count in the outbox:
  `OUTBOX 1 · 2 open items`, and it leaves the inbox count.
- A feature branch that is only the phase-0 copy of its PRD (the same folder, byte-identical to
  `main`, and a scenario-like file outside the delivery folder identical to `main`'s) counts in the
  inbox, not the outbox.
- A feature branch with one open item and no code counts in the outbox, `1 open item`.
- A branch `origin/docs/phase-0-<topic>` holding an inbox folder whose PRD number is in neither
  folder of `main` counts `IN REVIEW 1`, and stays out of the bar's total.
- A feature or phase-0 branch whose PRD is in `shipped/` on `main`, and one whose topic matches no
  folder, change no count.
- The branch shapes come from `branches.feature` and `branches.phase0`: a fixture with a different
  `branches.feature` template reads its own branches, and `kit/test/no-literals.test.mjs` passes.
- A branch whose tree cannot be read is skipped and the overview still exits 0.
- The open-item rule is the one `outboxItemFiles` applies (`.md`, not `settled.md`, nothing under
  `accounts/`), with `SETTLED_FILE` imported rather than retyped; nothing under `kit/lib/outbox/`
  changes.
- `pnpm test` is green, the bundle rebuilt.

**s3: your PRDs show, each with where it stands**
- With commits by `me@example.com` and `other@example.com` on the fixture, `omni status` run with
  `user.email=me@example.com` lists under `Yours · me@example.com` only the PRDs whose folder
  `me@example.com` touched, on `main` or on a feature or phase-0 branch, and the PRD whose feature
  branch carries a commit of theirs beyond `main` though they never touched its folder.
- The email is compared ignoring case: `Me@Example.com` matches.
- Rows come outbox, then inbox, then in review, each newest first, with the words the spec gives:
  `<k> open item(s) wait for an answer`, `being built`, `ready to build: /omni:yolo <n>`,
  `its phase-0 PR waits for a merge`.
- The `shipped` row lists every shipped PRD of yours, newest first, as `#<n> <topic>` joined by
  ` · `, wrapped at 80 columns under the first entry.
- No PRD of yours prints `none yet`; no `user.email` prints `set git config user.email to see
  yours`; a shallow clone (`git clone --depth 1` of the fixture) prints `this clone is shallow: git
  fetch --unshallow to see yours`. In each case the counts and the bar still show.
- No line is wider than 80 columns; a topic that would push a row past it is cut with `…`
  (`format.test.mjs`).
- `pnpm test` is green, the bundle rebuilt.

**s4: `/omni:status` runs the overview inside Claude**
- `kit/plugin/skills/status/SKILL.md` has front matter (`name: status`, a description with its
  triggers) and tells Claude to run `node .omni-loop/bin/omni.mjs status`, adding `--fetch` only
  when the person asks for fresh data, and to print the output as is in a text block.
- It never runs `omni status <prd>`: a new block in `kit/test/plugin.test.mjs` asserts the skill
  names `omni status` and holds no `omni status <` form.
- The plugin guard passes: the skill parses and names only commands the CLI has.
- `pnpm test` is green.

**s5: `omni help` explains the loop and every command**
- `omni help` prints, in this order, `THE LOOP` with the six stages and one line each, the three
  principles, `IN CLAUDE`, `IN THE TERMINAL`, and the `Run by the skills` lines, then
  `omni help <command> tells more about any of them.`, and exits 0.
- The delivery folders it shows are the config's: a fixture with `paths.delivery: work/delivery`
  prints `work/delivery/inbox/` and `work/delivery/shipped/`.
- It works in a folder with no config (a `mkdtemp` directory), using the kit's defaults.
- `kit/lib/help/entries.test.mjs` fails when a name in `COMMAND_TABLE` or a folder under
  `kit/plugin/skills/` has no entry of its kind, or when an entry names one that does not exist;
  every entry has a `usage`, a one-line `summary` and a `detail`. It passes with the 26 commands and
  13 skills.
- `omni help board` prints the board's usage, `for you` and its sentences; `omni help yolo` and
  `omni help /omni:yolo` print the same skill entry; `omni help plan` prints the command's entry,
  then the skill's; `omni help teleport` exits 2 with
  `omni help: no command "teleport"; omni help lists them all`.
- `omni --help` and `omni -h` print exactly what `omni help` prints; a bare `omni` and
  `omni frobnicate` still exit 2 with the usage line on stderr, now followed by
  `omni help: what each command does`.
- No line of `omni help` or of any `omni help <name>` is wider than 80 columns.
- `kit/plugin/skills/help/SKILL.md` runs `node .omni-loop/bin/omni.mjs help`, passing the name the
  person gave, and prints the output as is; its block in `kit/test/plugin.test.mjs` asserts so.
- `kit/README.md` has one paragraph on `omni help` and `omni status`.
- `kit/test/no-literals.test.mjs`, `kit/test/no-game-words.test.mjs` and `kit/test/dist.test.mjs`
  pass; `pnpm test` is green.
