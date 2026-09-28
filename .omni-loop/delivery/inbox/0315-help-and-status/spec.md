---
prd: 315
title: omni help and omni status, the loop explained and where your PRDs are
blocked-by: none
spec: file
---

# omni help and omni status: the loop explained, and where your PRDs are

**Date:** 2026-09-28 · **PRD:** #315 · **Touches:** the `omni` CLI (a new `help` command, a bare
`omni status`, `--help` and `-h`), two new skills of the `omni` plugin (`/omni:help`,
`/omni:status`), the bundle `kit/dist/omni.mjs`, the kit README and one porting note. The outbox
gate, `omni status <prd>`, is unchanged.

## Problem

Someone new to the loop, or coming back to it, has no way to ask the loop itself what it is or where
things stand:

- **No help.** `omni`, `omni help` and `omni --help` all print the same two lines on stderr and exit
  2: a usage line and 25 command names, with no word on what any of them does, which ones a person
  types, or which ones only the skills run. Nothing names the slash commands (`/omni:brainstorm`,
  `/omni:yolo`, …) or explains the loop's stages (idea, PRD, inbox, outbox, shipped, retro).
- **No overview.** `omni status` only takes a PRD number: it is the outbox gate, for one PRD. To
  know how many PRDs are in the inbox, how many are being built, how many have shipped, or which
  ones are yours, a person lists folders by hand, and still cannot see the outbox or the PRDs
  waiting for review: those live on other branches, not on the default branch.

## Solution

Two read-only commands, each typeable in the terminal and inside Claude.

### `omni help [<name>]` and `/omni:help [<name>]`

**`omni help`** prints one screen: the loop, its principles, the commands a person types in Claude,
the commands a person types in the terminal, and the ones only the skills run. Folder names come from
the config (`paths.delivery`), and the default branch from `repo.defaultBranch`. With this
repository's config it reads:

```text
omni: the Omni Loop's command line

THE LOOP
  idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro

  idea     talked through with /omni:brainstorm, nothing written yet
  PRD      spec, plan and before/after written, in a phase-0 PR a person reviews
  inbox    phase-0 PR merged: approved, ready to build
           .omni-loop/delivery/inbox/
  outbox   being built in waves of slices; what the agents decided alone
           waits for you
  shipped  feature PR merged: the change is on main
           .omni-loop/delivery/shipped/
  retro    a retro PR tells how it went; a knowledge PR keeps what it taught

  The folder is the status. Only a person merges into main. Every decision
  an agent takes alone becomes an outbox item that you answer or adopt.

IN CLAUDE (type these)
  /omni:brainstorm        an idea, to a design, to a PRD and its phase-0 PR
  /omni:yolo <n>          build a whole PRD: plan, waves, the outbox gate, ship
  /omni:yolo-fix <n>      rework what you answered on the feature PR
  /omni:plan <n>          slice a PRD into waves (yolo runs it when needed)
  /omni:wave <n>          build one wave        /omni:do-work   build one slice
  /omni:pr                open, watch and finish a pull request
  /omni:invade            set up this repository's knowledge base
  /omni:ask on|off        answer Claude's questions on a web page
  /omni:status            where your PRDs are     /omni:help   this page

IN THE TERMINAL
  omni status             your PRDs, the inbox, the outbox, what has shipped
  omni status <n>         the outbox gate for PRD n (exit 0 green, 1 red)
  omni prd <n>            where PRD n lives and its files
  omni board <n>          PRD n's slices and what can run next
  omni check [all]        the repository's guards
  omni kb show <form>     one form of the playbook
  omni knowledge <id>     one rule of the knowledge base
  omni signin | whoami    sign in to the Omni page, once per computer
  omni dossier …          a PRD's dossier on the Omni page
  omni init · config · credits · signout

  Run by the skills: settle, adopt, replies, comment, ship, harvest, item, plan,
  rework, phase0, sign; and /omni:dossier-open, /omni:dossier-push.

omni help <command> tells more about any of them.
```

The exact wording may change while it is built; the sections, their order, and every command and
skill appearing in one of them may not.

**`omni help <name>`** prints one entry: its usage line, who runs it (`for you` or `run by the
skills`), and a few sentences.

```text
omni board <prd> [--json] [--repo <owner/name>]            for you

PRD n's slices as the loop sees them, rebuilt from GitHub on every run: each
slice's state (merged, stuck, in flight, runnable, blocked) and the wave that
can run next. Needs gh logged in.
```

