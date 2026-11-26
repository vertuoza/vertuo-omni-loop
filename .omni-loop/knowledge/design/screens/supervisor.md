---
screen: supervisor
status: draft
kind: page
mock: supervisor.html
implements: [apps/galaxy/app/app/supervisor/page.tsx, apps/galaxy/app/app/supervisor/loading.tsx, apps/galaxy/src/supervisor/page/SupervisorPage.tsx, apps/galaxy/src/supervisor/page/SupervisorBoard.tsx, apps/galaxy/src/supervisor/page/SeatControls.tsx, apps/galaxy/src/supervisor/page/supervisor.css]
reads: [apps/galaxy/src/supervisor/page/model.ts, apps/galaxy/src/supervisor/page/load.ts, apps/galaxy/src/supervisor/page/live.ts, apps/galaxy/src/supervisor/page/seat.client.ts, apps/galaxy/src/supervisor/api/, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/sidebar.ts, apps/galaxy/src/dashboard/MemberGate.tsx]
routes: [/app/supervisor]
supersedes: null
---

## Purpose

What the workspace's Supervisor found, and what needs an owner: one agent per workspace watches runners,
jobs, missions and Omni Loop itself from a seat on a runner, and this page lists its findings, each with
the check that fired and its figures first, then the evidence, then its thread, beside the general chat.
Every member reads it; only workspace owners act on it (PRD omni-loop-34).

## Regions

- **The header,** a card: the owl's face (the `menu-supervisor` sprite at 2×, a dot green while watching,
  grey when paused or past the limit, red when offline), `Supervisor` and its state, then the meta line
  in mono: `seat atlas-01 · slot 4`, `last look 40 s ago`, `next in 1 min 20`, `412k tokens today of
  5M`. At its end, for an owner: `Memory · <n>` (s6), `Token limit` (the daily limit, in millions, opened
  in place with Save and Cancel) and `Pause` (or `Resume`). For a member: `Read only · owners act`.
