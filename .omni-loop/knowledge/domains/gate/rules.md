# Gate rules

## BR-PRODUCT-3

When the only red check is the outbox context and only person-answered items remain, /omni:pr reports this in the status comment and stops. It never counts this as a failed attempt and never applies the labels.outboxGo override.

Serves: P-PRODUCT-3
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s4-03-outbox-check-red-is-the-gate, PRD #7
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(pr)/, ^kit/test/plugin\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Kept id: moved from product, PRD 2346

## BR-PRODUCT-5

A feature pull request stays a draft while any question is open, with each open question posted on it. It is marked ready only after the work has been shipped, committed and pushed.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s9-01-gate-red-stays-draft, PRD #7
Enforced by: kit/test/plugin.test.ts
Governs: ^kit/plugin/skills/(yolo|pr)/, ^kit/test/plugin\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Kept id: moved from product, PRD 2346

## BR-PRODUCT-6

The live outbox check passes the pull request's changed files to the gate, so a risky change nobody explained turns it red, as do open questions and unfinished rework.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s5-01-check-grades-changed-files, PRD #28
Enforced by: apps/omni-app/src/outbox-check/outbox-check.test.ts
Governs: ^apps/omni-app/src/outbox-check/, ^kit/lib/outbox/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29
Kept id: moved from product, PRD 2346
