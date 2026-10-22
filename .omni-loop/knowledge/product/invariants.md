# Product invariants

## N-PRODUCT-2

The kit runs only inside a repository under git; tracked files always come from version control, and there is no fallback that walks plain folders.

Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s3-01-tracked-files-need-git, PRD #3
Enforced by: kit/lib/check-report.test.ts
Governs: ^kit/lib/check-report\., ^kit/lib/git\.
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4

## N-PRODUCT-5

kit/build.ts builds a byte-identical bundle wherever it is started from, with the working directory pinned to the repository root, and tests build to a scratch file rather than overwriting the committed kit/dist/omni.mjs.

Source: .omni-loop/delivery/shipped/0039-omni-init/outbox/settled.md, entry s3-03-build-script-outfile-and-fixed-working-dir, PRD #39
Enforced by: kit/test/dist.test.ts
Governs: ^kit/build\.ts$, ^kit/test/dist\.test\.ts$
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #40

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

## N-PRODUCT-19

A runner job for one of the loop's own skills never loads the repository's tool servers. A repository skill's job loads them only when its worktree declares them, and the runner refuses any line that is neither a fixed skill nor one the owner allowed before a job starts.

Source: .omni-loop/delivery/shipped/2313-runner-repo-skills/outbox/settled.md, entry s2-01-s2-job-tells-skill-by-line, PRD #2313
Enforced by: kit/lib/runner/job.test.ts, kit/lib/runner/runner.test.ts, kit/lib/runner/line.test.ts
Stated: 2026-10-21
Decided: nobody — adopted when raised (medium), 2026-10-21
Merged: @pierrederval, 2026-10-21, PR #2316
Proposed: harvest 2026-10-22