- **The seat's notice,** under the header, only when it says something: `Offline since 14:02 on
  atlas-01. Checks still run.` with an owner's `Move the seat` (to the Runners page), or `No Supervisor
  seat yet.` with an owner's `Open Runners`.
- **The tabs:** Open with its filled count, Done with its count.
- **The list,** 480 px: the kind chips (All, Stuck work, Omni Loop bug, Runner health, each counted),
  the Chat row first (`Ask the Supervisor anything`, the last line said and its time), then `Needs you
  now` (high) and `When you have a minute` (medium), newest first. Each row is the Inbox row's anatomy
  with a severity stripe (red high, the signal medium): the kind, the title, the check and its figures,
  the age (red when high) and `High`. On Done one section, the last closed first, each row ending on how
  it ended (`Acted`, `Not a problem`, `Resolved`). One row per cause, never one per job: a repository
  no online runner can take, or one kind of wait (held, answers, human), is one finding whose kind line
  counts its jobs (`Stuck work · vertuoza/data-viz-system · 8 jobs`) and whose check line names its
  figures (`Queue nobody can take · 8 jobs · Oldest queued 41 h`) (PRD omni-loop-35).
- **The pane:** the open finding (its kind, its title, `High` or `Medium` and its age; an owner's
  `Suggested` box with up to two suggestions; `The check that fired`, the check's name in bold and each
  figure in a cyan pill, or `Raised by the Supervisor, no check fired`; `Evidence`, one line each, and on
  a grouped finding one line per job it holds (`/omni:rewind 67 · queued 41 h · job 4f2a91c0`), 50 at
  most; its
  thread, the Supervisor's explanation first, each answer signed `Supervisor · agent`, a memory note
  quoted under it as `Remembered: “…”`), or, with none open, the general thread (`General thread · read
  by every member`, `Chat with the Supervisor`).

## States

- **2.A, an owner on an open finding:** one notification per cause; the check and its figures come
  first, the suggestions above it (`Open Runners`, `Not a problem`), the Evidence listing the jobs the
  finding groups, and the Supervisor's explanation saying when the oldest expires.
- **2.B, the general chat:** no finding open; the Chat row marked.
- **2.C, the Memory drawer** (s6, owners only): Short-term and Long-term tabs, each note with its source
  and a delete button, `Clear all 9 notes? Findings and chat stay.` confirmed in place.
- **2.D, a member:** the same page with no suggestion, chat box, Memory, Token limit, Pause or Move;
  `Read only · owners act` in the header and `Only workspace owners write to the Supervisor.` under each
  thread (AC-11).
- **2.E, the seat offline** (3 looks missed, or as long since the last): the header in red, the notice,
  and a finding the check wrote alone reads `No Supervisor look yet.` in place of its thread.
- **Paused by you** and **Thinking paused until midnight: 5M tokens used** (AC-7): the header's state in
  grey, the rest as watching, no `next in`.
- **2.F, all quiet:** `All quiet. Nothing needs you. The Supervisor keeps watching.`
- **2.G, a phone, below 900 px:** the header on two lines (`atlas-01 · last look 40 s`), the tabs, then
  the `Actions · <n>` and `Chat` switch; the list, or the pane once a finding or the chat is open.
- **No seat:** the header reads `No seat yet` and the notice says who places it.
- **Closed, signed out, in no workspace, unreadable:** the shared member gate, then `The Supervisor’s
  findings could not be read. Try again in a moment.`

## Words

Supervisor · Watching · Paused by you · Offline since <time> · Offline: no look yet · Thinking paused
until midnight: <n> tokens used · No seat yet · seat · slot · last look · next in · tokens today of ·
checks still run every 2 min · Memory · <n> · Token limit · Tokens a day, in millions · Save · Cancel ·
Pause · Resume · Read only · owners act · Offline since <time> on <runner>. · Checks still run. · Move
the seat · No Supervisor seat yet. · Open Runners · Open · Done · All · Stuck work · Omni Loop bug ·
Runner health · Chat · Ask the Supervisor anything · Last: “…” · No message yet · Needs you now · When
you have a minute · High · Medium · Acted · Not a problem · Resolved · Suggested · The check that fired ·
Raised by the Supervisor, no check fired · Evidence · No Supervisor look yet. · Supervisor · agent ·
Remembered: “…” · General thread · read by every member · Chat with the Supervisor · Only workspace
owners write to the Supervisor. · Queue nobody can take · <k> jobs · Oldest queued <d> · No online
runner can take <owner/repo> · Waiting too long · <k> jobs · Oldest <d> · queued <d> · job <id> · All quiet. · Nothing needs you. The Supervisor keeps watching. ·
Actions · <n>.

## Refusals

- A suggestion is only one of the actions the App already has: never a merge, an approval, a skipped
  check or a retry until green (PRD omni-loop-34).
- A member is drawn no control that acts: no suggestion button, chat box, Memory, Token limit, Pause or
  Move.
- Findings, suggestions and the chat are never cleared from this page: they record decisions.
- The check that fired comes before the Supervisor's own words, on every finding.
- Never one notification per job when the cause is the same: the jobs of one cause are listed in one
  finding's Evidence (PRD omni-loop-35).

## Open questions

- The before/after page's header shows `Token limit` where the spec names `Mandate`: built as drawn.
- Times of day are shown in UTC, as the Runners page shows them; the spec counts the token limit's
  midnight in the workspace's time zone.
- The `menu-supervisor` sprite (an owl) is drawn for this PRD and awaits its owner's approval before it
  joins the design system.
- The chat box, the Memory drawer (s6) and the suggestions' buttons with `Not a problem` (s7) are not
  built yet: in this draft the threads are read-only and the Suggested box lists its suggestions.
- 2.A is drawn as PRD omni-loop-35's before/after page draws it, at 1280 px there, here at 1440: its
  thread shows no chat box, where 2.B and the owner's other states keep one.

## Source

- /omni:brainstorm, PRD omni-loop-34: its before/after page, on the PRD's page (omni dossier get omni-loop-34 before-after), screens 2.A to 2.G
- PRD omni-loop-34 s5 (the page, built from those screens)
- PRD omni-loop-35 s5: 2.A brought up to that PRD's before/after page, Pixel perfect 2.A after (grouped
  notifications, Evidence listing the jobs; omni dossier get omni-loop-35 before-after)
