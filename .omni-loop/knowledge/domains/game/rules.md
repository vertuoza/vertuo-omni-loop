# Game rules

## BR-PRODUCT-27

A workspace theme colour is accepted only as a lowercase six-digit #rrggbb value, the same rule fleet colours follow; a value such as #A45CFF is refused, in the database and in the client schema alike.

Serves: P-PRODUCT-25
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-02-theme-colours-lowercase, PRD #100
Enforced by: apps/galaxy/src/arcade/theme.test.ts
Governs: ^apps/galaxy/src/arcade/theme\., ^supabase/migrations/
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Kept id: moved from product, PRD 2346

## BR-PRODUCT-30

When the arcade cannot read a signed-in person's memberships or loaders, it treats them as crew: it shows the galaxy-out-of-reach message and never the wrong-account screen.

Serves: P-PRODUCT-28
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s5-02-out-of-reach-is-not-outsider, PRD #100
Enforced by: apps/galaxy/src/data/arcade.test.ts
Governs: ^apps/galaxy/src/data/arcade\.
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101
Kept id: moved from product, PRD 2346

## BR-PRODUCT-32

The arcade shows only the XP earned in the workspace it plays for a person, the one they joined first. A failed XP read shows XP out of reach with no level, while the galaxy, fleets and crew still show as read.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s2-01-xp-read-in-the-workspace-played, PRD #160
Enforced by: apps/galaxy/src/data/arcade.test.ts
Governs: ^apps/galaxy/src/data/arcade\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-33

When the phone turns during an invaders game, the game keeps the field it started on (wide: ten columns and four shields; tall: six and three), letterboxed, until it ends. The next game uses the field of the current screen.

Serves: P-PRODUCT-31
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-03-a-game-keeps-its-field, PRD #160
Enforced by: apps/galaxy/src/arcade/game-field.test.ts
Governs: ^apps/galaxy/src/arcade/game-field\.test\.ts$, ^apps/galaxy/src/arcade/grid\., ^apps/galaxy/src/arcade/games/invaders\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-34

In the arcade invaders game, alien rows are ordered by what each Entropy kind pays (woundClose), highest on top, with ties kept in the spec's order, so the top row always pays most whatever the values become.

Serves: P-PRODUCT-32
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-04-rows-follow-the-close-values, PRD #160
Enforced by: apps/galaxy/src/arcade/games/invaders.test.ts
Governs: ^apps/galaxy/src/arcade/games/invaders\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-35

When a member leaves a workspace, their player row and every arcade_scores row keyed to it are removed with them, so the crew's score table never shows a departed player.

Serves: P-PRODUCT-33
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-01-scores-leave-with-the-player, PRD #160
Enforced by: apps/galaxy/src/data/scores-sql.test.ts
Governs: ^apps/galaxy/src/data/scores-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-36

The arcade reads high scores only for players who linked GitHub, separately from the galaxy. A failed read shows SCORES OUT OF REACH on the cabinet while the galaxy, level and XP still show and the game plays. The demo's table holds only the guest's own best.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-04-scores-read-on-their-own, PRD #160
Enforced by: apps/galaxy/src/data/arcade.test.ts
Governs: ^apps/galaxy/src/data/arcade\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-37

The level-up screen names the first registry game whose unlock level is above the level this device last celebrated and at or below the level reached, and only when the player's saved record holds it as unlocked.

Serves: P-PRODUCT-35
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s6-02-levels-climbed-between-visits, PRD #160
Enforced by: apps/galaxy/src/arcade/levelup.test.ts
Governs: ^apps/galaxy/src/arcade/levelup\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Kept id: moved from product, PRD 2346

## BR-PRODUCT-42

Whenever a player enters the arcade menu, including through the #menu link, with a level this device has not yet celebrated, the LEVEL UP screen plays first and the menu opens once it is done.

Serves: P-PRODUCT-39
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-02-level-up-before-menu-link, PRD #238
Enforced by: apps/galaxy/src/arcade/deep-link.test.ts
Governs: ^apps/galaxy/src/arcade/deep-link\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239
Kept id: moved from product, PRD 2346

## BR-PRODUCT-43

When a signed-in person with no galaxy on their page follows a link to the game's menu, the arcade starts from the intro as the home address does, then shows the outside-the-crew screen or the menu with the galaxy out of reach.

Serves: P-PRODUCT-40
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-03-menu-link-without-galaxy, PRD #238
Enforced by: apps/galaxy/src/arcade/deep-link.test.ts
Governs: ^apps/galaxy/src/arcade/deep-link\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239
Kept id: moved from product, PRD 2346

## BR-PRODUCT-44

