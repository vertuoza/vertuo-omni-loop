---
prd: 324
title: A status line in Claude Code, the model, the context and the PRD you work on
blocked-by: none
spec: file
---

# A status line in Claude Code: the model, the context and the PRD you work on

**Date:** 2026-09-28 · **PRD:** #324 · **Touches:** the `omni` CLI (a new `statusline` command, and
a PRD recorded per Claude session by the commands that name one), `omni init` (one key of
`.claude/settings.json`), this repository's `.claude/settings.json`, the bundle
`kit/dist/omni.mjs`, the kit README, and HOME's "Easy in, easy out" spread.

## Problem

Someone working with the loop in Claude Code cannot see, without asking, two things they need to
watch:

- **The session.** Which model it runs on, and how full its context window is. A long
  `/omni:yolo` fills the context; the person only learns it when Claude Code warns or compacts.
- **The PRD.** Which PRD this session is working on, and where that PRD stands: in review, in the
  inbox, being built (which wave, how many slices merged, any stuck), with open outbox items, or
  shipped. Today that takes `omni prd <n>`, `omni board <n>` and reading a pull request.

Claude Code has an answer for this kind of thing: a **status line**, a command it runs with the
session's data on stdin, whose output it shows at the bottom of the terminal. claude-hud
(github.com/jarrodwatts/claude-hud) uses it for the model and the context. Nothing in the loop
uses it.

## Solution

Every Claude Code session opened in a repository where the loop is installed, or in one of its
worktrees, shows two lines at the bottom of the terminal:

```text
Opus 5.5 · context ██████░░░░ 58% · usage 25%, resets in 1h30 · ask on
PRD 315 help-and-status · outbox · wave 2 of 4 · 3/5 slices merged, 1 stuck · 2 open items
```

### Line 1: the session

Parts, in this order, joined by ` · `, each left out when it has nothing to say:

- **The model:** `model.display_name` from Claude Code's JSON.
- **The context:** `context`, a bar of 10 cells, and the percentage. The percentage is
  `context_window.used_percentage` rounded down; the filled cells are that percentage divided by
  10, rounded down, at most 10; `█` is filled, `░` empty. The bar and the percentage are green
  under 50, yellow from 50 to 79, red from 80. While Claude Code sends no percentage (early in a
  session), the part reads `context —`.
- **The 5-hour usage:** `usage <u>%, resets in <t>`, where `<u>` is
  `rate_limits.five_hour.used_percentage` rounded down and `<t>` is the time to
  `rate_limits.five_hour.resets_at`: `<m>m` under an hour, `<h>h<mm>` from an hour on (`1h05`).
  Left out when Claude Code sends no five-hour window (it sends one only to Pro and Max
  subscribers), or when the reset time has passed.
- **Ask mode:** `ask on` while ask mode is on in the checkout Claude Code was launched from: the
  file the ask hooks read, `.omni-loop/local/ask.json` under `workspace.project_dir`, read with
  the kit's own `readMode`. Left out while it is off. Nothing is called to know it.

### Line 2: the PRD this session works on

```text
PRD <n> <topic>[ · <slice>] · <stage>[ · <slices>][ · <k> open item(s)]
```

- **`<topic>`** is the PRD folder's topic (`0315-help-and-status` → `help-and-status`).
- **`<slice>`** is the slice id, only when the session's branch is a slice branch (`· s2`).
- **`<stage>`** is `in review`, `inbox`, `outbox` or `shipped` (rules below).
- **`<slices>`**, in the outbox only, from the board:
  - `wave <w> of <W> · <m>/<n> slices merged`, where `<w>` is the lowest wave that holds a slice
    not merged, `<W>` the highest wave of the plan, `<m>` the slices `merged` and `<n>` all of them;
  - followed by `, <i> in flight` when slices are `in-flight` or `claimed-stale`, and `, <s> stuck`
    when slices are `stuck`, each only when not zero;
  - `all slices merged` instead, when every slice is merged;
  - left out when there is no board to show (below).
- **`<k> open item(s)`**, in the outbox only: `1 open item`, `2 open items`; left out at zero.
- **Shipped** reads `PRD <n> <topic> · shipped`, and nothing after.
- **No PRD** reads `no PRD · /omni:brainstorm to start`.

In a repository where the loop is not installed (no config loads), line 2 is not printed.

### Width and colour

