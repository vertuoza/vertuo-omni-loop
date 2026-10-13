# Product invariants

## N-PRODUCT-2

The kit runs only inside a repository under git; tracked files always come from version control, and there is no fallback that walks plain folders.

Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s3-01-tracked-files-need-git, PRD #3
Enforced by: kit/lib/check-report.test.ts
Governs: ^kit/lib/check-report\., ^kit/lib/git\.
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4

## N-PRODUCT-3

A raised item is graded by the same check the outbox gate uses before anything is written or adopted, so a bad option or a below-floor rank is refused at the source.

Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s13-01-item-new-json-shape-and-input-flag-rename, PRD #7
Enforced by: kit/bin/item.test.ts
Governs: ^kit/bin/commands/item\.ts$, ^kit/bin/item\.test\.ts$, ^kit/lib/outbox/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## N-PRODUCT-4

The outbox gate reads its settings from the base branch, so a pull request can never change the rules it is judged by, such as the override label. From the pull request's head it reads only what is judged: the delivery folder, and the knowledge folder as data compared with the base's, so a law that loses its test is seen (PRD 1342).

Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s1-01-evaluate-reads-two-snapshots, PRD #28
Enforced by: apps/omni-app/src/outbox-check/outbox-check.test.ts
Governs: ^apps/omni-app/src/outbox-check/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29

## N-PRODUCT-5

kit/build.ts builds a byte-identical bundle wherever it is started from, with the working directory pinned to the repository root, and tests build to a scratch file rather than overwriting the committed kit/dist/omni.mjs.

Source: .omni-loop/delivery/shipped/0039-omni-init/outbox/settled.md, entry s3-03-build-script-outfile-and-fixed-working-dir, PRD #39
Enforced by: kit/test/dist.test.ts
Governs: ^kit/build\.ts$, ^kit/test/dist\.test\.ts$
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #40

## N-PRODUCT-7

A plugin hook that cannot run never blocks a person's message or question: each hooks.json command ends in || true, and omni ask hook exits 0 with no output for any known kind, whatever the repository, config or server state.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-03-hooks-never-block, PRD #71
Enforced by: kit/bin/ask-hook.test.ts
Governs: ^kit/lib/ask/hook\., ^kit/plugin/hooks/, ^kit/bin/ask-hook\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## N-PRODUCT-8

The ask hooks send no call unless ask.url is set in the repository's config and its host equals the host saved in the session. Every call goes to a path under ask.url, and emptying the setting switches the mode off at once.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-04-where-the-hooks-send-calls, PRD #71
Enforced by: kit/bin/ask-hook.test.ts
Governs: ^kit/lib/ask/, ^kit/plugin/hooks/, ^kit/bin/ask-hook\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## N-PRODUCT-9

Each game/cli script parses its own arguments in openWorkspace() before any read, and any argument it does not understand exits 2 with the usage line before Supabase or GitHub is called.

Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s4-01-game-scripts-refuse-stray-arguments, PRD #100
Enforced by: game/cli/scripts.test.ts
Governs: ^game/cli/
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101

## N-PRODUCT-10

A player with no level is stored in player_xp with level 0, never an empty value, and every screen that shows a level reads 0 as no level and shows none.

Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s1-03-no-level-stored-as-zero, PRD #160
Enforced by: apps/galaxy/src/arcade/games/room.test.ts
Governs: ^apps/galaxy/src/arcade/games/room\., ^supabase/migrations/
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## N-PRODUCT-11

The front page forwards to /play every link that names a screen in the arcade's DEEP_LINKS table, reading the list from that table, and every link to a planet by its PRD number (#planet-<n>), so none of them ever lands on HOME.

Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s1-01-forward-every-arcade-link, PRD #261
Enforced by: apps/galaxy/src/home/forward.test.ts
Governs: ^apps/galaxy/src/home/forward\., ^apps/galaxy/src/arcade/deep-link\.
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #263

## N-PRODUCT-12

Run in a folder where the loop is not installed, omni now does not refuse: it reads nothing, answers that the session is on nothing, and exits 0. Other commands that need a kit still refuse there.

Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s1-01-now-runs-without-a-kit, PRD #1208
Enforced by: kit/lib/launch/launch.test.ts, kit/bin/now.test.ts, kit/bin/omni.test.ts
Governs: ^kit/lib/launch/launch\., ^kit/bin/commands/now\.ts$, ^kit/bin/now\.test\.ts$, ^kit/bin/omni\.
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## N-PRODUCT-13

omni init writes no file outside .omni-loop/ except two keys of .claude/settings.json, the status line and the band's setting, and never changes a value someone else set; it commits that file whenever either key is the loop's.

Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s7-01-init-wires-the-band-outside-its-territory, PRD #1208
Enforced by: kit/lib/init/settings.test.ts, kit/bin/init.test.ts
Governs: ^kit/lib/init/, ^kit/bin/commands/init\.ts$, ^kit/bin/init\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## N-PRODUCT-14

The terminal checks for a bug fix, a visual fix, coverage and the status gate compare the knowledge folder against the base branch's, so a law that loses its test is seen in the terminal just as the server sees it.

Source: .omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md, entry s7-02-terminal-checks-read-the-base-rules, PRD #1342
Enforced by: kit/bin/law-demoted.test.ts
Governs: ^kit/bin/law-demoted\.test\.ts$, ^kit/lib/outbox/, ^kit/bin/commands/(bug|visual|check|status)\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-10
Decided: nobody — adopted when raised (medium), 2026-10-10
Merged: @pierrederval, 2026-10-10, PR #1343

## N-PRODUCT-15

The loop's merge gate never merges a pull request into the default branch: `omni flow check merge` refuses one whose base is the default branch, and no skill runs a merge there. Only a person merges into it.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: kit/lib/flow/merge-gate.test.ts, kit/test/plugin.test.ts
Governs: ^kit/lib/flow/merge-gate\., ^kit/plugin/skills/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13

## N-PRODUCT-16

The game's ledger is append-only: no role may update or delete a row of `ledger_events`, a trigger refuses either, and the game only ever appends events it has not seen.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: supabase/checks/access.sql, game/ledger.test.ts
Governs: ^supabase/migrations/, ^supabase/checks/access\.sql$, ^game/ledger\., ^game/sources/supabase\.
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13

## N-PRODUCT-17

No secret reaches the browser: the arcade gives the browser only the two public Supabase values, and no other variable in `apps/` or `packages/` carries the `NEXT_PUBLIC_` prefix that Next inlines into the browser's code.

Source: .omni-loop/delivery/shipped/1726-locked-laws/outbox/settled.md, entry s6-01-candidate-laws-to-lock, PRD #1726
Enforced by: scripts/public-env-guard.test.ts, scripts/env-guard.test.ts
Governs: ^apps/galaxy/src/env(\.client)?\.ts$, ^apps/galaxy/\.env\.example$, ^scripts/(public-env|env)-guard\.test\.ts$
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-13
Decided: @pierrederval via the terminal, 2026-10-13
