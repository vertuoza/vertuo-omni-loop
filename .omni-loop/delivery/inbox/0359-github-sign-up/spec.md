---
prd: 359
title: One-click sign-up with GitHub
blocked-by: none
spec: file
---

# One-click sign-up with GitHub

**Date:** 2026-09-28 · **PRD:** #359 · **Touches:** `apps/galaxy` (sign-in, auth callback, a new
`/signup` route, HOME's button), `supabase/migrations` (the sign-up hook, workspaces, a new RPC and
table), `apps/omni-app/app.yml` (public, setup URL) · **Builds on:** #100 (workspaces), #261 (HOME)

This is the third of the front-door PRDs, after #141 (the design system) and #261 (HOME). It lights
up the "SIGN UP WITH GITHUB" button HOME ships disabled. It folds together the first two steps the
#100 roadmap listed separately: open sign-up, and each workspace owning a GitHub App installation.

## Problem

Nobody outside Vertuoza can get in, and a GitHub-only visitor cannot even create an account:

- Sign-in is Google only, forced to one domain with `hd: 'vertuoza.com'`, in five places
  (`src/arcade/account-supabase.ts`, `src/ask/page/SignInCard.tsx`, `src/ask/cli-code-card.tsx`,
  `src/knowledge/KnowledgeSignIn.tsx`, `src/dossier/page/DossierSignIn.tsx`). GitHub is only ever
  linked to a Google account (`linkIdentity`), never used to sign in.
- `hook_before_user_created` (`supabase/migrations/20260926120000_workspaces.sql:239`) refuses any
  account whose email domain is not a workspace's `join_domain`; the only one is `vertuoza.com`. A
  GitHub account with a hidden email is refused before its user row exists.
- Workspaces are created by migration only. `authenticated` cannot insert a workspace or a member,
  nothing ever sets `role = 'owner'`, and joining is `join_by_domain()`, by email domain.
- No workspace records a GitHub App installation. The omni-loop App (`apps/omni-app/app.yml`) is
  private to the vertuoza org.
- HOME's `SignUp()` (`src/home/poster/Poster.tsx:17`) is hard-disabled, "COMING SOON", and the
  outsider screen (`src/arcade/scenes/join.tsx`) says Omni Loop is for `@vertuoza.com` accounts.

## Solution

GitHub becomes the only way to sign in, and installing the omni-loop App is how a workspace is born.

```
HOME  [SIGN UP WITH GITHUB]
  │  signInWithOAuth(github, scopes: read:org)
  ▼
/auth/callback ── exchange code ── afterSignIn():
  │     1. join by GitHub org: the user's orgs (read with the provider token, once, never stored)
  │        plus their own login, against every workspace's github_org that has an installation
  │     2. complete the user's pending sign-up requests whose org now has the App installed
  │     3. link_github(): the account is a player at once
  ├─ member of a workspace ──▶ /play
  └─ member of none ─────────▶ /signup  "Install Omni Loop on your org"
                                  │  github.com/apps/<app slug>/installations/new
                                  ▼
                  GitHub's install page: pick an org or the personal account, pick repos
                                  ▼
/signup/installed?installation_id=…&setup_action=install|request
  ├─ install : fetch the installation with the App JWT → its account login and type
  │            verify the visitor owns that account (User) or belongs to it (Organization)
  │            create_workspace_from_installation() → /play
  └─ request : record a sign-up request → "Waiting for <org>'s owner" screen
```

galaxy owns all of it. omni-app changes only in its manifest; it never writes to Supabase.

## Decisions

1. **GitHub only.** Google sign-in is removed from every sign-in surface and disabled in the
   Supabase dashboard. The sign-up hook lets through a user created by the `github` provider,
   whatever their email or its absence, and refuses every other provider with "Omni Loop signs in
   with GitHub only."
2. **Existing members start fresh.** Nothing migrates Google accounts. A member who linked GitHub
   keeps their account when they sign in with it (Supabase matches the identity); anyone else gets a
   new account and rejoins by org membership.
3. **Joining is by GitHub org membership.** At sign-in the callback asks GitHub, with the provider
   token and the `read:org` scope, for the user's orgs, and adds the user as `member` of every
   workspace whose `github_org` is one of them (or is their own login) and that has an installation.
   `join_by_domain()` and `workspaces.join_domain` are dropped. Joining stays best effort (ADR 0044).
4. **The omni-loop App is made public.** One App: the installation that runs the outbox check is the
   one that owns the workspace. Its permissions and events do not change; `public: true` and a
   `setup_url` pointing at galaxy's `/signup/installed` do.
5. **galaxy creates the workspace, server side.** `/signup/installed` never trusts the
   `installation_id` in its URL alone: it fetches the installation with the App's JWT, and checks
   the visitor against its account. It then calls `create_workspace_from_installation`, a security
   definer function only the service role may run.
6. **One workspace per GitHub account.** The workspace's slug and name are the account's login,
   lowercased for the slug. Installing on an account that already has a workspace (Vertuoza's
   included) records the installation on it when it has none, and adds the visitor as `member`, never
   as a second owner. A new workspace makes its creator `owner`.
7. **A visitor who is not the org's admin** gets GitHub's install request, not an installation. The
   request is recorded; the next sign-in after the org's owner approves finishes it, and the
   requester becomes the workspace's owner.
8. **Personal accounts are allowed:** installing on your own account makes a solo workspace named
   after your login.
9. **Linking GitHub is no longer a step.** Every account signs in with GitHub, so the callback runs
   `link_github()` on every sign-in, and the arcade's "link your GitHub" step goes.