- Every line fits `COLUMNS`, which Claude Code sets to the terminal's width (80 when it is unset or
  not a number). Width counts characters, never colour codes. A line too wide cuts its topic first,
  down to 8 characters ending in `…`; a line still too wide is cut at its end with `…`.
- Colour is ANSI, on the context bar with its percentage and on the stuck count (red), nowhere
  else. When the `NO_COLOR` environment variable is set to anything but an empty string, there is
  no colour.

### Which PRD

The first of these that answers:

1. **The branch of the session's folder.** The folder is `workspace.current_dir` (else `cwd`, else
   the process's own folder); its branch is `git rev-parse --abbrev-ref HEAD` there. The branch is
   matched against `branches.slice`, then `branches.feature`, then `branches.phase0`, each template
   read with `{topic}` as one or more characters (the shortest that matches) and `{slice}` as one
   or more characters other than `/`: `feat/help-and-status--s2` is the slice `s2` of
   `help-and-status`, never a feature named `help-and-status--s2`. The topic names the PRD whose
   folder is `<nnnn>-<topic>`, under `<paths.delivery>/inbox/` or `<paths.delivery>/shipped/`, in
   that folder's checkout or on the base.
2. **What this session last worked on** (below): its record names a PRD number, whose folder is
   found in the same places.
3. Otherwise, no PRD. A branch or a record whose PRD has no folder in either place is no PRD too.

**The record.** When `CLAUDE_CODE_SESSION_ID` is set (Claude Code sets it for the commands a session
runs) and passes the kit's `isSafeId`, a command that names one PRD writes
`{ "prd": <n>, "at": "<iso time>" }` to `.omni-loop/local/sessions/<session id>.json` in the
repository's **main checkout**, found with `mainCheckout` (`git rev-parse --git-common-dir`), so a
command run in a worktree records it for the same session. The commands, and where they name the
PRD:

| Command | The PRD |
|---|---|
| `omni prd <n>`, `omni board <prd>`, `omni status <prd>`, `omni phase0 <prd>`, `omni ship <prd>`, `omni harvest <prd>`, `omni dossier push <n>` | the number after the command (after `push` for `dossier`) |
| `omni plan check <prd>`, `omni rework plan <prd>` | the number after the subcommand |
| any command given `--prd <n>` (`check`, `comment`, `item new`, `replies`, `rework close`) | the flag's value |

- A number that is not a positive integer is not recorded. The record is written before the command
  runs, whatever the command then returns, and a record that cannot be written is ignored: the
  command runs exactly as it does today.
- The latest record wins. Writing one deletes the records in that folder older than 7 days.
- The status line reads the record named by the `session_id` Claude Code sends it on stdin.

That is how a `/omni:yolo 315` started on `main` shows PRD 315: the skill runs `omni prd 315` among
its first commands. After `/clear` the session is a new one, and the line reads `no PRD` until the
next command that names a PRD.

### The stage

Read from git only, as of the last fetch: the status line never fetches. The **base** is
`<repo.remote>/<repo.defaultBranch>` when that ref exists, else the local `<repo.defaultBranch>`;
with neither, the stage is left out of line 2. The PRD's **feature branch** is
`<repo.remote>/<branches.feature>` with its topic. Each PRD reads the first row that matches:

| Stage | Rule |
|---|---|
| **shipped** | its folder is in `<paths.delivery>/shipped/` on the base |
| **outbox** | its folder is in `<paths.delivery>/inbox/` on the base, and its feature branch is **built**, or holds at least one **open item**, or the board shows a slice `merged`, `in-flight` or `claimed-stale` |
| **inbox** | its folder is in `<paths.delivery>/inbox/` on the base, and it is not in the outbox |
| **in review** | its folder is on neither folder of the base |

