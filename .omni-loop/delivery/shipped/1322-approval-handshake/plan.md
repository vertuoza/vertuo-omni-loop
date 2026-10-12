# Plan: The approval handshake

PRD #1322, specified in `spec.md` beside this plan. The feature branch `feat/approval-handshake` goes
into `main` through one feature PR (`Closes #1322`). Each slice is a sub-PR from
`feat/approval-handshake--<slice>` into the feature branch (`Part of #1322`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A workspace owner lists a product's approvers on Settings › Products, each asked to approve or skipped, and `dossier_approve` lets only those approvers approve once the list has one; the tables for each person's alert channels and push subscriptions exist, with the VAPID and Resend settings and the `web-push` and `resend` packages | `supabase/migrations/20261124090000_product_approvers` `supabase/database.types.ts` `supabase/checks/` `.github/workflows/supabase.yml` `apps/galaxy/src/products/` `apps/galaxy/app/app/settings/products/` `apps/galaxy/src/env` `apps/galaxy/.env.example` `apps/galaxy/package.json` `pnpm-lock.yaml` | — | 1 |
| s4 | `omni wait approval <n>` posts the request, prints the waiting line, follows the stream with `Last-Event-ID`, and prints approved, voided, held, signed out or timeout with its exit code | `kit/lib/approval/wait` `kit/lib/approval/stream` `kit/lib/ask/client` `kit/bin/commands/approval` `kit/bin/commands/index.ts` `kit/lib/help/` | — | 1 |
| s9 | A member turns on **Phone alerts** and **Email** on their profile page, and this device is subscribed to Web Push through an installable page | `apps/galaxy/src/profile/` `apps/galaxy/src/push/` `apps/galaxy/app/api/push/` `apps/galaxy/app/manifest.ts` `apps/galaxy/public/` | s1 | 2 |
| s2 | `POST /api/dossiers/approval/request` asks the product's approvers except the author (the author when nobody else) by each one's channels, records the request, and shows it in the asked people's bell | `supabase/migrations/20261125090000_approval_requests` `supabase/database.types.ts` `apps/galaxy/src/approvals/` `apps/galaxy/src/notify/` `apps/galaxy/app/api/dossiers/approval/request/` `apps/galaxy/src/waiting/` | s1 | 2 |
| s5 | The HUD band shows the waiting line while `omni wait approval` runs, and the approved or voided line highlighted for 10 seconds | `kit/lib/now/` `kit/plugin-hud/` | s4 | 2 |
| s8 | `/omni:yolo` waits on a ◆ PRD instead of stopping, `/omni:brainstorm`'s hand-off names `omni wait approval`, `/omni:drive` keeps parking; the guide and the galaxy README describe product approvers and the handshake | `kit/plugin/skills/yolo/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/drive/` `kit/porting/plugin--yolo.md` `kit/porting/plugin--brainstorm.md` `docs/guide/` `apps/galaxy/README.md` | s4 | 2 |
| s3 | `GET /api/dossiers/approval/stream` streams asked, approved, voided and re-asked as Server-Sent Events from Supabase Realtime, replays after `Last-Event-ID`, answers 401 signed out, and closes with `reconnect` before the function's limit | `apps/galaxy/src/approvals/stream` `apps/galaxy/app/api/dossiers/approval/stream/` | s2 | 3 |
| s6 | An `omni dossier push` that changes a pinned file voids the approval in the same transaction, the approver is pushed and emailed, and `omni approval` reads it as drifted | `supabase/migrations/20261126090000_approval_voiding` `supabase/database.types.ts` `supabase/checks/` `.github/workflows/supabase.yml` `apps/galaxy/src/approvals/void` `apps/galaxy/src/dossier/api` `kit/lib/approval/approval` | s2 | 3 |
| s7 | The approve screen opens with the spec's Problem and Solution above **Approve**, shows **Approve** only to those allowed to approve, and a voided approval shows **voided · approve again** with only the changed files' diff | `apps/galaxy/src/dossier/page/` | s2 | 3 |

**Shared ground.** `supabase/database.types.ts` is declared by s1 (wave 1), s2 (wave 2) and s6 (wave 3);
`supabase/checks/` and `.github/workflows/supabase.yml` by s1 and s6: each waits on the one before.
s1 alone owns the env module, `.env.example`, `apps/galaxy/package.json` and `pnpm-lock.yaml`, with
both channels' settings and packages, so s9 and s2 can run side by side in wave 2. `apps/galaxy/src/approvals/`
is s2's whole folder; s3 (`stream*`) and s6 (`void*`) add files under it in wave 3. `kit/lib/approval/`
is split by prefix: s4 owns `wait*` and `stream*`, s6 owns `approval*`. `kit/dist/` and
`apps/omni-app/api/` are generated: no slice lists them.

## Per slice: done when

**s1**
- The migration adds `product_approvers` (product, member, `asked` or `skipped`), which owners write
  and members read, and `alert_channels` (member, push, email) and `push_subscriptions` (member,
  endpoint, keys, device label), each written by its member only.
- `dossier_approve` refuses a caller who is not one of the product's members asked to approve, once
  the product lists one; with no product or no approver it keeps any member. A `supabase/checks`
  file proves both, and the supabase workflow runs it.
- Settings › Products › <product> shows an **Approvers** list: owners add a member and set *asked to
  approve* or *skipped*; other members read it.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY` and `RESEND_FROM` are read through the
  env module and documented in `.env.example`; `web-push` and `resend` are dependencies.

**s4**
- `omni wait approval <n> [--timeout <minutes>]` prints each line and exit code of the spec's §5
  table, against a stubbed request route and a stubbed event stream.
- A cut stream is resumed with `Last-Event-ID`, with no event printed twice; three failed reconnects
  in a row print the held line, and it keeps retrying.
- An approval already in force answers at once with the approved line and posts no request.
- The waiting file under `.omni-loop/local/` holds the current line while it waits.
- `omni help approval` explains `wait`.

**s9**
- The signed-in member's profile page shows **Phone alerts on this device** and **Email · <address>**,
  both off by default; turning on Phone alerts registers `/sw.js` and stores the subscription, and an
  iPhone not added to the home screen is told to add it first.
- `apps/galaxy/app/manifest.ts` makes the page installable; page and route tests cover the switches,
  subscribe and unsubscribe, and a signed-out caller.

**s2**
- The migration adds the append-only `approval_requests` and `approval_voids` tables.
- `apps/galaxy/src/approvals/` holds `approvals.repository.ts` (the only file that reaches Supabase
  here), `approvals.service.ts` and `approvals.controller.ts`.
- The request route asks the product's members asked to approve, except the author, or the author
  when nobody else, through each one's channels, and answers who was asked; a skipped member is never
  asked; a signed-out caller gets 401.
- Web Push and Resend senders run behind fakes in tests; a 404 or 410 deletes that subscription; a
  missing key skips its channel with one log line.
- The bell lists an approval request for each asked member, with the PRD's link.

**s5**
- The band shows `◌ PRD <n> · waiting for …` while the waiting file says so, and the approved or
  voided line highlighted for 10 seconds when it changes; render tests cover both.

**s8**
- `/omni:yolo` runs `omni wait approval <n>` on a ◆ PRD waiting for approval and goes on into wave 1
  on exit 0, or ends held naming the line.
- `/omni:brainstorm`'s ◆ hand-off names `omni wait approval <n>`; `/omni:drive` still parks.
- `docs/guide/loop.md` and `apps/galaxy/README.md` describe the opt-ins, the request, the stream and
  the void; the guide's and READMEs' tests pass.

**s3**
- The stream route sends `asked`, `approved`, `voided` and `re-asked` events with increasing ids and
  a `ping` every 15 seconds, replays the events after `Last-Event-ID`, closes with `event: reconnect`
  before the function's limit, and answers 401 signed out; tests drive it with a fake repository.

**s6**
- `dossier_push` appends `approval_voids` only when a new version of a pinned kind has another
  `sha256`, never edits an approval; a `supabase/checks` file proves it and the supabase workflow runs
  it.
- The push route sends `approval voided by <pusher>'s push` to the approver by push and email.
- `omni approval <n>` reads a voided approval as drifted, naming the push.

**s7**
- The approve screen renders the spec's Problem and Solution above **Approve**, which only someone
  allowed to approve sees; a voided approval
  shows **voided · approve again** with only the changed files' diff; a ◇ PRD's page is unchanged.
