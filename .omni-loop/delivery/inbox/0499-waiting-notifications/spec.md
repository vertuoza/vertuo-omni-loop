---
prd: 499
title: Waiting-for-you notifications — tab count, menu badges and bell, live on every page
blocked-by: none
spec: file
---

# Waiting-for-you notifications — tab count, menu badges and bell, live on every page

**Date:** 2026-09-28 · **PRD:** #499 · **Follows:** PRD 71 (ask mode), PRD 144 (shared questions),
PRD 216 (dossiers), PRD 426 (the PRD page's GitHub summary), PRD 438 (the app shell) · **Touches:** the
galaxy app only:
- the app shell, `apps/galaxy/src/nav/` (`AppShell.tsx`, `AppBar.tsx`, `Sidebar.tsx`, `viewer.ts`,
  `viewer-view.ts`, their stylesheets)
- the ask pages' poller and title, `apps/galaxy/src/ask/page/` (`poll.ts`, `tabs.ts`, `AskPage.tsx`,
  `AskQuestion.tsx`)
- a new module, `apps/galaxy/src/waiting/`, and a new route, `apps/galaxy/app/api/waiting/outbox/`

No migration, and no change to the kit, the game or the GitHub App.

## Problem

When Claude waits on a person, that person has no way of knowing it unless they are looking at `/ask`,
and even there they sometimes refresh to be sure.

- **The browser tab says nothing outside `/ask`.** `AskPage` sets `● (N) Claude asks · OMNI LOOP`
  (`tabsTitle`, `src/ask/page/tabs.ts`), but only while `/ask` is the page open. On `/prd`, `/app` or
  `/knowledge` the tab title never changes.
- **The menu is read once.** The only count in the sidebar is on **Shared with me** (`viewer.forMe`,
  read by `viewerLive()` when the page is rendered). It does not move until the page is reloaded, and
  **Questions** itself has no count: a question from the person's own terminal shows nowhere in the
  menu.
- **There is no bell.** The top bar (`AppBar.tsx`) has the title, the theme switch, Game mode and the
  avatar. Nothing in it says that something is waiting.
- **Outbox items are invisible until you open the PRD.** A red gate leaves human-action and high items
  on a PRD's feature PR. The person who opened the PRD only finds them by opening that PRD's page and
  its Outbox tab.
- **Nothing reaches a tab in the background.** No tab icon changes, no desktop notification, no sound.

## Solution

### 1. What counts as waiting for you

One list, **the waiting list**, with two parts:

| Part | Items | Read |
|---|---|---|
| **Questions** | every open round (`ask_rounds.status = 'open'`) of the person's own open sessions, and every open round shared with them | the ask pages' own readers, `readTabs` and `readForMe` (`src/ask/page/source.ts`), as the signed-in person |
| **Outbox** | every open outbox item ranked `human-action` or `high`, of a numbered dossier the person opened (`dossiers.opened_by`), while that PRD's feature PR is open | the new route (§4) |

The count is the number of items in both parts. A question both in the person's own session and
shared with them counts once (by round id).

### 2. Where it shows, on every signed-in page of the app shell

Every page that renders `AppShell` (`/app`, `/prd`, `/ask`, `/knowledge` and the pages under them)
shows the waiting list. A signed-out person sees none of it.

1. **The browser tab's title.** While the count is above 0, the title is `(N) ` followed by the
   page's own title (`(5) PRDs · OMNI LOOP`). At 0 it is the page's own title, unchanged. `/ask` no
   longer sets `● (N) Claude asks`: `tabsTitle` becomes the plain `Claude asks · OMNI LOOP` base, and
   the count is prefixed like on every other page. `AskQuestion`'s `● Claude asks · OMNI LOOP` loses
   its `● ` the same way.
2. **The tab's icon.** While the count is above 0, the page's `<link rel="icon">` points at the crest
   with a red dot in its top-right corner, drawn as an inline SVG data URL (no new file). At 0 it points
   back at the crest (`app/icon.ts`).
3. **The menu.**
   - **Questions** carries a count: the Questions part.
   - **Shared with me** keeps its count, the shared questions only, now live.
   - **PRDs** carries a count: the Outbox part.
   - An item with 0 carries no badge. Each badge keeps the existing `app-sidebar-badge` look and its
     `aria-label` ("Questions: 3 waiting").
