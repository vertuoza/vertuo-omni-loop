---
prd: 757
title: Play while Claude works
blocked-by: none
spec: file
---

# Play while Claude works

**Date:** 2026-09-30 · **PRD:** #757
**Touches:**
- `kit/bin/commands/` (a new `heartbeat` command), `kit/lib/ask/` (the throttle, the work finder, the
  client call), `kit/plugin/hooks/hooks.json` (one `PostToolUse` hook), `kit/test/fake-ask-server.mjs`
- `supabase/migrations/` (one new file: the `working_pings` table and its functions)
- `apps/galaxy/app/api/ask/heartbeat/` (the new route), `apps/galaxy/src/working/` (a new module: the
  store and `workingState`)
- `apps/galaxy/src/dossier/` (the live poll carries `working`), `apps/galaxy/src/ask/page/` (the same
  for a terminal's tab)
- `apps/galaxy/src/play-dock/` (a new module: `PlayDock`, `dockView`, its CSS), reusing
  `apps/galaxy/src/arcade/games/invaders.ts`, `src/arcade/scenes/invaders.tsx`,
  `src/arcade/games/room.ts` (`cabinetDoor`) and `src/arcade/scenes/invaders-score.ts`
- `.omni-loop/knowledge/adr/0002-kit-may-depend-on-a-url.md` (amended: the new call)

## Problem

A long Claude session leaves the Omni page idle. While a brainstorm writes its design between two
questions, or `/omni:yolo` builds a PRD for an hour, the PRD's page shows only empty tabs ("No
question yet", "The before/after page has no version yet") and the terminal says "Waiting for 1
background agent to finish". The person has nothing to do but wait, and no sign on the page that
anything is happening.

The page cannot even tell that Claude is working. A Claude session reaches the Omni page only when
it asks its first question with ask mode on (`POST /api/ask/sessions`, from the `PreToolUse` hook).
Between questions, `sessionView()` infers "working" from an open session with no open round, and
that holds for 12 hours even after the terminal is gone. A `/omni:yolo` run that asks nothing never
reaches the page at all.

## Solution

Two parts: the terminal says it is working, and the page offers the arcade's game while it does.

### 1. The heartbeat (kit → app)

- A new `PostToolUse` hook, on every tool, runs `node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs"
  heartbeat || true`.
- `omni heartbeat` sends at most **one call per 60 seconds per Claude session**. It keeps the time of
  its last call under `.omni-loop/local/`, and a call inside the window returns without any network
  work.
- It sends only when this computer is signed in to the Omni page and `dossier.enabled` is true with
  `ask.url` set. Ask mode on or off makes no difference. Otherwise it exits 0, silent.
- The call is `POST /api/ask/heartbeat` with the bearer token, `{claudeSessionId, repo, work}`,
  answered `204`. It has a 2-second limit and no retry. Any failure (unreachable, 401, 404 from an
  older server, 5xx) exits 0, silent: the hook never blocks or fails a tool.
- `work` is what the session works on, found locally, in this order (the **work finder**):
  1. the draft this Claude session opened with `omni dossier open` (the local record the command
     keeps): `{kind: 'draft', draftId}`;
  2. else, the hook input's `cwd` is on a branch shaped `branches.feature`, `branches.phase0` or
     `branches.slice`, and the `inbox` or `shipped` folder under `paths.delivery` holds
     `<nnnn>-<topic>` for its `<topic>`: `{kind: 'prd', number}`;
  3. else, the branch is shaped `branches.fix`, and the `visual` or `bugs` folder under
     `paths.delivery` holds `<nnnn>-<topic>`: `{kind: 'visual' | 'bug', number}`;
  4. else `null`: the session alone, which the /ask page still uses.
- The `SessionEnd` hook, which `omni ask hook end` already runs, also sends
  `POST /api/ask/heartbeat {claudeSessionId, repo, work: null, ended: true}` once, with the same
  limits.
- Only the Claude session id, the repository's name, the work's kind and number (or the draft's id)
  and the time leave the machine. No tool name, no path, no command, no transcript text.

### 2. Working, on the app

- A new table, `working_pings`, holds one row per Claude session: `claude_session_id` (primary key),
  `user_id`, `workspace_id` (the caller's, as `ask_sessions_place()` sets it), `repo`, `work_kind`,
  `work_number`, `dossier_id` (resolved from the draft id, or from the repository with the kind and
  number, as `dossier push` keys it; null when none exists yet), `seen_at`, `ended_at`.
- The route upserts the caller's own row. Only the row's owner writes it; workspace members read it,
  as they read the dossier.
- `workingState(ping, openQuestions, now)` is the one rule, a pure function:
  - `working` when a ping exists, it has no `ended_at`, `now - seen_at` is under **3 minutes**, and
    no question is open;
  - `asking` when a question is open (a round of the dossier, or of the terminal's session on /ask);
  - `idle` otherwise, including when the ping cannot be read.
- A dossier is working when any of its pings is working. /ask reads the ping of the terminal's
  Claude session. The live polls both pages already run every 2 seconds carry `working` in their
  answer, so no new poll is added. The fix pages use the dossier page's poll.

### 3. The play dock (the pages)

The pick from the rendered placements was **C, the corner dock**.

- One client component, `PlayDock`, sits on `/prd/…`, on the fix pages (`/visual/…` and `/bugs/…`,
  the dossier page on its own routes), and on `/ask` for the tab shown.
- **Folded:** a pill in the bottom-right corner, "● ▶ Play while Claude works". It shows only while
  the page is `working`, and never below 600 px wide.
- **Opened:** a mini Game Boy about 260 px wide, playing Entropy Invaders. It uses the arcade's game
  (`games/invaders.ts`), its overlay and sprites, and its score sending, and none of its menus. It is
  opened with the pill, and folded with ✕ or `Esc`.
  - It stays open across the page's tabs: its open or folded state is kept in `sessionStorage`, read
    in a `try`, and it is folded when the read fails.
  - The game's code is loaded when the dock first opens (a dynamic import), so a page where nobody
    opens it downloads none of it.
- **Who plays:** the arcade's rules, through `cabinetDoor()`. A player at LV 1 or more plays, and
  their scores go to the arcade's scores as they do there. A visitor, or a player below the level,
  sees the device with the arcade's own refusal line (`LINK GITHUB TO EARN XP`,
  `REACH LV 1 TO PLAY`, …) and a link to `/play`.
- **A question arrives** (the page turns `asking`): the game pauses at once and the device shows
  `⏸ CLAUDE ASKED · ANSWER`. The button goes to the Questions tab on a dossier page, and to the
  question on /ask. It never resumes by itself: the player presses start.
- **Claude stops** (the page turns `idle` while a game is on): the pill is gone, and the open device
  shows `CLAUDE IS DONE` over the field, keeps the score, and lets the game go on to its end. Folded,
  it does not come back until the page is `working` again.

`dockView(state, door, game)` is the pure view: folded, hidden, playing, paused on a question, Claude
done, or refused by the door.

## Decisions

1. **The game plays on the page,** in a panel, not in a new tab or on `/play`. The page keeps
   polling, so the game can pause the moment a question arrives. The person chose it.
2. **The arcade's rules apply:** GitHub linked and LV 1, scores saved as in the arcade. No free play.
   The person chose it over free play for all.
3. **Shown only while Claude works and nothing waits.** Not after a delay, and never on a plain
   empty tab. The person chose it.
4. **The corner dock (C)** over a strip under the tabs, the empty box as the device, a right rail, or
   an overlay. The person chose it from five rendered placements.
5. **On the PRD page, the fix pages and /ask.** The terminal prints nothing new.
6. **A throttled hook heartbeat** over skills saying start and stop, or over ask-mode sessions only.
   It is real liveness, needs no skill change, and a dead terminal clears itself in 3 minutes. The
   person chose it.
7. **Sent whenever signed in with dossiers on,** not only with ask mode on, and with no switch of its
   own. The person chose it.
8. **ADR-0002 is amended** by this PRD's last slice: the kit's contract gains
   `POST /api/ask/heartbeat`, and the list of what leaves the machine gains the work's kind and number
   and the time. The call and its hook stay game-free: the kit names a heartbeat and working, never the
   arcade, and `kit/test/no-game-words.test.mjs` keeps passing.
9. **Numbers:** 60 seconds between calls, working for 3 minutes after the last one, 600 px for the
   dock, a 2-second call limit. Each is a named constant beside its rule.

## User stories

1. As someone waiting on a brainstorm between two questions, I see "▶ Play while Claude works" on
   the PRD's page and play Invaders until Claude asks.
2. As someone who started `/omni:yolo 757` and opened PRD 757's page, I see the dock while the waves
   build, even though nothing is asked.
3. As a player mid-game, when Claude asks a question, the game pauses and one press takes me to the
   question.
4. As a player, when the terminal finishes or is closed, the dock says Claude is done within 3
   minutes and lets me finish my game.
5. As a visitor without GitHub linked, I see the device and the arcade's line telling me why I
   cannot play, with a link to the arcade.
6. As someone on /ask with a terminal's tab open, I get the same dock while that terminal works.
7. As a person not signed in on this computer, or in a repository with dossiers off, my terminal
   sends nothing and nothing changes for me.

## Scope

In:
- the `heartbeat` command, its hook and the `SessionEnd` call;
- the table, the route, `workingState` and `working` on the two live polls;
- `PlayDock` on the dossier page (PRD and fix routes) and on /ask;
- the ADR-0002 amendment.

Out:
- any new game, any change to Invaders' rules, levels or scores;
- the dock on phones (below 600 px), on `/app` dashboards and in the bell;
- a line in the terminal, and any change to a skill;
- replacing `sessionView()`'s own "Claude is working" card on /ask: it stays, and the dock sits
  beside it.

## Test seams

Following `omni kb show testing`: tests beside the code, pure modules first, the kit's commands
through `main()` on a fixture repository with `makeRepo()`, and the kit against
`kit/test/fake-ask-server.mjs`.

- **Kit, the throttle:** a second call within 60 s sends nothing. A call after 60 s sends. Each
  Claude session has its own window.
- **Kit, the work finder:** the draft of this session. A feature, phase-0 and slice branch to a PRD
  in `inbox` and in `shipped`. A fix branch to a visual fix and to a bug fix. A branch with no
  folder, and a detached HEAD, to `null`.
- **Kit, the command:** it exits 0 and makes no call when signed out, with `dossier.enabled` false,
  or with `ask.url` null. It exits 0 on 401, 404, 500 and a timeout from the fake server. The body
  holds exactly `claudeSessionId`, `repo`, `work` (and `ended` from the end hook), no other field.
- **Kit, the hook file:** `hooks.json` has the `PostToolUse` entry with `|| true`.
  `no-game-words.test.mjs` passes.
- **Migration:** a persistence test with realistic rows. The owner upserts their row. Another user
  cannot write it. A member of the workspace reads it. A non-member reads nothing.
- **App, the route:** 204 on a valid body. 400 on a missing session id, a bad `work`, or an unknown
  field. 401 without a token. `dossier_id` resolves for a draft, for a PRD and for a fix, and stays
  null when there is no dossier yet.
- **App, `workingState`:** working within 3 minutes, idle at exactly 3 minutes, idle after `ended`,
  asking over working, idle when the ping is null.
- **App, `dockView`:** hidden when idle, folded, playing, paused on asking, done when idle
  mid-game, refused for a visitor, for no XP and for below LV 1, and hidden below 600 px.
- **App, the pages:** the dossier poll and the /ask poll answer `working`. `PlayDock` renders the
  pill only while working, and the dock state survives a tab change.
- **Manual browser path (visual risk):** on a PRD page with a live terminal, check the pill, open,
  play, pause on a question, and "Claude is done" after the terminal closes, in light and dark.

## Risks

Following `omni kb show releasing`, a merge to `main` publishes:

- **The kit and its plugin.** Every signed-in terminal with dossiers on now runs `omni heartbeat`
  after every tool call. Most calls return before any network work, but a slow machine pays for
  starting Node each time. Rollback: revert the PR. `omni update` then brings the plugin back
  without the hook.
- **The database.** One migration adds `working_pings`. Rollback: revert the code. The table can
  stay, since nothing reads it without the code.
- **The galaxy app.** The dock loads nothing until opened. A broken dock hides itself, because
  `idle` is the fallback.
- **Privacy.** A teammate in the workspace can now see that someone's terminal is working on a PRD.
  That is what the page is for, and no content is sent.

## Acceptance criteria

1. With a terminal signed in and dossiers on, working on the feature branch of PRD n, PRD n's page
   shows the "▶ Play while Claude works" pill within one poll after the first tool call.
2. The same terminal making 100 tool calls in one minute sends at most one heartbeat.
3. Opening the pill shows a Game Boy playing Entropy Invaders for a player at LV 1 or more, and
   their finished game's score appears in the arcade's scores.
4. A visitor or a player below LV 1 sees the arcade's refusal line and a link to `/play`, never the
   game.
5. When Claude asks a question on that PRD, the game pauses within one poll and shows
   `⏸ CLAUDE ASKED · ANSWER`, which leads to the Questions tab.
6. Within 3 minutes of the terminal closing, or at once when its session ends, the pill is gone and
   an open game shows `CLAUDE IS DONE` with its score kept.
7. The dock stays open while switching between the PRD page's tabs.
8. A visual fix's page and a bug fix's page show the dock while a terminal works on its `fix/<topic>`
   branch, and /ask shows it for the working terminal's tab.
9. Signed out, or with `dossier.enabled` false, the hook makes no network call and exits 0.
10. No tool call ever fails or waits more than 2 seconds because of the heartbeat.
