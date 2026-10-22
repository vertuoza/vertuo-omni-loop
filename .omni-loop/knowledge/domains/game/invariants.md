# Game invariants

## N-PRODUCT-9

Each game/cli script parses its own arguments in openWorkspace() before any read, and any argument it does not understand exits 2 with the usage line before Supabase or GitHub is called.

Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s4-01-game-scripts-refuse-stray-arguments, PRD #100
Enforced by: game/cli/scripts.test.ts
Governs: ^game/cli/
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Kept id: moved from product, PRD 2346

## N-PRODUCT-10

A player with no level is stored in player_xp with level 0, never an empty value, and every screen that shows a level reads 0 as no level and shows none.

Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s1-03-no-level-stored-as-zero, PRD #160
Enforced by: apps/galaxy/src/arcade/games/room.test.ts
Governs: ^apps/galaxy/src/arcade/games/room\., ^supabase/migrations/
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## N-PRODUCT-16

The game's ledger is append-only: no role may update or delete a row of `ledger_events`, a trigger refuses either, and the game only ever appends events it has not seen.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: supabase/checks/access.sql, game/ledger.test.ts
Governs: ^supabase/migrations/, ^supabase/checks/access\.sql$, ^game/ledger\., ^game/sources/supabase\.
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13
Kept id: moved from product, PRD 2346