10. **A new workspace starts empty.** No sectors, no teams: `/play` shows it empty, with a pointer
    to Getting Started (`/docs`, PRD 346). Sectors and a projector per workspace are a later PRD.

## User stories

1. As a visitor on HOME, I press "SIGN UP WITH GITHUB", sign in with GitHub, install Omni Loop on my
   org, and land in a workspace named after it, as its owner.
2. As a visitor who is not my org's admin, I am told my org's owner must approve Omni Loop, and once
   they have, my next sign-in lands me in the workspace, as its owner.
3. As a developer without an org, I install Omni Loop on my own account and get a solo workspace.
4. As a member of an org that already uses Omni Loop, I sign in with GitHub and I am in its
   workspace, with nothing to install.
5. As a Vertuoza member, I sign in with GitHub, not Google, and I am in the vertuoza workspace.
6. As someone signing in from the terminal (`omni signin`), the ask page, the knowledge page or a
   dossier, I see only "Sign in with GitHub".

## Scope

**In:**

- A migration: `workspaces.github_installation_id bigint unique` and `workspaces.github_account_type`
  (`Organization` | `User`); `join_domain` and `join_by_domain()` dropped; the new hook;
  `signup_requests (user_id, github_org, created_at)`, readable by its own user, written by the
  service role; `create_workspace_from_installation(user_id, installation_id, login, type)`.
- galaxy: GitHub sign-in with `read:org` on every sign-in surface; `afterSignIn` joining by org,
  completing requests and linking; `/signup` and `/signup/installed`; HOME's button enabled; the
  outsider screen pointing at `/signup`; the arcade's link step removed.
- galaxy server config: `GITHUB_APP_ID`, `GITHUB_APP_SLUG` and `GITHUB_APP_PRIVATE_KEY`, server
  only, in `.env.example`.
- `apps/omni-app/app.yml`: `public: true`, `setup_url`; its test updated, permissions unchanged.
- A check that the omni-app webhook posts nothing on a repository without `.omni-loop`.
- Docs: galaxy's README (sign-in, joining, the new env vars and dashboard steps).

**Out:** sectors and the projector per workspace; inviting people by the owner; the admin app;
handling `installation.deleted` or `suspend`; migrating Google accounts; billing.

## Test seams

Tests sit beside the code (`*.test.ts` under `apps/galaxy/src/`, `*.test.mjs` in `apps/omni-app`),
run by `pnpm test`.

- **The joining rule**, a pure module: the user's orgs and login against workspaces → the workspaces
  to join (with and without an installation, a case-different login, no orgs).
- **`/signup/installed`**, against a stubbed GitHub: an install on an org the visitor belongs to, on
  their own account, on an org they do not belong to, on another user's account; a `request`; GitHub
  answering an error; a missing or non-numeric `installation_id`.
- **`create_workspace_from_installation`**, with realistic rows: a new org, an org that already has
  a workspace without an installation (Vertuoza), a replayed installation id, a personal account, a
  slug that would collide.
- **The hook**: `github` with an email, `github` without one, `google`, `email`.
- **Components**: HOME's button enabled and pointing at the sign-in, the pending screen, each
  sign-in card showing only GitHub, the outsider screen's copy.
- **`app.yml`**: `public: true` and `setup_url` set, permissions and events unchanged.
- **omni-app**: a `pull_request` on a repository without `.omni-loop` posts no check.

## Risks

A merge to `main` applies the migrations to production Supabase and deploys galaxy. It removes the
Google sign-in and email-domain joining: every existing session keeps working until it expires, but
a Google-only member cannot sign in again and starts fresh with GitHub (decision 2). By hand, on the
day it merges: enable the GitHub provider in Supabase with its production redirect URLs and disable
Google; make the omni-loop App public with its setup URL; add the App secrets to galaxy's Vercel
project. Making the App public lets any GitHub account install it on the repositories it picks; the
installation carries the outbox check and the retro, with `contents: write` on those repositories
only. **Rollback:** revert the feature PR (a new migration restores `join_domain` and the old hook),
re-enable Google in the dashboard, and make the App private again.

## Acceptance criteria

1. A visitor with no account presses HOME's "SIGN UP WITH GITHUB", signs in with GitHub, installs
   the App on an org they administer, and lands on `/play` in a workspace named after that org, as
   its `owner`, with the installation recorded on it.
2. A GitHub account with no public email can sign up.
3. A sign-in with any provider other than GitHub is refused with "Omni Loop signs in with GitHub
   only."
4. A member of an org that already has a workspace signs in with GitHub and is a `member` of it,
   with nothing to install; one who is in no such org lands on `/signup`.
5. An install request (the visitor is not the org's admin) shows the waiting screen and records the
   request; after the org's owner approves, the requester's next sign-in makes them the workspace's
   `owner`.
6. Installing on a personal account creates a workspace named after the login, with the visitor as
   `owner`.
7. `/signup/installed` with an installation whose account the visitor neither is nor belongs to, or
   a forged or unknown `installation_id`, creates nothing and shows an error screen.
8. Installing on an account that already has a workspace creates no second one; the visitor joins
   it as `member`, and the installation is recorded on it if it had none.
9. No sign-in surface (arcade, ask, knowledge, dossier, terminal) offers Google, and no code sets
   `hd`.
10. HOME's button is enabled; the outsider screen no longer mentions `@vertuoza.com` and points at
    `/signup`.
11. The omni-loop App's manifest is public with a setup URL, and its permissions and events are
    unchanged; a pull request on a repository without `.omni-loop` gets no outbox check.
