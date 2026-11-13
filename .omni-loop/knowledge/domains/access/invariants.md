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

## N-ACCESS-1

Whenever an API key is revoked, by whichever revoke path, its sealed GitHub App private key is erased from the database; no revoked key ever leaves its App key behind.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s1-02-revoke-erases-the-sealed-key-by-trigger, PRD #2433
Enforced by: supabase/checks/api_key_github_apps.sql, supabase/migrations/20261228090000_api_key_github_apps.sql
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-2

A runner job's GitHub App token never enters the job's environment: it is kept in a file only the runner's owner can read, removed when the job ends, and every token the job ever had is masked in its log and in everything the runner sends.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-01-app-token-in-a-file, PRD #2433
Enforced by: kit/lib/runner/github-token.test.ts, kit/lib/runner/runner-github.test.ts, kit/lib/runner/sender.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-3

When a job runs as the GitHub App, the app's sign-in and ssh-to-https rewrite apply to github.com only: its token is never offered to another host, which keeps the machine's own sign-in, and github.com never falls back to the machine's key.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-02-app-identity-github-only, PRD #2433
Enforced by: kit/lib/runner/github-app.test.ts, kit/bin/github.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-4

The runner's stand-in for the GitHub command line tool never stores a token; it fetches the job's app token each time it is called, and a job without a GitHub App never has it on its search path.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-03-gh-shim-shared, PRD #2433
Enforced by: kit/lib/runner/runner.test.ts, kit/lib/runner/runner-github.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-5

A runner tells the server at sign-up that it can run GitHub App jobs only when it was started with the means to hand a job its token. If keeping the token on the machine fails, the job ends as failed with one plain reason.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-05-register-app-only-when-able, PRD #2433
Enforced by: kit/lib/runner/runner.test.ts, kit/lib/runner/runner-github.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-6

When a runner releases a stranded job from an earlier run, a job that ran as the GitHub App is released as the App or not at all, never as the machine's own GitHub identity, even after the runner's cleanup has deleted old files.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s3-04-stranded-app-jobs-are-recognized-before-the-cleanup, PRD #2433
Enforced by: kit/lib/runner/runner.test.ts, kit/lib/runner/release.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## N-ACCESS-7

The server never asks GitHub for an App installation token without at least one named repository, nor for a repository whose owner differs from the installation's account in any letter case, so a token never covers more than the repositories named.

Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s4-02-token-needs-named-repositories, PRD #2433
Enforced by: apps/galaxy/src/public-api/keys/github-app.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23
