---
prd: 2915
title: A job an API key sends runs as the key's own GitHub App, when the key holds one
blocked-by: none
spec: file
phase0: server
areas: [access]
---

## Problem

PRD 2433 let an owner attach a GitHub App to an API key, so that an app sending bug fixes through the
public API sees its fixes signed by its own bot. PRD 2573 then made every runner job run as the Omni
App, the App this deployment signs in with, and stopped reading the key's App: it stays attached,
unused.

So an app that attached its own App sends a bug fix, and the comments, the branch, the commits and the
pull request read as the Omni bot, not as its own. Its users cannot tell its fixes from any other Omni
job, and the guide's "Run as your own GitHub App" promises nothing any more. Two things still disagree
with what runs:

- the public API checks the key's App at send (`github_app_not_installed`, `github_app_permissions`),
  though the job never runs as it;
- BR-ACCESS-1 states that a key's job "runs as the key's GitHub App".

## Solution

A job runs as one of two Apps, decided at every mint (at claim and at every refresh), never as a
person:

- **The key's App,** when the job's key holds a GitHub App, or the job was queued while it did
  (`needs_app`, as `api_key_github_app_of_job()` answers today; BR-ACCESS-2).
- **The Omni App,** for every other job: a job sent from the Omni page or by the Omni app, and a job of
  a key that holds no App and held none when the job was queued. Unchanged from PRD 2573.

1. **Minting from the key's App.** For a job that runs as the key's App, the server:
   - opens the key's sealed private key under `SECRETS_MASTER_KEY` (the secret box,
     `apps/galaxy/src/jev/secret-box.ts`), in its own memory only;
   - finds the App's installation on the job's repository and checks it holds write access to
     contents, pull requests and issues;
   - mints an installation token with the reach every job has today (`reachOf`): the job's repository
     and, for a skill that spans the product (a mega bug fix, an ultra skill), the product's other
     repositories within the key's allow-list that the installation holds (BR-ACCESS-1,
     BR-PRODUCT-63). Its permissions stay `APP_PERMISSIONS`: contents, pull requests and issues write,
     metadata read;
   - answers the claim with the key's App's bot, `<slug>[bot]` and
     `<bot id>+<slug>[bot]@users.noreply.github.com`, read from the row stored when the App was
     attached, with no call to GitHub;
   - records the mint in the key's `last_token_at`, so an owner sees `last token <date>` move again on
     Settings › API keys. A mint whose record fails still answers the job.
2. **A key's App that cannot mint fails the job.** The job ends `failed`, `github app: <why>`, before
   any runner starts it, and is never answered without `github`. The whys:
   - `the key's App was removed`: the job was queued while its key held an App, which an owner has
     since removed;
   - `this Omni server has no key to open the App's private key`: no `SECRETS_MASTER_KEY`, or a
     malformed one;
   - `the App's private key could not be opened`: sealed under another master key, or garbled;
   - `the App is not installed on <repo>`, `the App's installation lacks write access to <permission>`,
     or the first line of GitHub's own answer, as the Omni App's mint fails today.

   A key that no longer works (revoked, or its maker left) still fails its job first, as today
   (BR-PRODUCT-64). A job of a key's App never falls back to the Omni App, and never to a person.
3. **Refresh.** `githubToken` follows the same rule: a job that runs as the key's App gets a fresh token
   of the key's App, for the same repositories, while the job is claimed or running, as today (PRD 2809
   s3). A refresh that keeps failing until the token expires fails the job, as today.
4. **At send.** The public API's check of a key's App (422 `github_app_not_installed` or
   `github_app_permissions`, nothing queued) stays as it is for a bug fix, on the job's repository. For
   a skill that spans the product, sent by a key that holds an App (today `POST /v1/mega-bug-fixes`), it
   checks every repository the job's token would reach: the plan repository and each repository of its
   product within the key's allow-list. The first one the App is not installed on, or lacks a
   permission on, is refused, naming that repository. A key that holds no App is not checked, as today.
5. **The guide.**
   - `docs/guide/api.md` › Run as your own GitHub App says that a key's App signs its jobs, that a mega
     bug fix's send checks every repository of its product, and lists the failures above.
   - `docs/guide/runners.md` says a job runs as the Omni App, or as its key's App when the key holds
     one.
   - `apps/galaxy/src/public-api/openapi.ts`'s 422 text says the check covers a mega bug fix's
     product.

**What GitHub shows** for a job of a key's App, as PRD 2433 §11 set it: the comments and labels the job
writes on the bug's issue, the branch, the commits (author and committer), the pull request and its
status comment, and the release of the job's claims are the key's App's bot's. These stay as they are:

- the pull request's sender line, `Sent through the Omni API by API key <name> on runner <runner>`;
- the commits' `Co-Authored-By` and Omni-man trailers;
- what Omni's own GitHub App does: its checks, the outbox check, Omni-man's comments.

**Unchanged:**

- the runner: it already runs any App's grant (`kit/lib/runner/github-app.ts`), its credential helper,
  its `gh` and its release of claims included;
- Settings › API keys, save the `last token` date, which moves again;
- the database: `api_key_github_app_of_job()` already answers the sealed key, `needs_app` and the
  allow-list, and `api_key_github_app_minted()` still records a mint. No migration.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | galaxy | `GithubDeps.master`, `GithubDeps.open` (the master key, and opening a key's sealed private key) | no written convention: follows `GithubDeps` ← apps/galaxy/src/runners/runners.service.ts:115, the two members PRD 2433 had there |
| vertuo-omni-loop | galaxy | the whys `the key's App was removed`, `this Omni server has no key to open the App's private key`, `the App's private key could not be opened` | no written convention: follows `KEY_STOPPED` ← apps/galaxy/src/runners/runners.service.ts:165, in PRD 2433's words |
| vertuo-omni-loop | public API | `github_app_not_installed`, `github_app_permissions`, reused: no new code | ← apps/galaxy/src/public-api/public-api.contract.ts:303 |

## Decisions

Taken with the person during the brainstorm:

- **The key's App signs its jobs.** The person chose it over an opt-in switch per key, and over keeping
  PRD 2573 as it is. It reverses PRD 2573's "Always the Omni App" for the keys that hold an App;
  every other job keeps the Omni App. PRD 2573's single bot bought one mint path, one App to install,
  and no third party's private key opened at each claim; a job of a key's App now needs that App
  installed on its repositories (Risks). pierrederval, who merged PRD 2573, is named here and not
  notified, as the person chose.
- **A key's App that cannot mint fails the job.** The person chose it over falling back to the Omni App
  (the fix would run, but the signature promised to the calling app would not be kept, and only the
  pull request would show it), and over failing with a "send again as the Omni App" action.
- **A spanning skill's send checks every repository of its product.** The person chose it over the plan
  repository alone, as PRD 2433 checked: a target the App misses is seen before the run, not as a push
  that fails half-way.
- **No proof video:** the person said no. What changes shows on GitHub, not in the app's preview. e2e is
  off here.
- **The voice.** persona:B-E DEv objected: "Since PRD 2573 the other app's private key slept in your
  database. Now Omni opens it again at every claim and every refresh: one leak of the master key and
  anyone pushes as that app wherever it is installed." Settled `accepted`:
  - the key stays sealed at rest and is opened only in the server's memory;
  - tokens last an hour, with three permissions, on the job's repositories only;
  - `last token <date>` moves again, so an owner sees each use;
  - revoking the key deletes its sealed private key (PRD 2433's answer to the same objection).

Taken alone while writing, each the most reversible reading of the approved design:

- **The App is read at every mint, from the key as it is then.** An owner who replaces a key's App while
  one of its jobs runs: the later tokens come from the new App, and the job's commits keep the author
  it started with, set when the job started. Pinning the job's App at claim would need a migration for
  a rare case.
- **A job queued while its key held an App, the App removed since, fails** (`the key's App was
  removed`), as PRD 2433 §10 and BR-ACCESS-2 had it, and as the person's "fail, never fall back" reads.
- **The key App's bot is read from its stored row**, not asked of GitHub: PRD 2433 stored its slug and
  bot id when the App was attached, checked against GitHub then.

## User stories

- As an app that sends bug fixes through the public API with a key holding my own GitHub App, I want
  the fix's pull request, commits and comments signed by my bot, so that my users see my fixes as mine.
- As a workspace owner, I want to read on Settings › API keys when a key's App last made a token, so
  that I notice a key used where I did not expect it.
- As the sender of a mega bug fix, I want a send refused at once when my App misses one of the
  product's repositories, so that I fix the installation before a run stops half-way.
- As a member who sends a job from the Omni page, I want nothing to change: my jobs still sign as the
  Omni bot.

## Scope

In:

- `apps/galaxy/src/runners/`: `runners.service.ts` (which App mints at claim and at `githubToken`, the
  key App's grant, recording the mint), `runners.github.ts` and `runners.live.ts` (opening a sealed key
  under `SECRETS_MASTER_KEY`), their tests and fixtures.
- `apps/galaxy/src/public-api/`: `public-api.service.ts` (a spanning skill's send checks every
  repository of its product), the repository read it needs, `public-api.live.ts`, `openapi.ts`'s 422
  text, their tests, and whatever `pnpm schemas:verify` regenerates.
- `docs/guide/api.md`, `docs/guide/runners.md`.

Out: the runner and the kit (`kit/`), the database (no migration), Settings › API keys' form, a
person's own terminal, a send-time check of the Omni App's installation, and removing the key's App
feature.

## Test seams

- `apps/galaxy/src/runners/`, beside PRD 2573's grant tests, with GitHub stubbed through `GithubDeps`
  and the store's fake holding `KEY_APP` (`acme-bugs`):
  - a job of a key holding an App is answered with that App's grant: its bot `acme-bugs[bot]`, its
    token minted on its installation, never the Omni App's;
  - a job of a key with no App, and a job sent from the page, are answered with the Omni App's grant,
    as today;
  - a spanning skill of a key's App reaches the product's repositories within the allow-list that its
    installation holds, and no other;
  - each failure ends the job `failed` with its why and answers no runner: the App removed after the
    job was queued, no master key, a key that cannot be opened, not installed, lacking a permission,
    GitHub refusing; a revoked key's job still fails first;
  - the mint is recorded for the key's `last token`, and a record that fails still answers the job;
  - `githubToken` refreshes a key App's job from the key's App.
- `apps/galaxy/src/public-api/public-api.service.test.ts`: a mega bug fix sent by a key whose App misses
  one repository of the product within the allow-list is refused 422 `github_app_not_installed` naming
  it, and nothing is queued; one lacking a permission there, `github_app_permissions`; a repository
  outside the allow-list is not checked; a key with no App is not checked.
- `pnpm schemas:verify`, when the OpenAPI text changes.
- BR-ACCESS-1's proof (`apps/galaxy/src/runners/runners.github-repositories.test.ts`) stays green, and
  is left to its owner.

No test reaches GitHub or Supabase (testing form). A test private key or token is built at runtime,
never written whole.

## Risks

- **Publishes:** on the next deploy of the galaxy app, every job of a key that holds an App runs as that
  App. A key whose App is not installed on a repository its jobs reach, or lacks a permission there,
  now has those jobs fail (`github app: …`) where they ran as the Omni App since PRD 2573; a mega bug
  fix is refused at send instead. **Before the merge**, an owner of each key that holds an App checks
  that its installation covers the repositories the key's jobs reach (a manual step, no slice does it;
  the feature PR's body names it until it is done).
- **The master key:** the deployment needs `SECRETS_MASTER_KEY`, already set for Jev and for attaching
  an App. Without it every job of a key's App fails, saying so.
- **A third party's private key is opened again** at every mint of its jobs (Decisions, the voice). It
  stays sealed at rest, is opened in the server's memory only, and never reaches a runner, a line or a
  log (L-GDPR-2).
- **A fix that changes a workflow file** fails to push, as it does today: every token, the Omni App's
  or a key's App's, holds `APP_PERMISSIONS`, which has no `workflows`.
- **Replacing a key's App mid-job** mixes two Apps in one job's history (Decisions).
- **Rollback:** revert the feature PR's merge; every job runs as the Omni App again, as PRD 2573 left
  it. Nothing stored needs undoing (no migration); `last_token_at` keeps the dates written meanwhile.
- **The laws it bears on:** BR-ACCESS-1 ("runs as the key's GitHub App") becomes true to its words again;
  its owner, nicojustdev, keeps its wording. BR-ACCESS-2's `needs_app` mark decides a job queued while
  its key held an App. BR-PRODUCT-63's reach and BR-PRODUCT-64's failure are kept as the mint keeps
  them today.
- The locked laws: none touched.

## Acceptance criteria

- A bug fix sent through the public API by a key that holds a GitHub App opens its pull request, pushes
  its commits and writes its comments as that App's bot, `<slug>[bot]`, its commits' author being the
  bot's noreply address.
- A job sent from the Omni page, and a job of a key with no App, still run as the Omni App.
- A job of a key's App whose App is not installed on its repository ends `failed`, `github app: the App
  is not installed on <repo>`, and no runner starts it.
- No job of a key's App ever runs as the Omni App or as a person: each failure of its mint ends the job
  `failed`, `github app: <why>`.
- A job queued while its key held an App, the App removed since, ends `failed`, `github app: the key's
  App was removed`.
- On a deployment with no `SECRETS_MASTER_KEY`, a job of a key's App ends `failed`, `github app: this
  Omni server has no key to open the App's private key`.
- A running job of a key's App gets its fresh token from the key's App.
- After a job of a key's App is claimed, an owner reads `last token <date>` on Settings › API keys with
  the claim's date.
- A mega bug fix sent by a key whose App is not installed on one repository of its product within the
  key's allow-list is refused 422 `github_app_not_installed`, naming that repository, and nothing is
  queued.
- `docs/guide/api.md` › Run as your own GitHub App says the key's App signs its jobs, and no longer says
  it is unused.
