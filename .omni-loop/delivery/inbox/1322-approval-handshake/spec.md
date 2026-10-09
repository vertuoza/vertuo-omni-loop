---
prd: 1322
title: The approval handshake
blocked-by: none
spec: file
phase0: server
---

# The approval handshake

**Date:** 2026-10-09 · **PRD:** #1322 · **From:** concept #1269, area `approval-handshake`, after PRD
#1299 · **Touches:** `supabase/migrations/` (opt-ins, push subscriptions, approval requests, voids, and
`dossier_push` voiding a changed pinned file), `apps/galaxy` (the installable page, the service
worker, the approvals repository, service and controller, the request and stream routes, Web Push and
Resend senders, the profile page's switches, the approve screen, the bell), `kit/lib` and
`kit/bin/commands` (`omni wait approval`, the stream client, the HUD's waiting file),
`kit/plugin-hud/` (the band's waiting line and toast), the skills `yolo` and `drive`, and the guide.
**Out of scope:** approvers per product (area `product-home`), the `omni/approved` check on target
pull requests (area `product-gate`), voiding on a `git push` that bypasses `omni dossier push`,
approving from the notification itself, and SMS or Slack.

## Problem

Since PRD #1299 a PRD born on the server is approved on its page, but nobody is told it waits. The
agent stops with `PRD <n> waits for approval: <link>` and the run ends; someone has to notice, open
the page, approve, and then a person types `/omni:yolo <n>` again. The approver reads three tabs before
knowing what they are approving. A changed spec or plan after approval is only caught when a gate next
reads `omni approval`, and the approver is never told their approval no longer holds.

## Solution

### 1. Who is asked

A member opts in on their profile page with **Ask me to approve** (per workspace), and chooses how:
**Phone alerts** (Web Push on this device) and **Email** (to their GitHub sign-in address). A request
asks every opted-in member of the PRD's workspace **except the PRD's author**. When nobody has opted
in, it asks **the PRD's author**, by both channels their profile allows (email always, push when this
device subscribed). Any member may still approve on the page.

### 2. The phone and the email

- The Omni page becomes installable: a web manifest and a service worker (`/sw.js`). **Phone alerts**
  subscribes this device (`push_subscriptions`: the member, the endpoint, the keys, a device label);
  on an iPhone the switch first says to add the page to the home screen (iOS 16.4 and later).
- Web Push is sent with the `web-push` library and the `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`
  environment variables; email through Resend with `RESEND_API_KEY` and `RESEND_FROM`. A channel
  whose keys are missing is skipped with one log line; the other still goes out.
- The notification reads `PRD <n> waits for your approval`, then the spec's title, the one-line
  before → after, the repositories and the short pinned hashes. The email holds the same, and the
  spec's **Problem** and **Solution**. Both open the PRD page on its approve screen; approving needs
  the page, signed in.

### 3. The request

`omni wait approval <n>` posts `POST /api/dossiers/approval/request` `{repo, prd}`. The server appends
an `approval_requests` row (the dossier, who asked, who is asked, when) and sends the push and the
email. Asked members also see it in the page's bell, with the PRD's link. Asking again after a void
appends a new row (`re-asked`).

### 4. The stream: repository → service → controller

- `approvals.repository.ts` is the only file that reaches Supabase for this: it reads requests,
  approvals and voids, and subscribes, as the signed-in member, to Supabase Realtime on `approvals`
  and `approval_voids` for one dossier.
- `approvals.service.ts` shapes rows into events: `asked`, `approved`, `voided`, `re-asked`, each with
  an increasing id, and a `ping` every 15 seconds.
- `approvals.controller.ts` serves `GET /api/dossiers/approval/stream?repo=&prd=` as Server-Sent
  Events, answers 401 to a signed-out caller, replays the events after `Last-Event-ID`, and closes
  with `event: reconnect` before the function's time limit.

### 5. `omni wait approval <n> [--timeout <minutes>]`

It posts the request, prints one waiting line, and follows the stream until the approval lands,
reconnecting with the last event id. It also writes the HUD's waiting file under
`.omni-loop/local/` (the command owns it). Its lines, the same on the page, the HUD and the terminal:

| state | the line | exit |
|---|---|---|
| waiting | `◌ PRD <n> · waiting for Irisa or Paul` (`… for 4 members` past three names) | — |
| nobody to ask | `◌ PRD <n> · waiting for <author> · nobody has opted in` | — |
| approved | `✓ PRD <n> approved by <login> · <time> · <k> files pinned` | 0 |
| voided | `✗ approval voided by <pusher>'s push <old>→<new> · asked again` | — (keeps waiting) |
| held | `server unreachable · held, not failed` after 3 failed reconnects in a row; it keeps retrying | — |
| signed out | `no sign-in (omni signin) · held` | 1 |
| timeout | `held: still waiting for <names> after <minutes> min` (`--timeout`, 60 by default) | 1 |

An approval already in force answers at once with the approved line, and asks nobody.

### 6. The HUD

While a wait runs, the band shows the waiting line. When the approval lands, the band shows the
approved line highlighted for 10 seconds (the toast), in step with the terminal; a void shows the
voided line the same way.

### 7. Voided on `omni dossier push`

`dossier_push`, adding a version of a kind an approval in force pinned, compares its `sha256` with the
pin. When they differ, in the same transaction it appends `approval_voids` (the approval, the kind,
the old and the new hash, who pushed). The approval is never edited: an approval with a void after it
is no longer in force, and `omni approval` reads it as `drifted`, so the gates refuse as in #1299.
The approver gets a push and an email, `approval voided by <pusher>'s push`. The page shows **voided ·
approve again**, with only the changed files' diff above the button. A waiting stream gets `voided`,
and the wait asks again.

### 8. The approve screen

The approval cell of a ◆ PRD's page opens with the spec's **Problem** and **Solution**, rendered
above the **Approve** button, then the pinned files. After a void, the diff of each changed file
comes first.

### 9. The skills

`/omni:yolo`, finding a ◆ PRD waiting for approval, runs `omni wait approval <n>` and goes on into
wave 1 when it exits 0; any other exit ends the run held, naming the line. `/omni:brainstorm`'s hand-off
for a ◆ PRD names `omni wait approval <n>` beside the page link. `/omni:drive` keeps parking a waiting
PRD, never waiting in a tick.

## Decisions

- **Web Push plus Resend email**, both opt-in per member and per workspace. No third-party push
  service, no SMS, no Slack.
- **Opted-in members are asked, never the author; with nobody opted in, the author is asked.** The
  person asked for the author as the last resort. Approving one's own PRD stays allowed (#1299).
- **The stream follows repository → service → controller**, as PRD #1318 lays down for the galaxy,
  but this PRD does not wait for #1318 (the person chose not blocked): it lays out its own three files
  in that shape, which #1318's guard will accept as they are.
- **Server-Sent Events, not polling**, with Supabase Realtime behind the repository; the stream closes
  itself before the function's limit and the kit reconnects with `Last-Event-ID`.
- **A void is caught on `omni dossier push`**, in the same transaction as the new version, never on
  a git push; `omni approval` stays the gate's backstop for a file changed without a push.
- **Approvals stay append-only:** a void is its own row.
- **The voice objected** (persona:F-E Developer): approving from a phone invites approving what one
  did not read. Settled `accepted`: the approve screen opens with the spec's Problem and Solution.

## User stories

- As a PM, I run `/omni:yolo` on a ◆ PRD and the agent waits for approval instead of stopping, then
  starts wave 1 the moment someone approves.
- As an approver who opted in, I get a notification on my phone and an email, open the PRD, read its
  problem and solution, and approve.
- As the author in a workspace where nobody opted in, I am the one asked.
- As an approver, I am told when my approval is voided by a change, and see only what changed.

## Scope

In: §1 to §9. Out: everything the header lists as out of scope.

## Test seams

Every test runs on fixtures: none calls Supabase, a push service or Resend (`omni kb show testing`).

- **The service**, against a fake repository's rows and events: event shapes, ids, `ping`.
- **The controller**: SSE framing, 401 signed out, `Last-Event-ID` replay, `reconnect` before the limit.
- **The senders**: Web Push and Resend behind fakes; a 404/410 deletes that subscription; a missing key
  skips the channel.
- **Who is asked**: opted-in members minus the author; the author when nobody opted in.
- **The migration**: a SQL check that `dossier_push` voids only when a pinned kind's hash changes,
  and never edits an approval.
- **`omni wait approval`**, through `main()` with a stubbed stream: approved, already approved,
  voided then approved, held after 3 failures, signed out, timeout.
- **The HUD band**: the waiting line and the 10-second toast.
- **The page**: the approve screen's Problem and Solution, the voided diff, the profile switches.

## Risks

- **Merging publishes** migrations to production (additive tables and a new `dossier_push`), the
  galaxy app (the service worker included, which browsers keep until it changes), the kit and the
  HUD plugin. Rollback: revert the PR; the migrations only add, and `dossier_push`'s previous body is
  restored by a later migration if needed. Unregistering the service worker is a no-op file at
  `/sw.js`.
- **New secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`, `RESEND_FROM` must be
  set on the galaxy's Vercel project; without them each channel is skipped and the bell still works.
- **Email reaches real people**: only members who opted in, or the author.
- **A long wait holds a terminal**: `--timeout` bounds it, and `/omni:drive` never waits.

## Acceptance criteria

1. A member turns on **Ask me to approve** with **Phone alerts** and **Email** on their profile page;
   the device is subscribed.
2. `omni wait approval <n>` on a ◆ PRD prints `◌ PRD <n> · waiting for <names>`, and every opted-in
   member except the author gets a push and an email naming the PRD, its before → after and its
   repositories.
3. With nobody opted in, the author is asked, and the line says `nobody has opted in`.
4. The approve screen shows the spec's Problem and Solution above **Approve**.
5. Approving prints `✓ PRD <n> approved by <login> · <time> · <k> files pinned` in the waiting
   terminal within seconds, the HUD band shows it highlighted, and `omni wait approval` exits 0;
   `/omni:yolo` then starts wave 1 without being typed again.
6. A stream cut before the function's limit is resumed with no event lost.
7. An `omni dossier push` that changes a pinned file voids the approval: the approver is pushed and
   emailed, the page shows **voided · approve again** with only that file's diff, `omni approval <n>`
   reads `drifted`, and a waiting terminal prints the voided line and keeps waiting.
8. Signed out, the wait exits 1 with `no sign-in (omni signin) · held`; past `--timeout`, it exits 1
   with `held: still waiting for …`.
9. Without VAPID or Resend keys, that channel is skipped and the request still stands in the bell.
