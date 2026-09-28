# Plan: one-click sign-up with GitHub

PRD #359, spec beside this plan (`spec.md`). The feature branch `feat/github-sign-up` merges into
`main` through the feature PR, whose body says `Closes #359`. Each slice is a sub-PR from
`feat/github-sign-up--<slice>` into the feature branch, whose body says `Part of #359`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The database admits any GitHub account, and nothing else, and can make a workspace from a GitHub App installation. Covers: the migration `20261001090000_github_sign_up.sql` (the hook passing provider `github` with or without an email and refusing every other provider with "Omni Loop signs in with GitHub only."; `workspaces.github_installation_id bigint unique` and `github_account_type`; `signup_requests` with its RLS; `create_workspace_from_installation` and `join_workspaces_by_github`, security definer, service role only); `supabase/checks/signup.sql` proving them, run by the `supabase` workflow | `supabase/migrations/20261001090000_` `supabase/checks/signup.sql` `.github/workflows/supabase.yml` | — | 1 |
| s6 | The omni-loop App can be installed by anyone, and stays silent where the loop is not installed. Covers: `app.yml` `public: true` and `setup_url` at galaxy's `/signup/installed`, permissions and events unchanged, its test; a test that a pull request on a repository without `.omni-loop` gets no outbox check (and the fix if it does); the App README's registration steps | `apps/omni-app/app.yml` `apps/omni-app/test/app-yml.test.mjs` `apps/omni-app/src/webhook/` `apps/omni-app/src/outbox-check/` `apps/omni-app/README.md` | — | 1 |
| s2 | Everyone signs in with GitHub, and joins the workspaces of their GitHub orgs. Covers: every sign-in surface (arcade, ask, the terminal's code card, knowledge, dossier) offering only GitHub with the `read:org` scope and no `hd`; the callbacks' `afterSignIn` reading the user's orgs once with the provider token (never stored), the pure joining rule, the server call to `join_workspaces_by_github`, and `link_github()` on every sign-in, best effort (ADR 0044); the migration `20261001100000_drop_join_domain.sql` dropping `join_domain` and `join_by_domain()`; `access.sql`, the seed, the fakes and the game's workspace read following | `supabase/migrations/20261001100000_` `supabase/checks/access.sql` `supabase/seed.sql` `apps/galaxy/app/auth/` `apps/galaxy/app/ask/callback/` `apps/galaxy/app/knowledge/callback/` `apps/galaxy/app/prd/` `apps/galaxy/src/data/sign-in` `apps/galaxy/src/data/github-orgs` `apps/galaxy/src/data/workspace.ts` `apps/galaxy/src/data/galaxy.fake.ts` `apps/galaxy/src/data/arcade.test.ts` `apps/galaxy/src/arcade/account-supabase` `apps/galaxy/src/arcade/account-demo` `apps/galaxy/src/ask/page/SignInCard` `apps/galaxy/src/ask/cli-code-card` `apps/galaxy/src/knowledge/KnowledgeSignIn` `apps/galaxy/src/dossier/page/` `game/sources/supabase` `game/cli/scripts.test.mjs` `game/cli/xp.test.mjs` `game/workflow.test.mjs` | s1 | 2 |
| s3 | The arcade has no GitHub link step, and a visitor with no workspace is sent to sign up. Covers: the onboarding flow without the link step (every account is a player at once); the outsider screen's copy without `@vertuoza.com`, pointing at `/signup` | `apps/galaxy/src/arcade/onboarding` `apps/galaxy/src/arcade/scenes/` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/deep-link` | s2 | 3 |
| s4 | A visitor with no workspace installs Omni Loop and lands in their workspace, or waits for their org's owner. Covers: `/signup` (the install link); `/signup/installed` fetching the installation with the App's JWT, checking the visitor against its account (their own login, or one of their orgs), calling `create_workspace_from_installation`, or recording a request; the waiting and error screens; `afterSignIn` completing pending requests whose org now has the App installed; the App's env vars, server only, in `.env.example`; galaxy's README (sign-in, joining, env vars, the dashboard steps) | `apps/galaxy/app/signup/` `apps/galaxy/src/signup/` `apps/galaxy/src/data/sign-in` `apps/galaxy/.env.example` `apps/galaxy/README.md` | s1, s2 | 3 |
| s5 | HOME's "SIGN UP WITH GITHUB" button works. Covers: the button enabled on the poster and the order form, starting the GitHub sign-in s2 made | `apps/galaxy/src/home/` | s2 | 3 |

**Shared ground.** One prefix is declared by more than one slice, and the waves keep it apart:

- `apps/galaxy/src/data/sign-in`: s2 (joining by org, linking) and s4 (completing pending
  requests), in waves 2 and 3.

Each migration is named in its slice's territory by its timestamp, so the two never meet: s1 is
additive (`20261001090000`), s2 drops what s1 made unnecessary (`20261001100000`). Between them, on
the feature branch only, Google sign-in is refused by the hook while galaxy still offers it; s2
removes it.

Wave 1 runs s1 and s6 together: the database and the App's manifest share nothing. Wave 3 runs
s3, s4 and s5: the arcade, the sign-up routes and HOME own disjoint files.

The ordering has reasons behind it:

- s2 follows s1: it calls `join_workspaces_by_github` and drops what s1's hook no longer reads.
- s3 follows s2: removing the link step is safe only once the callback links on every sign-in.
- s4 follows s1 and s2: it calls `create_workspace_from_installation`, and extends s2's
  `afterSignIn`.
- s5 follows s2: the button starts the GitHub sign-in s2 made.

## Per slice: done when

**s1**

- `supabase/checks/signup.sql` passes in the `supabase` workflow and proves: a `github` user with an
  email passes the hook, and one without an email passes; a `google` and an `email` user are refused
  with "Omni Loop signs in with GitHub only." (acceptance criteria 2, 3).
- `create_workspace_from_installation` makes a new org's workspace with its slug, name,
  installation and account type, and the caller as `owner`; for an org that already has a workspace
  with no installation (vertuoza) it records the installation and adds the caller as `member`; a
  replayed installation id creates nothing new; a personal account makes a solo workspace
  (acceptance criteria 6, 8).
- `join_workspaces_by_github` adds a user as `member` of exactly the workspaces whose `github_org`
  matches one of the given logins, case-insensitively, and that have an installation.
- `authenticated` and `anon` can execute neither function and cannot insert into `workspaces`,
  `workspace_members` or `signup_requests`; a user reads only their own `signup_requests`.

**s6**

- `app.yml` has `public: true` and a `setup_url` ending in `/signup/installed`; its test pins that,
  and still fails on any permission or event beyond today's (acceptance criterion 11).
- A test proves a `pull_request` on a repository without `.omni-loop` posts no outbox check.

**s2**

- No file under `apps/galaxy` calls Google sign-in or sets `hd`; each sign-in surface's test shows
  only "Sign in with GitHub" and asks for `read:org` (acceptance criterion 9).
- The joining rule's tests: the user's orgs and login against workspaces give the ones to join, with
  and without an installation, case-different logins, and no orgs.
- `afterSignIn`'s tests: it joins by org and links GitHub on every sign-in, never stores the
  provider token, and a failure of either is logged without failing the sign-in (acceptance
  criterion 4).
- `join_domain` and `join_by_domain()` no longer exist; `access.sql`, the seed, the fakes and the
  game's tests pass without them.

**s3**

- The onboarding tests show a signed-in account going straight to the fleet pick, with no link
  step.
- The outsider screen's test: no `@vertuoza.com`, and a link to `/signup` (acceptance criterion 10).

**s4**

- `/signup/installed`'s tests, against a stubbed GitHub: an install on an org the visitor belongs
  to creates the workspace with them as `owner` and redirects to `/play`; on their own account,
  a solo workspace; on an org they do not belong to, or another user's account, or a forged,
  missing or non-numeric `installation_id`, or GitHub answering an error, nothing is created and an
  error screen shows (acceptance criteria 1, 6, 7, 8).
- A `request` records a sign-up request and shows "Waiting for <org>'s owner"; `afterSignIn`'s test
  shows the next sign-in, once the org has the App, making the requester `owner` (acceptance
  criterion 5).
- `.env.example` lists the App's variables as server-only; no client bundle imports them.
- galaxy's README describes GitHub sign-in, joining by org and the dashboard steps.

**s5**

- HOME's tests: the button is enabled, no longer says "COMING SOON", and starts the GitHub sign-in
  (acceptance criteria 1, 10).
