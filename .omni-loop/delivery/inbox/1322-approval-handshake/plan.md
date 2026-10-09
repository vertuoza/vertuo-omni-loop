# Plan: The approval handshake

PRD #1322, specified in `spec.md` beside this plan. The feature branch `feat/approval-handshake` goes
into `main` through one feature PR (`Closes #1322`). Each slice is a sub-PR from
`feat/approval-handshake--<slice>` into the feature branch (`Part of #1322`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A member turns on **Ask me to approve**, **Phone alerts** and **Email** on their profile page, and this device is subscribed to Web Push through an installable page | `supabase/migrations/20261124090000_approval_optins` `supabase/database.types.ts` `apps/galaxy/src/profile/` `apps/galaxy/src/push/` `apps/galaxy/app/api/push/` `apps/galaxy/app/manifest.ts` `apps/galaxy/public/` `apps/galaxy/src/env` `apps/galaxy/.env.example` `apps/galaxy/package.json` `pnpm-lock.yaml` | — | 1 |
| s4 | `omni wait approval <n>` posts the request, prints the waiting line, follows the stream with `Last-Event-ID`, and prints approved, voided, held, signed out or timeout with its exit code | `kit/lib/approval/wait` `kit/lib/approval/stream` `kit/lib/ask/client` `kit/bin/commands/approval` `kit/bin/commands/index.ts` `kit/lib/help/` | — | 1 |
| s2 | `POST /api/dossiers/approval/request` asks the opted-in members except the author (the author when nobody opted in) by Web Push and Resend email, records the request, and shows it in the asked members' bell | `supabase/migrations/20261125090000_approval_requests` `supabase/database.types.ts` `apps/galaxy/src/approvals/` `apps/galaxy/src/notify/` `apps/galaxy/app/api/dossiers/approval/request/` `apps/galaxy/src/waiting/` `apps/galaxy/src/env` `apps/galaxy/.env.example` | s1 | 2 |
| s5 | The HUD band shows the waiting line while `omni wait approval` runs, and the approved or voided line highlighted for 10 seconds | `kit/lib/now/` `kit/plugin-hud/` | s4 | 2 |
| s8 | `/omni:yolo` waits on a ◆ PRD instead of stopping, `/omni:brainstorm`'s hand-off names `omni wait approval`, `/omni:drive` keeps parking; the guide and the galaxy README describe the handshake | `kit/plugin/skills/yolo/` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/drive/` `kit/porting/plugin--yolo.md` `kit/porting/plugin--brainstorm.md` `docs/guide/` `apps/galaxy/README.md` | s4 | 2 |
| s3 | `GET /api/dossiers/approval/stream` streams asked, approved, voided and re-asked as Server-Sent Events from Supabase Realtime, replays after `Last-Event-ID`, answers 401 signed out, and closes with `reconnect` before the function's limit | `apps/galaxy/src/approvals/stream` `apps/galaxy/app/api/dossiers/approval/stream/` | s2 | 3 |
| s6 | An `omni dossier push` that changes a pinned file voids the approval in the same transaction, the approver is pushed and emailed, and `omni approval` reads it as drifted | `supabase/migrations/20261126090000_approval_voiding` `supabase/database.types.ts` `supabase/checks/` `.github/workflows/supabase.yml` `apps/galaxy/src/approvals/void` `apps/galaxy/src/dossier/api` `kit/lib/approval/approval` | s2 | 3 |
| s7 | The approve screen opens with the spec's Problem and Solution above **Approve**, and a voided approval shows **voided · approve again** with only the changed files' diff | `apps/galaxy/src/dossier/page/` | s2 | 3 |

**Shared ground.** `supabase/database.types.ts` is declared by s1 (wave 1), s2 (wave 2) and s6 (wave 3): each waits on
the one before. `apps/galaxy/src/env*` and `apps/galaxy/.env.example` are declared by s1 (VAPID) and s2 (Resend),
in waves 1 and 2. `apps/galaxy/src/approvals/` is s2's whole folder; s3 (`stream*`) and s6 (`void*`)
add files under it with their own prefixes, in wave 3 after s2. `kit/lib/approval/` is split by
prefix: s4 owns `wait*` and `stream*`, s6 owns `approval*`. Only s1 changes `apps/galaxy/package.json`
and `pnpm-lock.yaml` (both `web-push` and `resend`). `kit/dist/` and `apps/omni-app/api/` are
generated: no slice lists them.

## Per slice: done when

**s1**
- The migration adds `approval_optins` (member, workspace, ask, push, email) and `push_subscriptions`
  (member, endpoint, keys, device label), each readable and writable by its member only.
- The profile page of the signed-in member shows **Ask me to approve**, **Phone alerts on this
  device** and **Email · <address>**; turning on Phone alerts registers `/sw.js` and stores the
  subscription, and an iPhone not added to the home screen is told to add it first.
- `apps/galaxy/app/manifest.ts` makes the page installable; `VAPID_PUBLIC_KEY` and
  `VAPID_PRIVATE_KEY` are documented and read through the env module.
- Page and route tests cover the switches, the subscribe and unsubscribe routes, and a signed-out
  caller.

**s4**
- `omni wait approval <n> [--timeout <minutes>]` prints each line and exit code of the spec's §5
  table, against a stubbed request route and a stubbed event stream.
- A cut stream is resumed with `Last-Event-ID`, with no event printed twice; three failed reconnects
  in a row print the held line, and it keeps retrying.
- An approval already in force answers at once with the approved line and posts no request.
- The waiting file under `.omni-loop/local/` holds the current line while it waits.
- `omni help approval` explains `wait`.

**s2**
- The migration adds the append-only `approval_requests` and `approval_voids` tables.
- `apps/galaxy/src/approvals/` holds `approvals.repository.ts` (the only file that reaches Supabase
  here), `approvals.service.ts` and `approvals.controller.ts`.
- The request route asks every opted-in member except the author, or the author when nobody opted
  in, and answers who was asked; a signed-out caller gets 401.
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
- The approve screen renders the spec's Problem and Solution above **Approve**; a voided approval
  shows **voided · approve again** with only the changed files' diff; a ◇ PRD's page is unchanged.