While the OPEN THE APP? confirm is open, the arcade's timed hand-overs (boot, intro, welcome, fleet lock-in) wait. After a no, the same screen shows and restarts its timer in full, except the fleet lock-in, which still counts from when it began.

Serves: P-PRODUCT-41
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s3-02-timed-screens-wait-under-confirm, PRD #238
Enforced by: apps/galaxy/src/arcade/leave.test.ts
Governs: ^apps/galaxy/src/arcade/leave\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239
Kept id: moved from product, PRD 2346

## BR-PRODUCT-46

A fleet's mascot is one of eleven keys held in a database list, the same list and order as the sprite library's mascots: beaver, octopus, duck, spy, pirate, invincible hero, Atom Eve, shark, turtle, Allen the Alien or robot. The commander, the enemy, the plain heroes and the small icons are refused.

Serves: P-PRODUCT-43
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-01-mascot-choices, PRD #400
Enforced by: packages/design/src/mascots.test.ts
Governs: ^packages/design/src/(mascots|sprites)\., ^supabase/migrations/
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Kept id: moved from product, PRD 2346

## BR-PRODUCT-47

A new fleet's key is its label lowercased, with each run of non-letters and non-digits turned into a dash (c-i-a). When that key is already taken, even by a retired fleet, a number is added (beaver-2).

Serves: P-PRODUCT-44
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-03-fleet-key-from-label, PRD #400
Enforced by: apps/galaxy/src/fleets/fleet-key-sql.test.ts
Governs: ^apps/galaxy/src/fleets/fleet-key-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Kept id: moved from product, PRD 2346

## BR-PRODUCT-48

When a workspace has no fleets, the arcade menu keeps its FLEETS entry, hinted as no fleets yet, and it opens the invitation screen instead of the empty fleets wall; the Hall of Heroes fleet column and TOP FLEETS are hidden.

Serves: P-PRODUCT-45
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-01-fleets-menu-with-none, PRD #400
Enforced by: apps/galaxy/src/arcade/scenes/menu.test.ts
Governs: ^apps/galaxy/src/arcade/scenes/menu\.
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Kept id: moved from product, PRD 2346

## BR-PRODUCT-49

A player whose fleet was retired is sent to pick a fleet only while at least one fleet in the workspace is active. When none is, they count as ready, go straight to the menu under the retired fleet's name, and their stored fleet stays unchanged.

Serves: P-PRODUCT-46
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-02-disbanded-with-no-fleets, PRD #400
Enforced by: apps/galaxy/src/arcade/onboarding.test.ts
Governs: ^apps/galaxy/src/arcade/onboarding\.
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Kept id: moved from product, PRD 2346

## BR-PRODUCT-56

When the hero loses a life with lives left, the stage waits on its ready screen with the stage and lives left until the player presses start, as a new game does; play then resumes from the stage's start with the score kept.

Serves: P-PRODUCT-53
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s2-01-ready-screen-after-a-life-lost, PRD #817
Enforced by: apps/galaxy/src/arcade/platformer/session.test.ts
Governs: ^apps/galaxy/src/arcade/platformer/session\.
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818
Kept id: moved from product, PRD 2346

## BR-PRODUCT-57

The corner game box never takes the page's Tab or Shift keys, so a reader can always move between links while a game is open; Escape folds the box and B goes back to the game list.

Serves: P-PRODUCT-42
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s4-02-dock-select-stays-with-the-page, PRD #817
Enforced by: apps/galaxy/src/play-dock/dock-keys.test.ts
Governs: ^apps/galaxy/src/play-dock/dock-keys\.
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818
Kept id: moved from product, PRD 2346

## BR-PRODUCT-58

On a stage clear screen, A or START goes on to the next stage's ready screen with score and lives kept, and B does nothing, so a run ends only at game over or the world's end, where its score is saved.

Serves: P-PRODUCT-54
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s3-01-stage-clear-goes-on, PRD #817
Enforced by: apps/galaxy/src/arcade/platformer/session.test.ts
Governs: ^apps/galaxy/src/arcade/platformer/session\.
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818
Kept id: moved from product, PRD 2346

## BR-PRODUCT-77

Answering a question on a PRD earns the answerer 2 points and earns their fleet the same 2 points. If that PRD is later lost, those answer points are taken back in its season, like the rest of that PRD's points.

Serves: P-PRODUCT-68
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-01-answers-pay-the-fleet-too, PRD #1180
Enforced by: game/rulebook.test.ts, game/projector.test.ts, game/economy.test.ts
Governs: ^game/(rulebook|projector|economy)\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181
Kept id: moved from product, PRD 2346

## BR-PRODUCT-78

Every answered question earns points for the answerer when they are a current workspace member with a GitHub login, whether or not a numbered PRD claims it. An answer no PRD claims is credited on planet 0, which the map and the season's planets leave out.

