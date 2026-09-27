---
prd: 142
title: Ask mode — one page, a tab per terminal
blocked-by: none
spec: file
---

# Ask mode: one page, a tab per terminal

**Date:** 2026-09-26 · **PRD:** #142 · **Amends:** PRD 71's spec, decision 7 ("One session per
checkout") and its local-state layout (decision 6 keeps its folder)

## Problem

Ask mode is keyed to the checkout, and a person often runs several Claude Code terminals in one
checkout. Every terminal reads the same `.omni-loop/local/ask.json` and writes the same
`.omni-loop/local/ask-round.json`. Nothing reads the `session_id` the hooks are given, so the
terminals clash in three ways:

- **One page for all of them.** Every terminal posts its rounds into the one session. The page
  offers only the newest round (`apps/galaxy/src/ask/page/view.ts`, `sessionView`). The other
  terminal's question can never be answered there: its hook waits the full 540 s, then the terminal
  takes over.
- **One round file for all of them.** Terminal B's `pre` hook overwrites A's round. When A's `post`
  hook runs, the `tool_use_id` does not match, yet it deletes the file anyway
  (`kit/lib/ask/hook.mjs`, `postHook`'s `finally`). B's terminal answer is then never shown on the
  page.
- **One switch for all of them.** `omni ask on` in B replaces A's session and closes it. A's
  waiting `pre` hook then reads `closed` and deletes `ask.json`, the file B has just written. The
  mode goes off in both terminals.

The person is left stuck on one page with questions they cannot reach, and cannot tell which
terminal is asking.

## Solution

**The mode stays switched on per checkout. The session becomes per terminal. The page shows every
terminal as a tab.**

```text
omni ask on          the checkout's flag; prints the person's page, <ask.url>/ask
  terminal A asks    A's first question opens A's own session ("vertuo-omni-loop · main"),
  terminal B asks    and B's opens B's. Each tab answers its own terminal.
  terminal A exits   its SessionEnd hook closes A's session; its tab goes away
omni ask off         closes every terminal's session of this checkout; deletes the flag
```

### The kit side

**Local state**, still in `.omni-loop/local/`, still ignored by its own `.gitignore`:

| File | Holds | Written by |
|---|---|---|
| `ask.json` | `{ host }`: the mode is on in this checkout, against that host | `on`; deleted by `off` |
| `ask/<claude-session-id>.json` | `{ sessionId, host }`: this terminal's ask session | the first `pre` of that terminal |
| `ask/rounds/<tool-use-id>.json` | `{ roundId, status }`: one question's round | `pre`; read and deleted by `post` |

- `<claude-session-id>` is the hook input's `session_id` and `<tool-use-id>` its `tool_use_id`.
  Either one is used as a file name only when it matches `^[A-Za-z0-9_-]{1,128}$`. Anything else
  reads as missing, and the hook stays quiet.
- An `ask.json` in PRD 71's shape (`{ sessionId, url, host }`) reads as the mode being on against
  `host`. Its `sessionId` is kept only so that `off` can close it.

**Commands.**

- `omni ask on` needs `ask.url` and a sign-in, as today. It writes `ask.json` and prints
  `<ask.url>/ask`. It opens no session and closes none, so switching it on in one terminal never
  touches another. When it is already on, it prints the same link and changes nothing.
- `omni ask off` closes, on the server, every session named under `ask/`, and the PRD 71 session
  when `ask.json` still holds one. It then deletes `ask.json` and the `ask/` folder, whatever the
  server said, and prints `off`. A session that could not be closed is named on stderr, as today.
- `omni ask status` prints `<ask.url>/ask`, or `off`. It reads the checkout alone and calls
  nothing.

**Hooks.** Each reads its JSON input before deciding anything.

- `pre` (PreToolUse on `AskUserQuestion`):
  1. It finds this terminal's session file. When there is none, it opens a session titled
     `<repo slug> · <branch>` and writes the file.
  2. It posts the round and writes `ask/rounds/<tool_use_id>.json`, then waits exactly as today.
  3. When the wait reads `closed`, it deletes only this terminal's session file and its round
     file, and the terminal takes the question. The next question opens a fresh session. The mode
     stays on.
- `post` (PostToolUse): it reads only `ask/rounds/<tool_use_id>.json`, posts a terminal answer as
  today, and deletes that one file.
- `prompt` (UserPromptSubmit): unchanged, one sentence of context.
- `end`: a new SessionEnd hook, in `kit/plugin/hooks/hooks.json`. It closes this terminal's
  session on the server and deletes its session file. When the server cannot be reached, the
  session reads as closed after 12 hours without a call, as today.
- With no `session_id` in the input, `pre` answers nothing and the terminal prompt shows. A hook
  still never fails a session.

### The page side

**Routes.**

- `/ask` is new: the person's page. It lists every ask session they own that is open, meaning
  status `open` and a call within the last 12 hours. That covers every checkout and worktree they
  have ask mode on in. Signed out, it shows the sign-in card that returns to `/ask`.
- `/ask/<id>` is the same page with that session's tab selected. The links PRD 71 printed keep
  working. A closed session named in the URL still opens, read-only, as its own tab at the end of
  the list.

**The tab list**, on the left from 720 px:

- Each tab shows the session's title (`<repo slug> · <branch>`) and its latest question's header,
  which tells apart two terminals on the same branch.
- Each tab also shows its state:
  - **needs you · <age>**, with a badge, while its newest round is open and less than 540 s old;
  - **working** otherwise.
- The order is: tabs that need you first, oldest question first; then the others, most recently
  active first.
- The browser tab's title counts the tabs that need you: `● (2) Claude asks · OMNI LOOP`, and
  `Ask · OMNI LOOP` when none do.
- `/ask` selects the first tab in that order. The page never changes the selected tab by itself:
  a question arriving in another tab only lights that tab's badge.
- With no open session, the page says ask mode is not on in any terminal, and names
  `/omni:ask on`.

**Below 720 px**, the tab list folds into one row at the top, for example "Terminals (3) · 1 needs
you". Opening it shows the same list, and picking a tab closes it again.

**The pane** is PRD 71's page for the selected session: the open round, "working", "moved to the
terminal" or "closed", and the history. It is reused unchanged.

**Polling** stays at every 2 s. One read lists the person's open sessions, with the status and
header of each one's newest round. The selected session is read by the existing `sessionReader`.
Reads go straight to the database as the signed-in person, so row-level security decides, as
today.

**No migration.** `ask_sessions` and `ask_rounds` already allow many sessions per owner, and their
policies already scope every read to the owner.

## Decisions

1. **The mode is per checkout; the session is per terminal.** The person chose this (2026-09-26)
   over a switch per terminal. One `on` covers every terminal of the checkout, and each gets its
   own tab. This replaces PRD 71's decision 7.
2. **A terminal is Claude Code's `session_id`,** as the hooks receive it. The `on` command runs in
   Bash and has no session to key, so sessions are opened lazily by the first `pre`, never by `on`.
3. **Rounds are keyed by `tool_use_id`,** not by terminal. `pre` and `post` of one tool call always
   find each other, and no call can delete another call's round.
4. **One page for the person, not one per checkout.** The person chose the tabbed page across every
   checkout and worktree over a page per folder. `/ask` is a stable link, so `on` prints the same
   one every time.
5. **The page never switches tabs by itself.** A person halfway through an answer is never moved.
   A badge and the browser title say where else a question waits.
6. **A SessionEnd hook closes a terminal's tab.** Without it, a closed terminal's tab would stay
   for 12 hours.
7. **No migration.** The schema already allows it. The table comment still says "one per
   checkout"; it is left as it is, so this PRD ships nothing to the production database.

## User stories

1. As a person with two terminals in one checkout, I answer each terminal's question in its own tab,
   and neither terminal waits for the other.
2. As a person with terminals in several worktrees, I keep one page open and see every question
   waiting, wherever it comes from.
3. As a person answering in one tab, I am never moved to another tab while I type. I see that
   another terminal is waiting by its badge.
4. As a person who switches ask mode on in a new terminal, the terminals already asking are not
   disturbed.
5. As a person who closes a terminal, its tab goes away.
6. As a person on a phone, I pick the terminal from a list at the top and answer there.

## Scope

**In:**
- the kit: local state, `on`, `off`, `status`, the `pre` and `post` hooks, the new `end` hook, and
  `hooks.json`;
- the `/omni:ask` skill text and the command's help;
- the galaxy: the `/ask` route, the tab list, the list reader, and the `/ask/<id>` route
  rendering the same page;
- this spec's replacement of PRD 71's decision 7;
- the rebuilt `kit/dist/omni.mjs`.

**Out:**
- several open questions inside one terminal (the pane still offers the newest round);
- sharing a page with another person;
- Realtime or push notifications;
- renaming a tab;
- a migration.

## Test seams

- **Local state** (`kit/lib/ask/local-state.test.mjs`): the three files, written and read; an id
  that is not a safe file name reads as missing; the PRD 71 `ask.json` reads as on.
- **Hooks** (`kit/lib/ask/hook.test.mjs`, against `kit/test/fake-ask-server.mjs`):
  - two `session_id`s asking at the same time open two sessions, and each gets its own answer;
  - `post` for one `tool_use_id` never reads or deletes another's round;
  - `closed` in one terminal deletes only that terminal's file, and the next question opens a new
    session;
  - `end` closes its own session only;
  - no `session_id` means no output.
- **Commands** (`kit/bin/ask.test.mjs`, `kit/bin/ask-hook.test.mjs`, through `main()`):
  - `on` prints `<ask.url>/ask` and opens nothing;
  - `off` closes every session named under `ask/`, and the PRD 71 one;
  - `status` prints the link or `off`;
  - `hook end` is accepted.
- **The page** (`apps/galaxy/src/ask/page/*.test.ts`, pure functions and stubbed database):
  - the tab list's order, states and ages;
  - the counted title;
  - which tab `/ask` selects;
  - that a new question elsewhere never changes the selection;
  - the list reader's query, scoped to open sessions;
  - the empty state;
  - the layout rules in `theme-tokens.test.ts` (tabs beside the pane from 720 px, folded below).
- A test never calls Supabase or GitHub.

## Risks

- **What a merge publishes.**
  - The kit: `kit/dist/omni.mjs` and `kit/plugin`, including a new hook in `hooks.json`.
  - The galaxy's `/ask` pages, on its next deploy.
  - Nothing reaches the database.
- **A mixed rollout.** A terminal still on an old kit keeps writing `ask-round.json` and reading
  `ask.json`. The new kit ignores `ask-round.json` and reads the old `ask.json` as on. An old hook
  reading the new `{ host }` file finds no session and stays quiet, so the terminal prompt shows.
  Nothing blocks; at worst the question goes to the terminal.
- **Stale sessions.** A terminal killed without its SessionEnd hook leaves its tab for up to 12
  hours. That is the existing idle rule.
- **Rollback:** revert the feature PR. Sessions opened by the new kit simply close after 12 idle
  hours, and `omni ask on` in the old kit writes its own `ask.json` shape again.

## Acceptance criteria

1. Two terminals in one checkout with ask mode on each ask a question. Both questions show on
   `/ask`, as two tabs, and each answer reaches its own terminal.
2. Answering in the terminal for one question never removes another terminal's round, and the
   answer shows in that tab's history.
3. `omni ask on` run in a second terminal leaves the first terminal's session open and its mode on.
4. When one terminal's session is closed on the server, only that terminal's next question opens a
   new session. The other terminals keep theirs.
5. `omni ask off` closes every session of the checkout, and `omni ask status` then prints `off`.
6. A terminal that exits closes its session. Its tab is gone from `/ask` on the next poll.
7. `/ask` selects the first tab that needs the person, and a question arriving in another tab only
   badges that tab. The browser title counts the tabs that need the person.
8. `/ask/<id>` opens the page with that tab selected, and a PRD 71 link still opens.
9. Below 720 px the tabs fold into a list at the top, and the page scrolls.
10. `pnpm test` is green, and `kit/dist/omni.mjs` matches a fresh build.
