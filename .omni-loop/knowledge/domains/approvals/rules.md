# Approvals rules

## BR-PRODUCT-103

An approval request's author is whoever opened the PRD, or the person asking when no opener is recorded; any request after a PRD's first is a re-ask. A request stays in the asked person's bell until someone approves the PRD at or after the time it was asked.

Serves: P-PRODUCT-87
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s2-03-who-the-author-is-and-when-a-request-stops-waiting, PRD #1322
Enforced by: supabase/checks/approval_requests.sql, apps/galaxy/src/waiting/approvals.test.ts, apps/galaxy/src/approvals/approvals.repository.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346

## BR-PRODUCT-104

The band shows the approval wait of the PRD the session is on, else the most recent wait that still shows something. While a wait shows, it checks again every 5 seconds, so an approval appears within seconds and keeps its 10-second notice.

Serves: P-PRODUCT-79
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s5-01-which-wait-the-band-shows, PRD #1322
Enforced by: kit/lib/now/wait.test.ts, kit/plugin-hud/tests/hud.test.tsx
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346

## BR-PRODUCT-106

A fresh connection to the approval stream hears the PRD's latest request, then only what followed the later of that request and the latest void. A resumed connection hears only events after the last id it saw; an unknown id counts as none.

Serves: P-PRODUCT-89
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s3-01-what-the-stream-replays-and-its-event-ids, PRD #1322
Enforced by: apps/galaxy/src/approvals/stream.service.test.ts, apps/galaxy/src/approvals/stream.controller.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346

## BR-PRODUCT-107

When one push changes several approved files, each changed file is recorded as its own void of the approval, and the approver gets one alert and one email for that push listing every changed file. A later push does not void the same approval again.

Serves: P-PRODUCT-90
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s6-01-one-void-per-changed-file-one-alert-per-push, PRD #1322
Enforced by: supabase/checks/approval_voiding.sql, apps/galaxy/src/approvals/void.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346

## BR-PRODUCT-108

When the page cannot read who a product asks to approve, it offers Approve to every member. The server still refuses anyone the product does not ask, in its own words, and nothing is approved.

Serves: P-PRODUCT-91
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s7-01-approvers-unread-shows-approve, PRD #1322
Enforced by: apps/galaxy/src/dossier/page/approval.test.ts, apps/galaxy/src/approval/approval-api.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346
