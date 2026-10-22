# Jev rules

## BR-PRODUCT-59

Jev is on exactly when a key is stored: turning it off deletes the key and sets every decision to Off, and no decision may be Shadow or On without a key. Only the owner sees the key's last four and date; members see only whether Jev is on.

Serves: P-PRODUCT-55
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s1-02-jev-on-means-key-stored, PRD #812
Enforced by: apps/galaxy/src/jev/jev-key-sql.test.ts
Governs: ^apps/galaxy/src/jev/jev-key-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814
Kept id: moved from product, PRD 2346

## BR-PRODUCT-60

When a terminal asks Jev about a repository, the Jev settings of the workspace that owns it apply; a repository no workspace owns goes to the person's first-joined workspace, and one owned by a workspace the person is not in is refused.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s3-03-decide-unowned-repository, PRD #812
Enforced by: apps/galaxy/src/jev/decisions/decide-route.test.ts
Governs: ^apps/galaxy/src/jev/decisions/decide-route\.
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814
Kept id: moved from product, PRD 2346

## BR-PRODUCT-61

The Jev page's agreement rate counts only calls where Jev and the old way both answered, including answers under the confidence floor. A call where Jev failed, had no key or answered outside the options adds only to the call count.

Serves: P-PRODUCT-56
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s4-01-agreement-counts-only-answered-calls, PRD #812
Enforced by: apps/galaxy/src/jev/record/record.test.ts
Governs: ^apps/galaxy/src/jev/record/record\.
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814
Kept id: moved from product, PRD 2346
