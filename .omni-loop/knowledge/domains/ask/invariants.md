# Ask invariants

## N-PRODUCT-7

A plugin hook that cannot run never blocks a person's message or question: each hooks.json command ends in || true, and omni ask hook exits 0 with no output for any known kind, whatever the repository, config or server state.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-03-hooks-never-block, PRD #71
Enforced by: kit/bin/ask-hook.test.ts
Governs: ^kit/lib/ask/hook\., ^kit/plugin/hooks/, ^kit/bin/ask-hook\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346

## N-PRODUCT-8

The ask hooks send no call unless ask.url is set in the repository's config and its host equals the host saved in the session. Every call goes to a path under ask.url, and emptying the setting switches the mode off at once.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-04-where-the-hooks-send-calls, PRD #71
Enforced by: kit/bin/ask-hook.test.ts
Governs: ^kit/lib/ask/, ^kit/plugin/hooks/, ^kit/bin/ask-hook\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Kept id: moved from product, PRD 2346
