# Access invariants

## N-PRODUCT-17

No secret reaches the browser: the arcade gives the browser only the two public Supabase values, and no other variable in `apps/` or `packages/` carries the `NEXT_PUBLIC_` prefix that Next inlines into the browser's code.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: scripts/public-env-guard.test.ts, scripts/env-guard.test.ts
Governs: ^apps/galaxy/src/env(\.client)?\.ts$, ^apps/galaxy/\.env\.example$, ^scripts/(public-env|env)-guard\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13
Kept id: moved from product, PRD 2346