- `<name>` is a CLI command (`board`), a skill (`yolo`), or a slash command (`/omni:yolo`).
- A name that is both a command and a skill (`plan`, `ask`, `status`, `help`) prints the command's
  entry, then the skill's. `/omni:<name>` prints the skill's alone.
- An unknown name exits 2 with one line: `omni help: no command "<name>"; omni help lists them
  all`.
- `omni --help` and `omni -h` print what `omni help` prints.
- A bare `omni`, and an unknown command, keep their usage line on stderr and exit 2, with one line
  added under it: `omni help: what each command does`.
- `omni help` needs no config. When the config does not load (a repository not installed yet), it
  uses the kit's defaults.

**`/omni:help [<name>]`** runs `omni help [<name>]` and prints its output as is, in a text block.

### `omni status` and `/omni:status`

A bare **`omni status`** prints the repository's overview. **`omni status <prd>`**, the outbox gate,
is unchanged: the same flags, the same report, the same exit codes, the same `GITHUB_OUTPUT` and
`GITHUB_STEP_SUMMARY` lines.

```text
omni status · vertuoza/vertuo-omni-loop · origin/main, fetched 2 hours ago

  SHIPPED 26     INBOX 2     OUTBOX 1 · 3 open items     IN REVIEW 1

  delivered  ██████████████████████████░░░░  26 of 29 · 89%
             3 in progress: 2 in the inbox, 1 in the outbox

  Yours · pierre.derval@vertuoza.com
  outbox     #251  outbox-answers     3 open items wait for an answer
  inbox      #285  home-value         ready to build: /omni:yolo 285
  in review  #310  cli-help-status    its phase-0 PR waits for a merge
  shipped    24: #301 yolo-what-is-next · #292 what-is-next · #284 omni-theme
             #262 release-notes · #261 home · #238 game-app-switch · …

omni help: the loop and every command
```

(An example: the branches behind the outbox and the review rows are made up. In a real run the
`…` is the rest of the list: every shipped PRD of yours is listed.)

**Where it reads.** Git only, never GitHub, never the working tree. The **base** is
`<repo.remote>/<repo.defaultBranch>` as last fetched; when that ref does not exist, the local
`<repo.defaultBranch>`; when neither exists, `omni status` exits 2 with one line:
`omni status: cannot read origin/main or main; run omni status --fetch`.