Serves: P-PRODUCT-69
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-03-which-answers-are-paid, PRD #1180
Enforced by: supabase/checks/game_answered_rounds.sql, supabase/migrations/20261109090000_game_answered_rounds.sql, game/sources/supabase.test.ts, supabase/migrations/20261118090000_every_answer_pays.sql
Governs: ^game/sources/supabase\., ^supabase/checks/game_answered_rounds\.sql$, ^supabase/migrations/
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181
Kept id: moved from product, PRD 2346

## BR-PRODUCT-79

A point credited to a GitHub login is credited under that login; a login with capitals is accepted, never skipped, and answer points arrive already in lower case. The event is skipped only when the name holds an at sign, a dot, a space or another character no GitHub login can hold.

Serves: P-PRODUCT-70
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-01-capital-login-skipped, PRD #1180
Enforced by: game/projector.test.ts
Governs: ^game/projector\.
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181
Kept id: moved from product, PRD 2346

## BR-PRODUCT-80

When a settled decision names an approver that no GitHub login can have, such as a dotted name, its settle is skipped with a warning and earns no one credit. The decision stays open until the name is corrected, then it is credited to that login.

Serves: P-PRODUCT-71
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-02-dotted-approver-waits, PRD #1180
Enforced by: game/sources/parsers.test.ts
Governs: ^game/sources/parsers\.
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181
Kept id: moved from product, PRD 2346

## BR-PRODUCT-101

In the arcade duet game, quitting from the pause or pressing B on a ready screen once play has started ends the run at its game over, which sends the score once and shows whether it was saved; B from there returns to the game room.

Serves: P-PRODUCT-54
Source: .omni-loop/delivery/shipped/1633-omni-duet/outbox/settled.md, entry s4-01-quitting-shows-the-game-over, PRD #1633
Enforced by: apps/galaxy/src/arcade/duet/run.test.ts, apps/galaxy/src/arcade/scenes/duet.test.ts
Governs: ^apps/galaxy/src/arcade/duet/run\., ^apps/galaxy/src/arcade/scenes/duet\.
Stated: 2026-10-11
Decided: nobody — adopted when raised (medium), 2026-10-11
Merged: @martl-vertuoza, 2026-10-11, PR #1636
Kept id: moved from product, PRD 2346

## BR-PRODUCT-102

In Duet's endless mode, each wave is one to three of the last chapter's own rows drawn from a fixed seed, at a speed starting just above that chapter's fastest that rises slowly and then stops at a ceiling, so every endless wave stays passable.

Serves: P-PRODUCT-86
Source: .omni-loop/delivery/shipped/1633-omni-duet/outbox/settled.md, entry s4-02-endless-waves-from-chapter-four-rows, PRD #1633
Enforced by: apps/galaxy/src/arcade/duet/waves.test.ts, apps/galaxy/src/arcade/duet/waves.ts
Governs: ^apps/galaxy/src/arcade/duet/waves\.
Stated: 2026-10-11
Decided: nobody — adopted when raised (medium), 2026-10-11
Merged: @martl-vertuoza, 2026-10-11, PR #1636
Kept id: moved from product, PRD 2346

## BR-PRODUCT-112

A sub-PR never earns points. Securing a zone pays its author nothing, and a reverted zone takes nothing back; the one credit a sub-PR's author still earns is the expedition bonus, paid when the planet terraforms. Past seasons are recomputed the same way.

Serves: P-PRODUCT-68
Source: .omni-loop/delivery/shipped/1975-merged-pr-points/spec.md, Solution 7 and 11, PRD #1975
Enforced by: game/economy.test.ts
Governs: ^game/(rulebook|economy)\.
Stated: 2026-10-15
Decided: @pierrederval, 2026-10-15
Kept id: moved from product, PRD 2346

## BR-PRODUCT-122

In the arcade duet game, each obstacle a player gets past scores once, the first moment all of it is below the lowest point the orbs reach: 1 in a chapter, 2 in endless mode, a gate counting as one obstacle; finishing a wave adds nothing more, and a hit gives back every point scored since the chapter began (in endless mode, since the wave began).

Serves: P-PRODUCT-86
Source: .omni-loop/delivery/shipped/2318-duet-obstacle-points/outbox/settled.md, entry s1-01-duet-obstacle-scored-once, PRD #2318
Enforced by: apps/galaxy/src/arcade/duet/run.test.ts, apps/galaxy/src/arcade/duet/waves.test.ts
Governs: ^apps/galaxy/src/arcade/duet/run\.
Stated: 2026-10-21
Decided: @mart-lej, 2026-10-21
Kept id: moved from product, PRD 2346
