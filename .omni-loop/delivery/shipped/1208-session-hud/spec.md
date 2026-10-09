---
prd: 1208
title: The session HUD, what this Claude session is on, its links and the slice it builds
blocked-by: none
spec: file
---

# The session HUD: what this Claude session is on, its links and the slice it builds

**PRD:** #1208 · **Builds on:** PRD 324 (the status line), PRD 757 (the heartbeat's work finder),
PRD 1139 (the loop kept in the checkout) · **Touches:** the `omni` CLI (a new `now` command, the
session record, `omni statusline`'s second line, `omni loop push`, `omni roadmap push`), `omni init`
(one key of `.claude/settings.json`), a new plugin `omni-hud` in the kit's marketplace, this
repository's `.claude/settings.json`, the bundle `kit/dist/omni.mjs`, and the kit README.

## Problem

Someone driving the loop from Claude Code cannot see, at a glance, what the session is on and where
it stands:

- **Only PRDs show.** The status line's second line (PRD 324) names a PRD and its stage. A session
  running `/omni:bug-fix` or `/omni:visual-fix`, or driving a roadmap with `/omni:drive --roadmap`,
  shows `no PRD`, or a PRD with no word about the roadmap around it.
- **No links.** The PRD's page on the Omni page, the fix's page, the roadmap's page and the pull
  requests are each one command or one search away (`omni dossier link`, `gh pr list`). Nothing on
  screen opens them.
- **No "what now".** The line counts slices (`3/5 slices merged, 1 in flight`) but never names the
  slice being built, nor the step a loop is on.

Claude Code now runs **mods**: plugins whose hooks module draws inside the session, among them a
band above the prompt whose `Link` elements are clickable in the terminal (OSC 8) and in the desktop
app alike.

## Solution

Three pieces, the reading kept apart from the drawing so that any agent can use it:

1. **`omni now [--json]`**, in the CLI: what this session is on now, its stage, the slices being
   built, what it is doing and its links. Read from git and files on this computer only.
2. **The status line's second line** (`omni statusline`) is drawn from `omni now`, for every kind.
3. **The `omni-hud` plugin**, a Claude Code mod that only draws: a band above the prompt from
   `omni now --json`, with clickable links, hidden while the session is on nothing, toggled with
   `/omni:hud`.

### What a session is on

`omni now` reads, from the session's folder (`workspace.current_dir`, else `cwd`, else the process's
folder, as the status line does) and the session id (`--session <id>`, else
`CLAUDE_CODE_SESSION_ID`):

- **The headline**, when this checkout keeps a running loop (`.omni-loop/local/loop.json`, PRD 1139)
  whose state is `live` or `sleeping`: the loop, or the roadmap it drives when it drives one. A
  parked, stopped or silent loop is no headline.
- **The work**, the first of these that answers:
  1. the loop's current PRD, when there is a headline: the `prd` of its last tick (below);
  2. the session's record (below);
  3. the branch, read by the heartbeat's work finder (PRD 757, `findWork`): the PRD of a feature,
     phase-0 or slice branch whose folder sits in the inbox or in shipped, else the visual or bug fix
     of a fix branch whose folder sits under `<paths.delivery>/visual/` or `<paths.delivery>/bugs/`;
  4. otherwise none.

  A record or a branch that names a PRD, fix or roadmap with no folder in the checkout or on the base
  is none, as today.

**The record, widened.** `.omni-loop/local/sessions/<session id>.json` becomes
`{ "kind": "prd" | "bug" | "visual" | "roadmap", "number": <n>, "at": "<iso time>" }`. A record of
PRD 324's shape, `{ "prd": <n>, "at" }`, still reads, as kind `prd`. Every rule of PRD 324's record
holds (the main checkout, `isSafeId`, written before the command runs and ignored when it cannot be
written, the latest wins, the 7-day prune). The commands that write it:

| Command | Kind and number |
|---|---|
| every command PRD 324's table names | `prd`, as today |
| `omni bug <n>`, `omni dossier push <n> --kind bug` | `bug`, `<n>` |
| `omni visual <n>`, `omni dossier push <n> --kind visual` | `visual`, `<n>` |
| `omni roadmap check <n>`, `omni roadmap push <n>`, `omni next --roadmap <n>` | `roadmap`, `<n>` |

A record of kind `roadmap` with no running loop is a headline with no work under it.

**The loop keeps its last step.** `omni loop push tick` adds to `loop.json` the step it recorded:
`"last": { "step": <k>, "prd": <n>, "action": "<word>", "result": "<line>", "at": "<iso time>" }`.
`omni loop push start` adds `"roadmap": <n>` when the loop plan it starts from was made with
`omni next --roadmap <n>`, and `null` otherwise. A `loop.json` without these fields still reads, as
no last step and no roadmap.

### Stage, slices and "doing"

