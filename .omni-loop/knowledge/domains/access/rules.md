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
Source: .omni-loop/delivery/outbox/2433-api-key-github-app/settled.md, entry s7-01-token-covers-the-jobs-own-repository-only, PRD #2433
Enforced by: apps/galaxy/src/runners/runners.github-repositories.test.ts, supabase/checks/api_key_github_apps.sql
Stated: 2026-10-23
Decided: @nicojustdev, 2026-10-22, on PR #2434 (option B)
