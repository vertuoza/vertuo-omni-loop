# Plan: Open the Omni page to every workspace member, not only @vertuoza.com

PRD #459, with the spec beside this plan (`spec.md`). The feature branch `feat/workspace-gate` merges
into `main` with `Closes #459`. Each slice is a sub-PR from `feat/workspace-gate--<slice>` into the
feature branch, with `Part of #459`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Membership is the only gate for dossiers and ask sessions: `isCrewEmail()` and both its refusals are gone, one database function answers the spec's table for (person, repo) — the workspace, or a refusal naming the owning workspace, or none — and the ask-session trigger, `dossier_open()` and `dossier_push()` use it; an ask session with no workspace answers 403 with the reason, not 500; `omni dossier` prints `refused (403): <reason>` | `supabase/migrations/20261004` `supabase/checks/ask.sql` `supabase/checks/dossiers.sql` `supabase/checks/access.sql` `apps/galaxy/src/ask/auth` `apps/galaxy/src/ask/cli-code.ts` `apps/galaxy/src/ask/cli-code.test.ts` `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` `apps/galaxy/src/ask/store` `apps/galaxy/src/ask/api-live.ts` `apps/galaxy/src/dossier/api` `kit/lib/ask/client.mjs` `kit/lib/ask/client.test.mjs` `kit/bin/commands/dossier` `kit/dist/` | — | 1 |
| s4 | The guide and the READMEs stop saying invite-only or private: `index.md`, `install.md` and `troubleshooting.md` lose the invite, read-access, `repository not found` and `gh auth setup-git` text; troubleshooting gains the `refused (403)` and "no workspace owns … yet" entries; the root README and the knowledge's ask-mode rule describe membership | `docs/guide/` `apps/galaxy/src/docs/docs.test.ts` `README.md` `apps/galaxy/README.md` `.omni-loop/knowledge/product/rules.md` `.omni-loop/knowledge/playbook/setup.md` | — | 1 |
| s2 | The terminal sign-in names the workspace: the CLI callback joins before it issues and never refuses by domain; `POST /api/ask/token` takes `repo`, answers the GitHub login and `workspace` (or the reason and the install link), with `email` optional; `omni signin` and `omni init`'s sign-in step print one of the spec's three green lines | `apps/galaxy/src/ask/cli-code.ts` `apps/galaxy/src/ask/cli-code.test.ts` `apps/galaxy/src/ask/cli-code-live.ts` `apps/galaxy/app/api/ask/token/` `apps/galaxy/app/auth/callback/` `apps/galaxy/src/data/sign-in` `kit/lib/ask/credentials` `kit/bin/commands/signin` `kit/lib/init/signin-step` `kit/dist/` | s1 | 2 |
| s3 | `omni ask on` and `omni ask status` make one call and print where questions land (`questions go to <workspace>'s page`) or the refusal's reason; ask mode still falls back to the terminal when a hook's call fails | `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` `apps/galaxy/app/api/ask/workspace/` `kit/bin/commands/ask` `kit/lib/ask/client.mjs` `kit/lib/ask/client.test.mjs` `kit/dist/` | s1, s2 | 3 |

**Shared ground.**
- `kit/dist/` (the committed bundle, rebuilt by `pnpm kit:build` whenever kit source changes) is
  declared by s1, s2 and s3, one per wave (1, 2, 3).
- `apps/galaxy/src/ask/cli-code.ts` and its test: s1 removes the two domain refusals, s2 moves the
  join before the issue and changes the token reply; waves 1 and 2.
- `apps/galaxy/src/ask/api.ts`, its test and `kit/lib/ask/client.mjs`: s1 turns the 500 into a 403
  and keeps the error text in the kit client; s3 adds the where-do-questions-land call; waves 1 and 3.
  s3 is blocked by s2 only for `kit/dist/`.
- s1 and s4 share wave 1 and no prefix: s4 is docs and knowledge only.

## Per slice: done when

**s1: membership is the gate**
- No file under `apps/galaxy/src` or `kit/` checks an email domain; `isCrewEmail` does not exist.
- `supabase/checks/` covers each row of the spec's table with named accounts: a member of acme on
  `acme/api` (acme); a member of acme on `globex/web` where globex is a workspace (refused, naming
  globex); a member of acme on `nobody/tools` (acme, the fallback); an account in no workspace
  (refused, no owner). `dossier_open()`, `dossier_push()` and an ask-session insert each follow it,
  and the check that `is_crew()` stays gone still passes.
- `authenticate()` lets through an account with a non-vertuoza email and one with no email.
- Opening an ask session with no workspace to go to answers 403 with the reason; never 500.
- `omni dossier open|push|link` print `refused (403): <the server's reason>` on a refusal, and
  still `refused (<status>)` when the reply carries none.

**s2: the terminal sign-in names the workspace**
- The CLI callback runs the join before it issues the code, and an account in no workspace still
  gets a code.
- `POST /api/ask/token` with `{code, repo}` answers `login`, `workspace: {slug, name} | null`, and
  `reason` plus the App's install link when refused or unowned; `email` only when the account has one.
  Without `repo` (an older kit) it answers `workspace: null` and no reason.
- A token reply without `email` is kept by the kit.
- `omni signin` and the init sign-in step print, and exit 0 on, each of: `signed in as <login> —
  <owner/repo> goes to <workspace>`, `… — no workspace owns <owner/repo> yet — install the Omni App:
  <link>`, `… — you are not a member of <workspace>, which owns <owner/repo>`.

**s3: ask mode says where questions land**
- `omni ask on` and `omni ask status`, against a stubbed page, print `questions go to <workspace>'s
  page` for a placed repository and the reason for a refused one; an unreachable page prints the
  existing state and still turns ask mode on.
- The hooks' fallback to the terminal is unchanged (`kit/lib/ask/hook.test.mjs` still green).

**s4: the guide**
- `docs.test.ts` asserts the guide carries neither "invite", "invite-only", the kit repository being
  "private", nor `gh auth setup-git`, and that troubleshooting has the `refused (403)` and "no
  workspace owns … yet" entries.
- The root `README.md` names neither `@vertuoza.com` Google sign-in nor read access to the vertuoza
  organisation; `rules.md` states ask mode is open to any workspace member.
