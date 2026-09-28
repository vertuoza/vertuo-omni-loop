---
prd: 459
title: Open the Omni page to every workspace member, not only @vertuoza.com
blocked-by: none
spec: file
---

# Open the Omni page to every workspace member, not only @vertuoza.com

**Date:** 2026-09-28 · **PRD:** #459 · **Follows:** PRD 359 (GitHub sign-up, a workspace per App
install), PRD 71 (ask mode), PRD 144 (question history), PRD 420 (easy install; the kit repository
is public)
· **Touches:**
- the galaxy app's terminal API: `apps/galaxy/src/ask/auth.ts`, `src/ask/cli-code.ts`,
  `src/ask/api.ts`, `src/dossier/api.ts`
- one migration under `supabase/migrations/` and its checks in `supabase/checks/`
- the kit's sign-in, ask and dossier commands: `kit/bin/commands/{signin,ask,dossier}.mjs`,
  `kit/lib/ask/{credentials,client}.mjs`, `kit/lib/init/signin-step.mjs`
- the guide (`docs/guide/{index,install,troubleshooting}.md`, `apps/galaxy/src/docs/docs.test.ts`)
  and the root `README.md`

## Problem

Someone outside Vertuoza who installs the kit gets a red sign-in step in `omni init`, no dossiers and
no ask mode, even after installing the Omni App on their own GitHub account or org. The database
already works by workspace membership: `public.is_crew()` was dropped when workspaces arrived
(`supabase/migrations/20260926120000_workspaces.sql`), and every policy checks `is_member()`. One
email-domain check is left in the app's TypeScript, and it sits in front of the whole terminal path:

- `isCrewEmail()` in `apps/galaxy/src/ask/auth.ts` answers **403 "Ask mode is for @vertuoza.com
  accounts only."** to every `/api/ask/*` call and to the dossier API (`src/dossier/api.ts`).
- `apps/galaxy/src/ask/cli-code.ts` refuses the terminal sign-in with the same text, twice: in the
  `/auth/callback?next=ask-cli` return, **before** the step that joins the person to their
  workspaces, and in `POST /api/ask/token`.

Around that check, four smaller things go wrong:

1. **A hidden GitHub email fails.** The token reply carries `email`, and the kit refuses a reply
   without one (`kit/lib/ask/credentials.mjs`). GitHub sign-in accepts accounts with no public email.
