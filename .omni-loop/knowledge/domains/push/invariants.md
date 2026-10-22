# Push invariants

## N-PRODUCT-18

A push notification tap only ever opens a page on the Omni site; a link to anywhere else falls back to the app's home page. A push message the phone cannot read still shows a generic alert rather than nothing.

Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s9-01-push-payload-shape, PRD #1322
Enforced by: apps/galaxy/src/push/sw.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346
