# Plan: play while Claude works

PRD #757, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/play-while-working` into `main`, and the feature PR says `Closes #757`. Each slice is a sub-PR
from `feat/play-while-working--<slice>` into the feature branch, saying `Part of #757`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The terminal says it is working. `omni heartbeat`, run by a new `PostToolUse` hook on every tool, sends `POST /api/ask/heartbeat {claudeSessionId, repo, work}` at most once per 60 s per Claude session, only when signed in with `dossier.enabled` on and `ask.url` set, with a 2 s limit, and always exits 0. The work finder names the session's draft, else the PRD of a feature, phase-0 or slice branch, else the fix of a fix branch, else `null`. The `SessionEnd` hook sends `ended: true` once. ADR-0002 names the call and what leaves the machine | `kit/lib/ask/` `kit/bin/commands/heartbeat.mjs` `kit/bin/commands/index.mjs` `kit/bin/commands/help.mjs` `kit/bin/heartbeat.test.mjs` `kit/bin/ask-hook.test.mjs` `kit/bin/help.test.mjs` `kit/plugin/hooks/hooks.json` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` `.omni-loop/knowledge/adr/0002-kit-may-depend-on-a-url.md` | — | 1 |
| s2 | The app knows who is working. The `working_pings` table holds one row per Claude session, which the route `POST /api/ask/heartbeat` upserts for its owner, resolving `dossier_id` from the draft, or from the repository with the PRD or fix number. `workingState` says working, asking or idle (3 minutes, `ended`, an open question), and the store reads it for a dossier and for a Claude session | `supabase/migrations/20261019090000_working_pings.sql` `apps/galaxy/app/api/ask/heartbeat/` `apps/galaxy/src/working/` | — | 1 |
| s3 | The play dock exists. `PlayDock` draws the corner pill and opens a mini Game Boy playing Entropy Invaders, loaded on first open, kept open across tabs in `sessionStorage`, behind `cabinetDoor()`. `dockView` gives hidden, folded, playing, paused on a question, Claude done and refused, and hides it below 600 px | `apps/galaxy/src/play-dock/` `apps/galaxy/src/arcade/scenes/invaders` `apps/galaxy/src/arcade/games/invaders` | — | 1 |
| s4 | The PRD and fix pages offer the game while Claude works. The dossier page's live poll carries `working`, and `PlayDock` sits on `/prd/…`, `/visual/…` and `/bugs/…`, pausing on an open round and leading to the Questions tab | `apps/galaxy/src/dossier/` `apps/galaxy/app/prd/` `apps/galaxy/app/visual/` `apps/galaxy/app/bugs/` | s2, s3 | 2 |
| s5 | The /ask page offers the game while its terminal works. The tab's poll carries `working` for the tab's Claude session, and `PlayDock` sits beside "Claude is working", pausing on the open question and leading to it | `apps/galaxy/src/ask/page/` `apps/galaxy/app/ask/` | s2, s3 | 2 |

**Shared ground.**
- **`kit/dist/omni.mjs`:** s1 alone rebuilds it (`pnpm kit:build`), because `kit/test/dist.test.mjs`
  fails on a stale bundle.
- **`apps/galaxy/src/working/`:** s2 alone writes it. s4 and s5 only import its read functions and
  `workingState` as s2 left them, a wave later.
- **`apps/galaxy/src/play-dock/`:** s3 alone writes it. s4 and s5 only mount `PlayDock` with the
  state they read.
- **The arcade's Invaders files** (`src/arcade/scenes/invaders*`, `src/arcade/games/invaders*`):
  s3 alone, and only to export what the dock needs without the arcade's menus. The arcade's
  behaviour and its tests stay unchanged.
- **The database:** the only SQL is s2's single migration.
- **The two pages:** s4 owns `src/dossier/` and the dossier routes, and s5 owns `src/ask/page/` and
  `app/ask/`. They share no file, so wave 2 runs them side by side.

## Per slice: done when

**s1**
- Against the fake server, 100 hook runs within 60 s for one Claude session make one call, a run
  after 60 s makes a second call, and two sessions each get their own window.
- The call's body holds exactly `claudeSessionId`, `repo` and `work` (and `ended` from the end hook),
  no other field.
- The work finder returns the draft of this session; the PRD for a feature, phase-0 and slice branch
  whose folder is in `inbox` or in `shipped`; the visual and the bug fix for a fix branch; and `null`
  for a branch with no folder and for a detached HEAD.
- Signed out, with `dossier.enabled` false, or with `ask.url` null, it makes no call and exits 0.
- On 401, 404, 500 and a timeout past 2 s it exits 0 with no output.
- `hooks.json` has the `PostToolUse` entry ending in `|| true`, `no-game-words.test.mjs` passes, and
  `omni help` lists `heartbeat`.
- ADR-0002's contract paragraph names `POST /api/ask/heartbeat` and what leaves the machine.
- `pnpm test` is green, with the kit bundle rebuilt.

**s2**
- `POST /api/ask/heartbeat` answers 204 on a valid body; 400 on a missing session id, a bad `work`
  or an unknown field; 401 without a token.
- `dossier_id` resolves for a draft, for a PRD and for a visual and a bug fix, and stays null when
  there is no dossier yet.
- A persistence test with realistic rows: the owner upserts their row, another user cannot write it,
  a workspace member reads it, a non-member reads nothing.
- `workingState` is working within 3 minutes, idle at exactly 3 minutes, idle after `ended`, asking
  over working, and idle when the ping is null.

**s3**
- `dockView` covers hidden when idle, folded, playing, paused on asking, done when idle mid-game,
  refused for a visitor, for no XP and for below LV 1, and hidden below 600 px.
- Opening the pill loads the game's code on demand, and a page render test without opening it
  imports none of it.
- The open or folded state survives a remount through `sessionStorage`, and a throwing
  `sessionStorage` leaves it folded.
- A refused player sees the arcade's own line and a link to `/play`, and a finished game sends its
  score through the arcade's score sending.
- The arcade's existing Invaders tests pass unchanged.

**s4**
- The dossier's live poll answers `working`, and the page shows the pill only while it is working.
- An open round pauses the game with `⏸ CLAUDE ASKED · ANSWER`, which leads to the Questions tab.
- The dock stays open when switching the page's tabs.
- `/visual/…` and `/bugs/…` show it the same way.
- Manual browser path, in light and dark: pill, open, play, pause on a question, and "Claude is done"
  after the terminal closes.

**s5**
- The tab's poll answers `working` for its Claude session, and the tab shows the pill only while it
  is working, beside the unchanged "Claude is working" card.
- The open question pauses the game and its button leads to the question.
- Another tab's terminal working does not show the dock on this tab.
