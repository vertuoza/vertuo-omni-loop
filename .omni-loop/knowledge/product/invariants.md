# Product invariants

## N-PRODUCT-2

The kit runs only inside a repository under git; tracked files always come from version control, and there is no fallback that walks plain folders.

Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s3-01-tracked-files-need-git, PRD #3
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4

## N-PRODUCT-3

A raised item is graded by the same check the outbox gate uses before anything is written or adopted, so a bad option or a below-floor rank is refused at the source.

Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s13-01-item-new-json-shape-and-input-flag-rename, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## N-PRODUCT-4

The outbox gate reads its settings from the base branch and only the delivery folder from the pull request's head, so a pull request can never change the rules it is judged by, such as the override label.

Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s1-01-evaluate-reads-two-snapshots, PRD #28
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29

## N-PRODUCT-5

kit/build.ts builds a byte-identical bundle wherever it is started from, with the working directory pinned to the repository root, and tests build to a scratch file rather than overwriting the committed kit/dist/omni.mjs.

Source: .omni-loop/delivery/shipped/0039-omni-init/outbox/settled.md, entry s3-03-build-script-outfile-and-fixed-working-dir, PRD #39
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #40

## N-PRODUCT-7

A plugin hook that cannot run never blocks a person's message or question: each hooks.json command ends in || true, and omni ask hook exits 0 with no output for any known kind, whatever the repository, config or server state.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-03-hooks-never-block, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## N-PRODUCT-8

The ask hooks send no call unless ask.url is set in the repository's config and its host equals the host saved in the session. Every call goes to a path under ask.url, and emptying the setting switches the mode off at once.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-04-where-the-hooks-send-calls, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## N-PRODUCT-9

Each game/cli script parses its own arguments in openWorkspace() before any read, and any argument it does not understand exits 2 with the usage line before Supabase or GitHub is called.

Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s4-01-game-scripts-refuse-stray-arguments, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101

## N-PRODUCT-10

A player with no level is stored in player_xp with level 0, never an empty value, and every screen that shows a level reads 0 as no level and shows none.

Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s1-03-no-level-stored-as-zero, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## N-PRODUCT-11

The front page forwards every link that names an arcade screen to /play, reading the list from the arcade's DEEP_LINKS table, so no game-screen link ever lands on HOME.

Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s1-01-forward-every-arcade-link, PRD #261
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #263

## N-PRODUCT-12

Run in a folder where the loop is not installed, omni now does not refuse: it reads nothing, answers that the session is on nothing, and exits 0. Other commands that need a kit still refuse there.

Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s1-01-now-runs-without-a-kit, PRD #1208
Enforced by: kit/lib/launch/launch.test.ts, kit/bin/now.test.ts, kit/bin/omni.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## N-PRODUCT-13

omni init writes no file outside .omni-loop/ except two keys of .claude/settings.json, the status line and the band's setting, and never changes a value someone else set; it commits that file whenever either key is the loop's.

Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s7-01-init-wires-the-band-outside-its-territory, PRD #1208
Enforced by: kit/lib/init/settings.test.ts, kit/bin/init.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## N-PRODUCT-14

A push notification tap only ever opens a page on the Omni site; a link to anywhere else falls back to the app's home page. A push message the phone cannot read still shows a generic alert rather than nothing.

Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s9-01-push-payload-shape, PRD #1322
Enforced by: apps/galaxy/src/push/sw.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09
