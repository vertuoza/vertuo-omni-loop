# Install invariants

## N-PRODUCT-13

omni init and omni update write no file outside .omni-loop/ except two keys of .claude/settings.json, the status line and the band's setting, and the `.agents/skills/omni-*` folders the manifest says they own; they never change a value or a file someone else set, and they commit .claude/settings.json whenever either key is the loop's.

Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s7-01-init-wires-the-band-outside-its-territory, PRD #1208
Enforced by: kit/lib/init/settings.test.ts, kit/bin/init.test.ts, kit/lib/agents/write.test.ts
Governs: ^kit/lib/init/, ^kit/bin/commands/init\.ts$, ^kit/bin/init\.test\.ts$, ^kit/lib/agents/, ^kit/lib/update/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210
Kept id: moved from product, PRD 2346