4. **The bell.** A bell button in the top bar, between Game mode and the avatar (inside
   `app-bar-view`, after `GameModeButton`).
   - It carries the count as a red badge while above 0. Its accessible name is "Waiting for you: N"
     or "Nothing waiting for you".
   - Clicking it opens a panel under it; Escape, a click outside it or choosing an item closes it.
   - The panel lists two groups, each only when it has items:
     - **Questions:** each round's session title (its repository when it has no title), the first
       question's text on one line, and how long it has waited (`3 min`, `2 h`). Shared ones say
       "shared by <name>". Each links to `/ask/q/<round>`.
     - **Outbox:** each item's PRD (`PRD 459`) and title, the item's question on one line, and its rank
       (`human-action`, `high`). Each links to that PRD's page on its Outbox tab, `/prd/<dossier id>?tab=outbox`.
   - Oldest first within a group.
   - With nothing in either group: "Nothing waiting for you."
   - A part that could not be read (§5) shows one line in its place: "Outbox couldn't be read —
     retrying." with the items it last had, if any.
   - Its foot holds the two alert switches (§6).
   - On a phone (below 900 px) the panel takes the width of the screen under the top bar.

### 3. How it stays live

- **A waiting provider** (`src/waiting/`), mounted once by `AppShell` around the sidebar, the top
  bar and the page. The sidebar, the bell, the title and the icon read the list from it. Nothing else
  reads the ask tables for the count.
- **First paint.** The server reads the Questions part with the page, in `viewerLive()`, so the count
  is right before any script runs. `ViewerView.forMe` is replaced by `ViewerView.waiting`, the
  Questions part as the page rendered it. The Outbox part starts empty and is read by the browser
  after load: no page render waits on GitHub.
- **Questions, every 5 s.** The provider re-reads the Questions part through the browser Supabase
  client every **5 seconds** while the tab is visible, and at once when the tab becomes visible again.
- **Outbox, every 60 s.** The provider calls `GET /api/waiting/outbox` every **60 seconds** while the
  tab is visible, once after load, and at once when the tab becomes visible again, never more than
  once per 60 s.
- **One poller.** Both use `poll()` from `src/ask/page/poll.ts`, which already takes the interval as
  its third argument. `POLL_MS` stays 2 s for `/ask`'s own session reads, and the new `WAITING_MS`
  (5 s) and `OUTBOX_MS` (60 s) sit in `src/waiting/`.

### 4. The outbox route

`GET /api/waiting/outbox` answers only for a signed-in person (cookie session, `supabaseServer()`):

1. It lists the numbered dossiers (`prd is not null`) the person opened (`opened_by = auth.uid()`), in
   the workspaces they belong to, newest first, **at most 30**.
2. For each, it asks the shared GitHub reader (`dossierGithub()`, `src/dossier/github/server.ts`) for
   its summary. The reader keeps each summary for 60 s (`SUMMARY_TTL_MS`).
3. It keeps a dossier's open outbox items ranked `human-action` or `high`, only when its feature PR is
   `open` (a merged or absent feature PR keeps none).
4. It answers `{ items: [{ id, prd, dossierId, title, rank, question }], unread: number }`, where
   `unread` counts the dossiers whose summary or outbox read failed. Items are ordered by PRD, then as
   the outbox holds them.

- Signed out: 401 and no body beyond `{ error }`.
- No GitHub reader configured (`dossierGithub()` is null): 200 with `items: []` and `unread` equal to
  the number of dossiers listed.
- It reads as the signed-in person: no service key (ADR-0032).

### 5. When a read fails

- A part whose read fails keeps the items it last had. The bell's panel says that part is being
  retried (§2.4). The other part carries on, and the count is the sum of what each part holds.
- The Outbox part with `unread > 0` still shows the items it did read, and says "N PRDs couldn't be
  read".
- Nothing is thrown to the page. Each failure is logged once per kind of failure per page load
  (`console.error`), not on every poll.

### 6. Alerts for what is new

