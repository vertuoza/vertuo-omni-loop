---
prd: 579
title: New documents alert — one notification when a spec, plan or before/after lands on your PRD
blocked-by: none
spec: file
---

# New documents alert — one notification when a spec, plan or before/after lands on your PRD

**Date:** 2026-09-29 · **PRD:** #579 · **Follows:** PRD 499 (waiting-for-you notifications), PRD 216
(dossiers) · **Touches:** the galaxy app only:
- the waiting module, `apps/galaxy/src/waiting/` (`WaitingProvider.tsx`, `alerts.ts`, a new
  `documents.ts`)
- the bell, `apps/galaxy/src/nav/` (`bell.ts`, `Bell.tsx`, `bell.css`)
- the PRD page, `apps/galaxy/src/dossier/page/` (a small client part that marks the PRD seen)

No migration, no new route, and no change to the kit, the game or the GitHub App.

## Problem

`/omni:brainstorm`, `/omni:plan` and `/omni:mega-brainstorm` push a PRD's spec, before/after page and
plan to its dossier (`omni dossier push` → `dossier_versions`). Nothing tells the person who opened
that PRD that something landed: they find out only by keeping the PRD page on screen and watching it.
The bell (PRD 499) shows questions and outbox items, never a new document. And pushes come in bursts:
one brainstorm pushes the spec and the before/after within seconds, then the plan a minute later, and
at the phase-0 PR again, so one alert per push would flood.

## Solution

### 1. What counts as a new document

A **new document** is a `dossier_versions` row (kind `spec`, `plan` or `before-after`) that is:

- on a **numbered** dossier (`prd` not null) that the signed-in person **opened**
  (`dossiers.opened_by` = them) — the same rule as the bell's Outbox part;
- **created after the PRD was last seen** in this browser (§4);
- at most **7 days old**.

Every push counts, whoever made it, the person's own Claude session included: the point is "it's
ready, go look". The read is capped at the **50** newest rows.

### 2. The read

A new documents part in `WaitingProvider`, beside the Questions and Outbox parts. Every **10 s**, and
only while the tab is visible (the existing `poll()`), the browser reads straight from Supabase as the
signed-in person — row-level security already lets a member read their workspace's dossiers and
versions:

```text
dossier_versions (id, kind, created_at, dossier: dossiers!inner(id, prd, title, opened_by))
  where dossier.opened_by = me and dossier.prd is not null and created_at > now − 7 d
  order by created_at desc limit 50
```

The rows are grouped **per PRD**: its dossier id, number, title, the kinds that landed (in the order
spec, plan, before/after, each once), its newest version id and the newest `created_at`. A PRD all of
whose rows are seen (§4) is dropped. A read that fails keeps the last groups and the bell says the part
could not be read, retrying, like the other parts.

### 3. The debounce and the alert

A PRD's group is **settled** once its newest version is at least **30 s** old: 30 s have passed with
no further push to it. Only a settled group is announced, **once per newest version id**:

- **Desktop alert** (when the Desktop alerts switch is on): one notification per settled PRD, naming
  the kinds that landed **since that PRD's last alert** (the bell line keeps every unseen kind), title
  `PRD 572: new spec, plan, before/after`, body the PRD's title, tag `docs-<dossier id>-<newest
  version id>` so every open tab raises it once. Clicking it opens `/prd/<dossier id>`.
- **Chime** (when the Chime switch is on): once per read that settles one or more PRDs, through the
  existing `claimChime`, with those tags as ids, so one tab plays it.

A push landing on a PRD after its alert starts a new burst, and that burst alerts once more when it
settles. Which newest version ids were announced, with the time of each PRD's last alert, is kept in
localStorage (`omni-waiting-docs-announced`, bounded to the last 200), so a reload or a second tab does not alert
again. The first read after the page loads **does** announce settled groups that were never announced:
a PRD whose documents landed while no tab was open alerts once when the app is next opened.

Alerts reuse the two switches at the foot of the bell (PRD 499), both still off until the person
switches them on. No new switch.

### 4. Seen

Kept per browser in localStorage (`omni-waiting-docs-seen`): a map of dossier id to the time it was
last seen, and a `since` time.

- **The first time** this browser runs it, `since` is set to now: nothing older ever shows, so no
  history floods in.
- **Opening a PRD's page** (`/prd/<dossier id>`, any tab of it) sets that dossier's time to now, and
  again every time a new version renders while the page is open (the page already refreshes live).
  Its group leaves the bell at the next read.
- Storage that throws: `since` is the page load, nothing is remembered, and the part still works for
  the visit.

### 5. The bell

A third group in the bell's panel, **New documents**, after Questions and Outbox, only when it has
lines or a problem. One line per PRD, newest first:

- head `PRD 572 · Dashboards`
- text `New spec, plan, before/after`
- meta how long ago the newest landed (`waitedFor`: "just now", "3 min", "2 h")
- link `/prd/<dossier id>`

A group still in its 30 s shows in the bell at once; only the alert waits.

**Not counted anywhere else:** new documents do not add to the bell's count, the tab title's `(N)`,
the favicon dot or the sidebar badges. Those stay "waiting for you" (PRD 499); a new document is news,
not a wait.

## Decisions

- **Mine = PRDs I opened** (`opened_by`), asked and answered: "otherwise that would be spam". No
  follow list.
- **Own pushes count**: a person's own brainstorm session pushing is exactly what they want to hear
  about when they are in another window.
- **Debounce per PRD, 30 s quiet**, asked and answered. One chime per read however many PRDs settle.
- **Seen per browser, cleared by opening the PRD page**, asked and answered. No table, no migration.
- **Browser polling, not Realtime**, like the Questions part (PRD 499 kept the ask-mode rule).
- **Bell + alert only, not in (N)**, asked and answered.

## User stories

1. As the person who brainstormed a PRD, when my session pushes its spec and before/after and I am in
   another window, I get one desktop alert "PRD 579: new spec, before/after" about 30 s later, and
   clicking it opens the PRD page.
2. As that person, when the plan lands a minute later, I get one more alert for the plan only.
3. As that person, with three tabs of the app open, I get one notification and one chime, not three.
4. As that person, the bell lists PRD 579 under **New documents** until I open its page.
5. As a colleague in the same workspace who did not open PRD 579, nothing about it reaches me.
6. As someone opening the app on a new browser, I am not flooded with a week of old documents.

## Scope

**In:** the documents part of `WaitingProvider`, its pure module `src/waiting/documents.ts`, the
alert for it in `alerts.ts`, the bell's New documents group, the PRD page marking itself seen.

**Out:** a server-side seen state (no table), following other people's PRDs, drafts (no number yet),
email or Slack, counting new documents in `(N)` / the dot / badges, per-kind switches, Realtime.

## Test seams

Following `omni kb show testing`: tests beside the code, `*.test.ts` under `apps/galaxy/src/`, never
calling Supabase.

- **`src/waiting/documents.ts`, pure** (`documents.test.ts`):
  - `groupDocuments(rows, seen)`: rows of two PRDs → two groups, kinds ordered spec, plan,
    before/after and deduplicated, newest id and time right; rows at or before a PRD's seen time and
    before `since` dropped; a PRD with only seen rows dropped.
  - `settled(groups, now)`: a group whose newest is 29 s old is not settled, 30 s is.
  - `toAnnounce(settled, announced)`: a newest id already announced is skipped; a later version of
    the same PRD is announced, naming only the kinds newer than its last alert; the announced list stays
    bounded at 200.
  - the seen store: first run sets `since`; `markSeen` writes a dossier's time; a throwing storage
    gives `since` = load time and never throws.
  - the reader, on a fake `Db`: the query filters on `opened_by`, a numbered dossier, 7 days, 50 rows;
    a read error throws.
- **`src/waiting/alerts.ts`** (`alerts.test.ts`): `documentAlertOf(group)` gives the title
  `PRD 572: new spec, plan, before/after`, the tag `docs-<dossier>-<newest>` and the href
  `/prd/<dossier>`; raising goes through the same switch checks as today.
- **`src/nav/bell.ts`** (`bell.test.ts`, `Bell.render.test.ts`): the New documents group appears
  after Outbox, only with lines or a problem; its line reads head, text and meta as §5; the bell's
  count and `bellName` do not change with new documents.
- **The PRD page**: its seen part calls `markSeen` with the dossier id on mount and when the
  signature of the rendered versions changes.

## Risks

Following `omni kb show releasing`: a merge to `main` touches no migration and no kit file, so it
publishes only the galaxy app's next deployment.

- **Alert noise.** If the debounce misfires, a person with alerts on is spammed. Bounded: alerts are
  off by default, per PRD, once per newest version id, deduplicated across tabs.
- **Load.** One small Supabase read every 10 s per visible signed-in tab, capped at 50 rows. Hidden
  tabs do not poll.
- **Rollback:** revert the feature PR; nothing stored outside the browser. The localStorage keys left
  behind are ignored.

## Acceptance criteria

`acceptance.enabled` is false in this repository: each criterion becomes ordinary tests
(Test seams) and a manual browser pass on production.

1. With Desktop alerts on, a push of a spec and a before/after to a PRD I opened gives exactly one
   desktop alert for that PRD, 30 to 40 s after the last push, titled `PRD <n>: new spec,
   before/after`; clicking it opens `/prd/<dossier id>`.
2. A push of the plan to the same PRD a minute later gives one more alert, `PRD <n>: new plan`.
3. Pushes to two PRDs I opened within the same 30 s give two alerts and one chime.
4. With two tabs open, each alert shows once and the chime plays once.
5. The bell lists the PRD under **New documents** (head, `New <kinds>`, how long ago) as soon as a
   read sees the push, and not after I open that PRD's page.
6. A push to a PRD I did not open shows nothing and alerts nothing.
7. The bell's count, the tab's `(N)`, the favicon dot and the sidebar badges do not change with new
   documents.
8. On a browser that never ran it, versions older than the first load show nothing.
9. With both switches off, the bell's New documents group still shows; nothing else happens.
