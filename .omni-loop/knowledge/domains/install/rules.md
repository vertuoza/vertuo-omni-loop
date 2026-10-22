# Install rules

## BR-PRODUCT-7

The install sets laws.source to knowledge only when the knowledge registers hold at least one principle, rule or invariant. A knowledge folder that exists but is empty leaves it at none, even on a forced reinstall.

Serves: P-PRODUCT-6
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s4-02-laws-source-from-register-entries, PRD #45
Enforced by: kit/bin/init.test.ts
Governs: ^kit/lib/init/, ^kit/bin/commands/init\.ts$, ^kit/bin/init\.test\.ts$
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Kept id: moved from product, PRD 2346