- **New** means an item (by its id) that is in a read's result and was not in the list before that
  read. The first read after load (and the list the server rendered) announces nothing: what was
  waiting when the page opened is not new.
- **Desktop alerts**, off until switched on at the foot of the bell panel:
  - Switching on asks the browser's permission once (`Notification.requestPermission()`).
  - When the permission is denied, the switch reads "Blocked by the browser" and cannot be turned on
    from the page.
  - Each new item raises one notification: "Claude is asking: <first question>" or
    "PRD <n> outbox: <question>". Its `tag` is the item id, so several open tabs raise it once.
  - Clicking it focuses that tab and opens the item's link.
- **Chime**, off until switched on at the foot of the bell panel. It plays once for each read that
  finds new items, whatever their number, as a short tone made by the Web Audio API (no audio file).
  When several tabs find the same new items, the first to write the item ids to `localStorage`
  (`omni-waiting-chimed`) plays it; the others see them already written and stay silent. A browser that
  refuses to play sound, or a `localStorage` that throws, makes no sound and breaks nothing.
- Both switches are kept in `localStorage` (`omni-waiting-alerts`), per browser. Every read and
  write is wrapped in try/catch: without storage both are off.

## Decisions

- **Mine + shared + outbox,** chosen by the person with the idea over "mine + shared" and "mine only".
- **An outbox item rings the PRD's opener,** chosen over the feature PR's author and everyone in the
  workspace. The opener is `dossiers.opened_by`, the person who ran `/omni:brainstorm` and opened the
  draft, matched by their sign-in account, not their GitHub login. A PRD without a dossier on the app
  rings no one.
- **Only `human-action` and `high` count,** the ranks that hold the gate. `medium` items are adopted
  by the loop and never wait on a person.
- **One PRD, outbox slower:** questions every 5 s, outbox every 60 s from the cached GitHub summary,
  chosen over splitting the outbox into a second PRD.
- **Polling, not Realtime,** as ask mode ruled (PRD 71, spec: "Polling, not realtime"). 5 s was
  chosen over 2 s and over Supabase Realtime.
- **A dropdown panel** under the bell, chosen over a bell that only links to `/ask`.
- **Tab icon dot, desktop alert and chime,** all three chosen, the last two off until the person
  switches them on.
- **The outbox goes to the PRD page's Outbox tab,** which exists (PRD 426). Answering outbox items
  from the page is PRD 251's work, not this one's.
- **At most 30 dossiers** per person, newest first, so the route's GitHub reads are bounded.

## User stories

1. As a person running Claude with ask mode on, I see `(1)` in my browser tab while I am reading a
   PRD, so I know Claude is waiting on me without going to `/ask`.
2. As that person, I see the count drop to nothing within about 5 seconds of answering in the
   terminal, without reloading.
3. As a teammate a question was shared with, I see **Shared with me** and the bell count it, live.
4. As the person who opened a PRD, I see its red-gate outbox items in the bell and on **PRDs** within
   about a minute, and one click takes me to its Outbox tab.
5. As someone working in another app, I get one desktop notification and one chime when something new
   waits for me, once I have switched them on, however many Omni tabs I have open.
6. As a person with nothing waiting, I see a quiet bell, a plain title and the plain crest.

## Scope

**In:** the waiting provider and its two parts; the outbox route; the tab title prefix; the tab icon
dot; the counts on Questions, Shared with me and PRDs; the bell and its panel; the desktop alert and
chime switches; replacing the `/ask` title setters.

**Out:**
- Answering an outbox item from the bell or the page (PRD 251).
- Email, Slack or push notifications to a phone.
- Marking an item as seen or read: an item leaves the list only when it is answered, settled or
  abandoned.
- Questions of other people's sessions not shared with you.
- The public pages (`/docs`, `/releases`, HOME), which have no app shell.
- Supabase Realtime, and any migration.

## Test seams

Following `omni kb show testing`: Vitest, beside the code, `*.test.ts` under `apps/galaxy/src/`. No
test calls GitHub or Supabase.