- **Built** (the rule of PRD #315): some path outside `paths.delivery` changed on the feature branch
  since it forked from the base (`git diff --name-only <base>...<feature>`), and that path still
  differs from the base (`git diff --name-only <base> <feature>`). A phase-0 copy is byte-identical
  to the base once merged, so it never reads as built.
- **Open items** (the rule of PRD #315): the files under `<paths.delivery>/outbox/<folder>/` on the
  feature branch that `outboxItemFiles` counts: `.md` files, not `settled.md`, nothing under
  `accounts/`.
- A feature branch that does not exist is neither built nor holds items.

### The board

The slices come from a cached board, in the main checkout:
`.omni-loop/local/statusline/board-<n>.json`, holding `{ "at": "<iso time>", "slices": [{ "id",
"wave", "state" }] }` after a refresh that worked, or `{ "at": "<iso time>", "error": "<one line>" }`
after one that failed.

- **Shown** when the file holds slices and its `at` is under 10 minutes old. An error, a missing
  file or an older board shows no `<slices>` part.
- **Refreshed** when the file is missing or its `at` is 60 seconds old or more, and no refresh holds
  the lock: the status line starts `node <this omni.mjs> statusline --refresh <n>` detached, with
  its output ignored and its folder the session's folder, and renders from what the file holds
  now. It never waits for it.
- **The refresh** takes the lock `board-<n>.lock` (created exclusively; one older than 2 minutes is
  abandoned and taken over, one younger means another refresh is running and this one exits 0),
  builds the board exactly as `omni board <n>` does (the plan's slices, `gh pr list`, `boardFor`),
  writes the file to a temporary name and renames it into place, then removes the lock. Any failure
  (no `gh`, offline, no plan) is written as the error, so the next try comes 60 seconds later, not
  on every render.

### Keeping it moving

Claude Code runs the status line on its own events. While a `/omni:yolo` waits on its wave's
subagents it sends none, so the setting adds `refreshInterval: 30`: the command also runs every 30
seconds.

### Never breaking Claude Code

- `omni statusline` always exits 0 and prints at least line 1. An unexpected error prints line 1
  from Claude Code's JSON alone; JSON that cannot be read prints `omni`.
- A branch, ref, file or folder it cannot read counts as absent; it never prints to stderr.
- It never runs `git fetch`, never runs `gh` itself, and writes no file: only the detached refresh
  runs `gh` and writes the board. A session id becomes a file name only when `isSafeId` passes.
- Everything it keeps is in `.omni-loop/local/`, whose own `.gitignore` (`*`) keeps it out of every
  commit.

### The install

`omni init` adds one key to the repository's `.claude/settings.json`, creating the file (and the
`.claude/` folder) when it does not exist:

```json
"statusLine": {
  "type": "command",
  "command": "node \"${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/.omni-loop/bin/omni.mjs\" statusline",
  "refreshInterval": 30
}
```

- Every other key of the file is kept, in its order; the file is written with two-space indentation
  and a final newline.
- **The kit's own** status line is one whose `command` contains `.omni-loop/bin/omni.mjs" statusline`.
  One already there is kept (`kept    .claude/settings.json  (statusLine)`); `--force` rewrites it.
- **Anyone else's** status line is never touched, even with `--force`:
  `kept    .claude/settings.json  (its statusLine is not the kit's)`.
- **A file that is not valid JSON** is left as it is: `skipped .claude/settings.json: not valid JSON,
  no status line added`. `omni init` still succeeds.
- A written key prints `wrote   .claude/settings.json  (statusLine)`.
- The closing steps say that the status line is on for everyone who opens Claude Code in the
  repository, and that a person who wants their own sets `statusLine` in
  `.claude/settings.local.json`, which Claude Code reads first. The removal line becomes: delete
  `.omni-loop/` and the `statusLine` key of `.claude/settings.json`, and commit.
- `omni init`'s rule becomes: it writes nothing outside `.omni-loop/` but the `statusLine` key of
  `.claude/settings.json`.
- A repository that already has the loop gets the key by running `omni init` again: it keeps the
  config and the bin, as it does today.
- This repository gets the key in this PRD, beside the hooks its `.claude/settings.json` already
  holds.

### HOME

HOME's "Easy in, easy out" spread says what `omni init` now writes:

- GET IN, step 1: `omni init` adds one folder to your repository, `.omni-loop/`, and a status line
  to `.claude/settings.json`.
- GET OUT: **Delete `.omni-loop/` and the `statusLine` in `.claude/settings.json`, and commit.
  That's it.**

Paths and commands stay in `<code>`, as they are today.

### How it is built

```text
Claude Code ── JSON on stdin ──▶ omni statusline ──────────────────────▶ two lines on stdout
                                        │
kit/bin/commands/statusline.mjs    withoutContext: runs with no config; --refresh <n> is the
                                   background half
kit/lib/statusline/input.mjs       pure: Claude Code's JSON, every field optional
kit/lib/statusline/facts.mjs       the only reader: git, the checkouts, the record, the board file,
                                   ask mode
kit/lib/statusline/which-prd.mjs   pure: the branch templates, then the record
kit/lib/statusline/stage.mjs       pure: the stage rule
kit/lib/statusline/render.mjs      pure: the two lines, the bar, the width, the colour
kit/lib/statusline/board-cache.mjs the board file, its age, the lock, the refresh's start (spawn
                                   injected)
kit/lib/statusline/sessions.mjs    the per-session record: write, prune, read
kit/lib/init/settings.mjs          the statusLine key merged into .claude/settings.json
kit/bin/omni.mjs                   records the PRD a command names, before running it
```

The refresh reuses `omni board`'s own code: the part of `kit/bin/commands/board.mjs` that builds the
board is exported for it, and `omni board` itself prints exactly what it prints today. The bundle
`kit/dist/omni.mjs` is rebuilt with `node kit/build.mjs`.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The status line is on for the whole repository: `omni init` writes it into the committed `.claude/settings.json`. | Asked: "Automatic, whole repo". A plugin cannot provide a status line; only user or project settings can. |
| D2 | A status line that is not the kit's is never overwritten, even with `--force`; a person keeps their own in `.claude/settings.local.json`. | Project settings beat a person's user settings, so the kit must never take a line someone chose. |
| D3 | HOME's GET IN and GET OUT name the setting. | Asked: "Keep automatic, update HOME". The one-folder promise is no longer true, and HOME must not say it is. |
| D4 | Line 2 shows the stage and, in the outbox, the wave and the slices from the board. | Asked: "Stage + slices". |
| D5 | The board is refreshed in a detached process at most once a minute per PRD, and shown only while under 10 minutes old. | The line runs on every event and every 30 seconds; it must never wait on GitHub, and never show an old board as current. |
| D6 | With no PRD, line 2 is `no PRD · /omni:brainstorm to start`. | Asked: "A short hint". |
| D7 | Line 1 holds the model, the context bar, the 5-hour usage and `ask on`. | Asked: those extras, and not the git branch or the effort level. |
| D8 | Self-contained: the stage is PRD #315's rule written for one PRD, not #315's code. | Asked: "self-contained". #315 is in the inbox, not built; this PRD does not wait on it. |
| D9 | A board showing a slice merged or in flight reads outbox, even before the feature branch is built. | The board sees a sub-PR the moment a wave claims it; a line saying `inbox` while agents work would be wrong. |
| D10 | The branch decides first; the session's record only when the branch names no PRD. | The branch is where the session is; the record covers a yolo run from `main`, where the branch says nothing. |
| D11 | The record is written by the commands that name a PRD, from `CLAUDE_CODE_SESSION_ID`, in the main checkout. | The skills already run those commands; `omni dossier open` already reads that variable; the main checkout is shared by every worktree, as the dossier drafts are. |
| D12 | The status line never fetches, never runs `gh` in its own process, and always exits 0. | Claude Code blanks the line on a non-zero exit and cancels a run that is still going; the line must be fast and never an error. |
| D13 | `refreshInterval: 30`. | Claude Code sends no events while a session waits on background subagents, which is most of a yolo. |
| D14 | Colour only on the context bar and the stuck count, and none under `NO_COLOR`. | The two things a person must notice at a glance; everything else stays plain. |
| D15 | The command resolves the bin from `CLAUDE_PROJECT_DIR`, else from the checkout's top level. | It works from any folder of any worktree, and from the launch folder when Claude Code names it. |

## User stories

1. As someone working with the loop, I open Claude Code in the repository and see the model and how
   full the context is, without asking.
2. As that person, I see the context bar turn yellow, then red, as it fills, and know when to
   `/clear` or `/compact`.
3. As a Pro or Max subscriber, I see how much of my 5-hour usage is gone and when it resets.
4. As someone who ran `/omni:yolo 315`, I see `PRD 315`, its stage, the wave it is on, how many
   slices are merged and whether one is stuck, while the agents work and I wait.
5. As someone in a slice's worktree, I see which PRD and which slice it is.
6. As someone who answered questions on the web page, I see `ask on` and know where the next
   question will appear.
7. As someone with a status line of my own, I keep it: `omni init` never overwrites it, and I can
   keep mine in `.claude/settings.local.json`.
8. As someone adopting the loop, HOME tells me exactly what `omni init` adds and what to delete to
   stop.

## Scope

**In:**

- `kit/lib/statusline/` (`input.mjs`, `facts.mjs`, `which-prd.mjs`, `stage.mjs`, `render.mjs`,
  `board-cache.mjs`, `sessions.mjs`) and their tests.
- `kit/bin/commands/statusline.mjs`, `kit/bin/commands/index.mjs` (the command in the table),
  `kit/bin/commands/board.mjs` (its board-building part exported, its output unchanged),
  `kit/bin/omni.mjs` (the record), and their tests.
- `kit/lib/init/settings.mjs`, `kit/bin/commands/init.mjs`, `kit/lib/init/steps.mjs`, and their
  tests.
- `.claude/settings.json` of this repository: the `statusLine` key.
- `kit/dist/omni.mjs`, rebuilt.
- `kit/README.md`: one paragraph on the status line.
- `apps/galaxy/src/home/spreads/InOut.tsx` and `InOut.test.ts`: the GET IN and GET OUT lines.

**Out:**

- Subagent rows (Claude Code's `subagentStatusLine`), the git branch, the effort level, the session
  cost, links.
- Any call to GitHub from the status line's own process, and any `git fetch`.
- Repository counts when there is no PRD (PRD #315's overview).
- Any change to `omni board`'s output, to `omni status <prd>`, or to any skill's text.
- A per-person install command, and user-level (`~/.claude/settings.json`) installs.
- HOME outside the "Easy in, easy out" spread.

## Test seams

From the testing playbook: `pnpm test` runs vitest; tests sit beside their code (a command through
`main()` on a fixture repository from `makeRepo()`, a pure module on its own); no test ever calls
GitHub.

- **`kit/lib/statusline/input.test.mjs`:** a full Claude Code payload; one with every optional field
  missing; a null `used_percentage`; text that is not JSON.
- **`kit/lib/statusline/which-prd.test.mjs`:** a slice, a feature and a phase-0 branch;
  `feat/x--s1` read as slice `s1` of `x`; a topic with no folder; `main` with a record and without;
  a branch winning over a record; a record whose PRD has no folder.
- **`kit/lib/statusline/stage.test.mjs`:** one case per row; a feature branch that is only its
  phase-0 copy reads inbox; open items alone read outbox; a board with a slice in flight reads
  outbox; shipped wins over everything; no base leaves the stage out.
- **`kit/lib/statusline/render.test.mjs`:** the bar at 0, 49, 50, 79, 80, 100 and 130 %, its cells
  and colour; `context —`; the usage part present, absent and past its reset, `45m` and `1h05`;
  `ask on` present and absent; every slices wording (the wave, `m/n slices merged`, `in flight` and
  `stuck` only when not zero, `all slices merged`, no board); `1 open item`, `2 open items`; the
  shipped line; `no PRD · /omni:brainstorm to start`; `NO_COLOR`; every line within `COLUMNS` at
  40, 80 and 200, the topic cut first, colour codes not counted.
- **`kit/lib/statusline/board-cache.test.mjs`**, with an injected clock and spawn: a fresh file
  starts nothing; a missing or 60-second-old one starts exactly one refresh; a held lock starts
  none; a lock older than 2 minutes is taken over; an error hides the slices and is retried after
  60 seconds; a board 10 minutes old is not shown; the file is replaced by a rename.
- **`kit/lib/statusline/sessions.test.mjs`:** a record written and read back; an unsafe id writes
  nothing; records older than 7 days pruned on write.
- **`kit/bin/statusline.test.mjs`**, through `main()` on a `makeRepo({ git: true })` fixture cloned
  from a local bare repository: a default branch holding shipped and inbox folders; a feature
  branch with code and two outbox items; a slice branch; a phase-0 branch for a PRD not on the
  default branch; JSON on stdin; the two expected lines on each branch and on `main`; a repository
  with no config prints line 1 alone; text that is not JSON prints `omni`; exit 0 every time; the
  injected `exec` never sees `git fetch` nor `gh`; `--refresh 7` with a stubbed board writes the
  file and removes the lock.
- **`kit/bin/omni.test.mjs`:** with `CLAUDE_CODE_SESSION_ID` set, `omni prd 7` records 7 in the main
  checkout, also when run from a worktree; `omni check --prd 9` records 9; without the variable, or
  with an unsafe one, nothing is written; the command's output and exit code are unchanged.
- **`kit/lib/init/settings.test.mjs`** and **`kit/bin/init.test.mjs`:** the key added to a missing
  file and to a file holding other keys, kept in their order; the kit's own line kept, and rewritten
  with `--force`; someone else's line kept even with `--force`; a file that is not JSON left
  byte-identical, with its line printed, and init exiting 0; the closing steps naming
  `.claude/settings.local.json` and the new removal line.
- **`apps/galaxy/src/home/spreads/InOut.test.ts`:** the new GET IN step and GET OUT line, their
  paths in `<code>`; the lingo guard (`lingo.test.ts`) stays green.
- **The board:** the existing `omni board` tests pass unchanged.
- **The existing guards stay green:** `kit/test/no-literals.test.mjs`,
  `kit/test/no-game-words.test.mjs`, `kit/test/plugin.test.mjs`, and `kit/test/dist.test.mjs` once
  the bundle is rebuilt.

## Risks

- **What merging publishes.** The one-line install hands out `kit/dist/omni.mjs`, and HOME is
  rebuilt from `main`. A merge gives every repository that installs or re-runs `omni init` a status
  line for everyone who opens Claude Code there, and this repository gets one at once through its
  own `.claude/settings.json`. No database, no migration, no skill changes.
- **Rollback.** Revert the feature PR's merge commit: the command, the record and the init step go
  away, and HOME says one folder again. A repository that ran the new `omni init` keeps a
  `statusLine` key whose command no longer exists: Claude Code shows a blank line, nothing breaks,
  and deleting the key removes it.
- **Deleting only `.omni-loop/`.** The same blank line, until the key is deleted as HOME and the
  closing steps say.
- **A person's own status line.** In a repository that commits the kit's line, a person's line in
  `~/.claude/settings.json` loses to it; they move theirs to `.claude/settings.local.json`. The
  closing steps say so.
- **Claude Code's contract.** The JSON's fields and the `CLAUDE_CODE_SESSION_ID` variable are
  Claude Code's. A field that disappears leaves its part out, never an error. That the session id
  on stdin equals the one the commands see is checked by hand before the PRD ships (below).
- **Speed.** Each run is a Node start and a handful of git calls; the board costs nothing on the
  line's own time. A very large repository is slower; the line stays correct.
- **Windows.** Claude Code runs a status line through Git Bash when it is installed, else through
  PowerShell, where the `${CLAUDE_PROJECT_DIR:-…}` form does not run: the line stays blank there.
- **Checked by hand before the feature PR is ready.** Nothing automated runs Claude Code: open it in
  a worktree of this repository and see both lines, run `omni prd <n>` from a session on `main` and
  see line 2 follow, and see the board appear within a minute on a PRD with a plan.

## Acceptance criteria

1. In a repository where the loop is installed, `omni statusline` given Claude Code's JSON prints
   line 1 with the model, `context`, a 10-cell bar and the percentage rounded down, green under 50,
   yellow from 50, red from 80, and `context —` without a percentage.
2. Line 1 shows `usage <u>%, resets in <t>` only when Claude Code sends a five-hour window not yet
   past, and `ask on` only while ask mode is on in the launch folder's checkout.
3. On a slice, feature or phase-0 branch, line 2 names that PRD (and the slice, on a slice branch);
   on `main` it names the PRD this session's latest record names; otherwise it reads
   `no PRD · /omni:brainstorm to start`.
4. With `CLAUDE_CODE_SESSION_ID` set, every command listed under **The record** records the PRD it
   names in the main checkout, also from a worktree, and runs, prints and exits exactly as before.
5. The stage reads `shipped`, `outbox`, `inbox` or `in review` by the rules of **The stage**; a
   phase-0 copy alone reads inbox; open items alone, or a board with a slice merged or in flight,
   read outbox.
6. In the outbox, line 2 shows the wave, `m/n slices merged`, `in flight` and `stuck` when not zero,
   or `all slices merged`, from a board under 10 minutes old, and the open items; with no board, the
   stage alone.
7. A stale or missing board starts one detached refresh, never more while one holds the lock; the
   line never waits for it; a failed refresh is retried after 60 seconds.
8. No line is wider than `COLUMNS`; `NO_COLOR` removes every colour code.
9. `omni statusline` always exits 0, prints line 1 alone where the loop is not installed and `omni`
   for unreadable JSON, never fetches and never runs `gh` in its own process.
10. `omni init` adds the `statusLine` key with `refreshInterval: 30` to `.claude/settings.json`,
    keeps every other key, never overwrites a status line that is not the kit's, leaves a file that
    is not JSON untouched, and prints the status line and removal lines in its closing steps.
11. This repository's `.claude/settings.json` carries the key; HOME's GET IN and GET OUT name
    `.claude/settings.json`.
12. `pnpm test` passes, with the tests under **Test seams**, and `kit/dist/omni.mjs` equals a fresh
    build.
