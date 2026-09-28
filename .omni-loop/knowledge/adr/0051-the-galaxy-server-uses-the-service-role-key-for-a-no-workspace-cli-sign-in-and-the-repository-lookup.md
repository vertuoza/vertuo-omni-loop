# ADR-0051 — The galaxy server uses the service-role key to issue a terminal sign-in for someone in no workspace, and to look up where a repository goes

**Status:** accepted · **Date:** 2026-09-28 · **PRD:** #459 · **Supersedes:** part of ADR-0032 · **Decided:** @pierrederval via feature pull request #460, 2026-09-28 · **Merged:** pending, PR #460

## Context

PRD 459 promises that a terminal sign-in is never refused, and that the sign-in and `omni ask on|status` name the workspace a checkout's repository goes to. The database still refuses `ask_cli_code_issue()` to an account in no workspace (42501), and `repo_workspace(person, repo)`, which answers where a repository goes, is not executable by `authenticated` or `anon`. ADR-0032 kept the CLI codes behind those two security-definer functions, with no service-role key in `apps/galaxy`.

## Decision

The galaxy server uses `SUPABASE_SERVICE_ROLE_KEY`, server-side only, for two steps: issuing a CLI code when the database refused only because the person is in no workspace, and calling `repo_workspace()` for the token reply and for `GET /api/ask/workspace` (`apps/galaxy/src/ask/cli-code-live.ts`). Every other sign-in still goes through `ask_cli_code_issue()` and `ask_cli_code_redeem()` as the caller.

The option chosen: A. The web app's server uses its full-access key for these two steps only, the option built.

## What it supersedes in ADR-0032

- **Decision:** "The galaxy app, holding only the anon key" no longer holds: the galaxy deployment now carries the service-role key, and uses it for the two steps above. The table's row-level security and the two functions stay.

## Consequences

- The galaxy deployment needs `SUPABASE_SERVICE_ROLE_KEY`. Without it, someone in no workspace cannot finish a terminal sign-in, and the sign-in line and `omni ask status` name only the account.
- Moving away later (option B): a migration that drops the workspace requirement from `ask_cli_code_issue()` and lets a signed-in person call `repo_workspace()` for themself, then about thirty lines out of the web app; no stored data changes shape.

## Source

`.omni-loop/delivery/outbox/0459-workspace-gate/settled.md`, entry `s2-01-server-issues-sign-in-for-no-workspace`