2. **An ask session opened by someone in no workspace answers 500** ("The ask database could not
   answer"): the row-level policy refuses the insert, and the API reports a database failure.
3. **A repository owned by someone else's workspace lands in the caller's first workspace.**
   `ask_session_workspace()` prefers the workspace whose `github_org` owns the repository among the
   caller's own, and otherwise takes the one they joined first, even when another workspace owns it.
4. **The terminal drops the server's reason.** `omni dossier` prints `refused (403)`; ask mode's
   hooks fall back to the terminal and print nothing, and `omni ask on` never calls the page.

The guide still says the app is invite-only while in beta, that the kit repository is private and
needs read access, and has a troubleshooting entry for npm's `repository not found` that sends people
to `gh auth setup-git`. The kit repository is public now (PRD 420).

## Solution

Workspace membership is the only gate. The rules for what a workspace is stay those of PRD 359:
a person with no org installs the Omni App on their own account and the workspace carries their
name; one org is the workspace; with several orgs, GitHub's install screen asks which account to
install on, and that choice is the workspace.

**Which workspace a terminal call goes to.** Every terminal call (the sign-in, ask mode, dossier
open, push and link) names its repository: `owner/repo`, the checkout's `repo.slug`. The database
decides, in one function:

| The repository's owner is… | The call goes… |
|---|---|
| a workspace the person belongs to | to that workspace |
| a workspace the person does not belong to | nowhere: refused with "you are not a member of <workspace>, which owns <owner/repo>" |
| no workspace at all | to the workspace the person joined first (the fallback) |
| no workspace, and the person belongs to none | nowhere: "no workspace owns <owner/repo> yet — install the Omni App: <link>" |

"Owns" means a workspace whose `github_org` equals the repository's owner, case-insensitive: the
match PRD 144 already uses. Nothing looks up which repositories an App install covers.

**The gate.** `isCrewEmail()` is deleted. `authenticate()` lets a signed-in account through; what it
may do is the database's call, through the table above. The terminal sign-in is never refused for
being in no workspace: the callback joins the person to their workspaces first
(`joinBeforeIssue`, as today for everyone else), then issues the code.

**What the terminal says.**

- `omni signin` and the sign-in step of `omni init` send the checkout's repository with the code,
  and `POST /api/ask/token` answers the GitHub login and the workspace that repository goes to
  (`workspace: {slug, name} | null`, and `reason` when it is refused or unowned). They print one of:
  - `signed in as <login> — <owner/repo> goes to <workspace name>`
  - `signed in as <login> — no workspace owns <owner/repo> yet — install the Omni App: <link>`
  - `signed in as <login> — you are not a member of <workspace name>, which owns <owner/repo>`

  All three end green: a sign-in is never undone because of where a repository goes.
- `omni ask on` and `omni ask status` make one call and print where questions land:
  `questions go to <workspace name>'s page`, or the refusal's reason. Ask mode still falls back to
  the terminal when a hook's call fails, as today.
- `omni dossier open|push|link` print the server's reason after the status:
  `refused (403): you are not a member of acme, which owns acme/api`.

**The guide.** It drops "An Omni Loop invite", "invite-only while in beta", "the kit's repository is
private… read access", the `repository not found` mention in `install.md`, "the account your invite
was sent to", and the whole "npm says `repository not found`" / `gh auth setup-git` troubleshooting
section. What you need becomes a GitHub account and the Omni App installed on your account or an org
of yours. Troubleshooting gains two entries: "`refused (403)`: you are not a member of …" (ask the
workspace's owner to invite you to the GitHub org, or install the App on your own account) and "no
workspace owns … yet" (install the App). The root `README.md` loses its "@vertuoza.com Google" and
"read access to the vertuoza organisation" lines.

## Decisions

1. **Invite-only is dropped.** Anyone who installs the GitHub App gets a workspace (PRD 359); membership
   is the only gate, and the guide stops saying invite-only.
2. **A terminal call names its repository,** and the database finds the workspace that owns it. A
   member of another workspace is refused with "you are not a member of <workspace>, which owns
   <repo>".
3. **Sign-in never refuses a GitHub account.** With no workspace owning the repository and none of
   the person's own, the sign-in ends green with the install hint; dossiers and ask mode start
   working once the App is installed.
4. **On the web, people see only their own workspaces' dossiers and ask pages.** This is already true
   (row-level security by `is_member()`); this PRD does not change it.
5. **The fallback stays.** A repository no workspace owns goes to the person's first workspace, as it
   does today. Chosen over refusing it: work in a personal or scratch repository keeps landing
   somewhere the person can read.
6. **The rule lives in the database only** (approach A). The app does not repeat the membership check
   in TypeScript, so the two cannot drift.
7. **"Owns" is the org-name match,** not the App install's repository list: no new GitHub call, and
   the table of repositories per install that does not exist stays out of scope.
8. **A hidden email is fine.** The token reply's `email` becomes optional, and the terminal shows the
   GitHub login.
9. **Vertuoza's workspace changes nothing.** Its people are members through the `vertuoza` GitHub
   org since PRD 359; an @vertuoza.com account outside that org is already refused by the database
   today (it passed the email check only to hit the 500), so nobody loses access. No workspace is
   seeded.

## User stories

1. As someone outside Vertuoza who installed the Omni App on my org, I run `omni init` and its
   sign-in step ends green, naming my workspace.
2. As that person, I push a dossier and turn ask mode on, and both land on my workspace's page.
3. As someone who signed in before anyone installed the App on my repository's owner, I see that no
   workspace owns it yet and a link to install the App.
4. As a member of workspace acme working in a clone of a repository another workspace owns, I am told
   I am not a member of that workspace, instead of my work landing in acme.
5. As a GitHub user who keeps my email private, I can sign in from the terminal.
6. As a Vertuoza colleague, nothing I do or see changes.
7. As a newcomer reading the guide, I am not told I need an invite or read access to a private
   repository.

## Scope

In:
- Deleting `isCrewEmail()` and its two refusals in `cli-code.ts`, and its use in `authenticate()`.
- One migration: a function that answers the table above for (person, repo) — the workspace, or a
  refusal naming the owning workspace — used by the ask-session trigger, `dossier_open()` and
  `dossier_push()` in place of `ask_session_workspace()`; and its rows in `supabase/checks/`.
- The ask API answering 403 with the reason, not 500, when a session has no workspace to go to.
- The token endpoint taking `repo` and answering the login and the workspace; `email` optional.
- The kit printing the workspace or the reason in `signin`, `init`'s sign-in step, `ask on|status`
  and `dossier`.
- The guide and README text above, and the tests that assert it.
- Comments and knowledge that still describe the email gate: `auth.ts`, `src/ask/page/sign-in.ts`,
  `app/ask/signin/page.tsx`, `supabase/config.toml`, `apps/galaxy/README.md`, the ask-mode rule in
  `.omni-loop/knowledge/product/rules.md`.

Out:
- The web pages: they already show only the person's workspaces.
- Which repositories an App install covers (a table, a webhook, a live lookup).
- Removing a membership when someone leaves a GitHub org.
- A workspace picker, invites, or any change to how workspaces are made (PRD 359).
- Seeding any workspace.

## Test seams

Following `omni kb show testing`: tests sit beside the code, and no test calls GitHub or Supabase.

- **Database** (`supabase/checks/`, run in CI per ADR-0028): each row of the table above, with named
  accounts — a member whose repository's owner is their workspace; a member of acme on a repository
  owned by workspace globex (refused, naming globex); a member on an unowned repository (their first
  workspace); an account in no workspace (refused with no owner / install hint). `dossier_open()`,
  `dossier_push()` and an ask-session insert each follow it. The check that `is_crew()` stays gone
  still passes.
- **App** (`apps/galaxy/src/ask/*.test.ts`, `src/dossier/*.test.ts`): `authenticate()` lets a
  non-vertuoza, and an email-less, account through; the CLI callback joins before it issues and
  never refuses for the domain; `POST /api/ask/token` answers `{login, workspace}` for each row, and
  without `email`; opening a session with no workspace answers 403 with the reason, not 500.
- **Kit** (`kit/bin/*.test.mjs`, `kit/lib/ask/*.test.mjs`, with a stubbed page): `omni signin` and
  the init step print each of the three lines and exit 0; `omni ask on|status` print the workspace or
  the reason; `omni dossier` prints `refused (403): <reason>`; a token reply without `email` is kept.
- **Guide** (`apps/galaxy/src/docs/docs.test.ts`): the assertions on "An Omni Loop invite." and the
  `gh auth setup-git` block are replaced by assertions that the guide carries neither "invite",
  "private" nor `gh auth setup-git`, and that troubleshooting carries the two new entries.

## Risks

- **Publishes** (per `omni kb show releasing`): the migration reaches production Supabase through the
  `supabase` workflow on merge; the kit's `bin` and plugin change with the next `v0.0.N`; the galaxy
  app deploys on merge.
- **Access widens on purpose:** any GitHub account can reach the terminal API. What it may write is
  still bounded by membership in the database, the only gate; the checks in `supabase/checks/` are
  what keeps that true.
- **A Vertuoza member whose sessions today land in `vertuoza` by the fallback** keeps that behaviour:
  the fallback is unchanged. Only a repository owned by *another* workspace is refused.
- **An old kit against the new app:** it sends no `repo` to the token endpoint and expects `email`.
  The endpoint accepts a missing `repo` (it answers `workspace: null` without a reason) and still
  sends `email` when the account has one, so an unupdated kit signs in as before.
- **Rollback:** revert the feature PR; a follow-up migration restores `ask_session_workspace()` as the
  trigger's and the dossier functions' workspace pick. No data changes shape.

## Acceptance criteria

1. An account with a non-vertuoza email, or none, that belongs to a workspace, can sign in from the
   terminal, open an ask session and push a dossier for a repository its workspace owns.
2. A member of one workspace, calling for a repository another workspace owns, is refused with
   "you are not a member of <workspace>, which owns <owner/repo>", in the terminal and with HTTP 403.
3. A call for a repository no workspace owns goes to the caller's first workspace.
4. A signed-in account in no workspace, calling for an unowned repository, is told "no workspace owns
   <owner/repo> yet — install the Omni App: <link>"; its sign-in still ends green.
5. `omni init`'s sign-in step ends green in every case above and names the workspace or the reason.
6. Opening an ask session with no workspace to go to answers 403 with the reason, never 500.
7. No file under `apps/galaxy/src` or `kit/` checks an email domain; `supabase/checks` still fails if
   `is_crew()` returns.
8. The guide says neither "invite", "invite-only", "private" (of the kit repository) nor
   `gh auth setup-git`, and troubleshooting has the `refused (403)` and "no workspace owns … yet"
   entries.
9. A Vertuoza colleague's sign-in, ask mode, dossiers and web pages behave as before.
