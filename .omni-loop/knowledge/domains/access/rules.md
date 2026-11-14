# Access rules

## BR-PRODUCT-28

link_github() answers only a caller who has at least one workspace_members row; anyone else is refused with 42501 and 'Sign in with an account of a workspace first.', whether or not GitHub is linked.

Serves: P-PRODUCT-26
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-03-link-github-needs-a-workspace, PRD #100
Enforced by: apps/galaxy/src/data/link-github-sql.test.ts
Governs: ^apps/galaxy/src/data/link-github-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Kept id: moved from product, PRD 2346

## BR-PRODUCT-63

A link may read a repository the workspace lists, or any repository the workspace's GitHub organisation owns, exactly as a member's own read allows; any other repository is refused, and it never reads another workspace's claims.

Serves: P-PRODUCT-58
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s1-01-token-repo-scope, PRD #855
Enforced by: apps/galaxy/src/agent-connect/tokens/repo-scope-sql.test.ts
Governs: ^apps/galaxy/src/agent-connect/tokens/repo-scope-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856
Kept id: moved from product, PRD 2346

## BR-PRODUCT-64

When a member leaves a workspace, every link they made stops working and any call through it is refused, yet it stays in the links list marked as not working because its maker left, so an owner can revoke it for good.

Serves: P-PRODUCT-26
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s1-02-left-maker-links-listed, PRD #855
Enforced by: apps/galaxy/src/agent-connect/tokens/tokens-sql.test.ts
Governs: ^apps/galaxy/src/agent-connect/tokens/tokens-sql\.test\.ts$, ^supabase/migrations/
Locked: @pierrederval, 2026-10-13
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856
Kept id: moved from product, PRD 2346

## BR-PRODUCT-65

When an agent sends a question naming a code project that does not belong to the team's workspace, the question is refused with the same one-line reason given when the agent reads the business for that project; it is never kept.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s3-01-report-repo-must-be-the-workspaces, PRD #855
Enforced by: apps/galaxy/src/agent-connect/questions/report-sql.test.ts
Governs: ^apps/galaxy/src/agent-connect/questions/report-sql\.test\.ts$, ^supabase/migrations/
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856
Kept id: moved from product, PRD 2346

## BR-PRODUCT-66

Jev judges an agent's question only on the report that first stores it; a repeat only adds to its asked count and keeps its state. Once a person brings a question back, Jev never sets it aside again.

Serves: P-PRODUCT-37
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s4-02-jev-judges-first-report-bring-back-final, PRD #855
Enforced by: apps/galaxy/src/agent-connect/mcp/server.test.ts
Governs: ^apps/galaxy/src/agent-connect/mcp/server\.
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856
Kept id: moved from product, PRD 2346

## BR-PRODUCT-110

A token made from the terminal acts in the workspace the sign-in names. When the sign-in names none, it belongs to the first workspace the person joined.

Serves: P-PRODUCT-92
Source: .omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md, entry s1-02-token-workspace, PRD #1628
Enforced by: apps/galaxy/src/ask/kit-token.test.ts, supabase/checks/agent_tokens.sql
Stated: 2026-10-12
Decided: nobody — adopted when raised (medium), 2026-10-11
Merged: @pierrederval, 2026-10-12, PR #1629
Kept id: moved from product, PRD 2346

## BR-PRODUCT-111

A terminal token is visible only to the member who made it and to the workspace's owners, who may revoke it; other members never see it. Two terminal tokens may share a name.

Serves: P-PRODUCT-93
Source: .omni-loop/delivery/shipped/1628-cloud-sign-in/outbox/settled.md, entry s1-03-who-sees-tokens, PRD #1628
Enforced by: supabase/checks/agent_tokens.sql, apps/galaxy/src/profile/terminal-tokens.service.test.ts
Stated: 2026-10-12
Decided: nobody — adopted when raised (medium), 2026-10-11
Merged: @pierrederval, 2026-10-12, PR #1629
Kept id: moved from product, PRD 2346

## BR-ACCESS-1

When a job an API key sends runs as the key's GitHub App, its token reaches only repositories the key may reach: the job's repository and, for a mega bug fix, its plan repository and the other repositories its product names, each only when it is in the key's allowed repositories and the App's installation holds it.

Serves: P-PRODUCT-58
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s7-01-token-covers-the-jobs-own-repository-only, PRD #2433
Enforced by: apps/galaxy/src/runners/runners.github-repositories.test.ts, supabase/checks/api_key_github_apps.sql
Stated: 2026-10-23
Decided: @nicojustdev, 2026-10-22, on PR #2434 (option B)

## BR-ACCESS-2

A job queued while its API key held a GitHub App is only ever taken by a runner that can act as an App, even after the App is removed or the key revoked; it never runs as a person. A job queued after removal carries no such mark.

Serves: P-ACCESS-1
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s1-01-queued-jobs-stay-app-jobs, PRD #2433
Enforced by: supabase/checks/api_key_github_apps.sql, supabase/migrations/20261228090000_api_key_github_apps.sql
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## BR-ACCESS-3

When an API key sent a job, the key's name reaches the job in its own variable, never in the one that names a person, and any leading at sign is removed, so the pull request's sender line names the key and never reads as a person's handle.

Serves: P-ACCESS-2
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-04-key-sender-own-variable, PRD #2433
Enforced by: kit/lib/runner/sender.test.ts, kit/lib/env/read.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## BR-ACCESS-4

When a job that ran as the GitHub App ends with no valid App token left, or its token file is gone, its claims are not released and the job's result records why. They are never released with the machine's own GitHub login.

Serves: P-ACCESS-3
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s3-02-an-app-job-with-no-token-left-is-released-as-nothing, PRD #2433
Enforced by: kit/lib/runner/runner.test.ts, kit/lib/runner/release.test.ts, kit/lib/runner/runner-github.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## BR-ACCESS-5

When a job ends and its claims are released as the GitHub App, the runner reuses its token if more than five minutes are left, and otherwise asks the app for a fresh one first. If the app refuses, the claims are left as they are.

Serves: P-PRODUCT-14
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s3-03-release-asks-a-fresh-token-when-it-is-late, PRD #2433
Enforced by: kit/lib/runner/release.test.ts, kit/lib/runner/github-token.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## BR-ACCESS-6

Only the owner of an API key's workspace may attach a GitHub App pair to it; a member or another workspace's owner is refused, and the App ID and private key they sent are never stored, logged or returned.

Serves: P-ACCESS-4
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s4-01-pair-checked-before-owner, PRD #2433
Enforced by: apps/galaxy/src/public-api/keys/api-keys.service.test.ts, apps/galaxy/src/public-api/keys/api-keys.github-app.controller.test.ts, supabase/checks/api_key_github_apps.sql
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## BR-ACCESS-7

A runner's fresh-token request that cannot mint answers a conflict with the reason in words when the API key or its App no longer works, and service unavailable when GitHub cannot be reached. The words never hold a key or a token.

Serves: P-ACCESS-5
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s7-02-refresh-refusals-say-stop-or-try-again, PRD #2433
Enforced by: apps/galaxy/src/runners/runners.service.test.ts, apps/galaxy/src/runners/runners.controller.test.ts, kit/lib/runner/github-refresh.test.ts
Stated: 2026-10-23
Decided: nobody — adopted when raised (medium), 2026-10-22
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23