- **Pure modules in `src/waiting/`:**
  - the merge of the two parts, de-duplicated by id, and the count;
  - the title prefix: `(N) ` added, replaced when N changes, removed at 0, never doubled;
  - the new-item diff: the first read announces nothing, a later read announces only unseen ids, an
    item that leaves and comes back is new again;
  - the outbox filter: rank `human-action` or `high`, feature PR `open`, nothing from a merged,
    absent or unread feature PR;
  - the chime claim over a fake storage: the first claimer plays, the second does not, a throwing
    storage plays nothing;
  - the alert switches' storage read and write, with a throwing storage;
  - the icon swap: the dotted data URL above 0, the crest at 0.
- **The outbox route,** its handler called with a fake Supabase client and a stubbed `GithubReader`:
  signed out (401); no dossiers; a dossier with a merged feature PR; the 30 cap (31 dossiers, 30
  summaries asked); one summary failing (`unread: 1`, the others' items kept); no reader (`unread`
  equals the dossiers listed).
- **The poller:** `poll.test.ts` gains a case with the 60 s interval and a fake clock.
- **Render tests** (the existing `render.test.ts` style, `renderToStaticMarkup`):
  - the bell: nothing waiting, some waiting in both groups, one part unreadable, the switches with
    permission denied;
  - the sidebar: badges on Questions, Shared with me and PRDs, none at 0, their `aria-label`s.
- **By hand in a browser:** ask a question from a terminal with ask mode on while `/prd` is open, and
  watch the title, icon, badge and bell change without a reload; answer it in the terminal and watch
  them clear; switch on desktop alerts and the chime in two tabs and hear one chime; the panel on a
  phone.

## Risks

- **What a merge publishes:** the galaxy app only, on its next deploy. No migration runs, the kit and
  the plugin are unchanged. **Rollback:** revert the merge; nothing is stored that a revert leaves
  behind, except two `localStorage` keys in people's browsers, which the old app ignores.
- **Database load:** each visible app tab makes two small reads (own sessions' heads, shared rounds)
  every 5 s, as `/ask` already does every 2 s. A hidden tab makes none.
- **GitHub load:** the summary cache is per server instance, so on Vercel a cold instance re-reads.
  Each person's outbox call asks at most 30 summaries, each cached 60 s; the reader's existing error
  handling marks a failed one unread.
- **Wrong owner:** a PRD opened by one person and built by another rings only its opener. That is the
  decision, and it is visible in the Scope.
- **Notification fatigue:** alerts are off until switched on, and never fire for what was waiting at
  load.

## Acceptance criteria

Acceptance scenarios are off in this repository (`acceptance.enabled` is false); each criterion below
becomes ordinary tests or a manual browser check.

1. On any app-shell page, signed in, with an open round in one of my open sessions, the browser tab
   title starts with `(1) ` and the tab icon shows the red dot.
2. With the same page open, when that round is answered in the terminal, the `(1) ` prefix, the dot,
   the Questions badge and the bell's badge are gone within 10 seconds, with no reload.
3. When a new round opens in one of my sessions while I am on `/prd`, the count goes up within 10
   seconds, with no reload.
4. **Questions** in the menu counts my own open rounds plus those shared with me; **Shared with me**
   counts only the shared ones; **PRDs** counts the outbox items; an item at 0 shows no badge.
5. The bell's panel lists each waiting question with its session, first question and age, linking to
   `/ask/q/<round>`, and each outbox item with its PRD, question and rank, linking to that PRD's
   Outbox tab; with nothing waiting it says "Nothing waiting for you."
6. `GET /api/waiting/outbox` returns only `human-action` and `high` items of dossiers I opened whose
   feature PR is open; at most 30 dossiers are read; a signed-out call gets 401.
7. When the outbox read fails, the questions still update every 5 s and the panel says the outbox
   could not be read.
8. With desktop alerts and the chime switched on, a round that opens while the page is in the
   background raises one notification and one chime, even with two app tabs open; what was already
   waiting when the page loaded raises nothing.
9. With desktop alerts off (the default), nothing is raised and no permission is asked.
10. Signed out, there is no bell, no badge, no title prefix and no dot.
11. `/ask` no longer shows `● (N) Claude asks`; its title is `Claude asks · OMNI LOOP` with the
    shared `(N) ` prefix.