**`--fetch`** runs `git fetch --prune <repo.remote>` first. When the fetch fails, one line,
`fetch failed: <its first line>; showing your last fetch`, then the overview, exit 0. Without
`--fetch`, `omni status` never touches the network. The header says when the last fetch happened
(the time of the checkout's `FETCH_HEAD`), or `never fetched`.

**Stages.** Each PRD is counted once, in the first row that matches:

| Stage | Rule | In the bar |
|---|---|---|
| **shipped** | its folder is in `<paths.delivery>/shipped/` on the base | delivered |
| **outbox** | its folder is in `<paths.delivery>/inbox/` on the base, and its feature branch (`<repo.remote>/<branches.feature>` with its topic) is **built** or holds at least one **open item** | in progress |
| **inbox** | its folder is in `<paths.delivery>/inbox/` on the base, and it is not in the outbox | in progress |
| **in review** | a phase-0 branch (`<repo.remote>/<branches.phase0>` with a topic) holds a folder in `<paths.delivery>/inbox/` whose PRD number is in neither folder of the base | not in the bar |

- **Built:** some path outside `paths.delivery` changed on the feature branch since it forked from
  the base (`git diff --name-only <base>...<feature>`), and that path still differs from the base
  (`git diff --name-only <base> <feature>`). A phase-0 copy is byte-identical to the base once
  merged, so it never reads as built.
- **Open items:** the files under `<paths.delivery>/outbox/<folder>/` on the feature branch that
  `outboxItemFiles` would count: `.md` files, not `settled.md`, nothing under `accounts/`.
- A feature or phase-0 branch whose PRD already shipped, or whose topic matches no folder, is
  ignored. A feature branch counts only for a PRD whose folder is in the base's inbox.
- A branch whose tree cannot be read is skipped; the overview never fails because of one branch.

**The bar** is 30 cells, `█` delivered and `░` in progress: delivered is the shipped count, the total
is shipped + inbox + outbox. The filled cells and the percentage both round down, so it never reads
100% while anything is in progress. With nothing at all, the bar line reads
`nothing yet: /omni:brainstorm to start`.

**Yours.** You are the email `git config user.email` gives in this checkout. A PRD is yours when a
commit authored with that email (compared exactly, ignoring case):

- touches its folder under `<paths.delivery>`, on the base or on any feature or phase-0 branch
  `omni status` reads; or
- sits on its feature branch beyond the base (`<base>..<feature>`), so a PRD you helped build counts
  too.

Your PRDs are listed as rows: outbox, then inbox, then in review, each newest first, then one
`shipped` row listing every shipped PRD of yours, newest first, wrapped at 80 columns. Each row
says where it stands:

| Stage | Row says |
|---|---|
| outbox, with open items | `<k> open item(s) wait for an answer` |
| outbox, none open | `being built` |
| inbox | `ready to build: /omni:yolo <n>` |
| in review | `its phase-0 PR waits for a merge` |

When no PRD is yours, the section says `none yet`. When it cannot tell, it says one line instead,
and the counts and the bar still show:

- no email: `set git config user.email to see yours`;
- a shallow clone (`git rev-parse --is-shallow-repository`): `this clone is shallow: git fetch
  --unshallow to see yours`.

**Output.** Plain text, no colour, so it reads the same in a terminal and inside Claude. No line is
wider than 80 columns; a topic that would push a row past it is cut with `…`. The header names
`repo.slug` when the config has one. Exit 0.

**Flags.** `--fetch` belongs to the overview only: `omni status --fetch <prd>` is a usage error, and
so is a gate flag (`--labels`, `--base`, `--changes`) without a PRD number. The usage line becomes
`usage: omni status [--fetch] | omni status <prd> [--labels a,b] [--base <ref> | --changes]`.

**`/omni:status`** runs `omni status` (with `--fetch` when the person asks for fresh data) and
prints its output as is, in a text block. It never runs the gate.

### How it is built

```text
omni help [<name>]                         omni status [--fetch]         omni status <prd> …
        │                                          │                              │
kit/bin/commands/help.mjs          kit/bin/commands/status.mjs ─── one argument ──▶ the gate, unchanged
        │                                          │ no argument
kit/lib/help/entries.mjs  the table   kit/lib/status/facts.mjs     the only git caller
kit/lib/help/render.mjs   the text                 │ facts
                                       kit/lib/status/overview.mjs  pure: stages, counts, yours
                                                   │ overview
                                       kit/lib/status/format.mjs    pure: the text and the bar
```

- **`kit/lib/help/entries.mjs`:** one frozen table, pure data. The loop's six stages and its
  principles, then one entry per CLI command and per plugin skill: `name`, `kind` (`command` or
  `skill`), `who` (`you` or `skills`), `usage`, `summary` (one line) and `detail` (a few sentences).
  Paths are placeholders the renderer fills from the config, never literals.
- **`kit/lib/help/render.mjs`:** `renderOverview(config)` and `renderEntry(name, config)`, pure;
  `renderEntry` returns `null` for a name it does not know.
- **`kit/bin/commands/help.mjs`:** runs without a context (`withoutContext`, like `init`); it tries
  `loadContext`, and on a `ConfigError` renders with the kit's default config.
- **`kit/lib/status/facts.mjs`:** every git call of the overview, and nothing else: the base's
  folders (`git ls-tree`), the remote branches (`git for-each-ref`), the built check (`git diff`),
  the open items (`git ls-tree -r`), the authorship (`git log`), the email (`git config`), the
  shallow flag and the `FETCH_HEAD` time. It returns plain data.
- **`kit/lib/status/overview.mjs`:** `overviewFor(facts)`, pure: every stage rule, the counts, the
  bar's numbers and the rows of yours.
- **`kit/lib/status/format.mjs`:** `formatOverview(overview, { now })`, pure: the text, the bar,
  the wrapping, the relative fetch time.
- **`kit/bin/commands/status.mjs`:** no positional → the overview; one positional → the gate, as
  today.
- **`kit/plugin/skills/help/SKILL.md`** and **`kit/plugin/skills/status/SKILL.md`:** thin skills,
  like `/omni:ask`.
- **The bundle** `kit/dist/omni.mjs` rebuilt with `node kit/build.mjs`.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | A bare `omni status` is the overview; `omni status <prd>` stays the gate, unchanged. | Asked: "Bare `omni status`". A bare `omni status` is a usage error today, so no caller breaks. |
| D2 | The overview reads git only, offline; `--fetch` fetches first. | Asked: "Git only, offline". Fast, works without `gh`, and tests need no GitHub. |
| D3 | Help is one overview screen, plus `omni help <name>` for any command or skill. | Asked: "Overview + per-command". |
| D4 | The help text is a hand-written table, guarded by a test against the command table and the skill folders. | Asked: approach A. Skill descriptions are written for Claude's trigger matching, not for people. |
| D5 | PRDs in review are counted, but not in the bar. | The brief: the bar is delivered against inbox and outbox, "aka in progress". |
| D6 | Yours is authorship by `git config user.email`, on the PRD's folder or on its feature branch. | The brief asks for the PRDs a person worked on, which includes lending a slot to someone else's PRD. One email, no flag: the brief needs no other. |
| D7 | Outbox is "built or holds an open item"; built compares paths outside the delivery folder in both directions. | The outbox folder on the default branch is always empty until a PRD ships; the feature branch is where the building shows. The two-way compare keeps phase-0 copies from reading as built. |
| D8 | Plain text, no colour, 80 columns, `█` and `░`. | The same output in a terminal and inside Claude, where colour codes are noise. |
| D9 | A name that is both a command and a skill prints both entries. | `omni help plan` should not hide `/omni:plan`, nor the reverse. |
| D10 | `omni help` works without a config, on the kit's defaults. | Help is most needed before anything is set up. |
| D11 | A bare `omni` still exits 2, with one line naming `omni help`. | A caller may rely on the exit code; the added line is enough to find help. |
| D12 | No test compares each help usage line with the command's own usage. | Several commands do real work with no argument (`config`, `check`, `credits` calls GitHub), so a test cannot run them all safely. |
| D13 | The overview lists only your PRDs; everyone's appear only as counts. | The brief: counts for the repository, the list for the person. |

## User stories

1. As someone new to the loop, I type `omni help` or `/omni:help` and learn the six stages, the
   loop's principles, which commands I type and which the skills run, without opening a file.
2. As someone who wants to know one command, I type `omni help board` (or `omni help yolo`) and
   read its usage, who runs it and what it does.
3. As someone working with the loop, I type `omni status` or `/omni:status` and see, on one screen,
   how many PRDs have shipped, how many are in the inbox, in the outbox and in review, and a bar of
   delivered against in progress.
4. As that person, I see the PRDs I worked on, each with where it stands and, for one in the inbox,
   the command that builds it.
5. As that person, I run `omni status --fetch` to see the repository as it is on the remote right
   now.
6. As the outbox workflow and the skills that run the gate, `omni status <prd>` behaves exactly as
   before.

## Scope

**In:**

- `kit/lib/help/entries.mjs`, `kit/lib/help/render.mjs`, `kit/bin/commands/help.mjs`, their tests.
- `kit/lib/status/facts.mjs`, `kit/lib/status/overview.mjs`, `kit/lib/status/format.mjs`, their
  tests.
- `kit/bin/commands/status.mjs` (the bare form and its usage line), `kit/bin/commands/index.mjs`
  (`help` in the table), `kit/bin/omni.mjs` (`--help`, `-h`, the added usage line), their tests.
- `kit/plugin/skills/help/SKILL.md`, `kit/plugin/skills/status/SKILL.md`, and their assertions in
  `kit/test/plugin.test.mjs`.
- `kit/dist/omni.mjs`, rebuilt.
- `kit/README.md`: one paragraph on `omni help` and `omni status`.
- `kit/porting/bin--commands.md`: one line recording that a bare `omni status` is the overview.

**Out:**

- Any change to the gate's behaviour, report or exit codes.
- Reading GitHub (`gh`): issues, pull requests, reviews, CI.
- Another person's PRDs by name (`--author`), a `--json` output, colours.
- The Omni page, the dossier, the game.
- The endings of the other skills (they may mention `/omni:status` in a later PRD).

## Test seams

From the testing playbook: `pnpm test` runs vitest over `kit/`; tests sit beside their code (a
command through `main()` on a fixture repository from `makeRepo()`, a pure module on its own); no
test ever calls GitHub.

- **`kit/lib/status/overview.test.mjs`**, on hand-built facts: each stage rule; a feature branch
  that is only a phase-0 copy reads inbox, not outbox; one with open items but no code reads
  outbox; a shipped PRD's leftover feature and phase-0 branches are ignored; a branch whose topic
  matches no folder is ignored; in review is counted but kept out of the bar; the percentage and the
  filled cells round down; zero PRDs; yours from a folder commit, and from a feature-branch commit
  only; the email compared ignoring case.
- **`kit/lib/status/format.test.mjs`**: the bar at 0%, partway and 100%; `nothing yet`; the
  `open item` / `open items` wording; every line at most 80 columns; a long topic cut with `…`; the
  shipped list wrapped; the no-email, shallow and `none yet` lines; the relative fetch time with an
  injected `now`, and `never fetched`.
- **`kit/bin/status.test.mjs`** (new), through `main()` on a `makeRepo({ git: true })` fixture with
  a local bare repository as its remote: a default branch holding shipped and inbox folders, a
  feature branch with code and two outbox items, a phase-0 branch for a PRD not yet on the default
  branch, commits by two emails. `omni status` prints the expected counts, bar and rows; `--fetch`
  reads a branch pushed to the bare remote after the clone; a fetch from a missing remote prints
  `fetch failed` and exits 0; no remote-tracking ref falls back to the local default branch;
  neither exits 2; `--fetch 7` and `--labels a` alone exit 2.
- **The gate:** the existing `omni status <prd>` tests pass unchanged.
- **`kit/lib/help/entries.test.mjs`**: every name in `COMMAND_TABLE` and every folder under
  `kit/plugin/skills/` has exactly one entry of its kind, and no entry names one that does not
  exist; every entry has a usage, a one-line summary and a detail.
- **`kit/bin/help.test.mjs`** (new), through `main()`: the overview names every section in order and
  this fixture's configured delivery folder (a non-default `paths.delivery`); it renders outside an
  installed repository; `omni help board`, `omni help yolo`, `omni help /omni:yolo`, and
  `omni help plan` printing both entries; an unknown name exits 2 with its one line; `--help` and
  `-h` equal `omni help`; a bare `omni` still exits 2 and names `omni help`; every line at most 80
  columns.
- **`kit/test/plugin.test.mjs`**: `/omni:help` runs `omni help`, `/omni:status` runs `omni status`
  and never the gate.
- **The existing guards stay green:** `kit/test/no-literals.test.mjs` (the help text holds no
  repository literal: its paths come from the config), `kit/test/no-game-words.test.mjs`, the
  plugin guard (every `omni <command>` a skill names exists), and `kit/test/dist.test.mjs` once the
  bundle is rebuilt.

## Risks

- **What merging publishes.** The one-line install hands out `kit/dist/omni.mjs`, and the plugin
  marketplace serves `kit/plugin`: a merge gives every repository that installs the kit two new
  commands and two new skills. The gate is unchanged, so the outbox workflow and the skills that run
  it see no difference. No database, no page, no migration.
- **Rollback.** Revert the feature PR's merge commit: `omni help` and a bare `omni status` go back
  to usage errors, and the two skills go away.
- **A stage read wrong.** A repository whose branches do not follow `branches.feature` and
  `branches.phase0` shows those PRDs as inbox, or does not show them in review. The counts are then
  low, never wrong about what has shipped: the shipped count reads only the default branch.
- **Stale data.** Without `--fetch` the overview is as old as the last fetch; the header says how
  old.
- **Speed.** Each feature or phase-0 branch costs a few git calls. A repository with many stale
  branches is slower; `--fetch` prunes the remote-tracking branches deleted on the remote.
- **Wide characters.** `█`, `░`, `─` and `▶` are one column wide in a monospaced terminal. Where they
  are not, a line drifts; the words beside it say the same thing.

## Acceptance criteria

1. `omni help` prints, in this order: the loop's six stages with one line each, its principles, the
   slash commands, the terminal commands, and the commands run by the skills. Every CLI command and
   every plugin skill appears once, and the delivery folders shown are this repository's configured
   ones.
2. `omni help <name>` prints the usage, who runs it and a few sentences for any command or skill,
   takes `yolo` and `/omni:yolo` alike, prints both entries for a name that is both, and exits 2
   with one line for an unknown name.
3. `omni --help` and `omni -h` print what `omni help` prints; a bare `omni` still exits 2 and names
   `omni help`; `omni help` works in a repository with no config.
4. A bare `omni status` prints the shipped, inbox, outbox (with its open items) and in-review
   counts, a 30-cell bar of delivered against in progress with its percentage rounded down, and
   the PRDs that are yours with where each one stands, and exits 0.
5. A PRD whose feature branch carries code, or open outbox items, counts in the outbox; one whose
   feature branch is only its phase-0 copy counts in the inbox; one whose folder is only on a
   phase-0 branch counts in review and stays out of the bar.
6. `omni status --fetch` fetches the remote first; a failed fetch prints one line and still shows the
   overview; without `--fetch` no network call is made, and the header says when the last fetch was.
7. With no `user.email`, or in a shallow clone, the yours section is one line saying so, and the
   counts and the bar still show.
8. `omni status <prd>`, with every flag it takes today, behaves and prints exactly as before;
   `--fetch` with a PRD number, or a gate flag without one, exits 2.
9. `/omni:help` and `/omni:status` run their command and print its output as is.
10. No line of either command's output is wider than 80 columns.
11. `pnpm test` passes, with the tests under **Test seams**, and `kit/dist/omni.mjs` equals a fresh
    build.