- **A PRD:** its stage by PRD 324's rule (`in review`, `inbox`, `outbox`, `shipped`), worded
  `building` instead of `outbox` while a slice is not merged, and `outbox` once every slice is. Its
  slices come from PRD 324's cached board, which now also keeps each slice's **name**: the slice
  column of the plan, cut at the first full stop. The slices **in flight** are those `in-flight` or
  `claimed-stale`; `stuck` ones are named too.
- **A fix:** `fix PR open` while a pull request from its fix branch is open, `merged` once its folder
  is on the base, else `in progress`. The pull request is read by the background refresh, never by
  `omni now`.
- **A roadmap:** `<m>/<k> merged`, its PRDs whose folder is in shipped on the base over its rows
  (`omni roadmap check`'s table).
- **Doing**, one line: the loop's last step, as `step <k>: <action> PRD <n> · <result>`, when there
  is a headline; else, for a PRD with slices in flight, `building <id> <name>, <id> <name>`; else
  nothing.

### Links

Kept in `.omni-loop/local/now/links-<kind>-<n>.json` as `{ "at", "links": [{ "label", "href" }] }`,
written only by the background refresh (PRD 324's detached `omni statusline --refresh`, which now
takes a kind) and by `omni roadmap push`:

| Work | Links, in this order |
|---|---|
| PRD | `PRD page` (what `omni dossier link <n>` prints), `feature PR #<k>`, `phase-0 PR #<k>` while it is open |
| bug or visual fix | `fix page` (`omni dossier link <n> --kind <kind>`), `fix PR #<k>` |
| roadmap | `roadmap page`, the link `omni roadmap push <n>` printed last |
| loop with no roadmap | `loop page`, the Loop page's address |

A link that cannot be had is left out. The file is refreshed as PRD 324 refreshes the board: when it
is missing or 60 seconds old, by one detached process under a lock, never waited for, shown while
under 10 minutes old.

### `omni now`

- With `--json`, one document:
  `{ "headline": { "kind": "loop" | "roadmap", "number"?, "progress"?, "links": [] } | null,
  "work": { "kind", "number", "topic", "stage", "slices": [{ "id", "name", "state" }],
  "links": [] } | null, "doing": "<line>" | null }`. Without it, the same in two or three plain lines.
- It never fetches, never calls GitHub or the Omni page, writes nothing, and exits 0. It reads
  Claude Code's status line JSON on stdin when `--stdin` is given, for the session's folder and id.

### The status line's second line

Drawn from `omni now`, with PRD 324's width rule, colours and `NO_COLOR`:

```text
PRD 315 help-and-status · building · wave 2/4 · now s3 tabs, s4 board
PRD 315 help-and-status · outbox · all slices merged · 2 open items
bug #1180 login-redirect · fix PR open
visual #1150 sidebar · in progress
roadmap 7 · 3/7 merged · now PRD 315 · s3
no PRD · /omni:brainstorm to start
```

With a headline, the line reads the headline then `now PRD <n>` and the first slice in flight. A
line too wide cuts the slice names first, then the topic, as PRD 324 cuts.

### The band: the `omni-hud` plugin

A Claude Code mod in its own plugin, `kit/plugin-hud/`, listed in `.claude-plugin/marketplace.json`
beside `omni`. The `omni` plugin is not changed.

- **What it draws,** a `ui.render` hook on `AbovePrompt`, at most three rows:
  ```text
  roadmap 7 · 3/7 merged · roadmap page
  PRD 315 help-and-status · building · wave 2/4 · now: s3 tabs, s4 board
  PRD page · feature PR #1210 · phase-0 PR #1201
  ```
  Each link a `Link` element with its `href`. The first row only with a headline; the last only with
  links. `doing` replaces the "now" part of the second row when a loop runs.
- **When,** it runs `node <project dir>/.omni-loop/bin/omni.mjs now --json` with `$.process.run` at
  `session.start`, after each tool call (at most once every 10 seconds) and every 30 seconds, and
  redraws from the latest answer.
- **Hidden** (`next(e)` with nothing drawn) while `work` and `headline` are both null, while the
  command fails or its JSON does not parse, and while the person turned it off.
- **`/omni:hud`** turns the band off, or on again, for this person across sessions (`$.store`), and
  says which in one line.
- It reads nothing but `omni now`'s answer, sends nothing anywhere, and changes no file.

### The install

`omni init` adds `"omni-hud@omni-loop": true` to `enabledPlugins` in `.claude/settings.json`, beside
`omni@omni-loop`, by the rules it already follows for that file (created when missing, other keys
kept, a value set by anyone else never touched). This repository's `.claude/settings.json` gets the
same line. Setting it to `false` removes the band; the status line stays.

## Decisions

- **One reading, two drawings.** `omni now` holds every rule; the status line and the mod only draw
  it. Another agent, or a person in a terminal, gets the same answer with `omni now`.
- **The band is its own plugin.** The `omni` plugin's command hooks are not mixed with a hooks
  module, and a repository or a person turns the band off without touching the skills.
- **Many PRDs show as a headline and the current one** (the person chose it): a loop or roadmap on
  top, then only the PRD of the step running now, never one row per PRD.
- **The band shows only while the session is on something** (the person chose it), with `/omni:hud`
  to turn it off.
- **No network on screen.** Links come from a file the background refresh keeps, as PRD 324's board
  does: nothing drawn ever waits on GitHub or the Omni page.
- **No proof video:** the change is inside Claude Code, which the proof cannot film.
- **The voice.** persona:B-E DEv objected to the design: another band over the prompt is more fluff
  in their way. Settled `accepted`: the band hides itself while the session is on nothing, and
  `/omni:hud` turns it off for good.

## User stories

- As a person running `/omni:yolo 315`, I see at the bottom of Claude Code which slices are being
  built now, and open the feature PR with one click.
- As a person running `/omni:bug-fix`, I see the bug's number, whether its PR is open, and its page.
- As a person driving a roadmap, I see the roadmap's progress and page, and the PRD and step the
  loop is on.
- As a person who wants none of it, I type `/omni:hud` once and the band is gone.
- As an agent other than Claude, I run `omni now --json` and read the same thing.

## Scope

In: `omni now`; the widened record and the commands that write it; `last` and `roadmap` in
`loop.json`; slice names on the cached board; the links file and its refresh; the status line's
second line for every kind; the `omni-hud` plugin with `/omni:hud`; `omni init` and this
repository's settings; the kit README.

Out: a side pane; one row per PRD of a roadmap; any change to the `omni` plugin's skills or hooks;
any call from the mod to the network; a mega (plan repository) headline beyond what `loop.json`
holds; the heartbeat, which keeps its own finder.

## Test seams

Following `omni kb show testing`: tests beside the code, on fixtures, never calling GitHub or the
Omni page.

- **`omni now`**, through `main()` on a fixture repository (`kit/test/fixture.ts`): one case per
  kind (PRD on a feature branch, PRD from a record on `main`, bug fix branch, visual fix branch,
  roadmap record, running loop with a last step, loop parked), each in plain and `--json` form; a
  record of PRD 324's shape; a loop file without `last`; links present, missing, and over 10 minutes
  old; nothing at all.
- **The record writers:** each command of the table writes its kind and number, its output and exit
  unchanged.
- **The status line render:** the six lines above, the width cut on slice names then topic, and
  `NO_COLOR`.
- **The refresh:** slice names on the board file, the links file for each kind, the lock, with `gh`
  and the Omni page stubbed.
- **The mod:** `claude plugin validate kit/plugin-hud` and a `*.test.ts` under it run by
  `claude plugin test`, fed fixed `omni now` answers: hidden on null work and headline, on a failed
  command and on bad JSON; three rows with links; `/omni:hud` off then on.
- **`omni init`:** the `enabledPlugins` line added, kept, and never overwritten when set by someone
  else.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the kit bundle `kit/dist/omni.mjs` and the
  marketplace, which now serves a second plugin. Every repository that updates the kit gets
  `omni now`, the new second line and, after `omni init`, the band.
- **Mods are new in Claude Code.** A Claude Code too old for hooks modules does not load `omni-hud`;
  the status line still works, so nothing is lost.
- **The status line changes wording** (`building` for a PRD with slices not merged). A person who
  reads it by eye is the only reader; no tool parses it.
- **Rollback:** revert the feature PR. The session records and `loop.json` stay readable by the
  older kit, which ignores the new fields; a record of a new kind reads as none there.

## Acceptance criteria

- On a slice branch of a PRD being built, `omni now --json` names the PRD, its stage `building`, and
  each slice in flight by id and name; the status line's second line reads
  `PRD <n> <topic> · building · wave <w>/<W> · now <id> <name>, …`.
- After `omni bug <n>` on `main`, in a session, `omni now` names bug `<n>`; on its fix branch it
  names it without any record; the second line reads `bug #<n> <topic> · …`. The same holds for
  `omni visual <n>`.
- With a running loop that drives roadmap `<r>`, `omni now` shows the roadmap as the headline with
  `<m>/<k> merged`, the PRD of the loop's last step as the work, and `doing` as
  `step <k>: <action> PRD <n> · <result>`.
- Once the background refresh ran, `omni now --json` lists the PRD page, the feature PR and the
  phase-0 PR while it is open; for a fix, the fix page and its PR; for a roadmap, its page.
- `omni now` exits 0, prints nothing on stderr, and makes no network call, in every case above and
  on a repository where the loop is not installed.
- In Claude Code with `omni-hud` enabled, the band above the prompt shows the headline, the work and
  clickable links, and shows nothing when the session is on nothing.
- `/omni:hud` hides the band, in this and later sessions, and shows it again when typed again.
- `omni init` on a fresh repository leaves `"omni-hud@omni-loop": true` in `enabledPlugins`.
