# Push rules

## BR-PRODUCT-105

Turning phone alerts off on one device removes that device's subscription and turns phone alerts off for the person, so none of their devices is alerted until they turn phone alerts on again.

Serves: P-PRODUCT-88
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s9-02-phone-alerts-off-is-per-person, PRD #1322
Enforced by: apps/galaxy/src/push/api.test.ts, apps/galaxy/src/profile/alerts.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Kept id: moved from product, PRD 2346
